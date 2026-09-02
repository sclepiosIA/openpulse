/**
 * Parse Google Calendar and Teams invitation emails from body text
 * Extracts event details without ICS format
 */

export interface GoogleCalendarEvent {
  uid: string
  summary: string
  dtstart: string
  dtend?: string
  location?: string
  description?: string
  organizer?: string
  attendees?: string[]
  meetingLink?: string
}

export interface TeamsInvitationInfo {
  summary: string
  meetingLink: string
  meetingId?: string
  passcode?: string
  organizer?: string
  description?: string
  hasDateInfo: boolean
}

/**
 * Normalize malformed UTF-8 characters in Google Calendar emails
 * Handles â (encoded bullet/dash) and other common encoding issues
 */
function normalizeUTF8(str: string): string {
  return (
    str
      // Malformed UTF-8: â often represents • or – (en-dash)
      .replace(/â/g, '–')
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã /g, 'à')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã´/g, 'ô')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã®/g, 'î')
      .replace(/Ã¹/g, 'ù')
      .replace(/Â/g, '')
      // Common special characters
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
  )
}

/**
 * Parse French date format from Google Calendar emails
 * Example: "jeudi 29 janv. 2026 • 14:30 – 14:45"
 * Example: "lundi 3 févr. 2025 • 10:00 – 11:00"
 * Also handles malformed UTF-8: "jeudi 29 janv. 2026 â 14:30 â 14:45"
 */
// Helper to convert 12h AM/PM → 24h
function to24h(hour: number, period: string): number {
  const p = period.toLowerCase()
  if (p === 'pm' && hour !== 12) return hour + 12
  if (p === 'am' && hour === 12) return 0
  return hour
}

