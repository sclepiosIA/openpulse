/* @vitest-environment jsdom */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDynamicManifest } from './useDynamicManifest'

const { locationState, navigateMock } = vi.hoisted(() => ({
  locationState: { pathname: '/' },
  navigateMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useNavigate: () => navigateMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function resetHead() {
  document.head.innerHTML = ''
}

function getManifestLink() {
  return document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
}

function getAppleIconLink() {
  return document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null
}

function getThemeColorMeta() {
  return document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
}

describe('useDynamicManifest', () => {
  beforeEach(() => {
    resetHead()
    locationState.pathname = '/'
    navigateMock.mockReset()
  })

  it('crée les balises et applique la configuration métier pour une route app mobile', async () => {
    locationState.pathname = '/m/mail/inbox'

    const wrapper = createWrapper()
    const { result } = renderHook(() => useDynamicManifest(), { wrapper })

    await waitFor(() => {
      const manifest = getManifestLink()
      const apple = getAppleIconLink()
      const theme = getThemeColorMeta()

      expect(manifest).not.toBeNull()
      expect(apple).not.toBeNull()
      expect(theme).not.toBeNull()

      expect(manifest?.getAttribute('href')).toBe('/manifest-mail.json')
      expect(apple?.getAttribute('href')).toBe('/icons/app-mail-192.png')
      expect(theme?.getAttribute('content')).toBe('#3280DD')
    })

    expect(result.current).toBeUndefined()
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('link[rel="apple-touch-icon"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
  })

  it('mappe correctement une route install vers la configuration de l’application cible', async () => {
    locationState.pathname = '/m/pulse/install'

    const wrapper = createWrapper()
    renderHook(() => useDynamicManifest(), { wrapper })

    await waitFor(() => {
      expect(getManifestLink()?.getAttribute('href')).toBe('/manifest-pulse.json')
      expect(getAppleIconLink()?.getAttribute('href')).toBe('/icons/app-pulse-192.png')
      expect(getThemeColorMeta()?.getAttribute('content')).toBe('#9065D0')
    })
  })

  it('utilise les valeurs par défaut pour une route non reconnue', async () => {
    locationState.pathname = '/autre/page'

    const wrapper = createWrapper()
    renderHook(() => useDynamicManifest(), { wrapper })

    await waitFor(() => {
      expect(getManifestLink()?.getAttribute('href')).toBe('/manifest.webmanifest')
      expect(getAppleIconLink()?.getAttribute('href')).toBe('/icons/icon-192x192.png')
      expect(getThemeColorMeta()?.getAttribute('content')).toBe('#CB5A1A')
    })
  })

  it('réutilise les balises existantes et met à jour leurs valeurs au changement de route', async () => {
    locationState.pathname = '/m/calendrier'

    const wrapper = createWrapper()
    const { rerender } = renderHook(() => useDynamicManifest(), { wrapper })

    await waitFor(() => {
      expect(getManifestLink()?.getAttribute('href')).toBe('/manifest-calendar.json')
      expect(getAppleIconLink()?.getAttribute('href')).toBe('/icons/app-calendar-192.png')
      expect(getThemeColorMeta()?.getAttribute('content')).toBe('#C3518E')
    })

    const manifestBefore = getManifestLink()
    const appleBefore = getAppleIconLink()
    const themeBefore = getThemeColorMeta()

    locationState.pathname = '/m/jarvis/chat'
    rerender()

    await waitFor(() => {
      expect(getManifestLink()?.getAttribute('href')).toBe('/manifest-jarvis.json')
      expect(getAppleIconLink()?.getAttribute('href')).toBe('/icons/app-jarvis-192.png')
      expect(getThemeColorMeta()?.getAttribute('content')).toBe('#0099AD')
    })

    expect(getManifestLink()).toBe(manifestBefore)
    expect(getAppleIconLink()).toBe(appleBefore)
    expect(getThemeColorMeta()).toBe(themeBefore)
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('link[rel="apple-touch-icon"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
  })

  it('privilégie la correspondance install exacte avant la détection par préfixe', async () => {
    locationState.pathname = '/m/todos/install'

    const wrapper = createWrapper()
    renderHook(() => useDynamicManifest(), { wrapper })

    await waitFor(() => {
      expect(getManifestLink()?.getAttribute('href')).toBe('/manifest-todos.json')
      expect(getAppleIconLink()?.getAttribute('href')).toBe('/icons/app-todos-192.png')
      expect(getThemeColorMeta()?.getAttribute('content')).toBe('#31983D')
    })
  })
})
