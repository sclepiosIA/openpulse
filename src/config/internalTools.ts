export type InternalToolKey = 'gitea' | 'penpot'
export type InternalToolSsoMode = 'authentik-oidc'
export type InternalToolReadiness = 'pending' | 'verified' | 'blocked'

export interface InternalToolRuntimeConfig {
  url?: string
  externalUrl?: string
  launchUrl?: string
  embed?: boolean
  ssoMode?: string
  readiness?: string
}

export interface InternalToolRuntimeContext {
  embedRuntimeEnabled: boolean
  parentOrigin: string
}

export type InternalToolPresentation =
  | { mode: 'iframe'; url: string }
  | { mode: 'external'; url: string; reason: string }
  | { mode: 'disabled'; reason: string }

interface InternalToolPolicy {
  origin: string
  launchPath: string
  parentOrigins: ReadonlySet<string>
  externalOrigins: ReadonlySet<string>
}

const DESKTOP_SAME_SITE_ORIGIN = 'https://espace.exploitant.example.org'

const INTERNAL_TOOL_POLICIES: Record<InternalToolKey, InternalToolPolicy> = {
  gitea: {
    origin: 'https://forge.exploitant.example.org',
    launchPath: '/user/oauth2/authentik',
    parentOrigins: new Set([DESKTOP_SAME_SITE_ORIGIN]),
    externalOrigins: new Set([
      'https://forge.exploitant.example.org',
      'https://gitea.openpulse.example.org',
      'https://gitea.exploitant.example.org',
    ]),
  },
  penpot: {
    origin: 'https://design.exploitant.example.org',
    launchPath: '/openpulse-sso-bootstrap',
    parentOrigins: new Set([DESKTOP_SAME_SITE_ORIGIN]),
    externalOrigins: new Set([
      'https://design.exploitant.example.org',
      'https://design.openpulse.example.org',
      'https://penpot.exploitant.example.org',
    ]),
  },
}

function parseHttpsUrl(value: string | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

export function resolveInternalToolPresentation(
  tool: string,
  config: InternalToolRuntimeConfig | null | undefined,
  context: InternalToolRuntimeContext
): InternalToolPresentation {
  if (tool !== 'gitea' && tool !== 'penpot') {
    return { mode: 'disabled', reason: 'unsupported-tool' }
  }

  const policy = INTERNAL_TOOL_POLICIES[tool]
  const configuredUrl = parseHttpsUrl(config?.url)
  const externalUrl = parseHttpsUrl(config?.externalUrl)
  const launchUrl = parseHttpsUrl(config?.launchUrl)
  const parentOrigin = parseHttpsUrl(context.parentOrigin)?.origin

  if (
    configuredUrl &&
    (configuredUrl.username !== '' ||
      configuredUrl.password !== '' ||
      configuredUrl.pathname !== '/' ||
      configuredUrl.search !== '' ||
      configuredUrl.hash !== '')
  ) {
    return { mode: 'disabled', reason: 'unsafe-configured-url' }
  }

  if (
    config?.externalUrl &&
    (!externalUrl ||
      externalUrl.username !== '' ||
      externalUrl.password !== '' ||
      externalUrl.pathname !== '/' ||
      externalUrl.search !== '' ||
      externalUrl.hash !== '')
  ) {
    return { mode: 'disabled', reason: 'unsafe-external-url' }
  }

  if (launchUrl && (launchUrl.username !== '' || launchUrl.password !== '')) {
    return { mode: 'disabled', reason: 'unsafe-launch-url' }
  }

  if (launchUrl && (launchUrl.search !== '' || launchUrl.hash !== '')) {
    return { mode: 'disabled', reason: 'unsafe-launch-url' }
  }

  const verified =
    context.embedRuntimeEnabled &&
    config?.embed === true &&
    config.ssoMode === 'authentik-oidc' &&
    config.readiness === 'verified' &&
    configuredUrl?.origin === policy.origin &&
    launchUrl?.origin === policy.origin &&
    launchUrl.pathname === policy.launchPath &&
    launchUrl.search === '' &&
    launchUrl.hash === '' &&
    parentOrigin !== undefined &&
    policy.parentOrigins.has(parentOrigin)

  if (verified && launchUrl) {
    return { mode: 'iframe', url: launchUrl.toString() }
  }

  const fallbackUrl = externalUrl ?? configuredUrl
  if (fallbackUrl && policy.externalOrigins.has(fallbackUrl.origin)) {
    return { mode: 'external', url: fallbackUrl.toString(), reason: 'embed-not-verified' }
  }

  return { mode: 'disabled', reason: 'invalid-tool-origin' }
}
