/* @vitest-environment jsdom */

import React from 'react'

const {
  appComponent,
  createRootMock,
  renderMock,
  performanceInit,
  pwaInit,
  consoleCaptureInit,
  frontendErrorCaptureInit,
  installConsoleErrorFilterMock,
  initLiveUpdatesMock,
  installFetchInterceptorMock,
  webVitalsInit,
  infoSpy,
  warnSpy,
  errorSpy,
  getRegistrationsMock,
  unregisterMock,
  cachesKeysMock,
  cachesDeleteMock,
} = vi.hoisted(() => {
  const renderMock = vi.fn()
  const createRootMock = vi.fn(() => ({ render: renderMock }))

  return {
    appComponent: () => React.createElement('div', { 'data-testid': 'app' }, 'App'),
    createRootMock,
    renderMock,
    performanceInit: vi.fn(),
    pwaInit: vi.fn(),
    consoleCaptureInit: vi.fn(),
    frontendErrorCaptureInit: vi.fn(),
    installConsoleErrorFilterMock: vi.fn(),
    initLiveUpdatesMock: vi.fn(() => Promise.resolve()),
    installFetchInterceptorMock: vi.fn(),
    webVitalsInit: vi.fn(),
    infoSpy: vi.fn(),
    warnSpy: vi.fn(),
    errorSpy: vi.fn(),
    getRegistrationsMock: vi.fn(async () => [{ unregister: vi.fn() }]),
    unregisterMock: vi.fn(async () => true),
    cachesKeysMock: vi.fn(async () => ['a', 'b']),
    cachesDeleteMock: vi.fn(async () => true),
  }
})

vi.mock('./App', () => ({
  default: appComponent,
}))

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}))

vi.mock('./lib/performance', () => ({
  performanceMonitor: { init: performanceInit },
}))

vi.mock('./lib/pwa-analytics', () => ({
  pwaAnalytics: { init: pwaInit },
}))

vi.mock('./lib/consoleCapture', () => ({
  consoleCapture: { init: consoleCaptureInit },
}))

vi.mock('./lib/frontendErrorCapture', () => ({
  frontendErrorCapture: { init: frontendErrorCaptureInit },
}))

vi.mock('./lib/consoleErrorFilter', () => ({
  installConsoleErrorFilter: installConsoleErrorFilterMock,
}))

vi.mock('./lib/liveUpdates', () => ({
  initLiveUpdates: initLiveUpdatesMock,
}))

vi.mock('./lib/observability', () => ({
  observability: { installFetchInterceptor: installFetchInterceptorMock },
}))

vi.mock('./lib/webVitalsCapture', () => ({
  webVitalsCapture: { init: webVitalsInit },
}))

vi.mock('./index.css', () => ({}))

