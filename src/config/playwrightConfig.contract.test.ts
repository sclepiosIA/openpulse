// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'

type PlaywrightConfig = {
  use?: { baseURL?: string }
  webServer?: unknown
  reporter?: unknown
}

async function loadConfig(
  configPath: '../../playwright.config.ts' | '../../playwright.smoke.config.ts',
  env: {
    PW_BASE_URL?: string
    PLAYWRIGHT_BASE_URL?: string
    CI?: string
  }
) {
  vi.resetModules()
  vi.stubEnv('PW_BASE_URL', env.PW_BASE_URL)
  vi.stubEnv('PLAYWRIGHT_BASE_URL', env.PLAYWRIGHT_BASE_URL)
  vi.stubEnv('CI', env.CI)

  return (await import(configPath)).default as PlaywrightConfig
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe.each([
  ['full', '../../playwright.config.ts'],
  ['smoke', '../../playwright.smoke.config.ts'],
] as const)('%s Playwright config', (_name, configPath) => {
  it('uses PW_BASE_URL remotely without starting a local Vite server', async () => {
    const config = await loadConfig(configPath, {
      PW_BASE_URL: 'https://gestion.exploitant.example.org',
    })

    expect(config.use?.baseURL).toBe('https://gestion.exploitant.example.org')
    expect(config.webServer).toBeUndefined()
  })

  it('uses PLAYWRIGHT_BASE_URL as the remote fallback without starting Vite', async () => {
    const config = await loadConfig(configPath, {
      PLAYWRIGHT_BASE_URL: 'https://gestion.exploitant.example.org',
    })

    expect(config.use?.baseURL).toBe('https://gestion.exploitant.example.org')
    expect(config.webServer).toBeUndefined()
  })

  it('keeps the local server contract when no remote target is configured', async () => {
    const config = await loadConfig(configPath, {})

    expect(config.use?.baseURL).toBe('http://localhost:8080')
    expect(config.webServer).toMatchObject({
      command: 'npm run dev',
      url: 'http://localhost:8080',
    })
  })
})

describe('CI Playwright collection artifacts', () => {
  it('writes JSON and JUnit reports for the full CRM collection', async () => {
    const config = await loadConfig('../../playwright.config.ts', { CI: 'true' })

    expect(config.reporter).toEqual(
      expect.arrayContaining([
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ])
    )
  })
})

describe('Playwright ESM collection dependencies', () => {
  it('does not use CommonJS require in the Node WebSocket polyfill', async () => {
    const source = await readFile(
      new URL('../../tests/support/ws-polyfill.ts', import.meta.url),
      'utf8'
    )

    expect(source).toContain("import WebSocket from 'ws'")
    expect(source).not.toMatch(/\brequire\s*\(/)
  })
})
