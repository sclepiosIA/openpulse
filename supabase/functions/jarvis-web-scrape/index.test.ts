import {
  assertEquals,
  assertExists,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

type Helpers = {
  htmlToText: (html: string) => string
  htmlToMarkdown: (html: string) => string
  decodeHtmlEntities: (text: string) => string
  extractLinks: (html: string, baseUrl: string) => string[]
  extractImages: (html: string, baseUrl: string) => string[]
  extractMetadata: (html: string) => {
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
  extractBySelector: (html: string, selector: string) => string | null
}

let helpersPromise: Promise<Helpers> | undefined

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

function getPureSource(source: string): string {
  const start = source.indexOf('// Types de sortie supportés')
  const end = source.indexOf(
    '// ============================================================\n// Main Handler'
  )

  if (start < 0) {
    throw new Error('Unable to find pure helpers start marker')
  }

  if (end <= start) {
    throw new Error('Unable to find pure helpers end marker')
  }

  return `${source.slice(start, end)}
export { htmlToText, htmlToMarkdown, decodeHtmlEntities, extractLinks, extractImages, extractMetadata, extractBySelector };
`
}

function loadPureHelpers(): Promise<Helpers> {
  if (helpersPromise) return helpersPromise

  helpersPromise = (async () => {
    const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))
    const pureSource = getPureSource(source)
    const specifier = `data:application/typescript;base64,${encodeBase64(pureSource)}`

    return (await import(specifier)) as Helpers
  })()

  return helpersPromise
}

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('pure helper extraction fails loudly when source markers are missing', () => {
  assertThrows(
    () => getPureSource('function htmlToText() {}'),
    Error,
    'Unable to find pure helpers start marker'
  )

  assertThrows(
    () => getPureSource('// Types de sortie supportés\nfunction htmlToText() {}'),
    Error,
    'Unable to find pure helpers end marker'
  )
})

Deno.test('htmlToText removes scripts styles comments noscript and decodes entities', async () => {
  const { htmlToText } = await loadPureHelpers()

  const html = [
    '<article>',
    '<h1>Hello&nbsp;<strong>World</strong></h1>',
    "<script>window.secret = 'must not appear';</script>",
    '<style>.hidden { display: none; }</style>',
    '<!-- ignored comment -->',
    '<p>Tom &amp; Jerry &#169; &#x41;</p>',
    '<noscript>ignored noscript</noscript>',
    '</article>',
  ].join('')

  assertEquals(htmlToText(html), 'Hello World\nTom & Jerry © A')
})

Deno.test('htmlToMarkdown converts headings links emphasis images lists and code', async () => {
  const { htmlToMarkdown } = await loadPureHelpers()

  const html =
    '<h1>Title &amp; More</h1><p>Read <a href="/docs">docs</a> and <strong>bold</strong> <em>now</em>.</p><ul><li>One</li><li>Two</li></ul><p><code>x = 1</code></p><img src="/logo.png" alt="Logo">'

  assertEquals(
    htmlToMarkdown(html),
    '# Title & More\n\nRead [docs](/docs) and **bold** *now*.\n\n- One\n- Two\n\n`x = 1`\n![Logo](/logo.png)'
  )
})

Deno.test('decodeHtmlEntities handles named decimal and hexadecimal entities', async () => {
  const { decodeHtmlEntities } = await loadPureHelpers()

  assertEquals(
    decodeHtmlEntities('&lt;Jarvis&gt; &mdash; prix&nbsp;: 20&euro; &#169; &#x41; &unknown;'),
    '<Jarvis> — prix : 20€ © A &unknown;'
  )
})

Deno.test(
  'extractLinks resolves relative URLs deduplicates and ignores unsafe schemes and fragments',
  async () => {
    const { extractLinks } = await loadPureHelpers()

    const html = [
      '<a href="/about">About</a>',
      '<a href="/about">Duplicate</a>',
      '<a href="contact">Contact</a>',
      '<a href="../parent">Parent</a>',
      '<a href="https://cdn.example.org/resource">CDN</a>',
      '<a href="mailto:test@example.com">Mail</a>',
      '<a href="javascript:alert(1)">JS</a>',
      '<a href="tel:+33123456789">Phone</a>',
      '<a href="#section">Anchor</a>',
    ].join('')

    assertEquals(extractLinks(html, 'https://example.com/base/page.html'), [
      'https://example.com/about',
      'https://example.com/base/contact',
      'https://example.com/parent',
      'https://cdn.example.org/resource',
    ])
  }
)

