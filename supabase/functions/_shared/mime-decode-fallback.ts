/**
 * MIME Parsing & Encoding Fallback Module
 * 
 * Extracted from sync-emails/index.ts — contains all email content parsing logic:
 * - MIME header decoding (RFC 2047) with OVH/Nextcloud/Windows-1252 workarounds
 * - Content-Transfer-Encoding decoding (base64, quoted-printable)
 * - Multipart body parsing (including nested)
 * - ICS/calendar extraction (Teams, Outlook, Google Calendar, Nextcloud)
 * - Attachment detection
 * - Header parsing
 * - Thread ID extraction
 * 
 * These are pure functions — no IMAP protocol dependency.
 */

// ============================================================
// HEADER DECODING
// ============================================================

/**
 * Decode MIME encoded headers (e.g., =?UTF-8?B?...?=)
 * ENHANCED: Better handling of Nextcloud/OVH double-encoded headers and NBSP issues
 */
export function decodeHeaderValue(value: string): string {
  if (!value) return value;
  
  // 1. Decode RFC 2047 MIME words (=?UTF-8?B?...?=)
  const mimePattern = /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g;
  let decoded = value.replace(mimePattern, (match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const binaryString = atob(text);
        try {
          const bytes = new Uint8Array(binaryString.split('').map(c => c.charCodeAt(0)));
          return new TextDecoder(charset.toLowerCase() || 'utf-8', { fatal: false }).decode(bytes);
        } catch {
          return binaryString;
        }
      } else if (encoding.toUpperCase() === 'Q') {
        const qpDecoded = text
          .replace(/_/g, ' ')
          .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => 
            String.fromCharCode(parseInt(hex, 16))
          );
        try {
          const bytes = new Uint8Array(qpDecoded.split('').map((c: string) => c.charCodeAt(0)));
          return new TextDecoder(charset.toLowerCase() || 'utf-8', { fatal: false }).decode(bytes);
        } catch {
          return qpDecoded;
        }
      }
    } catch (e) {
      console.error('Error decoding MIME header:', e);
    }
    return match;
  });
  
  // 2. Handle consecutive MIME words
  decoded = decoded.replace(/\?=\s+=\?/g, '?==?');
  
  // 3. Fix malformed UTF-8 encoding - VRAIS patterns (double encodage UTF-8/Latin-1)
  decoded = decoded.replace(/Ã\u00A0 /g, 'à ');
  decoded = decoded.replace(/Ã\u00A0/g, 'à ');
  decoded = decoded.replace(/Ã\u0089/g, 'É');
  
  // Pattern 3: NEXTCLOUD-SPECIFIC - "Â" followed by space = NBSP encoded as Latin-1
  decoded = decoded.replace(/Â /g, ' ');
  decoded = decoded.replace(/\u00C2\u00A0/g, ' ');
  decoded = decoded.replace(/\u00A0/g, ' ');
  
  // Pattern 4: Fix words split by invisible characters
  decoded = decoded.replace(/(\w+)\s+([a-z]{1,3})([\s.,;:!?]|$)/gi, (match, part1, part2, ending) => {
    const merged = part1 + part2;
    const lowerMerged = merged.toLowerCase();
    const commonWords = ['générale', 'nationale', 'internationale', 'exceptionnelle', 'professionnelle', 
                         'extraordinaire', 'ordinaire', 'annuelle', 'mensuelle', 'trimestrielle'];
    if (commonWords.some(w => w === lowerMerged)) {
      return merged + ending;
    }
    return match;
  });
  
  // Pattern 5: Windows-1252/UTF-8 double encoding
  const windows1252Patterns: Record<string, string> = {
    'â€™': "'",
    'â€˜': "'",
    'â€œ': '"',
    'â€': '"',
    'â€"': '—',
    'â€¦': '…',
  };
  
  // Pattern 6: "â" isolé suivi de caractères non-imprimables
  decoded = decoded.replace(/â[\x80-\x9F]/g, "'");
  
  // Pattern 7: Patterns standards avec espaces
  const patternsWithSpaces: Record<string, string> = {
    'Ã© ': 'é ', 'Ã¨ ': 'è ', 'Ã ': 'à ', 'Ã§ ': 'ç ',
  };
  
  // Pattern 8: Patterns standards sans espace
  const patterns: Record<string, string> = {
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê', 'Ã«': 'ë',
    'Ã ': 'à', 'Ã¢': 'â', 'Ã¤': 'ä',
    'Ã¹': 'ù', 'Ã»': 'û', 'Ã¼': 'ü',
    'Ã´': 'ô', 'Ã¶': 'ö',
    'Ã®': 'î', 'Ã¯': 'ï',
    'Ã§': 'ç',
    'Ã‰': 'É', 'Ãˆ': 'È', 'ÃŠ': 'Ê',
    'Ã€': 'À', 'Ã‚': 'Â',
    'Ã™': 'Ù', 'Ã›': 'Û',
    'Ã"': 'Ô',
    'Ã‡': 'Ç',
  };
  
  for (const [malformed, correct] of Object.entries(windows1252Patterns)) {
    decoded = decoded.replace(new RegExp(malformed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
  }
  for (const [malformed, correct] of Object.entries(patternsWithSpaces)) {
    decoded = decoded.replace(new RegExp(malformed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
  }
  for (const [malformed, correct] of Object.entries(patterns)) {
    decoded = decoded.replace(new RegExp(malformed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
  }
  
  // Final cleanup: normalize multiple spaces
  decoded = decoded.replace(/\s+/g, ' ').trim();
  
  return decoded;
}

// ============================================================
// CONTENT DECODING
// ============================================================

/**
 * Decode email content with proper charset handling (base64, quoted-printable).
 */
export function decodeEmailContent(content: string, encoding: string, charset: string = 'UTF-8'): string {
  if (!content) return content;
  
  const enc = encoding ? encoding.toLowerCase().trim() : '';
  
  try {
    let decoded = content;
    
    if (enc === 'base64') {
      decoded = atob(content.replace(/\s/g, ''));
    } else if (enc === 'quoted-printable') {
      decoded = content
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => 
          String.fromCharCode(parseInt(hex, 16))
        );
    }
    
    return decoded;
  } catch (e) {
    console.error('Error decoding email content:', e);
    return content;
  }
}

/**
 * Legacy alias for backward compatibility.
 */
export function decodeBody(content: string, encoding: string): string {
  return decodeEmailContent(content, encoding, 'UTF-8');
}

// ============================================================
// TEXT UTILITIES
// ============================================================

/**
 * Sanitize date strings (remove non-standard parts like "(UTC)").
 */
export function sanitizeDateString(dateStr: string): string {
  if (!dateStr) return dateStr;
  return dateStr.replace(/\s*\([^)]+\)\s*/g, ' ').trim();
}

/**
 * Clean text content by normalizing line endings and removing control characters.
 */
export function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * Clean IMAP response residues from content.
 */
export function cleanImapResponse(content: string): string {
  if (!content) return '';
  
  let cleaned = content.replace(/\)\s*A\d{4}\s+OK\s+(?:FETCH|UID|SEARCH)[^\n]*$/gi, '');
  cleaned = cleaned.replace(/^A\d{4}\s+(?:OK|NO|BAD)\s+.*$/gm, '');
  cleaned = cleaned.replace(/^\*\s+(?:FLAGS|OK|BYE|NO).*$/gm, '');
  
  return cleaned.trim();
}

// ============================================================
// ADDRESS & HEADER PARSING
// ============================================================

/**
 * Parse email address with optional display name.
 */
export function parseEmailAddress(addr: string): { email: string; name: string | null } {
  if (!addr) return { email: '', name: null };
  
  const match = addr.match(/(.*?)<(.+?)>/) || addr.match(/(.+)/);
  if (!match) return { email: addr, name: null };
  
  if (match[2]) {
    const name = decodeHeaderValue(match[1].trim().replace(/["']/g, ''));
    return { email: match[2].trim(), name };
  }
  return { email: match[1].trim(), name: null };
}

/**
 * Parse raw email headers into a key-value map.
 */
export function parseHeaders(rawMessage: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerSection = rawMessage.split('\r\n\r\n')[0];
  const lines = headerSection.split('\r\n');
  
  let currentHeader = '';
  let currentValue = '';

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += ' ' + line.trim();
    } else if (line.includes(':')) {
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = decodeHeaderValue(currentValue.trim());
      }
      const colonIndex = line.indexOf(':');
      currentHeader = line.substring(0, colonIndex).trim();
      currentValue = line.substring(colonIndex + 1).trim();
    }
  }
  
  if (currentHeader) {
    headers[currentHeader.toLowerCase()] = decodeHeaderValue(currentValue.trim());
  }

  return headers;
}

/**
 * Extract thread ID from References/In-Reply-To headers, or fall back to message ID.
 */
export function extractThreadId(headers: Record<string, string>, messageId: string): string {
  const references = headers['references'] || headers['in-reply-to'];
  if (references) {
    const match = references.match(/<([^>]+)>/);
    return match ? match[1] : messageId;
  }
  return messageId;
}

// ============================================================
// BODY PARSING
// ============================================================

/**
 * Parse message body with improved charset handling.
 * ENHANCED: Better handling of deeply nested multipart structures (Nextcloud, Teams, etc.)
 */
export function parseBody(rawMessage: string): { text: string; html: string; icsContent?: string } {
  const parts = rawMessage.split('\r\n\r\n');
  if (parts.length < 2) return { text: '', html: '' };
  
  const body = parts.slice(1).join('\r\n\r\n');
  
  const maxBodySize = 200 * 1024;
  const truncatedBody = body.length > maxBodySize ? body.substring(0, maxBodySize) : body;
  
  const boundaryMatch = rawMessage.match(/boundary=["']?([^"'\s;]+)["']?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const sections = truncatedBody.split(`--${boundary}`);
    
    console.log(`Parsing multipart email - boundary: ${boundary}, sections: ${sections.length}`);
    
    let text = '';
    let html = '';
    let icsContent = '';
    
    for (const section of sections) {
      if (section.includes('--') && section.trim() === '--') continue;
      
      const sectionParts = section.split('\r\n\r\n');
      if (sectionParts.length < 2) continue;
      
      const sectionHeaders = sectionParts[0];
      const sectionBody = sectionParts.slice(1).join('\r\n\r\n');
      
      if (!sectionBody || sectionBody.trim().length === 0) continue;
      
      const contentTypeMatch = sectionHeaders.match(/Content-Type:\s*([^;\s\r\n]+)/i);
      const charsetMatch = sectionHeaders.match(/charset=["']?([^"'\s;\r\n]+)["']?/i);
      const encodingMatch = sectionHeaders.match(/Content-Transfer-Encoding:\s*([^\s\r\n]+)/i);
      
      const contentType = contentTypeMatch?.[1]?.toLowerCase();
      const charset = charsetMatch?.[1] || 'UTF-8';
      const encoding = encodingMatch?.[1]?.toLowerCase();
      
      // Extract .ics calendar content
      if (contentType === 'text/calendar' || contentType === 'application/ics') {
        let calContent = sectionBody.trim();
        if (encoding === 'base64') {
          try {
            calContent = atob(calContent.replace(/\s/g, ''));
          } catch (e) {
            console.error('Error decoding base64 ICS:', e);
          }
        } else if (encoding === 'quoted-printable') {
          calContent = calContent
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => 
              String.fromCharCode(parseInt(hex, 16))
            );
        }
        if (calContent.includes('BEGIN:VCALENDAR')) {
          icsContent = calContent;
          console.log(`✅ Found ICS content in parseBody: ${icsContent.length} bytes`);
        }
        continue;
      }
      
      // Skip attachments
      if (sectionHeaders.toLowerCase().includes('content-disposition: attachment')) continue;
      
      let decodedContent = sectionBody.trim();
      if (encoding) {
        decodedContent = decodeEmailContent(decodedContent, encoding, charset);
      }
      decodedContent = cleanText(decodedContent);
      
      // Handle nested multipart
      if (contentType?.includes('multipart')) {
        const nestedBoundaryMatch = sectionHeaders.match(/boundary=["']?([^"'\s;]+)["']?/i);
        if (nestedBoundaryMatch) {
          const nestedResult = parseBody(section);
          if (nestedResult.text && !text) text = nestedResult.text;
          if (nestedResult.html && !html) html = nestedResult.html;
          if (nestedResult.icsContent && !icsContent) icsContent = nestedResult.icsContent;
          continue;
        }
      }
      
      if (contentType === 'text/plain' && !text && decodedContent.length > 0) {
        text = cleanImapResponse(decodedContent);
      } else if (contentType === 'text/html' && !html && decodedContent.length > 0) {
        html = cleanImapResponse(decodedContent);
      }
    }
    
    // Fallback: if no content found, extract raw text
    if (!text && !html) {
      console.log('⚠️ No structured content found, extracting raw text');
      const bodyStart = rawMessage.indexOf('\r\n\r\n') + 4;
      if (bodyStart > 3) {
        const rawBody = rawMessage.substring(bodyStart, bodyStart + 2000);
        text = cleanImapResponse(cleanText(rawBody));
      }
    }
    
    return { text: cleanImapResponse(text), html: cleanImapResponse(html), icsContent };
  }
  
  // Single part message
  const headerSection = rawMessage.split('\r\n\r\n')[0];
  const charsetMatch = headerSection.match(/charset=["']?([^"'\s;]+)["']?/i);
  const encodingMatch = headerSection.match(/Content-Transfer-Encoding:\s*([^\s]+)/i);
  const charset = charsetMatch?.[1] || 'UTF-8';
  const encoding = encodingMatch?.[1]?.toLowerCase();
  
  let decodedBody = truncatedBody.trim();
  if (encoding) {
    decodedBody = decodeEmailContent(decodedBody, encoding, charset);
  }
  decodedBody = cleanImapResponse(cleanText(decodedBody));
  
  if (headerSection.toLowerCase().includes('text/html')) {
    return { text: '', html: decodedBody };
  }
  
  return { text: decodedBody, html: '' };
}

// ============================================================
// ATTACHMENT & CALENDAR EXTRACTION
// ============================================================

export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  size_bytes: number;
  partId: string;
  content?: string;
}