describe('main.tsx', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    document.body.innerHTML = '<div id="root"></div>'

    Object.defineProperty(window, 'self', {
      configurable: true,
      value: window,
    })

    Object.defineProperty(window, 'top', {
      configurable: true,
      value: window,
    })

    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: '',
    })

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'http://localhost',
        pathname: '/',
        reload: vi.fn(),
      },
    })

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })

    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'vitest',
    })

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: getRegistrationsMock,
        ready: Promise.resolve({
          waiting: {
            postMessage: vi.fn(),
          },
        }),
      },
    })

    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: cachesKeysMock,
        delete: cachesDeleteMock,
      },
    })

    vi.spyOn(console, 'info').mockImplementation(infoSpy)
    vi.spyOn(console, 'warn').mockImplementation(warnSpy)
    vi.spyOn(console, 'error').mockImplementation(errorSpy)
  })

  it('initialise les services de bootstrap et monte App dans #root', async () => {
    await import('./main')

    expect(consoleCaptureInit).toHaveBeenCalledTimes(1)
    expect(frontendErrorCaptureInit).toHaveBeenCalledTimes(1)
    expect(installFetchInterceptorMock).toHaveBeenCalledTimes(1)
    expect(webVitalsInit).toHaveBeenCalledTimes(1)
    expect(initLiveUpdatesMock).toHaveBeenCalledTimes(1)
    expect(performanceInit).toHaveBeenCalledTimes(1)
    expect(pwaInit).toHaveBeenCalledTimes(1)
    expect(installConsoleErrorFilterMock).toHaveBeenCalledTimes(1)

    expect(createRootMock).toHaveBeenCalledTimes(1)
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'))
    expect(renderMock).toHaveBeenCalledTimes(1)

    const renderedElement = renderMock.mock.calls[0][0] as React.ReactElement
    expect(renderedElement.type).toBe(appComponent)
  })

  it('désenregistre les service workers et vide les caches en iframe tierce', async () => {
    const fakeTop = {}
    Object.defineProperty(window, 'self', {
      configurable: true,
      value: window,
    })
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: fakeTop,
    })
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://third-party.example/frame',
    })

    const reg1 = { unregister: unregisterMock }
    const reg2 = { unregister: unregisterMock }
    getRegistrationsMock.mockResolvedValueOnce([reg1, reg2])

    await import('./main')
    await Promise.resolve()
    await Promise.resolve()

    expect(getRegistrationsMock).toHaveBeenCalledTimes(1)
    expect(unregisterMock).toHaveBeenCalledTimes(2)
    expect(cachesKeysMock).toHaveBeenCalledTimes(1)
    expect(cachesDeleteMock).toHaveBeenCalledWith('a')
    expect(cachesDeleteMock).toHaveBeenCalledWith('b')
  })

  it('capture une erreur de chunk dynamique via window error et tente une recovery SW', async () => {
    const postMessage = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: getRegistrationsMock,
        ready: Promise.resolve({
          waiting: {
            postMessage,
          },
        }),
      },
    })

    await import('./main')

    const evt = new Event('error') as Event & {
      message?: string
      filename?: string
      error?: Error
      target?: EventTarget | null
    }
    evt.message = 'Loading chunk 12 failed'
    evt.filename = 'https://cdn.example/chunk.js'

    window.dispatchEvent(evt)
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(warnSpy).toHaveBeenCalledWith(
      '[Chunk Recovery] Failure #1:',
      expect.objectContaining({
        errorMessage: 'Loading chunk 12 failed',
        chunkUrl: 'https://cdn.example/chunk.js',
        route: '/',
        online: true,
      }),
    )
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('intercepte unhandledrejection de chunk et appelle preventDefault au moins une fois', async () => {
    await import('./main')

    const preventDefault = vi.fn()
    const event = new Event('unhandledrejection') as Event & {
      reason?: { message?: string }
      preventDefault: () => void
    }
    event.reason = { message: 'dynamically imported module failed' }
    event.preventDefault = preventDefault

    window.dispatchEvent(event)
    await Promise.resolve()

    expect(preventDefault).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      '[Chunk Recovery] Failure #1:',
      expect.objectContaining({
        errorMessage: 'dynamically imported module failed',
        chunkUrl: undefined,
        route: '/',
        online: true,
      }),
    )
  })

  it('récupère une erreur DOM removeChild et nettoie les overlays orphelins', async () => {
    document.body.setAttribute('data-scroll-locked', '1')
    document.body.style.pointerEvents = 'none'

    const overlay = document.createElement('div')
    overlay.setAttribute('data-radix-portal', 'true')
    document.body.appendChild(overlay)

    await import('./main')

    const preventDefault = vi.fn()
    const evt = new Event('error', { bubbles: true, cancelable: true }) as Event & {
      error?: Error
      preventDefault: () => void
    }
    evt.error = new Error('Failed to execute removeChild on Node')
    evt.preventDefault = preventDefault

    window.dispatchEvent(evt)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(preventDefault).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[DOM Recovery] Caught DOM manipulation error, attempting recovery')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
    expect(document.body.style.pointerEvents).toBe('')
    expect(document.querySelector('[data-radix-portal]')).toBeNull()
  })

  it('affiche un fallback DOM si le montage React échoue', async () => {
    createRootMock.mockImplementationOnce(() => {
      throw new Error('mount failed')
    })

    await import('./main')

    const root = document.getElementById('root')
    expect(root?.innerHTML).toContain("Erreur de chargement de l'application")
    expect(root?.innerHTML).toContain('Actualiser la page')
    expect(errorSpy).toHaveBeenCalledWith('[Main] Fatal error during React mount:', expect.any(Error))
  })

  it('continue le bootstrap si performanceMonitor.init échoue', async () => {
    performanceInit.mockImplementationOnce(() => {
      throw new Error('perf fail')
    })

    await import('./main')

    expect(pwaInit).toHaveBeenCalledTimes(1)
    expect(createRootMock).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('Failed to initialize performance monitor:', expect.any(Error))
  })

  it('continue le bootstrap si pwaAnalytics.init échoue', async () => {
    pwaInit.mockImplementationOnce(() => {
      throw new Error('pwa fail')
    })

    await import('./main')

    expect(performanceInit).toHaveBeenCalledTimes(1)
    expect(createRootMock).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('Failed to initialize PWA analytics:', expect.any(Error))
  })
})