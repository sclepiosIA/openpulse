// Pure parsers extracted from EmailVisioInvitationCard.tsx — no React deps

interface VisioInfo {
  provider: string;
  providerName: string;
  link: string;
  color: string;
  icon?: string;
}

interface ICSDateInfo {
  start: Date;
  end?: Date;
  summary?: string;
  location?: string;
}

interface EmailVisioInvitationCardProps {
  messageId: string;
  threadId?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  subject?: string;
  fromAddress?: string;
  fromName?: string;
}

export function detectVisioLink(html?: string | null, text?: string | null): VisioInfo | null {
  const content = (html || '') + (text || '');
  
  // Google Meet
  const meetMatch = content.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
  if (meetMatch) {
    return {
      provider: 'google_meet',
      providerName: 'Google Meet',
      link: meetMatch[0],
      color: 'bg-green-500'
    };
  }
  
  // Microsoft Teams
  const teamsMatch = content.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i);
  if (teamsMatch) {
    return {
      provider: 'teams',
      providerName: 'Microsoft Teams',
      link: teamsMatch[0],
      color: 'bg-blue-600'
    };
  }
  
  // Zoom
  const zoomMatch = content.match(/https:\/\/[a-z]+\.zoom\.us\/j\/[^\s<>"]+/i);
  if (zoomMatch) {
    return {
      provider: 'zoom',
      providerName: 'Zoom',
      link: zoomMatch[0],
      color: 'bg-blue-500'
    };
  }
  
  // Webex
  const webexMatch = content.match(/https:\/\/[a-z]+\.webex\.com\/[^\s<>"]+/i);
  if (webexMatch) {
    return {
      provider: 'webex',
      providerName: 'Webex',
      link: webexMatch[0],
      color: 'bg-green-600'
    };
  }

  // Nextcloud Talk - ENHANCED patterns for various Nextcloud configurations
  // Pattern 1: Standard /call/ path
  // Pattern 2: /apps/spreed/call/ path (used in some configurations)
  // Pattern 3: /nc/ prefix (common in reverse proxy setups)
  const nextcloudPatterns = [
    /https:\/\/[a-zA-Z0-9.-]+\/call\/[a-zA-Z0-9-]+/i,
    /https:\/\/[a-zA-Z0-9.-]+\/apps\/spreed\/call\/[a-zA-Z0-9-]+/i,
    /https:\/\/[a-zA-Z0-9.-]+\/nc\/call\/[a-zA-Z0-9-]+/i,
    /https:\/\/[a-zA-Z0-9.-]+\/index\.php\/call\/[a-zA-Z0-9-]+/i
  ];
  
  for (const pattern of nextcloudPatterns) {
    const nextcloudMatch = content.match(pattern);
    if (nextcloudMatch) {
      return {
        provider: 'nextcloud',
        providerName: 'Nextcloud Talk',
        link: nextcloudMatch[0],
        color: 'bg-blue-700'
      };
    }
  }

  // Jitsi Meet (public ou auto-hébergé comme jitsi.exploitant.example.org)
  const jitsiMatch = content.match(/https:\/\/(?:meet\.jit\.si|jitsi\.[a-z0-9.-]+)\/[^\s<>"]+/i);
  if (jitsiMatch) {
    return {
      provider: 'jitsi',
      providerName: 'Jitsi Meet',
      link: jitsiMatch[0],
      color: 'bg-orange-500'
    };
  }
  
  return null;
}

// Helper pour convertir 12h AM/PM → 24h
export function convert12hTo24h(hour: number, period: string): number {
  const p = period.toLowerCase();
  if (p === 'pm' && hour !== 12) return hour + 12;
  if (p === 'am' && hour === 12) return 0;
  return hour;
}

export function extractDateFromEmail(subject?: string | null, text?: string | null, html?: string | null): { start: Date; end?: Date; allDay?: boolean } | null {
  // Priorité : subject (contient souvent la date Google Calendar), puis text, puis html
  const rawContent = [subject || '', text || '', html || ''].join(' ');
  if (!rawContent.trim()) return null;
  
  // Normalisation robuste : espaces invisibles Unicode + tirets Unicode + caractères spéciaux
  const content = rawContent
    // Espaces invisibles Unicode → espace normal
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A\u200B]/g, ' ')
    // Tirets Unicode variés → tiret normal
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D–—−]/g, '-')
    .replace(/[âÂ]/g, '-')  // em-dash mal encodé
    .replace(/⋅/g, ' ')     // point médian Google Calendar (U+22C5)
    .replace(/·/g, ' ')     // middle dot (U+00B7)
    .replace(/•/g, ' ')     // bullet (U+2022)
    .replace(/\|/g, ' ')    // pipe (Cal.com separator)
    .replace(/\s*:\s*/g, ':')  // "13 : 15" → "13:15"
    .replace(/\s+/g, ' ')   // collapse espaces multiples
    .replace(/\([^)]*\)/g, ''); // Remove parenthetical content like (Europe/Paris)
  
  // Debug logs removed - was generating 30+ logs per page load
  
  const months: Record<string, number> = {
    'janv': 0, 'jan': 0, 'janvier': 0, 'january': 0,
    'fevr': 1, 'févr': 1, 'fev': 1, 'février': 1, 'fevrier': 1, 'february': 1,
    'mars': 2, 'mar': 2, 'march': 2,
    'avr': 3, 'avril': 3, 'april': 3,
    'mai': 4, 'may': 4,
    'juin': 5, 'jun': 5, 'june': 5,
    'juil': 6, 'juill': 6, 'juillet': 6, 'july': 6,
    'aout': 7, 'août': 7, 'august': 7,
    'sept': 8, 'septembre': 8, 'september': 8,
    'oct': 9, 'octobre': 9, 'october': 9,
    'nov': 10, 'novembre': 10, 'november': 10,
    'dec': 11, 'déc': 11, 'décembre': 11, 'decembre': 11, 'december': 11,
  };
  
  // Helper pour normaliser le mois
  const normalizeMonth = (monthStr: string): string => {
    return monthStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('.', '');
  };

  // ======= Microsoft Teams "Quand:" / "When:" format =======
  // "Quand : mercredi 28 janvier 2026 10:00 - 11:00" or "When: Wednesday January 28, 2026 10:00 AM - 11:00 AM"
  // Also handles: "Date : lundi 3 février 2026 de 14:00 à 15:00"
  const teamsQuandPattern = /(?:Quand|When|Date)\s*:\s*(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*,?\s*(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(?:de\s+)?(\d{1,2}):(\d{2})(?:\s*(?:AM|PM))?\s*[-àa–]\s*(\d{1,2}):(\d{2})(?:\s*(?:AM|PM))?/i;
  let match = content.match(teamsQuandPattern);

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    }
  }

  // ======= Microsoft Teams format WITHOUT day name (common in forwarded invites) =======
  // "30 janv. 2026 14:00 - 15:00 Romance Standard Time"
  // "28 janvier 2026 10:00 - 11:00 (UTC+01:00)"
  // This pattern catches dates with time ranges but no weekday, often followed by timezone text
  const teamsNoWeekdayPattern = /(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})(?:\s+[A-Za-z\s]+Time)?/i;
  match = content.match(teamsNoWeekdayPattern);

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    }
  }

  // ======= Microsoft Teams "Réunion planifiée" format =======
  // "Réunion planifiée pour le 28 janvier 2026 à 10:00"
  const teamsPlanifieePattern = /(?:Réunion planifiée|Meeting scheduled|Planifiée?)\s+(?:pour le|for|le)?\s*(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(?:à|at|de)?\s*(\d{1,2}):(\d{2})/i;
  match = content.match(teamsPlanifieePattern);

  if (match) {
    const [, day, monthStr, year, hour, min] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(hour), parseInt(min));
      const end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1h
      
      return { start, end };
    }
  }

  // ======= Google Calendar AM/PM format =======
  // "mercredi 28 janv. 2026 - 10am - 10:45am" (with dot after abbreviated month, no comma after day, em-dash separators)
  const googleCalAmPmPattern = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s*-?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  match = content.match(googleCalAmPmPattern);

  if (match) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod);
      const endH = convert12hTo24h(parseInt(endHour), endPeriod);
      const start = new Date(parseInt(year), month, parseInt(day), startH, parseInt(startMin || '0'));
      const end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'));
      
      return { start, end };
    }
  }

  // ======= NEW PATTERN: Cal.com AM/PM format =======
  // "mardi, 20 janvier 2026 3:30pm - 4:00pm" (after normalization of | and timezone)
  const calComAmPmPattern = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  match = content.match(calComAmPmPattern);
  
  if (match) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod);
      const endH = convert12hTo24h(parseInt(endHour), endPeriod);
      const start = new Date(parseInt(year), month, parseInt(day), startH, parseInt(startMin || '0'));
      const end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'));
      
      return { start, end };
    }
  }

  // ======= NEW PATTERN: Simple AM/PM without day name (supports optional minutes) =======
  // "20 janvier 2026 3:30pm - 4:00pm" OR "20 janvier 2026 11am - 12pm"
  const simpleAmPmPattern = /(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  match = content.match(simpleAmPmPattern);
  
  if (match) {
    const [, day, monthStr, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod);
      const endH = convert12hTo24h(parseInt(endHour), endPeriod);
      const start = new Date(parseInt(year), month, parseInt(day), startH, parseInt(startMin || '0'));
      const end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'));
      
      return { start, end };
    }
  }

  // ======= NEW PATTERN: US format "January 20, 2026 3:30pm" (supports optional minutes) =======
  const usDatePattern = /([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i;
  match = content.match(usDatePattern);
  
  if (match) {
    const [, monthStr, day, year, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const startH = convert12hTo24h(parseInt(startHour), startPeriod);
      const start = new Date(parseInt(year), month, parseInt(day), startH, parseInt(startMin || '0'));
      let end: Date;
      if (endHour && endPeriod) {
        const endH = convert12hTo24h(parseInt(endHour), endPeriod);
        end = new Date(parseInt(year), month, parseInt(day), endH, parseInt(endMin || '0'));
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      
      return { start, end };
    }
  }

  // Pattern 0: Format "vendredi 16 janvier 2026 à 17:00" ou "Vendredi 16 janvier 2026 à 17:00 Durée : 1 heure"
  const frenchFullDatePattern = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+(?:à|a)\s+(\d{1,2}):(\d{2})/i;
  match = content.match(frenchFullDatePattern);
  
  if (match) {
    const [, day, monthStr, year, hour, min] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(hour), parseInt(min));
      
      // Chercher la durée "Durée : X heure(s)" ou "Durée : X min"
      const durationMatch = content.match(/Durée\s*:\s*(\d+)\s*(heure|heures|h|min|minutes)/i);
      let end: Date;
      if (durationMatch) {
        const durationValue = parseInt(durationMatch[1]);
        const durationUnit = durationMatch[2].toLowerCase();
        const durationMs = durationUnit.startsWith('h') || durationUnit === 'heure' || durationUnit === 'heures' 
          ? durationValue * 60 * 60 * 1000 
          : durationValue * 60 * 1000;
        end = new Date(start.getTime() + durationMs);
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1h
      }
      
      
      return { start, end };
    } else {
      
    }
  }

  // Pattern Nextcloud: "In X days on mardi 20 janvier 2026 between 10:00 - 10:30"
  const nextcloudInDaysPattern = /In\s+\d+\s+days?\s+on\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i;
  match = content.match(nextcloudInDaysPattern);

  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    }
  }

  // Pattern Nextcloud via "When:" ligne: "When: In X days on mardi 20 janvier 2026 between 10:00 - 10:30"
  const whenLineMatch = content.match(/When:?\s*(?:In\s+\d+\s+days?\s+on\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i);

  if (whenLineMatch) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = whenLineMatch;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    }
  }

  // Pattern 1: Format Google Calendar body "mercredi 11 févr. 2026 09:00 - 10:00" (après normalisation du ⋅)
  // Jour de la semaine complet + date + heures
  const googleCalendarBodyPattern = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i;
  match = content.match(googleCalendarBodyPattern);
  
  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    } else {
      
    }
  }

  // Pattern 2: Format Google Calendar sujet "mer. 21 janv. 2026 08:45 - 09:00"
  // Capture optionnelle du jour de la semaine abrégé, puis date, puis heures
  const googleSubjectPattern = /(?:\w{2,}\.?\s+)?(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i;
  match = content.match(googleSubjectPattern);
  
  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    } else {
      
    }
  }
  
  // Pattern 3: Format "21 janv. 2026 08:45 - 09:00" (format compact sans jour de semaine)
  const datePattern1 = /(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i;
  match = content.match(datePattern1);
  
  if (match) {
    const [, day, monthStr, year, startHour, startMin, endHour, endMin] = match;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      const start = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      return { start, end };
    } else {
      
    }
  }
  
  // Pattern 3: Format ISO dans le HTML (Teams, Zoom, etc.) datetime="2026-01-21T08:45:00"
  const isoPattern = /datetime="(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/i;
  const isoMatch = content.match(isoPattern);
  
  if (isoMatch) {
    const [, year, month, day, hour, min] = isoMatch;
    const start = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    
    return { start, end };
  }

  // Pattern 4: Format date explicite "21/01/2026 08:45"
  const slashPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/;
  const slashMatch = content.match(slashPattern);
  
  if (slashMatch) {
    const [, day, month, year, hour, min] = slashMatch;
    const start = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    
    return { start, end };
  }

  // Pattern 5: Format simple "Date : Vendredi 16 janvier 2026" suivi de "heure" dans le texte
  const simpleDatePattern = /Date\s*:\s*(?:\w+\s+)?(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})/i;
  const simpleDateMatch = content.match(simpleDatePattern);
  
  if (simpleDateMatch) {
    const [, day, monthStr, year] = simpleDateMatch;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      // Chercher l'heure séparément
      const timeMatch = content.match(/(?:à|a)\s*(\d{1,2}):(\d{2})/i);
      const hour = timeMatch ? parseInt(timeMatch[1]) : 9;
      const min = timeMatch ? parseInt(timeMatch[2]) : 0;
      
      const start = new Date(parseInt(year), month, parseInt(day), hour, min);
      
      // Chercher la durée
      const durationMatch = content.match(/Durée\s*:\s*(\d+)\s*(heure|heures|h|min|minutes)/i);
      let end: Date;
      if (durationMatch) {
        const durationValue = parseInt(durationMatch[1]);
        const durationUnit = durationMatch[2].toLowerCase();
        const durationMs = durationUnit.startsWith('h') || durationUnit === 'heure' || durationUnit === 'heures' 
          ? durationValue * 60 * 60 * 1000 
          : durationValue * 60 * 1000;
        end = new Date(start.getTime() + durationMs);
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      
      
      return { start, end };
    } else {
      
    }
  }
  
  // Pattern 6: Événement journée entière "lundi 16 mars 2026" (sans heure)
  const allDayPattern = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zA-ZéûôàùèêëïîçÉÛÔÀÙÈÊËÏÎÇ]+)\s+(\d{4})(?!\s+\d{1,2}:)/i;
  const allDayMatch = content.match(allDayPattern);
  
  if (allDayMatch) {
    const [, day, monthStr, year] = allDayMatch;
    const monthKey = normalizeMonth(monthStr);
    const month = months[monthKey];
    
    if (month !== undefined) {
      // Événement journée entière : 00:00 à 23:59
      const start = new Date(parseInt(year), month, parseInt(day), 0, 0);
      const end = new Date(parseInt(year), month, parseInt(day), 23, 59);
      
      return { start, end, allDay: true };
    }
  }
  
  
  return null;
}

