/**
 * Post-processor to transform raw ICS UIDs in HTML into styled clickable elements.
 * Catches patterns like [ICS UID: xxx] that the LLM may output raw.
 */

// Match [ICS UID: some-uid@domain.com] or [ICS UID: some-uid]
const ICS_UID_BRACKET_PATTERN = /\[ICS\s*UID[:\s]+([^\]]+)\]/gi

/**
 * Transforms raw ICS UID references into styled HTML spans.
 * This is a client-side fallback in case the LLM doesn't format them as links.
 */
export function processIcsUids(html: string): string {
  if (!html) return html

  // First pass: replace [ICS UID: xxx] patterns
  const processed = html.replace(ICS_UID_BRACKET_PATTERN, (_match, uid: string) => {
    const trimmedUid = uid.trim()
    return `<span class="ics-uid" title="ICS: ${trimmedUid}">${truncateUid(trimmedUid)}</span>`
  })

  return processed
}

function truncateUid(uid: string): string {
  if (uid.length <= 30) return uid
  const atIndex = uid.indexOf('@')
  if (atIndex > 15) {
    return uid.substring(0, 12) + '…' + uid.substring(atIndex)
  }
  return uid.substring(0, 25) + '…'
}
