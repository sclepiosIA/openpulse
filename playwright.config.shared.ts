const LOCAL_PLAYWRIGHT_BASE_URL = 'http://localhost:8080'

export function resolvePlaywrightBaseURL(env = process.env): string {
  return env.PW_BASE_URL ?? env.PLAYWRIGHT_BASE_URL ?? env.E2E_BASE_URL ?? LOCAL_PLAYWRIGHT_BASE_URL
}

export function isLocalPlaywrightTarget(baseURL: string): boolean {
  try {
    const hostname = new URL(baseURL).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    // An invalid explicit target must never cause Playwright to start a local
    // server: surface the invalid URL through Playwright instead.
    return false
  }
}

export function localWebServerFor(baseURL: string) {
  if (!isLocalPlaywrightTarget(baseURL)) return undefined

  return {
    command: 'npm run dev',
    url: LOCAL_PLAYWRIGHT_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  }
}