function parseFrenchDate(dateStr: string): { start: string; end?: string } | null {
  // Normalize malformed UTF-8 first
  let normalizedStr = normalizeUTF8(dateStr)

  // Additional normalization for Cal.com and similar formats
  normalizedStr = normalizedStr
    .replace(/\|/g, ' ') // pipe separator
    .replace(/\([^)]*\)/g, '') // remove (Europe/Paris) etc
    .replace(/\s+/g, ' ')
    .trim()

  const months: Record<string, string> = {
    janv: '01',
    jan: '01',
    janvier: '01',
    january: '01',
    févr: '02',
    fev: '02',
    février: '02',
    fevrier: '02',
    february: '02',
    mars: '03',
    mar: '03',
    march: '03',
    avr: '04',
    avril: '04',
    april: '04',
    mai: '05',
    may: '05',
    juin: '06',
    jun: '06',
    june: '06',
    juil: '07',
    juill: '07',
    juillet: '07',
    july: '07',
    août: '08',
    aout: '08',
    august: '08',
    sept: '09',
    septembre: '09',
    september: '09',
    oct: '10',
    octobre: '10',
    october: '10',
    nov: '11',
    novembre: '11',
    november: '11',
    déc: '12',
    dec: '12',
    décembre: '12',
    decembre: '12',
    december: '12',
  }

  // NEW: Cal.com AM/PM pattern: "mardi, 20 janvier 2026 3:30pm - 4:00pm" (supports optional minutes: 11am - 12pm)
  const calComAmPmPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
  const ampmMatch = normalizedStr.match(calComAmPmPattern)

  if (ampmMatch) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      ampmMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      const startH = to24h(parseInt(startHour), startPeriod)
      const endH = to24h(parseInt(endHour), endPeriod)

      return {
        start: `${year}-${month}-${paddedDay}T${String(startH).padStart(2, '0')}:${startMin || '00'}:00`,
        end: `${year}-${month}-${paddedDay}T${String(endH).padStart(2, '0')}:${endMin || '00'}:00`,
      }
    }
  }

  // NEW: Simple AM/PM pattern without day name (supports optional minutes: 11am - 12pm)
  const simpleAmPmPattern =
    /(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
  const simpleAmpmMatch = normalizedStr.match(simpleAmPmPattern)

  if (simpleAmpmMatch) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      simpleAmpmMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      const startH = to24h(parseInt(startHour), startPeriod)
      const endH = to24h(parseInt(endHour), endPeriod)

      return {
        start: `${year}-${month}-${paddedDay}T${String(startH).padStart(2, '0')}:${startMin || '00'}:00`,
        end: `${year}-${month}-${paddedDay}T${String(endH).padStart(2, '0')}:${endMin || '00'}:00`,
      }
    }
  }

  // NEW: US format "January 20, 2026 3:30pm - 4:00pm" (supports optional minutes: 11am - 12pm)
  const usAmPmPattern =
    /([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i
  const usMatch = normalizedStr.match(usAmPmPattern)

  if (usMatch) {
    const [, monthStr, day, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      usMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      const startH = to24h(parseInt(startHour), startPeriod)

      const result: { start: string; end?: string } = {
        start: `${year}-${month}-${paddedDay}T${String(startH).padStart(2, '0')}:${startMin || '00'}:00`,
      }

      if (endHour && endPeriod) {
        const endH = to24h(parseInt(endHour), endPeriod)
        result.end = `${year}-${month}-${paddedDay}T${String(endH).padStart(2, '0')}:${endMin || '00'}:00`
      }

      return result
    }
  }

  // NEW: Nextcloud pattern "In X days on": "In 3 days on mardi 20 janvier 2026 between 10:00 - 10:30"
  const nextcloudInDaysPattern =
    /In\s+\d+\s+days?\s+on\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i
  const inDaysMatch = normalizedStr.match(nextcloudInDaysPattern)

  if (inDaysMatch) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = inDaysMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      return {
        start: `${year}-${month}-${paddedDay}T${startHour.padStart(2, '0')}:${startMin}:00`,
        end: `${year}-${month}-${paddedDay}T${endHour.padStart(2, '0')}:${endMin}:00`,
      }
    }
  }

  // NEW: Nextcloud pattern: "lundi 26 janvier 2026 between 14:00 - 15:00"
  const nextcloudBetweenPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i
  const nextcloudMatch = normalizedStr.match(nextcloudBetweenPattern)

  if (nextcloudMatch) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = nextcloudMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      return {
        start: `${year}-${month}-${paddedDay}T${startHour.padStart(2, '0')}:${startMin}:00`,
        end: `${year}-${month}-${paddedDay}T${endHour.padStart(2, '0')}:${endMin}:00`,
      }
    }
  }

  // NEW: Alternative pattern: "26 janvier 2026 from 14:00 to 15:00" or "de 14:00 à 15:00"
  const fromToPattern =
    /(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s+(?:from|de)\s+(\d{1,2}):(\d{2})\s+(?:to|à)\s+(\d{1,2}):(\d{2})/i
  const fromToMatch = normalizedStr.match(fromToPattern)

  if (fromToMatch) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = fromToMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      return {
        start: `${year}-${month}-${paddedDay}T${startHour.padStart(2, '0')}:${startMin}:00`,
        end: `${year}-${month}-${paddedDay}T${endHour.padStart(2, '0')}:${endMin}:00`,
      }
    }
  }

  // Pattern: "jour DD mois. YYYY • HH:MM – HH:MM" or "jour DD mois YYYY HH:MM - HH:MM"
  // Also matches malformed UTF-8 separators
  const datePattern =
    /(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s*[•·\-–â]\s*(\d{1,2}):(\d{2})\s*[–\-â]\s*(\d{1,2}):(\d{2})/i
  const match = normalizedStr.match(datePattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      const paddedStartHour = startHour.padStart(2, '0')
      const paddedEndHour = endHour.padStart(2, '0')

      return {
        start: `${year}-${month}-${paddedDay}T${paddedStartHour}:${startMin}:00`,
        end: `${year}-${month}-${paddedDay}T${paddedEndHour}:${endMin}:00`,
      }
    }
  }

  // Alternative pattern without time range: "jour DD mois YYYY à HH:MM"
  const simplePattern = /(\d{1,2})\s+(\w+)\.?\s+(\d{4})\s*(?:à|at|•)?\s*(\d{1,2}):(\d{2})/i
  const simpleMatch = normalizedStr.match(simplePattern)

  if (simpleMatch) {
    const [, day, monthStr, year, hour, min] = simpleMatch
    const monthKey = monthStr.toLowerCase().replace('.', '')
    const month = months[monthKey]

    if (month) {
      const paddedDay = day.padStart(2, '0')
      const paddedHour = hour.padStart(2, '0')

      return {
        start: `${year}-${month}-${paddedDay}T${paddedHour}:${min}:00`,
      }
    }
  }

  return null
}

/**
 * Extract meeting link from email body
 */