/**
 * Parse attachments from raw message.
 */
export function parseAttachments(rawMessage: string): ParsedAttachment[] {
  const attachments: ParsedAttachment[] = [];
  const lines = rawMessage.split('\r\n');
  
  let inAttachment = false;
  let currentFilename = '';
  let currentMimeType = '';
  let currentSize = 0;
  let partIndex = 0;

  for (const line of lines) {
    if (line.includes('Content-Disposition:') && (line.includes('attachment') || line.includes('inline'))) {
      inAttachment = true;
      const filenameMatch = line.match(/filename="?([^";\r\n]+)"?/);
      if (filenameMatch) currentFilename = filenameMatch[1];
    }
    
    if (inAttachment && line.startsWith('Content-Type:')) {
      const mimeMatch = line.match(/Content-Type:\s*([^;\r\n]+)/);
      if (mimeMatch) currentMimeType = mimeMatch[1].trim();
    }

    if (inAttachment && line.trim() === '') {
      if (currentFilename && currentMimeType) {
        attachments.push({
          filename: currentFilename,
          mimeType: currentMimeType,
          size_bytes: currentSize || 1024,
          partId: String(++partIndex)
        });
      }
      inAttachment = false;
      currentFilename = '';
      currentMimeType = '';
      currentSize = 0;
    }
  }

  return attachments;
}

