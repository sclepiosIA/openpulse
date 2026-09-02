import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCalendarRealtime } from './useCalendarRealtime'

const {
  AUTH_STATE,
  AUTHENTICATED_USER,
  ROWS,
  subscriptions,
  mockFrom,
  mockChannelFactory,
  mockRemoveChannel,
  mockOn,
  mockSubscribe,
  mockUseAuth,
  mockDebugLog,
  mockRealtimeChannel,
} = vi.hoisted(() => {
  type AuthUser = { id: string; email: string }
  type AuthState = {
    user: AuthUser | null
    session: { user: { id: string } } | null
    isLoading: boolean
  }
  type Payload = { eventType: string }
  type RealtimeCallback = (payload: Payload) => void
  type SubscribeCallback = (status: string) => void
  type Filter = { event: string; schema: string; table: string }
  type Subscription = {
    event: string
    filter: Filter
    callback: RealtimeCallback
  }
  type Row = { id: string }
  type QueryResult = { data: Row[] | null; error: { message: string } | null }
  type QueryBuilder = {
    select: (columns?: string) => QueryBuilder
    eq: (column: string, value: unknown) => QueryBuilder
    gte: (column: string, value: unknown) => QueryBuilder
    lte: (column: string, value: unknown) => QueryBuilder
    in: (column: string, values: readonly unknown[]) => QueryBuilder
    order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
    limit: (count: number) => QueryBuilder
    insert: (values: unknown) => QueryBuilder
    update: (values: unknown) => QueryBuilder
    delete: () => QueryBuilder
    single: () => Promise<QueryResult>
    maybeSingle: () => Promise<QueryResult>
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<QueryResult | TResult>
  }
  type RealtimeChannel = {
    on: (event: string, filter: Filter, callback: RealtimeCallback) => RealtimeChannel
    subscribe: (callback?: SubscribeCallback) => RealtimeChannel
  }

  const AUTHENTICATED_USER: AuthUser = { id: 'u1', email: 't@t.co' }
  const AUTH_STATE: AuthState = {
    user: AUTHENTICATED_USER,
    session: { user: { id: AUTHENTICATED_USER.id } },
    isLoading: false,
  }

  const ROWS: Row[] = [{ id: '1' }]
  const QUERY_SUCCESS: QueryResult = { data: ROWS, error: null }
  const queryState = { result: QUERY_SUCCESS }
  const subscriptions: Subscription[] = []

  const builder = {} as QueryBuilder
  builder.select = vi.fn((_columns?: string) => builder)
  builder.eq = vi.fn((_column: string, _value: unknown) => builder)
  builder.gte = vi.fn((_column: string, _value: unknown) => builder)
  builder.lte = vi.fn((_column: string, _value: unknown) => builder)
  builder.in = vi.fn((_column: string, _values: readonly unknown[]) => builder)
  builder.order = vi.fn((_column: string, _options?: { ascending?: boolean }) => builder)
  builder.limit = vi.fn((_count: number) => builder)
  builder.insert = vi.fn((_values: unknown) => builder)
  builder.update = vi.fn((_values: unknown) => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(queryState.result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(queryState.result))
  builder.then = vi.fn(
    <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(queryState.result).then(onfulfilled, onrejected)
  )
  builder.catch = vi.fn(
    <TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) =>
      Promise.resolve(queryState.result).catch(onrejected ?? undefined)
  )

  const mockFrom = vi.fn((_table: string) => builder)

  const realtimeChannel = {} as RealtimeChannel
  const mockOn = vi.fn((event: string, filter: Filter, callback: RealtimeCallback) => {
    subscriptions.push({ event, filter, callback })
    return realtimeChannel
  })
  const mockSubscribe = vi.fn((callback?: SubscribeCallback) => {
    if (callback) callback('SUBSCRIBED')
    return realtimeChannel
  })
  realtimeChannel.on = mockOn
  realtimeChannel.subscribe = mockSubscribe

  const mockChannelFactory = vi.fn((_name: string) => realtimeChannel)
  const mockRemoveChannel = vi.fn((_channel: RealtimeChannel) => undefined)
  const mockUseAuth = vi.fn(() => AUTH_STATE)
  const mockDebugLog = vi.fn((_message: string, _value?: unknown) => undefined)

  return {
    AUTH_STATE,
    AUTHENTICATED_USER,
    ROWS,
    subscriptions,
    mockFrom,
    mockChannelFactory,
    mockRemoveChannel,
    mockOn,
    mockSubscribe,
    mockUseAuth,
    mockDebugLog,
    mockRealtimeChannel: realtimeChannel,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannelFactory,
    removeChannel: mockRemoveChannel,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
  useAuthSafe: mockUseAuth,
  AuthProvider: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockDebugLog,
  },
}))

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
}

function findSubscription(table: string) {
  return subscriptions.find((subscription) => subscription.filter.table === table)
}

