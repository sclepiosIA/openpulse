/// <reference types="vitest" />
/// <reference lib="dom" />

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

declare global {
  var __WB_MANIFEST: Array<string | { url: string; revision: string | null }> | undefined
}

const {
  WORKBOX,
  createServiceWorkerScope,
  createFetchEvent,
  createExtendableEvent,
  createPushEvent,
  createNotificationClickEvent,
  flushPromises,
} = vi.hoisted(() => {
  const WORKBOX = {
    precacheAndRoute: vi.fn(),
    cleanupOutdatedCaches: vi.fn(),
    registerRoute: vi.fn(),
    NetworkFirst: vi
      .fn()
      .mockImplementation((opts: unknown) => ({ strategy: 'NetworkFirst', opts })),
    CacheFirst: vi.fn().mockImplementation((opts: unknown) => ({ strategy: 'CacheFirst', opts })),
    NetworkOnly: vi.fn().mockImplementation((opts: unknown) => ({ strategy: 'NetworkOnly' })),
    ExpirationPlugin: vi
      .fn()
      .mockImplementation((opts: unknown) => ({ plugin: 'ExpirationPlugin', opts })),
    CacheableResponsePlugin: vi
      .fn()
      .mockImplementation((opts: unknown) => ({ plugin: 'CacheableResponsePlugin', opts })),
  }

  function createServiceWorkerScope() {
    const listeners = new Map<string, Array<(event: unknown) => void>>()

    const scope = {
      listeners,
      location: { origin: 'https://app.test' },
      addEventListener: vi.fn((type: string, cb: (event: unknown) => void) => {
        const arr = listeners.get(type) ?? []
        arr.push(cb)
        listeners.set(type, arr)
      }),
      dispatchEvent(type: string, event: unknown) {
        const arr = listeners.get(type) ?? []
        for (const cb of arr) cb(event)
      },
      skipWaiting: vi.fn(),
      clients: {
        claim: vi.fn().mockResolvedValue(undefined),
        matchAll: vi.fn().mockResolvedValue([] as unknown[]),
        openWindow: vi.fn().mockResolvedValue(undefined),
      },
      registration: {
        scope: 'scope-v',
        showNotification: vi.fn().mockResolvedValue(undefined),
        getNotifications: vi.fn().mockResolvedValue([] as unknown[]),
      },
    }

    return scope
  }

  function createFetchEvent(url: string, headers?: Record<string, string>, destination?: string) {
    const h = new Headers(headers ?? {})
    const req = new Request(url, { headers: h })
    Object.defineProperty(req, 'destination', { value: destination ?? '', configurable: true })

    const ev = {
      request: req,
    }
    return ev as unknown as FetchEvent
  }

  function createExtendableEvent(data?: unknown, source?: unknown) {
    const waits: Array<Promise<unknown>> = []
    const ev = {
      data,
      source,
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waits.push(Promise.resolve(p))
      }),
      __waits: waits,
    }
    return ev as unknown as ExtendableMessageEvent & { __waits: Array<Promise<unknown>> }
  }

  function createPushEvent(payload: unknown) {
    const waits: Array<Promise<unknown>> = []
    const data =
      payload === undefined
        ? null
        : {
            json: () => {
              if (typeof payload === 'string') throw new Error('not json')
              return payload
            },
            text: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
          }

    const ev = {
      data,
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waits.push(Promise.resolve(p))
      }),
      __waits: waits,
    }
    return ev as unknown as PushEvent & { __waits: Array<Promise<unknown>> }
  }

  function createNotificationClickEvent(action: string, data: unknown) {
    const waits: Array<Promise<unknown>> = []
    const ev = {
      action,
      notification: {
        data,
        close: vi.fn(),
      },
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waits.push(Promise.resolve(p))
      }),
      __waits: waits,
    }
    return ev as unknown as NotificationEvent & { __waits: Array<Promise<unknown>> }
  }

  async function flushPromises() {
    await Promise.resolve()
    await Promise.resolve()
  }

  return {
    WORKBOX,
    createServiceWorkerScope,
    createFetchEvent,
    createExtendableEvent,
    createPushEvent,
    createNotificationClickEvent,
    flushPromises,
  }
})

vi.mock('workbox-precaching', () => ({
  precacheAndRoute: WORKBOX.precacheAndRoute,
  cleanupOutdatedCaches: WORKBOX.cleanupOutdatedCaches,
}))

vi.mock('workbox-routing', () => ({
  registerRoute: WORKBOX.registerRoute,
}))