export interface CalendarPart {
  content: string;
  mimeType: string;
  filename: string;
}

/**
 * Extract inline text/calendar parts from email body.
 * ENHANCED: Better detection for Google Calendar, Teams, Outlook and nested MIME parts.
 */
export function extractCalendarParts(rawMessage: string): CalendarPart[] {
  const calendarParts: CalendarPart[] = [];
  let partIndex = 0;
  
  console.log(`📅 extractCalendarParts: Scanning message (${rawMessage.length} bytes)`);
  
  // Method 1: Look for all boundaries (handles nested multipart)
  const allBoundaries = [...rawMessage.matchAll(/boundary=["']?([^"'\s;]+)["']?/gi)].map(m => m[1]);
  
  console.log(`📅 Found ${allBoundaries.length} MIME boundaries`);
  
  for (const boundary of allBoundaries) {
    const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sections = rawMessage.split(new RegExp(`--${escapedBoundary}`, 'g'));
    
    for (const section of sections) {
      if (section.trim() === '--' || section.trim() === '') continue;
      
      const isCalendarPart = 
        /content-type:\s*text\/calendar/i.test(section) ||
        /content-type:\s*application\/ics/i.test(section) ||
        /content-type:\s*application\/octet-stream[^]*?\.ics/i.test(section) ||
        (/filename[*]?=["']?[^"'\s]*\.ics/i.test(section) && section.includes('BEGIN')) ||
        (/method=REQUEST/i.test(section) && (section.includes('BEGIN:VCALENDAR') || section.includes('DTSTART')));
      
      if (isCalendarPart) {
        console.log(`📅 Found calendar MIME section (boundary: ${boundary.substring(0, 15)}...)`);
        
        const sectionParts = section.split(/\r?\n\r?\n/);
        if (sectionParts.length >= 2) {
          let icsContent = sectionParts.slice(1).join('\n\n');
          
          const encodingMatch = section.match(/Content-Transfer-Encoding:\s*([^\s\r\n]+)/i);
          const encoding = encodingMatch?.[1]?.toLowerCase();
          
          console.log(`📅 Calendar part encoding: ${encoding || 'none'}`);
          
          if (encoding === 'base64') {
            const cleanBase64 = icsContent.replace(/[\s\r\n]/g, '');
            // Validate base64 before decoding
            if (/^[A-Za-z0-9+/=]+$/.test(cleanBase64) && cleanBase64.length > 10) {
              try {
                icsContent = atob(cleanBase64);
                console.log(`📅 Decoded base64 ICS: ${icsContent.length} bytes`);
              } catch (e) {
                console.warn(`⚠️ base64 decode failed, using raw content:`, e);
              }
            } else {
              console.log(`📅 Content marked as base64 but not valid base64, using raw`);
            }
          } else if (encoding === 'quoted-printable') {
            icsContent = icsContent
              .replace(/=\r?\n/g, '')
              .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => 
                String.fromCharCode(parseInt(hex, 16))
              );
            console.log(`📅 Decoded quoted-printable ICS: ${icsContent.length} bytes`);
          }
          
          icsContent = icsContent.replace(/\n--[^\n]+--?\s*$/g, '').trim();
          
          if (icsContent.includes('BEGIN:VCALENDAR') || icsContent.includes('BEGIN=3AVCALENDAR')) {
            if (icsContent.includes('=3A') || icsContent.includes('=0D')) {
              icsContent = icsContent
                .replace(/=\r?\n/g, '')
                .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => 
                  String.fromCharCode(parseInt(hex, 16))
                );
            }
            
            if (icsContent.includes('DTSTART')) {
              calendarParts.push({
                content: icsContent,
                mimeType: 'text/calendar',
                filename: `invite-${++partIndex}.ics`
              });
              console.log(`✅ Valid ICS found with DTSTART (${icsContent.length} bytes)`);
            } else {
              console.log(`⚠️ ICS found but missing DTSTART, skipping`);
            }
          }
        }
      }
    }
  }
  
  // Method 2: Fallback - look for raw ICS content in body
  if (calendarParts.length === 0) {
    console.log(`📅 No ICS in MIME parts, trying raw content scan...`);
    
    const icsPatterns = [
      /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g,
      /BEGIN=3AVCALENDAR[\s\S]*?END=3AVCALENDAR/g
    ];
    
    for (const pattern of icsPatterns) {
      const matches = rawMessage.match(pattern);
      if (matches) {
        for (const match of matches) {
          let icsContent = match;
          
          if (icsContent.includes('=3A') || icsContent.includes('=0D')) {
            icsContent = icsContent
              .replace(/=\r?\n/g, '')
              .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => 
                String.fromCharCode(parseInt(hex, 16))
              );
          }
          
          if (icsContent.includes('DTSTART')) {
            calendarParts.push({
              content: icsContent,
              mimeType: 'text/calendar',
              filename: `invite-${++partIndex}.ics`
            });
            console.log(`✅ Found raw ICS content in email body (${icsContent.length} bytes)`);
          }
        }
        break;
      }
    }
  }
  
  // Method 3: Deep scan for Google Calendar pattern
  if (calendarParts.length === 0) {
    const googleIcsMatch = rawMessage.match(
      /Content-Type:\s*text\/calendar[^]*?method=REQUEST[^]*?\n\n(BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR)/i
    );
    if (googleIcsMatch && googleIcsMatch[1] && googleIcsMatch[1].includes('DTSTART')) {
      calendarParts.push({
        content: googleIcsMatch[1],
        mimeType: 'text/calendar',
        filename: `invite-${++partIndex}.ics`
      });
      console.log(`✅ Found Google Calendar ICS via deep scan`);
    }
  }
  
  // Method 4: Teams/Outlook specific - look for base64 blocks that decode to ICS
  if (calendarParts.length === 0) {
    const base64Blocks = rawMessage.match(/Content-Transfer-Encoding:\s*base64[^]*?\n\n([A-Za-z0-9+/=\s]{100,})/gi);
    if (base64Blocks) {
      for (const block of base64Blocks) {
        try {
          const base64Match = block.match(/\n\n([A-Za-z0-9+/=\s]+)/);
          if (base64Match) {
            const cleanB64 = base64Match[1].replace(/[\s\r\n]/g, '');
            if (!/^[A-Za-z0-9+/=]+$/.test(cleanB64) || cleanB64.length < 20) continue;
            const decoded = atob(cleanB64);
            if (decoded.includes('BEGIN:VCALENDAR') && decoded.includes('DTSTART')) {
              calendarParts.push({
                content: decoded,
                mimeType: 'text/calendar',
                filename: `invite-${++partIndex}.ics`
              });
              console.log(`✅ Found ICS in base64 block via Teams/Outlook scan`);
              break;
            }
          }
        } catch {
          // Not valid base64 or not ICS, continue
        }
      }
    }
  }
  
  console.log(`📅 extractCalendarParts: Found ${calendarParts.length} calendar part(s) total`);
  return calendarParts;
}

/**
 * Extract body content from an IMAP FETCH response by part name.
 * Used by resync-empty-emails to extract HEADER or TEXT from raw responses.
 */
export function extractBodyContent(response: string, partName: string): string {
  const regex = new RegExp(`BODY\\[${partName}\\](?:<[^>]+>)?\\s*\\{(\\d+)\\}\\r\\n([\\s\\S]+?)\\r?\\n(?:A\\d{4}|\\*|$)`, 'i');
  const match = response.match(regex);
  return match ? match[2].trim() : '';
}
