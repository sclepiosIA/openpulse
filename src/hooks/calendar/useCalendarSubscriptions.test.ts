const {
  mockFrom,
  RESPONSES,
  LAST_BUILDER,
  mockFunctionsInvoke,
  AUTH_STATE,
  USER,
  SUBS,
} = vi.hoisted(() => {
  const USER = {
    id: 'user-1',
    email: 'test@example.com',
  }

  const SUBS = [
    {
      id: 'sub-1',
      user_id: USER.id,
      calendar_id: 'cal-1',
      name: 'Work',
      url: 'https://cal.example/1.ics',
      color: '#ff0000',
      sync_frequency: 'daily',
      last_sync_at: null,
      last_sync_status: null,
      is_active: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
    },
    {
      id: 'sub-2',
      user_id: USER.id,
      calendar_id: 'cal-2',
      name: 'Personal',
      url: 'https://cal.example/2.ics',
      color: '#00ff00',
      sync_frequency: 'hourly',
      last_sync_at: null,
      last_sync_status: null,
      is_active: false,
      created_at: '2023-02-01T00:00:00Z',
      updated_at: '2023-02-02T00:00:00Z',
    },
  ]

  // Mutable responses that tests will adjust before invoking hooks/mutations
  const RESPONSES: {
    [k: string]: any
    functionsInvoke?: any
  } = {
    // default for calendar_subscriptions if not set by test
    calendar_subscriptions: { data: SUBS, error: null },
    functionsInvoke: { data: null, error: null },
  }

  // Keep reference to last created builder for assertions
  const LAST_BUILDER: { instance: any | null } = { instance: null }

  function createBuilder(tableName: string) {
    const builder: any = {}
    builder._table = tableName
    builder._response = RESPONSES[tableName] ?? { data: null, error: null }
    builder._lastSelect = null
    builder._lastEq = null
    builder._lastOrder = null
    builder._lastLimit = null
    builder._lastInsertPayload = null
    builder._lastUpdatePayload = null
    builder._didDelete = false

    builder.select = (...args: any[]) => {
      builder._lastSelect = args
      return builder
    }
    builder.eq = (field: string, value: any) => {
      builder._lastEq = { field, value }
      return builder
    }
    builder.gte = () => builder
    builder.lte = () => builder
    builder.in = () => builder
    builder.order = (field: string, opts?: any) => {
      builder._lastOrder = { field, opts }
      return builder
    }
    builder.limit = (n: number) => {
      builder._lastLimit = n
      return builder
    }
    builder.insert = (payload: any) => {
      builder._lastInsertPayload = payload
      // allow test to control response for insert via RESPONSES[tableName]
      builder._response = RESPONSES[tableName] ?? { data: payload, error: null }
      return builder
    }
    builder.update = (payload: any) => {
      builder._lastUpdatePayload = payload
      builder._response = RESPONSES[tableName] ?? { data: null, error: null }
      return builder
    }
    builder.delete = () => {
      builder._didDelete = true
      builder._response = RESPONSES[tableName] ?? { data: null, error: null }
      return builder
    }
    builder.single = () => {
      // tests can arrange that RESPONSES[tableName].data is the single row or already shaped
      return builder
    }
    builder.maybeSingle = () => builder
    builder.then = (resolve: any, reject: any) =>
      Promise.resolve(builder._response).then(resolve, reject)
    builder.catch = (cb: any) => Promise.resolve(builder._response).catch(cb)

    // record latest created builder
    LAST_BUILDER.instance = builder
    return builder
  }

  const mockFrom = vi.fn((tableName: string) => createBuilder(tableName))

  const mockFunctionsInvoke = vi.fn((fnName: string, opts?: any) =>
    Promise.resolve(RESPONSES.functionsInvoke)
  )

  // AUTH state mutable for tests
  const AUTH_STATE: { user: any | null } = {
    user: USER,
  }

  return {
    mockFrom,
    RESPONSES,
    LAST_BUILDER,
    mockFunctionsInvoke,
    AUTH_STATE,
    USER,
    SUBS,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: (...args: any[]) => mockFunctionsInvoke(...args),
      },
    },
  }
})

vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => AUTH_STATE,
  }
})

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useCalendarSubscriptions,
  useCreateCalendarSubscription,
  useDeleteCalendarSubscription,
  useSyncCalendarSubscription,
  useToggleSubscriptionActive,
} from './useCalendarSubscriptions'

