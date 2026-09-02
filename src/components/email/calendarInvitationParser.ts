// Pure helpers extracted from EmailCalendarInvitationCard for length budget.
// Detection + parsing of calendar invitations (Google, Outlook, Nextcloud, Cal.com, etc.)

// Détecte si c'est une invitation calendrier (Google Calendar, Outlook, Nextcloud, etc.)
export function detectCalendarInvitation(
  subject?: string | null,
  html?: string | null,
  text?: string | null
): boolean {
  const content = (subject || '') + (html || '') + (text || '')
  const subjectLower = subject?.toLowerCase() || ''

  // Marqueurs d'invitation Google Calendar
  if (subjectLower.includes('invitation:')) return true
  if (content.includes('calendar.google.com')) return true
  if (content.includes('calendar-notification@google.com')) return true

  // Marqueurs Outlook/Teams
  if (content.includes('BEGIN:VCALENDAR')) return true
  if (subjectLower.includes('meeting request')) return true

  // Marqueurs génériques
  if (/Quand\s*:/i.test(content) && /Où\s*:/i.test(content)) return true
  if (/Date\s*:/i.test(content) && /Invités\s*:/i.test(content)) return true

  // === OUTLOOK/TEAMS EMPTY BODY DETECTION ===
  // Outlook invitations often have an empty HTML body (just &nbsp; in Office tags)
  // Detect via subject keywords when body is empty
  const htmlStripped = (html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
  const textStripped = (text || '').trim()
  if (!htmlStripped && !textStripped && subject) {
    if (/rencontre|réunion|meeting|rendez-vous|rdv|invitation|teams|planifi/i.test(subject)) {
      return true
    }
  }

  // === NEXTCLOUD-SPECIFIC MARKERS ===
  // Pattern: "vous a invité à l'événement" / "has invited you to"
  if (/vous a invit[ée]/i.test(content)) return true
  if (/has invited you to/i.test(content)) return true

  // Pattern: "In X days on [day] [date] between [time]"
  if (/In\s+\d+\s+days?\s+on/i.test(content)) return true

  // Pattern: "between HH:MM - HH:MM" (Nextcloud time format)
  if (/between\s+\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/i.test(content)) return true

  // Pattern: Nextcloud Calendar specific markers
  if (/nextcloud/i.test(content) && /calendar/i.test(content)) return true

  // Pattern: French invitation keywords in subject
  if (subjectLower.includes('invitation :') || subjectLower.includes('invitation:')) return true
  if (subjectLower.includes('assemblée') || subjectLower.includes('réunion planifiée')) return true

  return false
}

// Détecte si l'email a un lien de visioconférence
export function hasVisioLink(html?: string | null, text?: string | null): boolean {
  const content = (html || '') + (text || '')

  // Google Meet
  if (/https:\/\/meet\.google\.com\/[a-z-]+/i.test(content)) return true
  // Microsoft Teams
  if (/https:\/\/teams\.microsoft\.com\/l\/meetup-join/i.test(content)) return true
  // Zoom
  if (/https:\/\/[a-z]+\.zoom\.us\/j\//i.test(content)) return true
  // Webex
  if (/https:\/\/[a-z]+\.webex\.com\//i.test(content)) return true
  // Nextcloud Talk - ENHANCED patterns
  if (/https:\/\/[a-zA-Z0-9.-]+\/call\/[a-zA-Z0-9-]+/i.test(content)) return true
  if (/https:\/\/[a-zA-Z0-9.-]+\/apps\/spreed\/call\/[a-zA-Z0-9-]+/i.test(content)) return true
  // Jitsi Meet
  if (/https:\/\/(?:meet\.jit\.si|jitsi\.[a-z0-9.-]+)\/[^\s<>"]+/i.test(content)) return true

  return false
}

// Helper pour convertir 12h AM/PM → 24h
export function convert12hTo24h(hour: number, period: string): number {
  const p = period.toLowerCase()
  if (p === 'pm' && hour !== 12) return hour + 12
  if (p === 'am' && hour === 12) return 0
  return hour
}

export function extractDateFromEmail(
  subject?: string | null,
  text?: string | null,
  html?: string | null
): { start: Date; end?: Date; allDay?: boolean } | null {
  const rawContent = [subject || '', text || '', html || ''].join(' ')
  if (!rawContent.trim()) return null

  // Normalisation robuste
  const content = rawContent
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A\u200B]/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D–—−]/g, '-')
    .replace(/[âÂ]/g, '-')
    .replace(/⋅/g, ' ')
    .replace(/·/g, ' ')
    .replace(/•/g, ' ')
    .replace(/\|/g, ' ') // pipe (Cal.com separator)
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content like (Europe/Paris)

  const months: Record<string, number> = {
    janv: 0,
    jan: 0,
    janvier: 0,
    january: 0,
    fevr: 1,
    févr: 1,
    fev: 1,
    février: 1,
    fevrier: 1,
    february: 1,
    mars: 2,
    mar: 2,
    march: 2,
    avr: 3,
    avril: 3,
    april: 3,
    mai: 4,
    may: 4,
    juin: 5,
    jun: 5,
    june: 5,
    juil: 6,
    juill: 6,
    juillet: 6,
    july: 6,
    aout: 7,
    août: 7,
    august: 7,
    sept: 8,
    septembre: 8,
    september: 8,
    oct: 9,
    octobre: 9,
    october: 9,
    nov: 10,
    novembre: 10,
    november: 10,
    dec: 11,
    déc: 11,
    décembre: 11,
    decembre: 11,
    december: 11,
  }

  const normalizeMonth = (monthStr: string): string => {
    return monthStr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace('.', '')
  }

  // Google Calendar format: "mercredi 28 janv. 2026 - 10am - 10:45am" (with special dashes and dots in months)
  // This pattern handles the Google Calendar format with em-dash separators
  const googleCalAmPmPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
  let match = content.match(googleCalAmPmPattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod)
      const endH = convert12hTo24h(parseInt(endHour), endPeriod)
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        startH,
        parseInt(startMin || '0')
      )
      const end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'))
      return { start, end }
    }
  }

  // Cal.com AM/PM format: "mardi, 20 janvier 2026 3:30pm - 4:00pm" (supports optional minutes: 11am - 12pm)
  const calComAmPmPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
  match = content.match(calComAmPmPattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod)
      const endH = convert12hTo24h(parseInt(endHour), endPeriod)
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        startH,
        parseInt(startMin || '0')
      )
      const end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'))
      return { start, end }
    }
  }

  // Simple AM/PM: "20 janvier 2026 3:30pm - 4:00pm" OR "20 janvier 2026 11am - 12pm" (optional minutes)
  const simpleAmPmPattern =
    /(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
  match = content.match(simpleAmPmPattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod)
      const endH = convert12hTo24h(parseInt(endHour), endPeriod)
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        startH,
        parseInt(startMin || '0')
      )
      const end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'))
      return { start, end }
    }
  }

  // US format: "January 20, 2026 3:30pm" OR "January 20, 2026 11am" (optional minutes)
  const usDatePattern =
    /([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i
  match = content.match(usDatePattern)

  if (match) {
    const [, monthStr, day, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
      match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod)
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        startH,
        parseInt(startMin || '0')
      )
      let end: Date
      if (endHour && endPeriod) {
        const endH = convert12hTo24h(parseInt(endHour), endPeriod)
        end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'))
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000)
      }
      return { start, end }
    }
  }

  // Pattern Nextcloud: "In X days on mardi 20 janvier 2026 between 10:00 - 10:30"
  const nextcloudInDaysPattern =
    /In\s+\d+\s+days?\s+on\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i
  match = content.match(nextcloudInDaysPattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(startHour),
        parseInt(startMin)
      )
      const end = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(endHour),
        parseInt(endMin)
      )
      return { start, end }
    }
  }

  // Pattern Nextcloud: "lundi 26 janvier 2026 between 14:00 - 15:00" (sans préfixe)
  const nextcloudBetweenPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i
  match = content.match(nextcloudBetweenPattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(startHour),
        parseInt(startMin)
      )
      const end = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(endHour),
        parseInt(endMin)
      )
      return { start, end }
    }
  }

  // Pattern alternatif: "lundi 26 janvier 2026 from 14:00 to 15:00" ou "de 14:00 à 15:00"
  const fromToPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+(?:from|de)\s+(\d{1,2}):(\d{2})\s+(?:to|à)\s+(\d{1,2}):(\d{2})/i
  match = content.match(fromToPattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(startHour),
        parseInt(startMin)
      )
      const end = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(endHour),
        parseInt(endMin)
      )
      return { start, end }
    }
  }

  // Pattern: "lundi 16 mars 2026" (journée entière) - doit être APRÈS les patterns avec heures
  const allDayPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})(?!\s+(?:\d{1,2}:|between|from|de))/i
  const allDayMatch = content.match(allDayPattern)

  if (allDayMatch) {
    const [, day, monthStr, year] = allDayMatch
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), 0, 0)
      const end = new Date(parseInt(year), month, parseInt(day), 23, 59)
      return { start, end, allDay: true }
    }
  }

  // Pattern: avec heures 24h
  const dateWithTimePattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?/i
  match = content.match(dateWithTimePattern)

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const start = new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(startHour),
        parseInt(startMin)
      )
      const end =
        endHour && endMin
          ? new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin))
          : new Date(start.getTime() + 60 * 60 * 1000)
      return { start, end }
    }
  }

  // Pattern: "Jeudi 5 mars à 10h00" / "jeudi 5 mars à 10 h 00" (day + month WITHOUT year → infer current year)
  const dayMonthNoYearPattern =
    /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(?:à|a)\s+(\d{1,2})\s*[hH:]\s*(\d{0,2})/i
  match = content.match(dayMonthNoYearPattern)

  if (match) {
    const [, day, monthStr, hour, min] = match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const year = new Date().getFullYear()
      const start = new Date(year, month, parseInt(day), parseInt(hour), parseInt(min || '0'))
      const end = new Date(start.getTime() + 60 * 60 * 1000) // default 1h
      return { start, end }
    }
  }

  // Pattern: "5 mars à 10h00" (day + month without weekday prefix, without year)
  const simpleMonthNoYearPattern =
    /(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(?:à|a)\s+(\d{1,2})\s*[hH:]\s*(\d{0,2})/i
  match = content.match(simpleMonthNoYearPattern)

  if (match) {
    const [, day, monthStr, hour, min] = match
    const monthKey = normalizeMonth(monthStr)
    const month = months[monthKey]

    if (month !== undefined) {
      const year = new Date().getFullYear()
      const start = new Date(year, month, parseInt(day), parseInt(hour), parseInt(min || '0'))
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      return { start, end }
    }
  }

  return null
}

