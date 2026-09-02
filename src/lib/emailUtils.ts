import { debug } from '@/lib/debug'
import { decodeHtmlEntities, sanitizeEmailHtml } from './emailHtmlSanitization'

// Domaines email grand public qui ne peuvent JAMAIS être classifiés au niveau domaine
export const GENERIC_EMAIL_DOMAINS = [
  // Microsoft
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'msn.com',
  'hotmail.co.uk',
  'hotmail.de',
  'hotmail.es',
  'hotmail.it',

  // Google
  'gmail.com',
  'googlemail.com',

  // Yahoo
  'yahoo.com',
  'yahoo.fr',
  'yahoo.co.uk',
  'ymail.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // Orange/Wanadoo
  'orange.fr',
  'wanadoo.fr',

  // Free
  'free.fr',

  // SFR
  'sfr.fr',
  'neuf.fr',

  // AOL
  'aol.com',
  'aol.fr',

  // Autres
  'laposte.net',
  'protonmail.com',
  'gmx.com',
  'gmx.fr',
]

export function isGenericDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.includes(domain.toLowerCase())
}

/**
 * Format contact role for display
 * Maps internal type_contact values to user-friendly labels
 */
export function formatContactRole(role: string | null): string | null {
  if (!role) return null

  const roleMapping: Record<string, string> = {
    direction: 'Direction',
    administration: 'Admin',
    administratif: 'Admin',
    informatique: 'DSI',
    dsi: 'DSI',
    dim: 'DIM',
    operationnel: 'Opérationnel',
    cliniciens: 'Clinicien',
    clinicien: 'Clinicien',
    secretariat: 'Secrétariat',
    médical: 'Médical',
    medical: 'Médical',
    technique: 'Technique',
    financier: 'Finance',
    rh: 'RH',
    autre: 'Autre',
  }

  const key = role.toLowerCase().trim()
  return roleMapping[key] || role
}

/**
 * Nettoyer les résidus IMAP du contenu
 */
export function cleanImapResidues(text: string): string {
  if (!text) return text
  return text
    .replace(/\)\s*\w+\d+\s+OK\s+(?:FETCH|UID|SEARCH|STORE|COPY|NOOP)[^\n]*$/gi, '')
    .replace(/^\w+\d+\s+(?:OK|NO|BAD)\s+.*$/gm, '')
    .replace(/^\*\s+(?:FLAGS|OK|BYE|NO).*$/gm, '')
    .replace(/^\)\s*/g, '')
    .replace(/\)\s*$/g, '')
    .trim()
}

/**
 * Fix malformed UTF-8 encoding (e.g., Ã© → é)
 * This handles cases where UTF-8 was incorrectly interpreted as ISO-8859-1
 * ENHANCED: Also fixes Nextcloud-specific patterns with NBSP issues
 */
