import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface CalendarEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend?: string;
  location?: string;
  description?: string;
}

// Parse ICS date formats
function parseICSDate(value: string): string {
  const clean = value.replace(/[^0-9TZ]/g, '');
  
  if (clean.length >= 15) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(9, 11);
    const minute = clean.substring(11, 13);
    const second = clean.substring(13, 15);
    const isUTC = clean.endsWith('Z');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${isUTC ? 'Z' : ''}`;
  } else if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00`;
  }
  
  return value;
}

// Decode ICS escaped values
function decodeICSValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// Parse ICS content
function parseICS(content: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = content.split(/\r?\n/);
  let currentEvent: Partial<CalendarEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line continuations
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.summary && currentEvent.dtstart) {
        currentEvent.uid = currentEvent.uid || crypto.randomUUID();
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        const key = keyPart.split(';')[0];

        switch (key) {
          case 'UID':
            currentEvent.uid = value;
            break;
          case 'SUMMARY':
            currentEvent.summary = decodeICSValue(value);
            break;
          case 'DTSTART':
            currentEvent.dtstart = parseICSDate(value);
            break;
          case 'DTEND':
            currentEvent.dtend = parseICSDate(value);
            break;
          case 'LOCATION':
            currentEvent.location = decodeICSValue(value);
            break;
          case 'DESCRIPTION':
            currentEvent.description = decodeICSValue(value);
            break;
        }
      }
    }
  }

  return events;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { subscriptionId, subscriptionUrl, calendarId } = await req.json();

    if (!subscriptionUrl || !calendarId) {
      return new Response(
        JSON.stringify({ error: 'Missing subscriptionUrl or calendarId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-calendar-subscription] Fetching from ${subscriptionUrl}`);

    // Fetch the external calendar with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let icsResponse: Response;
    try {
      icsResponse = await fetch(subscriptionUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Marque-IA/1.0 Calendar-Sync'
        }
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      const errorMsg = error.name === 'AbortError' ? 'Timeout fetching calendar' : error.message;
      
      // Update subscription status
      if (subscriptionId) {
        await supabase
          .from('calendar_subscriptions')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: `error: ${errorMsg}`
          })
          .eq('id', subscriptionId);
      }
      
      throw new Error(errorMsg);
    }

    if (!icsResponse.ok) {
      const errorMsg = `HTTP ${icsResponse.status}: ${icsResponse.statusText}`;
      
      if (subscriptionId) {
        await supabase
          .from('calendar_subscriptions')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: `error: ${errorMsg}`
          })
          .eq('id', subscriptionId);
      }
      
      throw new Error(errorMsg);
    }

    const icsContent = await icsResponse.text();
    console.log(`[sync-calendar-subscription] Received ${icsContent.length} bytes`);

    // Parse events
    const events = parseICS(icsContent);
    console.log(`[sync-calendar-subscription] Parsed ${events.length} events`);

    // Filter to future events only (last 30 days and future)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const relevantEvents = events.filter(e => {
      try {
        const eventDate = new Date(e.dtstart);
        return eventDate >= thirtyDaysAgo;
      } catch {
        return false;
      }
    });

    console.log(`[sync-calendar-subscription] ${relevantEvents.length} events in relevant date range`);

    // Get existing events to check for duplicates
    const { data: existingEvents } = await supabase
      .from('calendar_events')
      .select('id, title, start_time')
      .eq('calendar_id', calendarId);

    const existingSet = new Set(
      existingEvents?.map(e => `${e.title}|${e.start_time}`) || []
    );

    // Filter new events
    const newEvents = relevantEvents.filter(event => {
      const key = `${event.summary}|${event.dtstart}`;
      return !existingSet.has(key);
    });

    console.log(`[sync-calendar-subscription] ${newEvents.length} new events to insert`);

    let imported = 0;
    let errors: string[] = [];

    // Insert new events in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < newEvents.length; i += BATCH_SIZE) {
      const batch = newEvents.slice(i, i + BATCH_SIZE);
      
      const eventsToInsert = batch.map(event => ({
        calendar_id: calendarId,
        title: event.summary.substring(0, 255),
        start_time: event.dtstart,
        end_time: event.dtend || event.dtstart,
        location: event.location?.substring(0, 500) || null,
        description: event.description?.substring(0, 5000) || null,
        status: 'confirmed',
        visibility: 'default',
        all_day: !event.dtstart.includes('T') || event.dtstart.endsWith('T00:00:00')
      }));

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(eventsToInsert)
        .select('id');

      if (error) {
        console.error('[sync-calendar-subscription] Batch insert error:', error);
        errors.push(error.message);
      } else {
        imported += data?.length || 0;
      }
    }

    // Update subscription status
    if (subscriptionId) {
      await supabase
        .from('calendar_subscriptions')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: errors.length > 0 
            ? `partial: ${imported} imported, ${errors.length} errors` 
            : `success: ${imported} imported`
        })
        .eq('id', subscriptionId);
    }

    console.log(`[sync-calendar-subscription] Completed: ${imported} events imported`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: relevantEvents.length,
        skipped: relevantEvents.length - newEvents.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('sync-calendar-subscription', error, corsHeaders, 500);
  }

});
