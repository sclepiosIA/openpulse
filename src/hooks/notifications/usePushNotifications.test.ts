/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  mockFrom,
  mockUseAuth,
  mockUseLocation,
  mockUseNavigate,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockSanitizeSupabaseError,
  mockIsThirdPartyIframe,
  mockUseVapidPublicKey,
  mockDebugLog,
  mockDebugWarn,
  mockDebugError,
  stablePrefs,
  stableExistingScopes,
  stableExistingSubscriptionRow,
  stableNullResponse,
  serviceWorkerState,
  dbState,
} = vi.hoisted(() => {
  const stablePrefs = {
    enabled: true,
    email_notifications: true,
    task_notifications: false,
    ai_suggestions: true,
    calendar_reminders: true,
    treasury_alerts: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  }

  const stableExistingScopes = {
    app_scopes: ['main'],
  }

  const stableExistingSubscriptionRow = {
    id: 'sub-db-1',
  }

  const stableNullResponse = {
    data: null,
    error: null,
  }

  const dbState = {
    tables: {
      push_subscriptions: {
        maybeSingleQueue: [] as Array<{ data: unknown; error: unknown }>,
        thenResponse: stableNullResponse as { data: unknown; error: unknown },
        upsertResponse: stableNullResponse as { data: unknown; error: unknown },
        deleteResponse: stableNullResponse as { data: unknown; error: unknown },
        updateResponse: stableNullResponse as { data: unknown; error: unknown },
      },
      push_notification_preferences: {
        maybeSingleQueue: [] as Array<{ data: unknown; error: unknown }>,
        thenResponse: stableNullResponse as { data: unknown; error: unknown },
        upsertResponse: stableNullResponse as { data: unknown; error: unknown },
        deleteResponse: stableNullResponse as { data: unknown; error: unknown },
        updateResponse: stableNullResponse as { data: unknown; error: unknown },
      },
      email_messages: {
        maybeSingleQueue: [] as Array<{ data: unknown; error: unknown }>,
        thenResponse: stableNullResponse as { data: unknown; error: unknown },
        upsertResponse: stableNullResponse as { data: unknown; error: unknown },
        deleteResponse: stableNullResponse as { data: unknown; error: unknown },
        updateResponse: stableNullResponse as { data: unknown; error: unknown },
      },
    },
    lastUpserts: [] as Array<{ table: string; payload: unknown; options: unknown }>,
    lastDeletes: [] as Array<{ table: string; filters: Array<{ column: string; value: unknown }> }>,
    lastUpdates: [] as Array<{
      table: string
      payload: unknown
      filters: Array<{ column: string; value: unknown }>
    }>,
  }

  const createBuilder = (table: keyof typeof dbState.tables) => {
    const filters: Array<{ column: string; value: unknown }> = []
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value })
        return builder
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn((payload: unknown) => {
        dbState.lastUpdates.push({ table, payload, filters: [...filters] })
        return builder
      }),
      upsert: vi.fn((payload: unknown, options?: unknown) => {
        dbState.lastUpserts.push({ table, payload, options })
        return Promise.resolve(dbState.tables[table].upsertResponse)
      }),
      delete: vi.fn(() => {
        dbState.lastDeletes.push({ table, filters: [...filters] })
        return builder
      }),
      maybeSingle: vi.fn(() => {
        const queue = dbState.tables[table].maybeSingleQueue
        const next = queue.shift()
        return Promise.resolve(next ?? stableNullResponse)
      }),
      single: vi.fn(() => Promise.resolve(stableNullResponse)),
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve(dbState.tables[table].thenResponse).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(dbState.tables[table].thenResponse).catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table as keyof typeof dbState.tables))

  return {
    mockFrom,
    mockUseAuth: vi.fn(),
    mockUseLocation: vi.fn(),
    mockUseNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastInfo: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    mockIsThirdPartyIframe: vi.fn(),
    mockUseVapidPublicKey: vi.fn(),
    mockDebugLog: vi.fn(),
    mockDebugWarn: vi.fn(),
    mockDebugError: vi.fn(),
    stablePrefs,
    stableExistingScopes,
    stableExistingSubscriptionRow,
    stableNullResponse,
    serviceWorkerState: {
      registration: {
        pushManager: {
          getSubscription: vi.fn(),
          subscribe: vi.fn(),
        },
      },
      getRegistrations: vi.fn(),
      ready: Promise.resolve(null as unknown),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    dbState,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/lib/iframeDetection', () => ({
  isThirdPartyIframe: mockIsThirdPartyIframe,
}))

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useVapidPublicKey: mockUseVapidPublicKey,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: mockUseNavigate,
  useLocation: mockUseLocation,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockDebugLog,
    warn: mockDebugWarn,
    error: mockDebugError,
  },
}))