Deno.test('extractImages resolves image URLs deduplicates and ignores tiny data URIs', async () => {
  const { extractImages } = await loadPureHelpers()

  const largeDataUri = `data:image/png;base64,${'A'.repeat(520)}`
  const html = [
    '<img src="/img/logo.png" alt="Logo">',
    '<img src="photo.jpg" alt="Photo">',
    '<img src="/img/logo.png" alt="Duplicate">',
    '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Spacer">',
    `<img src="${largeDataUri}" alt="Inline">`,
  ].join('')

  assertEquals(extractImages(html, 'https://example.com/articles/post'), [
    'https://example.com/img/logo.png',
    'https://example.com/articles/photo.jpg',
    largeDataUri,
  ])
})

Deno.test(
  'extractMetadata reads title meta tags canonical url language keywords and OpenGraph fields',
  async () => {
    const { extractMetadata } = await loadPureHelpers()

    const html = [
      '<html lang="fr">',
      '<head>',
      '<title>Jarvis &amp; Co</title>',
      '<meta name="description" content="Desc &amp; details">',
      '<meta content="Ada Lovelace" name="author">',
      '<meta name="keywords" content="ai, deno, scraping , ">',
      '<meta property="og:title" content="OG &quot;Title&quot;">',
      '<meta content="OG description" property="og:description">',
      '<meta property="og:image" content="https://example.com/og.png">',
      '<link rel="canonical" href="https://example.com/canonical">',
      '</head>',
      '</html>',
    ].join('')

    assertEquals(extractMetadata(html), {
      title: 'Jarvis & Co',
      description: 'Desc & details',
      author: 'Ada Lovelace',
      keywords: ['ai', 'deno', 'scraping'],
      ogImage: 'https://example.com/og.png',
      ogTitle: 'OG "Title"',
      ogDescription: 'OG description',
      canonicalUrl: 'https://example.com/canonical',
      language: 'fr',
    })
  }
)

Deno.test(
  'extractBySelector supports tag class tag id simple tag and missing selectors',
  async () => {
    const { extractBySelector } = await loadPureHelpers()

    const html = [
      '<main id="content">',
      '<article class="post featured"><h1>A</h1><p>B</p></article>',
      '</main>',
      '<aside class="post">No</aside>',
    ].join('')

    assertEquals(
      extractBySelector(html, 'article.post'),
      '<article class="post featured"><h1>A</h1><p>B</p></article>'
    )

    assertEquals(
      extractBySelector(html, 'main#content'),
      '<main id="content"><article class="post featured"><h1>A</h1><p>B</p></article></main>'
    )

    assertEquals(extractBySelector(html, 'aside'), '<aside class="post">No</aside>')

    assertEquals(extractBySelector(html, 'section.missing'), null)
  }
)

Deno.test('source keeps SSRF and redirect hardening in the HTTP handler', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertExists(source)
  assertEquals(source.includes('URL not allowed (private/internal host)'), true)
  assertEquals(source.includes('Only http/https protocols are allowed'), true)
  assertEquals(source.includes("redirect: 'error'"), true)
  assertEquals(source.includes('Redirects are not allowed for scraped URLs'), true)
  assertEquals(source.includes('metadata\\.google\\.internal'), true)
  assertEquals(source.includes('/^localhost$/i'), true)
  assertEquals(source.includes('/^127\\./'), true)
  assertEquals(source.includes('/^10\\./'), true)
  assertEquals(source.includes('/^192\\.168\\./'), true)
  assertEquals(source.includes('/^172\\.(1[6-9]|2\\d|3[01])\\./'), true)
  assertEquals(source.includes('/^169\\.254\\./'), true)
})
