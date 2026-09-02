/**
 * Client-side iCalendar (ICS) parser
 * Parses ICS content and extracts calendar event data
 */
import { debug } from '@/lib/debug'

export interface ParsedCalendarEvent {
  uid: string
  summary: string
  dtstart: string
  dtend?: string
  location?: string
  description?: string
  organizer?: string
  attendees?: string[]
}

/**
 * Decode quoted-printable content (RFC 2045)
 * Handles =XX hex sequences and soft line breaks
 */
function decodeQuotedPrintable(content: string): string {
  return (
    content
      // Remove soft line breaks (= at end of line)
      .replace(/=\r?\n/g, '')
      // Decode hex sequences (=XX)
      .replace(/=([0-9A-Fa-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  )
}

/**
 * Pre-process email body to extract ICS content
 * Handles quoted-printable encoding and multipart boundaries
 */
function extractICSContent(rawContent: string): string {
  let content = rawContent

  // Check if content contains quoted-printable ICS data
  if (content.includes('BEGIN=3AVCALENDAR') || content.includes('BEGIN:VCALENDAR')) {
    // Find the ICS section - look for BEGIN:VCALENDAR or encoded version
    const icsStartEncoded = content.indexOf('BEGIN=3AVCALENDAR')
    const icsStartPlain = content.indexOf('BEGIN:VCALENDAR')
    const icsStart = icsStartEncoded >= 0 ? icsStartEncoded : icsStartPlain

    if (icsStart >= 0) {
      // Find the end
      const icsEndEncoded = content.indexOf('END=3AVCALENDAR', icsStart)
      const icsEndPlain = content.indexOf('END:VCALENDAR', icsStart)
      let icsEnd = -1

      if (icsEndEncoded >= 0 && icsEndPlain >= 0) {
        icsEnd = Math.min(icsEndEncoded, icsEndPlain)
      } else {
        icsEnd = icsEndEncoded >= 0 ? icsEndEncoded : icsEndPlain
      }

      if (icsEnd >= 0) {
        // Include the END marker (approximately 20 chars for END:VCALENDAR + potential encoding)
        content = content.substring(icsStart, icsEnd + 25)
      } else {
        content = content.substring(icsStart)
      }
    }
  }

  // Decode quoted-printable if needed
  if (content.includes('=3A') || content.includes('=0D') || content.includes('=0A')) {
    content = decodeQuotedPrintable(content)
  }

  return content
}

/**
 * Parse iCalendar date format to ISO 8601
 * Formats:
 * - 20250115T140000Z (UTC)
 * - 20250115T140000 (local)
 * - TZID=Europe/Paris:20250115T140000 (with timezone)
 * - VALUE=DATE:20250115 (all-day)
 */
function parseICSDate(value: string): string {
  let dateValue = value

  // Handle TZID or VALUE parameters: "TZID=Europe/Paris:20250120T153000" or "VALUE=DATE:20250120"
  if (value.includes(':')) {
    // Take everything after the last colon (the actual date value)
    dateValue = value.split(':').pop() || value
  }

  // Remove any remaining non-numeric prefix (shouldn't happen but just in case)
  dateValue = dateValue.replace(/^[^0-9]+/, '').trim()

  // Format: YYYYMMDDTHHMMSS[Z]
  const match = dateValue.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (match) {
    const [, year, month, day, hour, min, sec, isUTC] = match
    const dateStr = `${year}-${month}-${day}T${hour}:${min}:${sec}`
    return isUTC ? `${dateStr}Z` : dateStr
  }

  // Format: YYYYMMDD (all-day event)
  const dateMatch = dateValue.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    return `${year}-${month}-${day}T00:00:00`
  }

  // If nothing matched, try to extract any date-like pattern
  const fallbackMatch = dateValue.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/)
  if (fallbackMatch) {
    const [, year, month, day, hour = '00', min = '00', sec = '00'] = fallbackMatch
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`
  }

  if (import.meta.env.DEV) debug.warn('[parseICSDate] Could not parse date value:', value)
  return value
}

/**
 * Decode iCalendar escaped values
 * RFC 5545: \n, \, \;, \,
 */
function decodeICSValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/**
 * Extract email from ORGANIZER or ATTENDEE property
 * Format: MAILTO:email@domain.com or CN=Name:MAILTO:email@domain.com
 */
export function extractEmailFromCalendarProperty(property: string): string | null {
  const match = property.match(/mailto:([^\s>]+)/i)
  return match ? match[1] : null
}

/**
 * Parse iCalendar (ICS) content and extract VEVENT data
 * Supports basic iCalendar format without external dependencies
 * Handles quoted-printable encoded content
 */
export function parseICSClient(icsContent: string): ParsedCalendarEvent[] {
  // Pre-process to handle encoded content
  const processedContent = extractICSContent(icsContent)
  const events: ParsedCalendarEvent[] = []
  const lines = processedContent.split(/\r?\n/)

  let inEvent = false
  let currentEvent: Partial<ParsedCalendarEvent> = {}

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    // Handle multi-line values (RFC 5545: lines starting with space/tab are continuations)
    while (i + 1 < lines.length && /^[\s\t]/.test(lines[i + 1])) {
      line += lines[++i].trim()
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
    } else if (line === 'END:VEVENT') {
      // Auto-generate a UID when the source ICS omits it (common with some exporters)
      if (currentEvent.summary && currentEvent.dtstart) {
        if (!currentEvent.uid) {
          currentEvent.uid =
            globalThis.crypto?.randomUUID?.() ?? `${currentEvent.summary}-${currentEvent.dtstart}`
        }
        events.push(currentEvent as ParsedCalendarEvent)
      }
      inEvent = false
      currentEvent = {}
    } else if (inEvent) {
      // Parse property line: PROPERTY[;params]:value
      const match = line.match(/^([^:;]+)(?:;[^:]*)?:(.*)$/)
      if (match) {
        const [, key, value] = match
        const cleanKey = key.toUpperCase()

        switch (cleanKey) {
          case 'UID':
            currentEvent.uid = value
            break
          case 'SUMMARY':
            currentEvent.summary = decodeICSValue(value)
            break
          case 'DTSTART':
            currentEvent.dtstart = parseICSDate(value)
            break
          case 'DTEND':
            currentEvent.dtend = parseICSDate(value)
            break
          case 'LOCATION':
            currentEvent.location = decodeICSValue(value)
            break
          case 'DESCRIPTION':
            currentEvent.description = decodeICSValue(value)
            break
          case 'ORGANIZER':
            currentEvent.organizer = value
            break
          case 'ATTENDEE':
            if (!currentEvent.attendees) currentEvent.attendees = []
            currentEvent.attendees.push(value)
            break
        }
      }
    }
  }

  return events
}

/**
 * Extract meeting link from ICS content
 * Looks for Teams, Zoom, Meet, Webex links in LOCATION or DESCRIPTION
 */
export function extractMeetingLinkFromICS(event: ParsedCalendarEvent): string | null {
  const content = [event.location || '', event.description || ''].join(' ')

  // Microsoft Teams
  const teamsMatch = content.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i)
  if (teamsMatch) return teamsMatch[0]

  // Google Meet
  const meetMatch = content.match(/https:\/\/meet\.google\.com\/[a-z-]+/i)
  if (meetMatch) return meetMatch[0]

  // Zoom
  const zoomMatch = content.match(/https:\/\/[a-z]+\.zoom\.us\/j\/[^\s<>"]+/i)
  if (zoomMatch) return zoomMatch[0]

  // Webex
  const webexMatch = content.match(/https:\/\/[a-z]+\.webex\.com\/[^\s<>"]+/i)
  if (webexMatch) return webexMatch[0]

  return null
}
