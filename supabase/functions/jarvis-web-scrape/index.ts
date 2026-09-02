/**
 * Jarvis Web Scrape - Native Web Scraping Tool (No External API)
 *
 * Extrait le contenu textuel, les liens et les métadonnées d'une page web.
 * Utilise fetch natif + parsing HTML basique sans dépendance payante.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { validateServiceOrUser } from '../_shared/auth-helpers.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

// Types de sortie supportés
type OutputFormat = 'text' | 'markdown' | 'html' | 'links' | 'metadata'

interface ScrapeRequest {
  url: string
  formats?: OutputFormat[]
  maxLength?: number
  timeout?: number
  includeImages?: boolean
  selector?: string // CSS selector pour cibler un élément spécifique
}

interface ScrapeResponse {
  success: boolean
  url: string
  title?: string
  text?: string
  markdown?: string
  html?: string
  links?: string[]
  images?: string[]
  metadata?: {
    title?: string
    description?: string
    author?: string
    keywords?: string[]
    ogImage?: string
    ogTitle?: string
    ogDescription?: string
    canonicalUrl?: string
    language?: string
  }
  wordCount?: number
  error?: string
}

// ============================================================
// HTML Parsing Utilities (Native, no external deps)
// ============================================================

/**
 * Extrait le contenu textuel du HTML (supprime balises, scripts, styles)
 */
function htmlToText(html: string): string {
  // Supprimer scripts et styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

  // Supprimer les commentaires HTML
  text = text.replace(/<!--[\s\S]*?-->/g, '')

  // Remplacer les balises de bloc par des sauts de ligne
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
  text = text.replace(/<(br|hr)[^>]*\/?>/gi, '\n')

  // Supprimer toutes les autres balises
  text = text.replace(/<[^>]+>/g, ' ')

  // Décoder les entités HTML courantes
  text = decodeHtmlEntities(text)

  // Normaliser les espaces et les lignes
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n\s*\n/g, '\n\n')
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')

  return text.trim()
}

/**
 * Convertit HTML en Markdown basique
 */
function htmlToMarkdown(html: string): string {
  let md = html

  // Supprimer scripts et styles
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  md = md.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  md = md.replace(/<!--[\s\S]*?-->/g, '')

  // Convertir les headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')

  // Convertir les liens
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Convertir les images
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)')
  md = md.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![$1]($2)')
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)')

  // Convertir le gras et l'italique
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')

  // Convertir les listes
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n')

  // Convertir les paragraphes et les divs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n')

  // Convertir les sauts de ligne
  md = md.replace(/<br[^>]*\/?>/gi, '\n')
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n')

  // Convertir le code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')

  // Supprimer toutes les autres balises
  md = md.replace(/<[^>]+>/g, '')

  // Décoder les entités HTML
  md = decodeHtmlEntities(md)

  // Normaliser les espaces
  md = md.replace(/[ \t]+/g, ' ')
  md = md.replace(/\n{3,}/g, '\n\n')
  md = md
    .split('\n')
    .map((line) => line.trim())
    .join('\n')

  return md.trim()
}

/**
 * Décode les entités HTML courantes
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&cent;': '¢',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '\u2026',
    '&bull;': '\u2022',
  }

  let decoded = text
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char)
  }

  // Décoder les entités numériques (&#123; ou &#x7B;)
  decoded = decoded.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)))
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  )

  return decoded
}

/**
 * Extrait tous les liens d'une page
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi
  const links: Set<string> = new Set()
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim()

    // Ignorer les liens javascript: et mailto:
    if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue
    }

    // Convertir les liens relatifs en absolus
    try {
      const absoluteUrl = new URL(href, baseUrl).href
      links.add(absoluteUrl)
    } catch {
      // Ignorer les URLs invalides
    }
  }

  return Array.from(links)
}

/**
 * Extrait toutes les images d'une page
 */
function extractImages(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
  const images: Set<string> = new Set()
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim()

    // Ignorer les data URIs trop petites (icônes, spacers)
    if (src.startsWith('data:') && src.length < 500) {
      continue
    }

    try {
      const absoluteUrl = new URL(src, baseUrl).href
      images.add(absoluteUrl)
    } catch {
      // Ignorer les URLs invalides
    }
  }

  return Array.from(images)
}

/**
 * Extrait les métadonnées d'une page (title, description, og:*, etc.)
 */
function extractMetadata(html: string): ScrapeResponse['metadata'] {
  const getMetaContent = (nameOrProperty: string): string | undefined => {
    const patterns = [
      new RegExp(`<meta[^>]*name=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${nameOrProperty}["']`, 'i'),
      new RegExp(`<meta[^>]*property=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${nameOrProperty}["']`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        return decodeHtmlEntities(match[1].trim())
      }
    }
    return undefined
  }

  // Extraire le titre
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined

  // Extraire le canonical URL
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
  const canonicalUrl = canonicalMatch?.[1]

  // Extraire la langue
  const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i)
  const language = langMatch?.[1]

  // Extraire les keywords
  const keywordsStr = getMetaContent('keywords')
  const keywords = keywordsStr
    ? keywordsStr
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : undefined

  return {
    title,
    description: getMetaContent('description'),
    author: getMetaContent('author'),
    keywords,
    ogImage: getMetaContent('og:image'),
    ogTitle: getMetaContent('og:title'),
    ogDescription: getMetaContent('og:description'),
    canonicalUrl,
    language,
  }
}