export function extractAttendees(text?: string | null): Array<{ email: string; name?: string }> {
  if (!text) return []

  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const matches = text.match(emailPattern)

  if (!matches) return []

  const uniqueEmails = [...new Set(matches)].filter(
    (email) =>
      !email.includes('noreply') &&
      !email.includes('no-reply') &&
      !email.includes('calendar-notification') &&
      !email.includes('calendar.google.com')
  )

  return uniqueEmails.slice(0, 10).map((email) => ({ email }))
}

export function extractLocation(text?: string | null, html?: string | null): string | null {
  const content = (text || '') + (html || '')

  // Pattern: "Où : Salle de réunion X"
  const whereMatch = content.match(/Où\s*:\s*([^\n<]+)/i)
  if (whereMatch) return whereMatch[1].trim()

  // Pattern: "Lieu : Adresse"
  const locationMatch = content.match(/Lieu\s*:\s*([^\n<]+)/i)
  if (locationMatch) return locationMatch[1].trim()

  return null
}

export function cleanSubjectForDisplay(subject?: string): string {
  if (!subject) return 'Événement calendrier'

  return (
    subject
      .replace(/^\[SPAM\]\s*/i, '')
      .replace(/^(RE:|TR:|FW:|FWD:)\s*/gi, '')
      .replace(/^Invitation:\s*/i, '')
      .replace(/\s*-\s*\w{3,4}\.?\s+\d{1,2}\s+\w+\.?\s+\d{4}.*$/i, '')
      .replace(/\s*\(U\s*TC[+-]?\d*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 60) || 'Événement calendrier'
  )
}