function extractMeetingLink(body: string): string | null {
  // Google Meet
  const meetMatch = body.match(/https:\/\/meet\.google\.com\/[a-z-]+/i)
  if (meetMatch) return meetMatch[0]

  // Microsoft Teams - extract full meeting URL
  const teamsMatch = body.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i)
  if (teamsMatch) return teamsMatch[0]

  // Zoom
  const zoomMatch = body.match(/https:\/\/[a-z]+\.zoom\.us\/[^\s<>"]+/i)
  if (zoomMatch) return zoomMatch[0]

  // Generic video conference link
  const genericMatch = body.match(/https:\/\/[^\s<>"]+(?:video|conference|meeting)[^\s<>"]*/i)
  if (genericMatch) return genericMatch[0]

  return null
}

/**
 * Extract organizer email from email body
 */
function extractOrganizer(body: string): string | null {
  // Pattern: "Organisateur : Name <email@domain.com>" or "Organizer: email@domain.com"
  const patterns = [
    /(?:organisateur|organizer|organisé par|organized by)[:\s]+([^\n<]+)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /(?:de la part de|from|sender)[:\s]+([^\n<]+)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
  ]

  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match && match[2]) {
      return match[2]
    }
  }

  return null
}

/**
 * Extract attendees from email body
 */
function extractAttendees(body: string): string[] {
  const attendees: string[] = []

  // Pattern: email addresses in the body
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const matches = body.match(emailPattern)

  if (matches) {
    // Filter unique emails, exclude common no-reply addresses
    const uniqueEmails = [...new Set(matches)].filter(
      (email) =>
        !email.includes('noreply') &&
        !email.includes('no-reply') &&
        !email.includes('calendar-notification') &&
        !email.includes('calendar.google.com')
    )
    attendees.push(...uniqueEmails.slice(0, 20)) // Max 20 attendees
  }

  return attendees
}

/**
 * Parse Microsoft Teams invitation email
 * Teams emails often don't include date in body - only meeting link and codes
 */
export function parseTeamsInvitation(
  subject: string,
  bodyText: string,
  fromAddress: string
): TeamsInvitationInfo | null {
  // Check if this is a Teams email
  if (!bodyText.includes('teams.microsoft.com')) {
    return null
  }

  // Extract Teams meeting link
  const meetingLink = extractMeetingLink(bodyText)
  if (!meetingLink) {
    return null
  }

  // Extract meeting ID
  const meetingIdMatch =
    bodyText.match(/Numéro de réunion\s*:\s*([0-9\s]+)/i) ||
    bodyText.match(/Meeting ID\s*:\s*([0-9\s]+)/i)
  const meetingId = meetingIdMatch ? meetingIdMatch[1].trim() : undefined

  // Extract passcode
  const passcodeMatch =
    bodyText.match(/Code secret\s*:\s*(\S+)/i) || bodyText.match(/Passcode\s*:\s*(\S+)/i)
  const passcode = passcodeMatch ? passcodeMatch[1].trim() : undefined

  // Try to extract date from body (some Teams emails include it)
  const dateInfo = parseFrenchDate(bodyText)

  // Build description
  const descriptionParts: string[] = [`🔗 Rejoindre Teams: ${meetingLink}`]
  if (meetingId) {
    descriptionParts.push(`📞 ID réunion: ${meetingId}`)
  }
  if (passcode) {
    descriptionParts.push(`🔑 Code: ${passcode}`)
  }

  return {
    summary: subject,
    meetingLink,
    meetingId,
    passcode,
    organizer: fromAddress,
    description: descriptionParts.join('\n'),
    hasDateInfo: dateInfo !== null,
  }
}

/**
 * Parse Google Calendar invitation email
 * Extracts event details from plain text body
 */