describe('useCalendarSubscriptions and related mutations', () => {
  beforeEach(() => {
    // reset mock call counts but keep hoisted references intact
    vi.clearAllMocks()
    // default responses
    RESPONSES.calendar_subscriptions = SUBS.slice()
    RESPONSES.functionsInvoke = { data: null, error: null }
    AUTH_STATE.user = USER
    LAST_BUILDER.instance = null
  })

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const Wrapper = ({ children }: any) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    return { Wrapper, queryClient }
  }

  it('loads subscriptions for authenticated user', async () => {
    // Arrange
    AUTH_STATE.user = USER
    RESPONSES.calendar_subscriptions = { data: SUBS, error: null }

    const { Wrapper } = createWrapper()

    // Act
    const { result } = renderHook(() => useCalendarSubscriptions(), { wrapper: Wrapper })

    // Assert: wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(SUBS)
    expect(mockFrom).toHaveBeenCalledWith('calendar_subscriptions')
    // ensure query used order and limit by checking builder recorded values
    expect(LAST_BUILDER.instance._lastLimit).toBe(50)
    expect(LAST_BUILDER.instance._lastOrder).toMatchObject({ field: 'created_at', opts: { ascending: false } })
    expect(LAST_BUILDER.instance._lastEq).toMatchObject({ field: 'user_id', value: USER.id })
  })

  it('returns empty list if not authenticated and does not call supabase', async () => {
    // Arrange: no user
    AUTH_STATE.user = null
    RESPONSES.calendar_subscriptions = { data: SUBS, error: null }

    const { Wrapper } = createWrapper()

    // Act
    const { result } = renderHook(() => useCalendarSubscriptions(), { wrapper: Wrapper })

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('reports error when supabase returns an error for list', async () => {
    // Arrange
    AUTH_STATE.user = USER
    RESPONSES.calendar_subscriptions = { data: null, error: { message: 'something went wrong' } }

    const { Wrapper } = createWrapper()

    // Act
    const { result } = renderHook(() => useCalendarSubscriptions(), { wrapper: Wrapper })

    // Assert
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // react-query will surface the thrown error
    expect((result.current.error as any).message).toContain('something went wrong')
    expect(mockFrom).toHaveBeenCalledWith('calendar_subscriptions')
  })

  it('creates a calendar subscription and invalidates queries on success', async () => {
    // Arrange
    AUTH_STATE.user = USER
    const created = {
      id: 'created-1',
      user_id: USER.id,
      calendar_id: 'cal-new',
      name: 'New cal',
      url: 'https://cal.example/new.ics',
      color: '#0000ff',
      sync_frequency: 'daily',
      last_sync_at: null,
      last_sync_status: null,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    // Arrange response for insert
    RESPONSES.calendar_subscriptions = { data: created, error: null }

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateCalendarSubscription(), { wrapper: Wrapper })

    // Act
    const payload = {
      calendar_id: 'cal-new',
      name: 'New cal',
      url: 'https://cal.example/new.ics',
      color: '#0000ff',
      sync_frequency: 'daily' as const,
    }

    await act(async () => {
      const res = await result.current.mutateAsync(payload)
      // Assert returned subscription is the created one
      expect(res).toEqual(created)
    })

    // Ensure supabase 'from' was called and insert payload includes user_id
    expect(mockFrom).toHaveBeenCalledWith('calendar_subscriptions')
    expect(LAST_BUILDER.instance._lastInsertPayload).toMatchObject({
      user_id: USER.id,
      calendar_id: payload.calendar_id,
      name: payload.name,
      url: payload.url,
      color: payload.color,
      sync_frequency: payload.sync_frequency,
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-subscriptions'] })
  })

  it('deletes a calendar subscription and invalidates queries', async () => {
    // Arrange
    AUTH_STATE.user = USER
    RESPONSES.calendar_subscriptions = { data: null, error: null }

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteCalendarSubscription(), { wrapper: Wrapper })

    const targetId = 'to-delete-1'

    // Act
    await act(async () => {
      await result.current.mutateAsync(targetId)
    })

    // Assert supabase delete called with eq on id
    expect(mockFrom).toHaveBeenCalledWith('calendar_subscriptions')
    expect(LAST_BUILDER.instance._didDelete).toBe(true)
    expect(LAST_BUILDER.instance._lastEq).toMatchObject({ field: 'id', value: targetId })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-subscriptions'] })
  })

  it('invokes sync function and invalidates subscriptions and events queries', async () => {
    // Arrange
    AUTH_STATE.user = USER
    RESPONSES.functionsInvoke = { data: { ok: true }, error: null }

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSyncCalendarSubscription(), { wrapper: Wrapper })

    const subscription = SUBS[0]

    // Act
    await act(async () => {
      const res = await result.current.mutateAsync(subscription)
      expect(res).toEqual({ ok: true })
    })

    // Assert functions.invoke called with correct payload
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('sync-calendar-subscription', {
      body: {
        subscriptionId: subscription.id,
        subscriptionUrl: subscription.url,
        calendarId: subscription.calendar_id,
      },
    })

    // Ensure both relevant queries invalidated
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-subscriptions'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
  })

  it('toggles subscription active flag and invalidates queries', async () => {
    // Arrange
    AUTH_STATE.user = USER
    RESPONSES.calendar_subscriptions = { data: null, error: null }

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useToggleSubscriptionActive(), { wrapper: Wrapper })

    const payload = { id: 'sub-1', is_active: false }

    // Act
    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    // Assert update called with correct payload and eq with id
    expect(mockFrom).toHaveBeenCalledWith('calendar_subscriptions')
    expect(LAST_BUILDER.instance._lastUpdatePayload).toMatchObject({ is_active: false })
    expect(LAST_BUILDER.instance._lastEq).toMatchObject({ field: 'id', value: payload.id })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['calendar-subscriptions'] })
  })
})