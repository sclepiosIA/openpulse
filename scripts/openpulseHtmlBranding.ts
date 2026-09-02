export type IndexHtmlBrandingEnv = Readonly<Record<string, string | undefined>>

const DEFAULT_PRODUCT_NAME = 'OpenPulse'
const PRODUCT_NAME_TOKEN = '%VITE_MARQUE_NOM_PRODUIT%'
const CSP_TOKENS = [
  'VITE_CSP_IMG_EXTRA',
  'VITE_CSP_CONNECT_EXTRA',
  'VITE_CSP_FRAME_EXTRA',
  'VITE_CSP_MEDIA_EXTRA',
] as const
const ALLOWED_CSP_ORIGIN_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:'])

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeCspOrigins(variable: (typeof CSP_TOKENS)[number], value: string | undefined) {
  const sources = value?.trim().split(/\s+/).filter(Boolean) ?? []

  return [
    ...new Set(
      sources.map((source) => {
        let url: URL

        try {
          url = new URL(source)
        } catch {
          throw new Error(`${variable} doit contenir uniquement des origines explicites`)
        }

        const isOriginOnly =
          ALLOWED_CSP_ORIGIN_PROTOCOLS.has(url.protocol) &&
          !source.includes('*') &&
          !source.includes(';') &&
          !url.username &&
          !url.password &&
          url.pathname === '/' &&
          !url.search &&
          !url.hash

        if (!isOriginOnly) {
          throw new Error(`${variable} doit contenir uniquement des origines explicites`)
        }

        return url.origin
      })
    ),
  ].join(' ')
}

/**
 * Resolves the HTML-only brand and CSP placeholders before Vite's native
 * replacement pass. Missing optional CSP origins become an empty directive
 * segment; the product name keeps the same safe default as `MARQUE`.
 */
export function applyIndexHtmlBranding(html: string, env: IndexHtmlBrandingEnv): string {
  const productName = env.VITE_MARQUE_NOM_PRODUIT?.trim() || DEFAULT_PRODUCT_NAME
  let transformed = html.replaceAll(PRODUCT_NAME_TOKEN, escapeHtmlAttribute(productName))

  for (const variable of CSP_TOKENS) {
    transformed = transformed.replaceAll(
      `%${variable}%`,
      escapeHtmlAttribute(normalizeCspOrigins(variable, env[variable]))
    )
  }

  return transformed
}