export function fixMalformedEncoding(text: string): string {
  if (!text) return text

  // Dictionary of common malformed sequences and their correct versions
  const fixes: Record<string, string> = {
    // Common double-encoding patterns (UTF-8 interpreted as Latin-1/Windows-1252)
    'Ã©': 'é',
    'Ã¨': 'è',
    Ãª: 'ê',
    'Ã«': 'ë',
    'Ã ': 'à',
    'Ã¢': 'â',
    'Ã¤': 'ä',
    'Ã´': 'ô',
    'Ã¶': 'ö',
    'Ã¹': 'ù',
    'Ã»': 'û',
    'Ã¼': 'ü',
    'Ã§': 'ç',
    'Ã®': 'î',
    'Ã¯': 'ï',
    'Ã‰': 'É',
    Ãˆ: 'È',
    ÃŠ: 'Ê',
    'Ã‹': 'Ë',
    'Ã€': 'À',
    'Ã‚': 'Â',
    'Ã„': 'Ä',
    'Ã"': 'Ô',
    'Ã–': 'Ö',
    'Ã™': 'Ù',
    'Ã›': 'Û',
    Ãœ: 'Ü',
    'Ã‡': 'Ç',
    ÃŽ: 'Î',
    'Ã\u008F': 'Ï',

    // French ligatures (œ, Œ, æ, Æ) - multiple encoding patterns
    'Å\u0153': 'œ',
    'Å\u0152': 'Œ',
    'Ã¦': 'æ',
    'Ã†': 'Æ',
    'Ã³': 'ó',
    'Ã²': 'ò',

    // Windows-1252 specific - quotes and dashes
    'â€™': "'",
    'â€˜': "'",
    'â€œ': '"',
    'â€': '"',
    'â€"': '—',
    'â€¦': '…',
    'â‚¬': '€',

    // Guillemets français
    'Â»': '»',
    'Â«': '«',
    'Â°': '°',

    // Common malformed apostrophes and quotes
    'Ã¢â‚¬â„¢': "'",
    'Ã¢â‚¬Å"': '"',
    'Ã¢â‚¬\u008D': '"',
    'Ã¢â‚¬': "'",

    // nbsp and special spaces - CRITICAL for Nextcloud emails
    // Note: 'Â ' is already handled above, using hex escapes for unique keys
    '\xC2\xA0': ' ', // UTF-8 NBSP bytes
    '\u00A0': ' ', // Unicode NBSP

    // Windows-1252 Unicode characters
    '\u0080': '€',
    '\u0082': '‚',
    '\u0083': 'ƒ',
    '\u0084': '„',
    '\u0086': '†',
    '\u0091': "'",
    '\u0092': "'",
    '\u0093': '"',
    '\u0094': '"',
    '\u0095': '•',
    '\u0096': '–',
    '\u0097': '—',
    '\u0099': '™',

    // Quoted-printable patterns
    '=C3=A9': 'é',
    '=C3=A8': 'è',
    '=C3=AA': 'ê',
    '=C3=AB': 'ë',
    '=C3=A0': 'à',
    '=C3=A2': 'â',
    '=C3=A4': 'ä',
    '=C3=B9': 'ù',
    '=C3=BB': 'û',
    '=C3=BC': 'ü',
    '=C3=B4': 'ô',
    '=C3=B6': 'ö',
    '=C3=AE': 'î',
    '=C3=AF': 'ï',
    '=C3=A7': 'ç',
    '=C2=A0': ' ',
    '=E9': 'é',
    '=E8': 'è',
    '=EA': 'ê',
    '=E0': 'à',
    '=E2': 'â',
    '=F4': 'ô',
    '=EE': 'î',
    '=E7': 'ç',
  }

  let fixed = text

  // Tentative de décodage UTF-8 double-encodé (Latin-1 → UTF-8)
  if (fixed.includes('Ã') || fixed.includes('Â')) {
    fixed = tryDecodeUTF8DoubleEncoded(fixed)
  }

  // Apply all fixes
  Object.entries(fixes).forEach(([bad, good]) => {
    fixed = fixed.split(bad).join(good)
  })

  // Pattern pour "â" isolé suivi de caractères non-imprimables
  fixed = fixed.replace(/â[\x80-\x9F]/g, "'")

  // Nettoyer les "Â" orphelins (souvent reste de double-encodage)
  fixed = fixed.replace(/Â(?=[a-zéèêëàâäùûüôöîïç])/gi, '')

  // Fix common French words with ligatures that get mangled
  fixed = fixed
    .replace(/v[ÃÂ][Å"œ\u0153]ux/gi, 'vœux')
    .replace(/c[ÃÂ][Å"œ\u0153]ur/gi, 'cœur')
    .replace(/s[ÃÂ][Å"œ\u0153]ur/gi, 'sœur')
    .replace(/[ÃÂ][Å"œ\u0153]uvre/gi, 'œuvre')
    .replace(/[ÃÂ][Å"œ\u0153]il/gi, 'œil')
    .replace(/b[ÃÂ][Å"œ\u0153]uf/gi, 'bœuf')
    .replace(/n[ÃÂ][Å"œ\u0153]ud/gi, 'nœud')

  // Fix isolated uppercase "À" that should be lowercase "à" in French context
  // E.g., "À 17h" should be "à 17h" when following lowercase text
  fixed = fixed.replace(/([a-zéèêëàâäùûüôöîïç,.;:!?\s])À\s+(\d)/gi, '$1à $2')

  // NEXTCLOUD-SPECIFIC: Fix "Généra le" → "Générale" (word split by NBSP)
  // This pattern catches words incorrectly split by invisible characters
  fixed = fixed.replace(
    /(\w+)[\u00A0\s]+([a-z]{1,3})(?=\s|$|[.,;:!?])/gi,
    (match, part1, part2) => {
      // Common French word endings that might have been split
      const merged = part1 + part2
      const commonWords = [
        'générale',
        'nationale',
        'internationale',
        'exceptionnelle',
        'professionnelle',
      ]
      const lowerMerged = merged.toLowerCase()
      if (commonWords.some((w) => w === lowerMerged || w.includes(lowerMerged))) {
        return merged
      }
      return match
    }
  )

  return fixed
}

/**
 * Tente de décoder un texte UTF-8 qui a été mal interprété comme Latin-1
 */
function tryDecodeUTF8DoubleEncoded(text: string): string {
  try {
    // Vérifie si le texte ressemble à du double-encodage
    if (!text.includes('Ã') && !text.includes('Â')) {
      return text
    }

    // Essayer de décoder comme UTF-8 mal interprété en Latin-1
    const bytes = new Uint8Array(text.split('').map((c) => c.charCodeAt(0)))
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

    // Vérifier que le décodage a produit un résultat valide (moins de caractères de remplacement)
    if (!decoded.includes('\uFFFD') && decoded.length > 0) {
      return decoded
    }
  } catch {
    // Si le décodage échoue, retourner le texte original
  }
  return text
}

/**
 * Sanitize all email fields comprehensively
 * Applies encoding fixes and MIME decoding to all text fields
 */
export function sanitizeAllEmailFields(message: {
  subject?: string | null
  from_name?: string | null
  body_html?: string | null
  body_text?: string | null
}): {
  subject: string
  from_name: string | null
  body_html: string | null
  body_text: string | null
  encodingWasCorrected: boolean
} {
  const original = {
    subject: message.subject || '',
    from_name: message.from_name || '',
    body_html: message.body_html || '',
    body_text: message.body_text || '',
  }

  const sanitized = {
    subject: sanitizeEmailSubject(message.subject),
    from_name: sanitizeDisplayName(message.from_name),
    body_html: message.body_html
      ? cleanImapResidues(fixMalformedEncoding(decodeHtmlEntities(message.body_html)))
      : null,
    body_text: message.body_text
      ? cleanImapResidues(fixMalformedEncoding(message.body_text))
      : null,
    encodingWasCorrected: false,
  }

  // Check if any field was actually corrected
  sanitized.encodingWasCorrected =
    sanitized.subject !== original.subject ||
    (sanitized.from_name !== null && sanitized.from_name !== original.from_name) ||
    (sanitized.body_html !== null && sanitized.body_html !== original.body_html) ||
    (sanitized.body_text !== null && sanitized.body_text !== original.body_text)

  return sanitized
}

/**
 * Robustly decode email content with multiple encoding strategies
 */
export function decodeEmailContent(content: string): string {
  if (!content) return ''

  let decoded = content

  // 1. Detect and decode base64 if present
  if (/^[A-Za-z0-9+/]+=*$/.test(decoded.trim()) && decoded.length > 50) {
    try {
      decoded = atob(decoded)
    } catch {
      // Not base64, continue
    }
  }

  // 2. Strip MIME headers and decode quoted-printable
  decoded = stripMimeHeaders(decoded)

  // 3. Decode HTML entities
  decoded = decodeHtmlEntities(decoded)

  // 4. Fix malformed encoding
  decoded = fixMalformedEncoding(decoded)

  // 5. Normalize whitespace and invisible characters
  decoded = decoded
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/\u200B/g, '') // Zero-width space
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/\r/g, '\n')

  return decoded
}

/**
 * Strip MIME headers and boundaries from raw email content
 * Handles both multipart messages and plain text with headers
 */
export function stripMimeHeaders(content: string): string {
  if (!content) return ''

  // Detect if content contains MIME headers
  const hasMimeHeaders =
    content.includes('Content-Type:') ||
    content.includes('Content-Transfer-Encoding:') ||
    content.match(/^--[a-zA-Z0-9_-]+$/m)

  if (!hasMimeHeaders) return content

  // Split by MIME boundaries to extract actual content
  let cleaned = content

  // Remove MIME boundaries
  cleaned = cleaned.replace(/^--[a-zA-Z0-9_=-]+$/gm, '')

  // Remove Content-Type headers and their parameters
  cleaned = cleaned.replace(/^Content-Type:.*?(?=\n(?:[^\s]|$))/gims, '')

  // Remove Content-Transfer-Encoding headers
  cleaned = cleaned.replace(/^Content-Transfer-Encoding:.*$/gim, '')

  // Remove other common MIME headers
  cleaned = cleaned.replace(/^Content-Disposition:.*$/gim, '')
  cleaned = cleaned.replace(/^Content-ID:.*$/gim, '')
  cleaned = cleaned.replace(/^MIME-Version:.*$/gim, '')

  // Decode quoted-printable if present
  if (content.toLowerCase().includes('quoted-printable')) {
    // Remove soft line breaks (= at end of line)
    cleaned = cleaned.replace(/=\r?\n/g, '')
    // Decode =XX sequences
    cleaned = cleaned.replace(/=([0-9A-F]{2})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16))
      } catch {
        return ''
      }
    })
  }

  // Remove excessive blank lines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  return cleaned.trim()
}

/**
 * Clean an email signature that may be wrapped in <pre><code> and multi-encoded.
 * Handles triple-encoded HTML from TipTap or similar editors.
 */
export function cleanEmailSignature(raw: string): string {
  if (!raw) return ''

  let s = raw

  // Strip <pre><code>...</code></pre> wrappers (case-insensitive)
  s = s.replace(/^<pre[^>]*>\s*<code[^>]*>/i, '').replace(/<\/code>\s*<\/pre>/i, '')

  // Strip trailing empty <p></p> or <p>&nbsp;</p>
  s = s.replace(/(<p>\s*(&nbsp;)?\s*<\/p>\s*)+$/gi, '')

  // Multi-pass decode HTML entities (handles triple encoding)
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    let prev = ''
    let current = s
    // Keep decoding until stable (max 5 passes for safety)
    for (let i = 0; i < 5 && current !== prev; i++) {
      prev = current
      textarea.innerHTML = current
      current = textarea.value
    }
    s = current
  }

  // Fix residual encoding issues
  s = fixMalformedEncoding(s)

  return s.trim()
}

/**
 * Decode HTML entities using native browser API with multi-pass support
 * This approach is more reliable than regex-based decoding
 */
// HTML sanitization / decoding extracted to ./emailHtmlSanitization (re-exported above via top import)
export { decodeHtmlEntities, sanitizeEmailHtml };



/**
 * Sanitize plain text email content
 * Escapes HTML characters and decodes entities
 */
export function sanitizeEmailText(text: string): string {
  if (!text) return ''

  // First decode content properly
  let processed = decodeEmailContent(text)

  // Escape HTML characters for safe display
  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Convert URLs to clickable links
    .replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>'
    )
    // Preserve line breaks
    .replace(/\n/g, '<br>')

  return processed
}

/**
 * Fix participant name encoding
 */
export function fixParticipantName(name: string | null): string | null {
  return name ? fixMalformedEncoding(name) : null
}

/**
 * Format email addresses for display
 */
export function formatEmailAddress(name: string | null, email: string): string {
  return name ? `${name} <${email}>` : email
}

/**
 * Parse email addresses from a comma-separated string
 */
export function parseEmailAddresses(addresses: string): string[] {
  return addresses
    .split(',')
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Extrait l'expéditeur principal d'un thread email
 * @param thread - Le thread email avec ses participants
 * @param userEmail - L'adresse email de l'utilisateur (pour l'exclure)
 * @returns Le nom et l'email du principal expéditeur externe
 */
/**
 * Decode quoted-printable encoding
 */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16))
      } catch {
        return ''
      }
    })
}

/**
 * Try to decode text with different encodings
 */
function tryTextDecode(text: string, encoding: string = 'utf-8'): string {
  try {
    if (typeof TextDecoder === 'undefined') return text

    const bytes = new Uint8Array(text.split('').map((char) => char.charCodeAt(0)))
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return text
  }
}

/**
 * Decode RFC 2047 MIME encoded words (=?charset?encoding?text?=)
 */
function decodeMimeWords(text: string): string {
  if (!text) return text

  // Pattern: =?charset?encoding?encoded-text?=
  const mimeWordPattern = /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g

  return text.replace(mimeWordPattern, (match, charset, encoding, encodedText) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        // Base64 decoding
        const decoded = atob(encodedText)
        return tryTextDecode(decoded, charset.toLowerCase())
      } else if (encoding.toUpperCase() === 'Q') {
        // Quoted-printable decoding
        const withSpaces = encodedText.replace(/_/g, ' ')
        const decoded = decodeQuotedPrintable(withSpaces)
        return tryTextDecode(decoded, charset.toLowerCase())
      }
    } catch (error) {
      // MIME decoding failures are expected for malformed data - only log in dev
      if (import.meta.env.DEV) {
        debug.warn('Failed to decode MIME word:', match, error)
      }
    }
    return match
  })
}