import { usePushNotifications } from './usePushNotifications'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    mockUseLocation.mockReturnValue({ pathname: '/m/mail' })
    mockUseNavigate.mockReturnValue(vi.fn())
    mockSanitizeSupabaseError.mockReturnValue('Erreur nettoyée')
    mockIsThirdPartyIframe.mockReturnValue(false)
    mockUseVapidPublicKey.mockReturnValue('BEl6ZmFrZV92YXBpZF9rZXk')

    dbState.tables.push_subscriptions.maybeSingleQueue = []
    dbState.tables.push_subscriptions.thenResponse = stableNullResponse
    dbState.tables.push_subscriptions.upsertResponse = stableNullResponse
    dbState.tables.push_subscriptions.deleteResponse = stableNullResponse
    dbState.tables.push_subscriptions.updateResponse = stableNullResponse

    dbState.tables.push_notification_preferences.maybeSingleQueue = []
    dbState.tables.push_notification_preferences.thenResponse = stableNullResponse
    dbState.tables.push_notification_preferences.upsertResponse = stableNullResponse
    dbState.tables.push_notification_preferences.deleteResponse = stableNullResponse
    dbState.tables.push_notification_preferences.updateResponse = stableNullResponse

    dbState.tables.email_messages.maybeSingleQueue = []
    dbState.tables.email_messages.thenResponse = stableNullResponse
    dbState.tables.email_messages.upsertResponse = stableNullResponse
    dbState.tables.email_messages.deleteResponse = stableNullResponse
    dbState.tables.email_messages.updateResponse = stableNullResponse

    dbState.lastUpserts = []
    dbState.lastDeletes = []
    dbState.lastUpdates = []

    const pushSubscription = {
      endpoint: 'https://push.test/sub-1',
      toJSON: () => ({
        keys: {
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    }

    serviceWorkerState.registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(pushSubscription),
      },
    }
    serviceWorkerState.getRegistrations = vi
      .fn()
      .mockResolvedValue([serviceWorkerState.registration])
    serviceWorkerState.ready = Promise.resolve(serviceWorkerState.registration)
    serviceWorkerState.addEventListener = vi.fn()
    serviceWorkerState.removeEventListener = vi.fn()

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    })

    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: function PushManager() {},
    })

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: serviceWorkerState.getRegistrations,
        ready: serviceWorkerState.ready,
        addEventListener: serviceWorkerState.addEventListener,
        removeEventListener: serviceWorkerState.removeEventListener,
      },
    })

    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Macintosh Safari/605.1.15',
    })

    Object.defineProperty(window, 'MSStream', {
      configurable: true,
      value: undefined,
    })

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        hostname: 'app.local',
      },
    })

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    })

    vi.stubGlobal(
      'atob',
      vi.fn(() => 'abcd')
    )
  })

  it('gère le chargement initial puis charge les préférences et l’état d’abonnement', async () => {
    const existingSubscription = {
      endpoint: 'https://push.test/sub-1',
    }

    serviceWorkerState.registration.pushManager.getSubscription = vi
      .fn()
      .mockResolvedValue(existingSubscription)
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: serviceWorkerState.getRegistrations,
        ready: Promise.resolve(serviceWorkerState.registration),
        addEventListener: serviceWorkerState.addEventListener,
        removeEventListener: serviceWorkerState.removeEventListener,
      },
    })

    dbState.tables.push_subscriptions.maybeSingleQueue = [
      { data: stableExistingSubscriptionRow, error: null },
    ]
    dbState.tables.push_notification_preferences.maybeSingleQueue = [
      { data: stablePrefs, error: null },
    ]

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.permission).toBe('default')
    expect(result.current.isSubscribed).toBe(true)
    expect(result.current.preferences).toEqual(stablePrefs)
    expect(serviceWorkerState.registration.pushManager.getSubscription).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('push_subscriptions')
    expect(mockFrom).toHaveBeenCalledWith('push_notification_preferences')
  })

  it('subscribe enregistre la souscription avec le scope courant et crée les préférences par défaut', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/m/mail/inbox' })
    dbState.tables.push_subscriptions.maybeSingleQueue = [
      { data: null, error: null },
      { data: stableExistingScopes, error: null },
    ]
    dbState.tables.push_notification_preferences.maybeSingleQueue = [{ data: null, error: null }]

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let subscribeResult = false
    await act(async () => {
      subscribeResult = await result.current.subscribe()
    })

    expect(subscribeResult).toBe(true)
    expect(serviceWorkerState.registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(ArrayBuffer),
    })

    expect(dbState.lastUpserts).toContainEqual({
      table: 'push_subscriptions',
      payload: expect.objectContaining({
        user_id: 'user-1',
        endpoint: 'https://push.test/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        user_agent: 'Mozilla/5.0 Macintosh Safari/605.1.15',
        device_type: 'mac',
        app_scope: 'mail',
        app_scopes: ['main', 'mail'],
      }),
      options: { onConflict: 'user_id,endpoint' },
    })

    expect(dbState.lastUpserts).toContainEqual({
      table: 'push_notification_preferences',
      payload: expect.objectContaining({
        user_id: 'user-1',
        enabled: true,
      }),
      options: { onConflict: 'user_id' },
    })

    expect(result.current.isSubscribed).toBe(true)
    expect(mockToastSuccess).toHaveBeenCalledWith('Notifications push activées')
    expect(localStorage.setItem).toHaveBeenCalledWith('push-subscribed-once', 'true')
  })

  it('retourne false et affiche une erreur nettoyée quand la persistance Supabase échoue pendant subscribe', async () => {
    dbState.tables.push_subscriptions.maybeSingleQueue = [
      { data: null, error: null },
      { data: stableExistingScopes, error: null },
    ]
    dbState.tables.push_subscriptions.upsertResponse = {
      data: null,
      error: { message: 'db failed' },
    }

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let subscribeResult = true
    await act(async () => {
      subscribeResult = await result.current.subscribe()
    })

    expect(subscribeResult).toBe(false)
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'db failed' })
    expect(mockToastError).toHaveBeenCalledWith('Erreur nettoyée')
    expect(result.current.isSubscribed).toBe(false)
  })
})