export function extractAttendees(text?: string | null): Array<{ email: string; name?: string }> {
  if (!text) return [];
  
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = text.match(emailPattern);
  
  if (!matches) return [];
  
  const uniqueEmails = [...new Set(matches)].filter(email => 
    !email.includes('noreply') && 
    !email.includes('no-reply') && 
    !email.includes('calendar-notification') &&
    !email.includes('calendar.google.com')
  );
  
  return uniqueEmails.slice(0, 10).map(email => ({ email }));
}

// Fonction de nettoyage basique côté client pour l'affichage immédiat
export function cleanSubjectForDisplay(subject?: string): string {
  if (!subject) return 'Réunion visioconférence';
  
  return subject
    .replace(/^\[SPAM\]\s*/i, '')
    .replace(/^(RE:|TR:|FW:|FWD:)\s*/gi, '')
    .replace(/^Invitation:\s*/i, '')
    .replace(/\s*-\s*\w{3,4}\.?\s+\d{1,2}\s+\w+\.?\s+\d{4}\s+\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}.*$/i, '') // Retire dates à la fin
    .replace(/\s*\(U\s*TC[+-]?\d*\)/gi, '') // Retire (UTC+1) etc
    .replace(/\s*\([^)]*@[^)]*\)/g, '') // Retire (email@domain.com)
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60) || 'Réunion visioconférence';
}