/**
 * Extrait un élément spécifique via un sélecteur CSS basique
 * Supporte: #id, .class, tag, tag.class, tag#id
 */
function extractBySelector(html: string, selector: string): string | null {
  let pattern: RegExp

  if (selector.startsWith('#')) {
    // Sélecteur ID: #myId
    const id = selector.slice(1)
    pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'i')
  } else if (selector.startsWith('.')) {
    // Sélecteur classe: .myClass
    const className = selector.slice(1)
    pattern = new RegExp(
      `<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`,
      'i'
    )
  } else if (selector.includes('.')) {
    // Sélecteur tag.class: div.content
    const [tag, className] = selector.split('.')
    pattern = new RegExp(
      `<${tag}[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
      'i'
    )
  } else if (selector.includes('#')) {
    // Sélecteur tag#id: main#content
    const [tag, id] = selector.split('#')
    pattern = new RegExp(`<${tag}[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  } else {
    // Sélecteur de tag simple: main, article, etc.
    pattern = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i')
  }

  const match = html.match(pattern)
  return match ? match[0] : null
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  // Require auth (signed-in user OR service role) — prevent open scraping proxy abuse
  const auth = await validateServiceOrUser(req)
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    })
  }

  try {
    const body: ScrapeRequest = await req.json()

    // Validation
    if (!body.url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }

    // Normaliser l'URL
    let url = body.url.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }

    // 🔒 SSRF guard: block private / loopback / link-local / cloud metadata hosts
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^192\.168\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^169\.254\./,
        /^0\.0\.0\.0$/,
        /^::1$/,
        /^\[?::1\]?$/,
        /^\[?fc[0-9a-f]{2}:/i,
        /^\[?fe80:/i,
        /\.internal$/i,
        /\.local$/i,
        /metadata\.google\.internal$/i,
      ]
      if (blockedPatterns.some((rx) => rx.test(host))) {
        return new Response(
          JSON.stringify({ success: false, error: 'URL not allowed (private/internal host)' }),
          { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
        )
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Only http/https protocols are allowed' }),
          { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid URL' }), {
        status: 400,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }

    console.log(`[jarvis-web-scrape] 🌐 Scraping: ${url}`)
    console.log(`[jarvis-web-scrape] Formats: ${body.formats?.join(', ') || 'text (default)'}`)

    // Configuration
    const formats = body.formats || ['text']
    const maxLength = body.maxLength || 50000 // 50k caractères par défaut
    const timeout = body.timeout || 15000 // 15s timeout par défaut

    // Fetch la page avec timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Jarvis-Bot/1.0; +https://exploitant.example.org/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity', // Pas de compression pour simplicité
        },
        signal: controller.signal,
        // 🔒 SSRF hardening: refuse redirects to prevent redirect-based bypass
        // of the private-IP blocklist applied to the initial hostname above.
        redirect: 'error',
      })
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      const msg = (fetchErr as Error)?.message ?? ''
      if (msg.toLowerCase().includes('redirect')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Redirects are not allowed for scraped URLs' }),
          { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
        )
      }
      throw fetchErr
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          url,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier le content-type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return new Response(
        JSON.stringify({
          success: false,
          url,
          error: `Unsupported content type: ${contentType}. Only HTML pages are supported.`,
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    // Lire le HTML
    let html = await response.text()

    // Si un sélecteur est fourni, extraire uniquement cet élément
    if (body.selector) {
      const extracted = extractBySelector(html, body.selector)
      if (extracted) {
        html = extracted
        console.log(`[jarvis-web-scrape] Extracted element with selector: ${body.selector}`)
      } else {
        console.log(`[jarvis-web-scrape] ⚠️ Selector "${body.selector}" not found, using full page`)
      }
    }

    // Construire la réponse
    const result: ScrapeResponse = {
      success: true,
      url,
    }

    // Extraire selon les formats demandés
    if (formats.includes('text')) {
      let text = htmlToText(html)
      if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '\n\n[Contenu tronqué...]'
      }
      result.text = text
      result.wordCount = text.split(/\s+/).filter((w) => w.length > 0).length
    }

    if (formats.includes('markdown')) {
      let md = htmlToMarkdown(html)
      if (md.length > maxLength) {
        md = md.substring(0, maxLength) + '\n\n[Contenu tronqué...]'
      }
      result.markdown = md
    }

    if (formats.includes('html')) {
      let cleanHtml = html
      if (cleanHtml.length > maxLength) {
        cleanHtml = cleanHtml.substring(0, maxLength) + '\n<!-- Truncated -->'
      }
      result.html = cleanHtml
    }

    if (formats.includes('links')) {
      result.links = extractLinks(html, url)
    }

    if (formats.includes('metadata') || formats.includes('text') || formats.includes('markdown')) {
      const metadata = extractMetadata(html)
      result.metadata = metadata
      result.title = metadata?.title || metadata?.ogTitle
    }

    if (body.includeImages) {
      result.images = extractImages(html, url)
    }

    console.log(
      `[jarvis-web-scrape] ✅ Success - ${result.wordCount || 0} words, ${result.links?.length || 0} links`
    )

    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Gérer l'erreur de timeout spécifiquement
    if (errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
      return buildErrorResponse('jarvis-web-scrape', error, getCorsHeaders(req.headers.get('origin')), 500)
    }

    return buildErrorResponse('jarvis-web-scrape', error, getCorsHeaders(req.headers.get('origin')), 500)
  }
})
