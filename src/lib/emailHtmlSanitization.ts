import DOMPurify from 'dompurify'
import { fixMalformedEncoding } from './emailUtils'

/**
 * Decode HTML entities (including double-encoded) and fix encoding artefacts.
 */
export function decodeHtmlEntities(html: string): string {
  if (typeof document === 'undefined') return html

  const textarea = document.createElement('textarea')

  // First pass
  textarea.innerHTML = html
  let decoded = textarea.value

  // Second pass for double-encoded entities
  if (decoded.includes('&')) {
    textarea.innerHTML = decoded
    decoded = textarea.value
  }

  // Fix malformed UTF-8 encoding
  decoded = fixMalformedEncoding(decoded)

  return decoded
}

/**
 * Sanitize email HTML using DOMPurify for robust XSS protection
 * while preserving formatting and correctly decoding entities
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return ''

  // Only fix encoding issues — do NOT run decodeEmailContent which
  // strips MIME headers and decodes HTML entities before DOMPurify,
  // corrupting valid HTML (signatures, tables, inline styles).
  const processed = fixMalformedEncoding(html)

  if (typeof window !== 'undefined' && typeof DOMPurify !== 'undefined') {
    const sanitized = DOMPurify.sanitize(processed, {
      ALLOWED_TAGS: [
        'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
        'hr', 'font', 'center', 'sub', 'sup',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height',
        'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'bgcolor',
        'color', 'size', 'face', 'target', 'rel', 'data-cid', 'data-original-src',
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: [
        'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
        'onsubmit', 'formaction',
      ],
      ADD_ATTR: ['target', 'rel'],
      FORCE_BODY: true,
    })

    return postProcessEmailHtml(sanitized)
  }

  return fallbackSanitizeEmailHtml(processed)
}

/**
 * Post-process sanitized HTML for email-specific requirements
 */
function postProcessEmailHtml(html: string): string {
  let processed = html

  // Make external links safe (add target="_blank" and rel="noopener noreferrer")
  processed = processed.replace(/<a\s+([^>]*href=["'][^"']*["'][^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('target=')) return match
    return `<a ${attrs} target="_blank" rel="noopener noreferrer">`
  })

  // Handle images: preserve inline base64, mark external and CID for processing
  processed = processed.replace(/<img([^>]*?)>/gi, (match, attrs) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i)
    if (!srcMatch) return match

    const src = srcMatch[1]
    const beforeSrc = attrs.substring(0, srcMatch.index)
    const afterSrc = attrs.substring(srcMatch.index + srcMatch[0].length)

    const mergeStyleWithSafety = (attrsStr: string, extraStyle: string = '') => {
      const existingStyleMatch = attrsStr.match(/style=["']([^"']*)["']/i)
      const existingStyle = existingStyleMatch ? existingStyleMatch[1].replace(/;?\s*$/, '') : ''
      const cleanedAttrs = existingStyleMatch
        ? attrsStr.replace(existingStyleMatch[0], '')
        : attrsStr
      const merged = existingStyle
        ? `${existingStyle};max-width:100%;height:auto;${extraStyle}`
        : `max-width:100%;height:auto;${extraStyle}`
      return { cleanedAttrs, mergedStyle: merged }
    }

    if (src.startsWith('data:image/')) {
      const { cleanedAttrs, mergedStyle } = mergeStyleWithSafety(beforeSrc + afterSrc)
      return `<img ${cleanedAttrs} src="${src}" style="${mergedStyle}" loading="lazy">`
    }

    if (src.startsWith('cid:')) {
      const cid = src.substring(4)
      const { cleanedAttrs, mergedStyle } = mergeStyleWithSafety(
        beforeSrc + afterSrc,
        'display:none;'
      )
      return `<img ${cleanedAttrs} data-cid="${cid}" src="" alt="" class="cid-image" style="${mergedStyle}" loading="lazy">`
    }

    if (src.includes('blocked-image') || src.includes('apps/mail/img/')) {
      return `<img${beforeSrc}src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E"${afterSrc} style="display:none;">`
    }

    if (src.startsWith('http://') || src.startsWith('https://')) {
      const { cleanedAttrs, mergedStyle } = mergeStyleWithSafety(beforeSrc + afterSrc)
      return `<img ${cleanedAttrs} src="${src}" style="${mergedStyle}" loading="lazy" referrerpolicy="no-referrer">`
    }

    return match
  })

  return processed
}

/**
 * Fallback sanitization for server-side environments without DOMPurify
 */
function fallbackSanitizeEmailHtml(html: string): string {
  return (
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(
        /<a\s+([^>]*href=["'][^"']*["'][^>]*)>/gi,
        '<a $1 target="_blank" rel="noopener noreferrer">'
      )
  )
}