export function parseGoogleCalendarEmail(
  subject: string,
  bodyText: string,
  fromAddress: string
): GoogleCalendarEvent | null {
  // Check if this is a calendar invitation email
  const isInvitation =
    /^(Invitation|Invitation mise à jour|Updated invitation|Événement|Event|Rappel|Reminder)[\s:]/i.test(
      subject
    )
  const hasTimeInfo = /\d{1,2}:\d{2}/.test(bodyText) && /\d{4}/.test(bodyText)

  if (!isInvitation && !hasTimeInfo) {
    return null
  }

  // Extract event title from subject
  // "Invitation : Titre de l'événement" or "Invitation: Event Title @ Date"
  let summary = subject
    .replace(
      /^(Invitation|Updated invitation|Invitation mise à jour|Événement|Event|Rappel|Reminder)[:\s]+/i,
      ''
    )
    .replace(/\s*@\s*.*$/, '') // Remove date suffix
    .trim()

  if (!summary || summary.length < 3) {
    // Try to extract from body
    const titleMatch = bodyText.match(/(?:Quoi|What|Titre|Title)[:\s]+([^\n]+)/i)
    if (titleMatch) {
      summary = titleMatch[1].trim()
    } else {
      summary = subject // Fallback to full subject
    }
  }

  // Extract date and time
  const dateInfo = parseFrenchDate(bodyText)

  if (!dateInfo) {
    // Try alternative date extraction
    // Look for "Quand : date" pattern
    const quandMatch = bodyText.match(/(?:Quand|When|Date)[:\s]+([^\n]+)/i)
    if (quandMatch) {
      const altDateInfo = parseFrenchDate(quandMatch[1])
      if (!altDateInfo) {
        console.log('[google-calendar-parser] Could not parse date from:', quandMatch[1])
        return null
      }
      Object.assign(dateInfo || {}, altDateInfo)
    } else {
      console.log('[google-calendar-parser] No date found in body')
      return null
    }
  }

  if (!dateInfo) return null

  // Extract location
  let location: string | undefined
  const locationMatch = bodyText.match(/(?:Où|Where|Lieu|Location)[:\s]+([^\n]+)/i)
  if (locationMatch) {
    location = locationMatch[1].trim()
  }

  // Extract meeting link
  const meetingLink = extractMeetingLink(bodyText)

  // Extract organizer
  const organizer = extractOrganizer(bodyText) || fromAddress

  // Extract attendees
  const attendees = extractAttendees(bodyText)

  // Generate UID from subject + date
  const uid = `google-${Date.now()}-${summary.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`

  // Build description
  const descriptionParts: string[] = []
  if (meetingLink) {
    descriptionParts.push(`🔗 Lien de visio: ${meetingLink}`)
  }
  if (location && location !== meetingLink) {
    descriptionParts.push(`📍 Lieu: ${location}`)
  }
  if (attendees.length > 0) {
    descriptionParts.push(`👥 Participants: ${attendees.join(', ')}`)
  }

  return {
    uid,
    summary,
    dtstart: dateInfo.start,
    dtend: dateInfo.end,
    location: meetingLink || location,
    description: descriptionParts.join('\n'),
    organizer,
    attendees,
    meetingLink: meetingLink ?? undefined,
  }
}

/**
 * Check if email is likely a calendar invitation
 */
export function isLikelyCalendarInvitation(subject: string, bodyText: string): boolean {
  // Check subject patterns
  const subjectPatterns = [
    /^Invitation[\s:]/i,
    /^Updated invitation/i,
    /^Invitation mise à jour/i,
    /^Événement[\s:]/i,
    /^Event[\s:]/i,
    /^Rappel[\s:]/i,
    /^Reminder[\s:]/i,
    /^Accepté[\s:]/i,
    /^Accepted[\s:]/i,
    /vous invite/i,
    /invites you/i,
  ]

  const hasSubjectMatch = subjectPatterns.some((p) => p.test(subject))

  // Check body patterns
  const bodyPatterns = [
    /meet\.google\.com/i,
    /teams\.microsoft\.com/i,
    /zoom\.us/i,
    /(?:Quand|When)[:\s]+.*\d{1,2}:\d{2}/i,
    /(?:Où|Where|Lieu|Location)[:\s]+/i,
    /calendar\.google\.com/i,
    /Accepter|Accept|Refuser|Decline|Peut-être|Maybe/i,
  ]

  const hasBodyMatch = bodyPatterns.some((p) => p.test(bodyText || ''))

  return hasSubjectMatch || (hasBodyMatch && /\d{1,2}:\d{2}/.test(bodyText || ''))
}

/**
 * Check if email is a Teams meeting invitation (even without date)
 */
export function isTeamsInvitation(bodyText: string): boolean {
  return (
    bodyText.includes('teams.microsoft.com/l/meetup-join') ||
    (bodyText.includes('Microsoft Teams') && bodyText.includes('Rejoindre la réunion'))
  )
}
