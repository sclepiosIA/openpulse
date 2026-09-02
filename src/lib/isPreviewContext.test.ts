/**
 * @vitest-environment jsdom
 */

type MinimalPreviewWindow = {
  location: {
    hostname: string
    search: string
  }
  self: object
  top: object
  __NO_SW__?: boolean
}

function createPreviewWindow(
  options: {
    hostname?: string
    search?: string
    isIframe?: boolean
    noSw?: boolean
  } = {}
): MinimalPreviewWindow {
  const self = {}
  const top = options.isIframe === true ? {} : self

  const base: MinimalPreviewWindow = {
    location: {
      hostname: options.hostname ?? 'app.example.test',
      search: options.search ?? '',
    },
    self,
    top,
  }

  if (typeof options.noSw === 'boolean') {
    return { ...base, __NO_SW__: options.noSw }
  }

  return base
}

function createWindowWithInaccessibleTop(): MinimalPreviewWindow {
  const self = {}

  return {
    location: {
      hostname: 'app.example.test',
      search: '',
    },
    self,
    get top(): object {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
}

async function isPreviewContextResult(): Promise<boolean> {
  const module = await import('./isPreviewContext')
  return module.isPreviewContext()
}

describe('isPreviewContext', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('PROD', true)
    vi.stubGlobal('window', createPreviewWindow())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns false outside the browser', async () => {
    vi.stubGlobal('window', undefined)

    await expect(isPreviewContextResult()).resolves.toBe(false)
  })

  it('returns false in production for a normal top-level page without flags', async () => {
    vi.stubGlobal(
      'window',
      createPreviewWindow({
        hostname: 'app.example.test',
        search: '?sw=on&no-sw=0',
        noSw: false,
      })
    )

    await expect(isPreviewContextResult()).resolves.toBe(false)
  })

  it('returns true outside production even without iframe, host, query, or kill-switch flags', async () => {
    vi.stubEnv('PROD', false)
    vi.stubGlobal(
      'window',
      createPreviewWindow({
        hostname: 'app.example.test',
        search: '',
        isIframe: false,
        noSw: false,
      })
    )

    await expect(isPreviewContextResult()).resolves.toBe(true)
  })

  it('returns true when running inside an iframe', async () => {
    vi.stubGlobal(
      'window',
      createPreviewWindow({
        hostname: 'app.example.test',
        isIframe: true,
      })
    )

    await expect(isPreviewContextResult()).resolves.toBe(true)
  })

  it('returns true when iframe detection cannot access window.top', async () => {
    vi.stubGlobal('window', createWindowWithInaccessibleTop())

    await expect(isPreviewContextResult()).resolves.toBe(true)
  })

  it.each([
    'id-preview--workspace.apercu.example.org',
    'preview--workspace.apercu.example.org',
    'previsualisation.example.org',
    'demo.previsualisation.example.org',
    'previsualisation-dev.example.org',
    'demo.previsualisation-dev.example.org',
    'beta.generation.example.org',
    'demo.beta.generation.example.org',
  ])('returns true for preview hostname %s', async (hostname) => {
    vi.stubGlobal('window', createPreviewWindow({ hostname }))

    await expect(isPreviewContextResult()).resolves.toBe(true)
  })

  it.each([
    ['?sw=off', 'sw'],
    ['?no-sw=1', 'no-sw'],
    ['?x=1&sw=off&no-sw=0', 'sw with additional params'],
    ['?x=1&sw=on&no-sw=1', 'no-sw with additional params'],
  ])('returns true when query string disables service worker via %s (%s)', async (search) => {
    vi.stubGlobal(
      'window',
      createPreviewWindow({
        hostname: 'app.example.test',
        search,
      })
    )

    await expect(isPreviewContextResult()).resolves.toBe(true)
  })

  it('returns true when the global __NO_SW__ kill-switch is enabled', async () => {
    vi.stubGlobal(
      'window',
      createPreviewWindow({
        hostname: 'app.example.test',
        search: '',
        noSw: true,
      })
    )

    await expect(isPreviewContextResult()).resolves.toBe(true)
  })

  it.each([
    'id-preview.example.test',
    'my-preview--workspace.apercu.example.org',
    'previsualisation.example.org.example.test',
    'demo.previsualisation-dev.example.org.example.test',
    'alpha.generation.example.org',
  ])('returns false for non-matching hostname %s in production', async (hostname) => {
    vi.stubGlobal(
      'window',
      createPreviewWindow({
        hostname,
        search: '',
        noSw: false,
      })
    )

    await expect(isPreviewContextResult()).resolves.toBe(false)
  })

  it.each(['?sw=on', '?no-sw=0', '?sw=OFF', '?no-sw=true'])(
    'returns false for non-disabling query string %s in production',
    async (search) => {
      vi.stubGlobal(
        'window',
        createPreviewWindow({
          hostname: 'app.example.test',
          search,
          noSw: false,
        })
      )

      await expect(isPreviewContextResult()).resolves.toBe(false)
    }
  )
})
