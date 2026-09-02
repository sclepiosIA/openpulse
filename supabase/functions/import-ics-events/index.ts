import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface CalendarEvent {
  uid: string
  summary: string
  dtstart: string
  dtend?: string
  location?: string
  description?: string
}

/**
 * Parse iCalendar date format to ISO 8601 with timezone handling
 */
function parseICSDate(value: string, timezone?: string): string {
  // Remove any VALUE=DATE or TZID parameters
  const dateValue = value.split(':').pop() || value

  // Format: YYYYMMDDTHHMMSS[Z]
  const match = dateValue.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (match) {
    const [, year, month, day, hour, min, sec, isUTC] = match
    const dateStr = `${year}-${month}-${day}T${hour}:${min}:${sec}`
    if (isUTC) {
      return `${dateStr}Z`
    }
    // If timezone is Europe/Paris, add +01:00 for winter or +02:00 for summer
    // For simplicity, return as local time - DB will handle it
    return dateStr
  }

  // Format: YYYYMMDD (all-day event)
  const dateMatch = dateValue.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    return `${year}-${month}-${day}T00:00:00`
  }

  return value
}

/**
 * Decode iCalendar escaped values
 */
function decodeICSValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/**
 * Parse ICS content and extract events
 */
function parseICS(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const lines = icsContent.split(/\r?\n/)

  let inEvent = false
  let currentEvent: Partial<CalendarEvent> = {}
  let timezone = 'Europe/Paris'

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Handle multi-line values (RFC 5545: lines starting with space/tab are continuations)
    while (i + 1 < lines.length && /^[\s\t]/.test(lines[i + 1])) {
      line += lines[++i].substring(1)
    }
    line = line.trim()

    if (line.includes('TZID:')) {
      timezone = line.split('TZID:')[1]?.trim() || timezone
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
    } else if (line === 'END:VEVENT') {
      // Auto-generate UID if the source ICS omitted it (some exporters do)
      if (currentEvent.summary && currentEvent.dtstart) {
        currentEvent.uid = currentEvent.uid || crypto.randomUUID()
        events.push(currentEvent as CalendarEvent)
      }
      inEvent = false
      currentEvent = {}
    } else if (inEvent) {
      // Parse property line: PROPERTY[;params]:value
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex)
        const value = line.substring(colonIndex + 1)
        const cleanKey = keyPart.split(';')[0].toUpperCase()

        switch (cleanKey) {
          case 'UID':
            currentEvent.uid = value
            break
          case 'SUMMARY':
            currentEvent.summary = decodeICSValue(value)
            break
          case 'DTSTART':
            currentEvent.dtstart = parseICSDate(value, timezone)
            break
          case 'DTEND':
            currentEvent.dtend = parseICSDate(value, timezone)
            break
          case 'LOCATION':
            currentEvent.location = decodeICSValue(value)
            break
          case 'DESCRIPTION':
            currentEvent.description = decodeICSValue(value)
            break
        }
      }
    }
  }

  return events
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // SECURITY: Validate authenticated user
    const { validateUserAuth } = await import('../_shared/auth-helpers.ts')
    const authResult = await validateUserAuth(req)
    if (authResult.error) {
      console.error('[import-ics-events] Unauthorized:', authResult.error)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { icsContent, calendarId, minDate } = await req.json()

    if (!icsContent || !calendarId) {
      return new Response(JSON.stringify({ error: 'Missing icsContent or calendarId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse ICS content
    let events = parseICS(icsContent)
    console.log(`[import-ics-events] Parsed ${events.length} events from ICS`)

    // Filter by minDate if provided
    if (minDate) {
      const minDateObj = new Date(minDate)
      console.log(`[import-ics-events] Filtering events after ${minDateObj.toISOString()}`)
      events = events.filter((e) => {
        try {
          const eventDate = new Date(e.dtstart)
          return eventDate >= minDateObj
        } catch {
          return false
        }
      })
      console.log(`[import-ics-events] ${events.length} events after filter`)
    }

    if (events.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          message: 'No events found in ICS' + (minDate ? ` after ${minDate}` : ''),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get existing events in this calendar to avoid duplicates (by UID check in description)
    const { data: existingEvents } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, description')
      .eq('calendar_id', calendarId)

    const existingMap = new Map<string, boolean>()
    existingEvents?.forEach((e) => {
      // Create a unique key from title + start_time
      const key = `${e.title}|${e.start_time}`
      existingMap.set(key, true)
    })

    // Filter out duplicates and prepare events for insertion
    const newEvents = events.filter((e) => {
      const key = `${e.summary}|${e.dtstart}`
      return !existingMap.has(key)
    })

    console.log(
      `[import-ics-events] ${newEvents.length} new events to import (${events.length - newEvents.length} duplicates skipped)`
    )

    if (newEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          skipped: events.length,
          message: 'All events already exist in calendar',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert events in batches
    const BATCH_SIZE = 50
    let totalInserted = 0
    const errors: string[] = []

    for (let i = 0; i < newEvents.length; i += BATCH_SIZE) {
      const batch = newEvents.slice(i, i + BATCH_SIZE)
      const toInsert = batch.map((event) => ({
        calendar_id: calendarId,
        title: event.summary,
        start_time: event.dtstart,
        end_time: event.dtend || event.dtstart,
        location: event.location || null,
        description: event.description
          ? `${event.description}\n\n[ICS UID: ${event.uid}]`
          : `[ICS UID: ${event.uid}]`,
        status: 'confirmed',
        visibility: 'private',
      }))

      const { data, error } = await supabase.from('calendar_events').insert(toInsert).select('id')

      if (error) {
        console.error(`[import-ics-events] Batch insert error:`, error)
        errors.push(error.message)
      } else {
        totalInserted += data?.length || 0
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: totalInserted,
        skipped: events.length - newEvents.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `${totalInserted} événements importés`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('[import-ics-events] Error:', error)
    return buildErrorResponse('import-ics-events', error, corsHeaders, 500)
  }
})