describe('useCalendarRealtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    subscriptions.splice(0, subscriptions.length)
    AUTH_STATE.user = AUTHENTICATED_USER
    AUTH_STATE.session = { user: { id: AUTHENTICATED_USER.id } }
    AUTH_STATE.isLoading = false
    mockFrom.mockClear()
    mockChannelFactory.mockClear()
    mockRemoveChannel.mockClear()
    mockOn.mockClear()
    mockSubscribe.mockClear()
    mockUseAuth.mockClear()
    mockDebugLog.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('ne crée aucune souscription quand aucun utilisateur authentifié n’est disponible', () => {
    AUTH_STATE.user = null
    AUTH_STATE.session = null

    const client = createTestClient()
    const { result, unmount } = renderHook(() => useCalendarRealtime(), {
      wrapper: createWrapper(client),
    })

    expect(result.current).toBeUndefined()
    expect(mockUseAuth).toHaveBeenCalledTimes(1)
    expect(mockChannelFactory).not.toHaveBeenCalled()
    expect(mockOn).not.toHaveBeenCalled()
    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(mockRemoveChannel).not.toHaveBeenCalled()

    unmount()
    client.clear()
  })

  it('souscrit aux trois tables calendrier avec le canal propre à l’utilisateur', () => {
    const client = createTestClient()
    const { unmount } = renderHook(() => useCalendarRealtime(), {
      wrapper: createWrapper(client),
    })

    expect(mockUseAuth).toHaveBeenCalledTimes(1)
    expect(mockChannelFactory).toHaveBeenCalledTimes(1)
    expect(mockChannelFactory).toHaveBeenCalledWith('calendar-realtime-u1')
    expect(mockOn).toHaveBeenCalledTimes(3)
    expect(subscriptions.map((subscription) => subscription.event)).toEqual([
      'postgres_changes',
      'postgres_changes',
      'postgres_changes',
    ])
    expect(subscriptions.map((subscription) => subscription.filter)).toEqual([
      { event: '*', schema: 'public', table: 'calendar_events' },
      { event: '*', schema: 'public', table: 'event_attendees' },
      { event: '*', schema: 'public', table: 'event_reminders' },
    ])
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockDebugLog).toHaveBeenCalledWith('[calendar-realtime] channel status', 'SUBSCRIBED')

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockRealtimeChannel)
    client.clear()
  })

  it('invalide les caches métier des événements calendrier après le debounce de 250 ms', () => {
    const client = createTestClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useCalendarRealtime(), {
      wrapper: createWrapper(client),
    })
    const subscription = findSubscription('calendar_events')

    expect(subscription).toBeDefined()
    if (!subscription) throw new Error('Souscription calendar_events absente')

    act(() => {
      subscription.callback({ eventType: 'INSERT' })
      vi.advanceTimersByTime(249)
    })

    expect(invalidateSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(mockDebugLog).toHaveBeenCalledWith('[calendar-realtime] calendar_events', 'INSERT')
    expect(invalidateSpy).toHaveBeenCalledTimes(4)
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ['calendar-events'] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ['calendar-event'] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: ['calendar-today-count'] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(4, { queryKey: ['my-invitations'] })

    unmount()
    client.clear()
  })

  it('coalesce une rafale de changements et conserve uniquement la dernière invalidation planifiée', () => {
    const client = createTestClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useCalendarRealtime(), {
      wrapper: createWrapper(client),
    })
    const calendarSubscription = findSubscription('calendar_events')
    const attendeesSubscription = findSubscription('event_attendees')

    expect(calendarSubscription).toBeDefined()
    expect(attendeesSubscription).toBeDefined()
    if (!calendarSubscription) throw new Error('Souscription calendar_events absente')
    if (!attendeesSubscription) throw new Error('Souscription event_attendees absente')

    act(() => {
      calendarSubscription.callback({ eventType: 'UPDATE' })
      vi.advanceTimersByTime(100)
      attendeesSubscription.callback({ eventType: 'DELETE' })
      vi.advanceTimersByTime(249)
    })

    expect(invalidateSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(mockDebugLog).toHaveBeenCalledWith('[calendar-realtime] calendar_events', 'UPDATE')
    expect(mockDebugLog).toHaveBeenCalledWith('[calendar-realtime] event_attendees', 'DELETE')
    expect(invalidateSpy).toHaveBeenCalledTimes(3)
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ['event-attendees'] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ['calendar-events'] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: ['my-invitations'] })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['calendar-today-count'] })

    unmount()
    client.clear()
  })

  it('annule le timer en attente au démontage et retire le canal Supabase', () => {
    const client = createTestClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useCalendarRealtime(), {
      wrapper: createWrapper(client),
    })
    const subscription = findSubscription('event_reminders')

    expect(subscription).toBeDefined()
    if (!subscription) throw new Error('Souscription event_reminders absente')

    act(() => {
      subscription.callback({ eventType: 'UPDATE' })
      vi.advanceTimersByTime(100)
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(mockDebugLog).toHaveBeenCalledWith('[calendar-realtime] event_reminders', 'UPDATE')
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockRealtimeChannel)
    client.clear()
  })

  it('invalide uniquement les caches des rappels lors d’un changement event_reminders', () => {
    const client = createTestClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useCalendarRealtime(), {
      wrapper: createWrapper(client),
    })
    const subscription = findSubscription('event_reminders')

    expect(subscription).toBeDefined()
    if (!subscription) throw new Error('Souscription event_reminders absente')

    act(() => {
      subscription.callback({ eventType: 'DELETE' })
      vi.advanceTimersByTime(250)
    })

    expect(invalidateSpy).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ['event-reminders'] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ['pending-reminders'] })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['calendar-events'] })
    expect(ROWS).toEqual([{ id: '1' }])

    unmount()
    client.clear()
  })
})