/**
 * Sanitize email subject with comprehensive encoding fixes
 */
export function sanitizeEmailSubject(subject?: string | null): string {
  if (!subject) return '(Sans objet)'

  let cleaned = subject

  // 1. Decode RFC 2047 MIME encoded words
  cleaned = decodeMimeWords(cleaned)

  // 2. Fix malformed UTF-8 encoding (e.g., Ã© → é)
  cleaned = fixMalformedEncoding(cleaned)

  // 3. Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned)

  // 4. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // 5. Handle empty subjects
  if (!cleaned || cleaned === '') {
    return '(Sans objet)'
  }

  return cleaned
}

/**
 * Sanitize display names (participant names, sender names, etc.)
 */
export function sanitizeDisplayName(name?: string | null): string | null {
  if (!name) return null

  let cleaned = name

  // 1. Decode RFC 2047 MIME encoded words
  cleaned = decodeMimeWords(cleaned)

  // 2. Fix malformed UTF-8 encoding
  cleaned = fixMalformedEncoding(cleaned)

  // 3. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned || null
}

/**
 * Safely truncate text at character boundaries
 */
export function truncateSafe(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  // Try to break at word boundary
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '…'
  }

  return truncated + '…'
}

// Participants logic extracted to ./emailParticipants for module size
export { getThreadMainSender, getAllThreadParticipants } from './emailParticipants';

