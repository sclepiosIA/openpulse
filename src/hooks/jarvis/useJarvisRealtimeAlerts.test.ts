/* @vitest-environment jsdom */
import React, { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJarvisRealtimeAlerts } from './useJarvisRealtimeAlerts'
import defaultExport from './useJarvisRealtimeAlerts'

const {
  AUTH_STATE,
  ALERTS_DATA,
  ERROR_MESSAGE,
  contextHookMock,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  ALERTS_DATA: [
    {
      id: 'alert-1',
      title: 'Alerte critique',
      severity: 'high',
      read: false,
      created_at: '2024-01-02T10:00:00Z',
    },
    {
      id: 'alert-2',
      title: 'Alerte info',
      severity: 'low',
      read: true,
      created_at: '2024-01-01T09:00:00Z',
    },
  ],
  ERROR_MESSAGE: 'x',
  contextHookMock: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/contexts/JarvisProactiveAlertsContext', () => ({
  useJarvisProactiveAlertsContext: contextHookMock,
}))

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: ALERTS_DATA[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: ALERTS_DATA[0], error: null })),
    then: (
      onFulfilled: (value: { data: typeof ALERTS_DATA; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: ALERTS_DATA, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  }

  mockFrom.mockReturnValue(builder)

  return {
    supabase: {
      from: mockFrom,
      channel: vi.fn(),
      removeChannel: vi.fn(),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useJarvisRealtimeAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('re-exporte exactement le hook du contexte et retourne les valeurs métier attendues après chargement', async () => {
    contextHookMock
      .mockReturnValueOnce({
        isLoading: true,
        isError: false,
        alerts: [],
        unreadCount: 0,
        markAsRead: vi.fn(),
      })
      .mockReturnValueOnce({
        isLoading: false,
        isError: false,
        alerts: ALERTS_DATA,
        unreadCount: 1,
        markAsRead: vi.fn(),
      })

    const { result, rerender } = renderHook(() => useJarvisRealtimeAlerts(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.alerts).toEqual([])
    expect(contextHookMock).toHaveBeenCalledTimes(1)

    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isError).toBe(false)
    expect(result.current.alerts).toEqual(ALERTS_DATA)
    expect(result.current.unreadCount).toBe(1)
    expect(result.current.alerts[0]).toMatchObject({
      id: 'alert-1',
      title: 'Alerte critique',
      severity: 'high',
      read: false,
    })
    expect(result.current.alerts[1]).toMatchObject({
      id: 'alert-2',
      title: 'Alerte info',
      severity: 'low',
      read: true,
    })
    expect(contextHookMock).toHaveBeenCalledTimes(2)
  })

  it('propage un état d’erreur quand le hook de contexte retourne une erreur', async () => {
    contextHookMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: ERROR_MESSAGE },
      alerts: null,
      unreadCount: 0,
      markAsRead: vi.fn(),
    })

    const { result } = renderHook(() => useJarvisRealtimeAlerts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toEqual({ message: 'x' })
    expect(result.current.alerts).toBeNull()
    expect(result.current.unreadCount).toBe(0)
  })

  it('le default export est le même re-export et relaie la mutation markAsRead', async () => {
    const markAsRead = vi.fn(async (alertId: string) => ({ data: { id: alertId }, error: null }))

    contextHookMock.mockReturnValue({
      isLoading: false,
      isError: false,
      alerts: ALERTS_DATA,
      unreadCount: 1,
      markAsRead,
    })

    const { result } = renderHook(() => defaultExport(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.markAsRead('alert-1')
    })

    expect(markAsRead).toHaveBeenCalledWith('alert-1')
    expect(result.current.alerts[0].read).toBe(false)
    expect(result.current.unreadCount).toBe(1)
  })
})