vi.mock('workbox-strategies', () => ({
  NetworkFirst: WORKBOX.NetworkFirst,
  CacheFirst: WORKBOX.CacheFirst,
  NetworkOnly: WORKBOX.NetworkOnly,
}))

vi.mock('workbox-expiration', () => ({
  ExpirationPlugin: WORKBOX.ExpirationPlugin,
}))

vi.mock('workbox-cacheable-response', () => ({
  CacheableResponsePlugin: WORKBOX.CacheableResponsePlugin,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

function findRouteMatcherFor(
  predicate: (matcher: (args: { url: URL; request: Request }) => boolean) => boolean
) {
  for (const call of WORKBOX.registerRoute.mock.calls) {
    const matcher = call[0] as (args: { url: URL; request: Request }) => boolean
    if (predicate(matcher)) return matcher
  }
  return null
}

describe('sw.ts', () => {
  beforeEach(() => {
    vi.resetModules()

    WORKBOX.precacheAndRoute.mockClear()
    WORKBOX.cleanupOutdatedCaches.mockClear()
    WORKBOX.registerRoute.mockClear()
    WORKBOX.NetworkFirst.mockClear()
    WORKBOX.CacheFirst.mockClear()
    WORKBOX.NetworkOnly.mockClear()
    WORKBOX.ExpirationPlugin.mockClear()
    WORKBOX.CacheableResponsePlugin.mockClear()

    const sw = createServiceWorkerScope()
    ;(globalThis as unknown as { self: unknown }).self = sw
    ;(globalThis as unknown as { location: unknown }).location = sw.location

    ;(globalThis as unknown as { caches: unknown }).caches = {
      keys: vi.fn().mockResolvedValue([] as string[]),
      delete: vi.fn().mockResolvedValue(true),
    }

    const nav = globalThis.navigator as unknown as Record<string, unknown>
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)

    globalThis.__WB_MANIFEST = [
      { url: '/assets/app.js', revision: 'r1' },
      { url: '/assets/app.css', revision: 'r2' },
      { url: '/index.html', revision: 'r3' },
      { url: '/manifest.webmanifest', revision: 'r4' },
      { url: '/icons/icon-192x192.png', revision: 'r5' },
      { url: '/data/file.json', revision: 'r6' },
      '/assets/other.js?x=1',
      '/assets/ok.png',
    ]
  })

  it('initialisation: cleanupOutdatedCaches, precacheAndRoute avec manifest filtré, et enregistre les routes', async () => {
    await import('./sw')

    expect(WORKBOX.cleanupOutdatedCaches).toHaveBeenCalledTimes(1)
    expect(WORKBOX.precacheAndRoute).toHaveBeenCalledTimes(1)

    const filtered = WORKBOX.precacheAndRoute.mock.calls[0]?.[0] as Array<
      string | { url: string; revision: string | null }
    >
    const urls = filtered.map((e) => (typeof e === 'string' ? e : e.url))

    expect(urls).toContain('/icons/icon-192x192.png')
    expect(urls).toContain('/data/file.json')
    expect(urls).toContain('/assets/ok.png')

    expect(urls.some((u) => /\.(js|css|html)(\?|$)/.test(u))).toBe(true)
    expect(urls.some((u) => u.includes('manifest.webmanifest') || u.endsWith('.webmanifest'))).toBe(
      false
    )

    expect(WORKBOX.registerRoute).toHaveBeenCalled()
    const strategies = WORKBOX.registerRoute.mock.calls
      .map((c) => (c[1] as { strategy?: string } | undefined)?.strategy)
      .filter((s): s is string => typeof s === 'string')

    expect(strategies).toContain('NetworkFirst')
    expect(strategies).toContain('CacheFirst')
    expect(strategies).toContain('NetworkOnly')
  })

  it('fetch handler global: bypass manifest/auth-bridge/generation.example.org sans erreur', async () => {
    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    const e1 = createFetchEvent('https://app.test/manifest.webmanifest')
    const e2 = createFetchEvent('https://app.test/manifest.json')
    const e3 = createFetchEvent('https://x.generation.example.org/some')
    const e4 = createFetchEvent('https://app.test/auth-bridge/callback')
    const e5 = createFetchEvent('https://app.test/other')

    expect(() => sw.dispatchEvent('fetch', e1)).not.toThrow()
    expect(() => sw.dispatchEvent('fetch', e2)).not.toThrow()
    expect(() => sw.dispatchEvent('fetch', e3)).not.toThrow()
    expect(() => sw.dispatchEvent('fetch', e4)).not.toThrow()
    expect(() => sw.dispatchEvent('fetch', e5)).not.toThrow()
  })

  it('route Supabase: cache uniquement les requêtes anon, exclut les requêtes authentifiées', async () => {
    await import('./sw')

    const matcher = findRouteMatcherFor((m) => {
      const url = new URL('https://supabase.openpulse.example.org/rest/v1/table')
      const req = new Request(url.toString(), { headers: new Headers() })
      return typeof m({ url, request: req }) === 'boolean'
    })

    expect(matcher).not.toBeNull()
    if (!matcher) return

    const url = new URL('https://supabase.openpulse.example.org/rest/v1/patients')

    const anonHeaders = new Headers({ apikey: 'anon-key', authorization: 'Bearer anon-key' })
    const anonReq = new Request(url.toString(), { headers: anonHeaders })
    expect(matcher({ url, request: anonReq })).toBe(true)

    const authHeaders = new Headers({ apikey: 'anon-key', authorization: 'Bearer user-access' })
    const authReq = new Request(url.toString(), { headers: authHeaders })
    expect(matcher({ url, request: authReq })).toBe(false)

    const noAuthHeaders = new Headers({ apikey: 'anon-key' })
    const noAuthReq = new Request(url.toString(), { headers: noAuthHeaders })
    expect(matcher({ url, request: noAuthReq })).toBe(true)

    const otherOrigin = new URL('https://example.test/rest/v1/patients')
    const otherReq = new Request(otherOrigin.toString(), { headers: anonHeaders })
    expect(matcher({ url: otherOrigin, request: otherReq })).toBe(false)
  })

  it('push: payload email JSON -> showNotification avec actions + requireInteraction, puis setAppBadge basé sur getNotifications', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => ({ ok: true }), { wrapper })
    expect(result.current.ok).toBe(true)

    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    sw.registration.getNotifications.mockResolvedValueOnce([{}, {}, {}])

    const payload = {
      title: 'Nouveau message',
      body: 'Vous avez reçu un email',
      icon: '/i.png',
      badge: '/b.png',
      tag: 't1',
      url: '/emails/123',
      type: 'email',
      related_id: 'th1',
      timestamp: 123,
    }

    const ev = createPushEvent(payload)
    await act(async () => {
      sw.dispatchEvent('push', ev)
      await Promise.all(ev.__waits)
      await flushPromises()
    })

    expect(sw.registration.showNotification).toHaveBeenCalledTimes(1)
    const [titleArg, optionsArg] = sw.registration.showNotification.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(titleArg).toBe('Nouveau message')
    expect(optionsArg.body).toBe('Vous avez reçu un email')
    expect(optionsArg.icon).toBe('/i.png')
    expect(optionsArg.badge).toBe('/b.png')
    expect(optionsArg.tag).toBe('t1')
    expect(optionsArg.requireInteraction).toBe(true)

    const actions = optionsArg.actions as Array<{ action: string; title: string }>
    expect(actions.map((a) => a.action)).toEqual(['open', 'mark-read'])

    const nav = globalThis.navigator as unknown as { setAppBadge?: (n: number) => Promise<void> }
    expect(nav.setAppBadge).toBeTypeOf('function')
    expect(nav.setAppBadge as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(3)
  })

  it('push: payload texte JSON invalide -> fallback notification (robuste)', async () => {
    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    const ev = createPushEvent('not-json')
    await act(async () => {
      sw.dispatchEvent('push', ev)
      await Promise.all(ev.__waits)
      await flushPromises()
    })

    expect(sw.registration.showNotification).toHaveBeenCalledTimes(1)
    const [titleArg, optionsArg] = sw.registration.showNotification.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(titleArg).toBe('OpenPulse')
    expect(optionsArg.body).toBe('Vous avez une nouvelle notification')
    const data = optionsArg.data as { url?: string; type?: string; related_id?: string | null }
    expect(data.url).toBe('/')
    expect(data.type).toBe('unknown')
    expect(data.related_id).toBeNull()
  })

  it('notificationclick action mark-read (email): poste MARK_EMAIL_READ et ne navigue pas', async () => {
    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    const c1 = {
      url: 'https://app.test/m/mail',
      postMessage: vi.fn(),
      focus: vi.fn().mockResolvedValue(undefined),
    }
    const c2 = {
      url: 'https://app.test/emails',
      postMessage: vi.fn(),
      focus: vi.fn().mockResolvedValue(undefined),
    }
    sw.clients.matchAll.mockResolvedValueOnce([c1, c2])

    const ev = createNotificationClickEvent('mark-read', {
      url: '/emails/1',
      type: 'email',
      related_id: 'thread-1',
    })

    await act(async () => {
      sw.dispatchEvent('notificationclick', ev)
      await Promise.all(ev.__waits)
      await flushPromises()
    })

    expect(ev.notification.close).toHaveBeenCalledTimes(1)
    expect(c1.postMessage).toHaveBeenCalledWith({ type: 'MARK_EMAIL_READ', threadId: 'thread-1' })
    expect(c2.postMessage).toHaveBeenCalledWith({ type: 'MARK_EMAIL_READ', threadId: 'thread-1' })
    expect(sw.clients.openWindow).not.toHaveBeenCalled()
  })

  it('notificationclick navigation: client PWA mobile (/m/) -> réécrit /emails vers /m/mail et focus', async () => {
    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    const mobileClient = {
      url: 'https://app.test/m/home',
      postMessage: vi.fn(),
      focus: vi.fn().mockResolvedValue(undefined),
    }
    sw.clients.matchAll.mockResolvedValueOnce([mobileClient])

    const ev = createNotificationClickEvent('open', {
      url: '/emails/99',
      type: 'email',
      related_id: 'thread-99',
    })

    await act(async () => {
      sw.dispatchEvent('notificationclick', ev)
      await Promise.all(ev.__waits)
      await flushPromises()
    })

    expect(mobileClient.postMessage).toHaveBeenCalledWith({
      type: 'NAVIGATE_TO',
      url: '/m/mail/99',
    })
    expect(mobileClient.focus).toHaveBeenCalledTimes(1)
    expect(sw.clients.openWindow).not.toHaveBeenCalled()
  })

  it('message CLEAR_ALL_CACHES: supprime tous les caches et notifie les clients', async () => {
    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    const cachesObj = globalThis.caches as unknown as {
      keys: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
    }
    cachesObj.keys.mockResolvedValueOnce(['c1', 'c2'])
    cachesObj.delete.mockResolvedValue(true)

    const c1 = { postMessage: vi.fn() }
    const c2 = { postMessage: vi.fn() }
    sw.clients.matchAll.mockResolvedValueOnce([c1, c2])

    const ev = createExtendableEvent({ type: 'CLEAR_ALL_CACHES' })

    await act(async () => {
      sw.dispatchEvent('message', ev)
      await Promise.all(ev.__waits)
      await flushPromises()
    })

    expect(cachesObj.keys).toHaveBeenCalledTimes(1)
    expect(cachesObj.delete).toHaveBeenCalledWith('c1')
    expect(cachesObj.delete).toHaveBeenCalledWith('c2')

    expect(c1.postMessage).toHaveBeenCalledWith({ type: 'CACHES_CLEARED' })
    expect(c2.postMessage).toHaveBeenCalledWith({ type: 'CACHES_CLEARED' })
  })

  it('message GET_VERSION: poste SW_VERSION au source client', async () => {
    await import('./sw')

    const source = { postMessage: vi.fn() }
    const ev = createExtendableEvent({ type: 'GET_VERSION' }, source)

    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self
    sw.dispatchEvent('message', ev)

    expect(source.postMessage).toHaveBeenCalledWith({ type: 'SW_VERSION', version: 'scope-v' })
  })

  it('message SKIP_WAITING: appelle skipWaiting', async () => {
    await import('./sw')

    const ev = createExtendableEvent({ type: 'SKIP_WAITING' })

    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self
    sw.dispatchEvent('message', ev)

    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('install/activate: skipWaiting + clients.claim via waitUntil', async () => {
    await import('./sw')
    const sw = (globalThis as unknown as { self: ReturnType<typeof createServiceWorkerScope> }).self

    const installEv = createExtendableEvent()
    sw.dispatchEvent('install', installEv)
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1)

    const activateEv = createExtendableEvent()
    await act(async () => {
      sw.dispatchEvent('activate', activateEv)
      await Promise.all(activateEv.__waits)
      await flushPromises()
    })

    expect(sw.clients.claim).toHaveBeenCalledTimes(1)
  })

  it('hook harness (QueryClientProvider): isLoading -> success -> error', async () => {
    const wrapper = createWrapper()

    function useLocalQuery(shouldError: boolean) {
      return useQuery({
        queryKey: ['k', shouldError],
        queryFn: async () => {
          await Promise.resolve()
          if (shouldError) throw new Error('x')
          return { value: 7 }
        },
      })
    }

    const { result, rerender } = renderHook(({ err }: { err: boolean }) => useLocalQuery(err), {
      wrapper,
      initialProps: { err: false },
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.value).toBe(7)

    rerender({ err: true })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('x')
  })
})
