import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useRealtimeChannel } from './useRealtimeChannel'

const {
  CHANNEL_A,
  CHANNEL_B,
  mockFrom,
  mockOn,
  mockSubscribe,
  mockSupabaseChannel,
  mockRemoveChannel,
  resetChannelSequence,
  setSubscribeStatus,
} = vi.hoisted(() => {
  const ROWS = [{ id: '1' }]
  const queryResult = { data: ROWS, error: null }
  const singleResult = { data: ROWS[0], error: null }

  interface MockQueryBuilder {
    select: (...args: unknown[]) => MockQueryBuilder
    eq: (...args: unknown[]) => MockQueryBuilder
    gte: (...args: unknown[]) => MockQueryBuilder
    lte: (...args: unknown[]) => MockQueryBuilder
    in: (...args: unknown[]) => MockQueryBuilder
    order: (...args: unknown[]) => MockQueryBuilder
    limit: (...args: unknown[]) => MockQueryBuilder
    insert: (...args: unknown[]) => MockQueryBuilder
    update: (...args: unknown[]) => MockQueryBuilder
    delete: (...args: unknown[]) => MockQueryBuilder
    upsert: (...args: unknown[]) => MockQueryBuilder
    range: (...args: unknown[]) => MockQueryBuilder
    match: (...args: unknown[]) => MockQueryBuilder
    is: (...args: unknown[]) => MockQueryBuilder
    neq: (...args: unknown[]) => MockQueryBuilder
    or: (...args: unknown[]) => MockQueryBuilder
    contains: (...args: unknown[]) => MockQueryBuilder
    filter: (...args: unknown[]) => MockQueryBuilder
    single: () => Promise<typeof singleResult>
    maybeSingle: () => Promise<typeof singleResult>
    then: (
      onfulfilled?: ((value: typeof queryResult) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null
    ) => Promise<unknown>
    catch: (onrejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  }

  let mockQueryBuilder: MockQueryBuilder

  const chain = vi.fn((..._args: unknown[]) => mockQueryBuilder)

  mockQueryBuilder = {
    select: chain,
    eq: chain,
    gte: chain,
    lte: chain,
    in: chain,
    order: chain,
    limit: chain,
    insert: chain,
    update: chain,
    delete: chain,
    upsert: chain,
    range: chain,
    match: chain,
    is: chain,
    neq: chain,
    or: chain,
    contains: chain,
    filter: chain,
    single: vi.fn(() => Promise.resolve(singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(singleResult)),
    then: vi.fn((onfulfilled, onrejected) =>
      Promise.resolve(queryResult).then(onfulfilled ?? undefined, onrejected ?? undefined)
    ),
    catch: vi.fn((onrejected) => Promise.resolve(queryResult).catch(onrejected ?? undefined)),
  }

  const mockFrom = vi.fn((_table: string) => mockQueryBuilder)

  interface MockRealtimeChannel {
    id: string
    topic: string
    on: (...args: unknown[]) => MockRealtimeChannel
    subscribe: (callback?: (status: string) => void) => MockRealtimeChannel
  }

  let subscribeStatus = 'SUBSCRIBED'
  let channelIndex = 0

  const mockOn = vi.fn(function (this: MockRealtimeChannel, ..._args: unknown[]) {
    return this
  })

  const mockSubscribe = vi.fn(function (
    this: MockRealtimeChannel,
    callback?: (status: string) => void
  ) {
    if (callback) {
      callback(subscribeStatus)
    }
    return this
  })

  const CHANNEL_A: MockRealtimeChannel = {
    id: 'ch-a',
    topic: 'emails:threads:u1',
    on: mockOn,
    subscribe: mockSubscribe,
  }

  const CHANNEL_B: MockRealtimeChannel = {
    id: 'ch-b',
    topic: 'emails:threads:u2',
    on: mockOn,
    subscribe: mockSubscribe,
  }

  const channelSequence = [CHANNEL_A, CHANNEL_B]

  const mockSupabaseChannel = vi.fn((_name: string, _options?: unknown) => {
    const channel = channelSequence[channelIndex] ?? CHANNEL_A
    channelIndex += 1
    return channel
  })

  const mockRemoveChannel = vi.fn((_channel: MockRealtimeChannel) => Promise.resolve('ok'))

  return {
    CHANNEL_A,
    CHANNEL_B,
    mockFrom,
    mockOn,
    mockSubscribe,
    mockSupabaseChannel,
    mockRemoveChannel,
    resetChannelSequence: () => {
      channelIndex = 0
    },
    setSubscribeStatus: (status: string) => {
      subscribeStatus = status
    },
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockSupabaseChannel,
    removeChannel: mockRemoveChannel,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

type BroadcastCallback = (event: { payload: unknown }) => void

function getRegisteredBroadcastCallback(): BroadcastCallback {
  const broadcastCall = mockOn.mock.calls.find((call) => call[0] === 'broadcast')
  const invoker = broadcastCall?.[2]

  if (typeof invoker !== 'function') {
    throw new Error('Broadcast callback was not registered')
  }

  return invoker as BroadcastCallback
}

describe('useRealtimeChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChannelSequence()
    setSubscribeStatus('SUBSCRIBED')
  })

  it('ne crée aucun canal lorsque enabled vaut false', () => {
    const postgresHandler = vi.fn((payload: unknown) => {
      void payload
    })
    const onSubscribed = vi.fn()

    renderHook(
      () =>
        useRealtimeChannel({
          channel: 'emails:threads:u1',
          enabled: false,
          postgresChanges: [
            {
              filter: { event: 'INSERT', schema: 'public', table: 'messages' },
              handler: postgresHandler,
            },
          ],
          onSubscribed,
        }),
      { wrapper: createWrapper() }
    )

    expect(mockSupabaseChannel).not.toHaveBeenCalled()
    expect(mockOn).not.toHaveBeenCalled()
    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(onSubscribed).not.toHaveBeenCalled()
    expect(mockRemoveChannel).not.toHaveBeenCalled()
  })

  it('souscrit au canal, enregistre postgres_changes et broadcast, puis nettoie le canal', () => {
    const postgresFilter = { event: 'INSERT', schema: 'public', table: 'messages' } as const
    const channelOptions = { config: { broadcast: { self: true }, presence: { key: 'u1' } } }
    const postgresHandler = vi.fn((payload: unknown) => {
      void payload
    })
    const broadcastHandler = vi.fn((payload: unknown) => {
      void payload
    })
    const onSubscribed = vi.fn((channel: unknown) => {
      void channel
    })
    const broadcastPayload = { id: 'p1', type: 'created' }

    const { unmount } = renderHook(
      () =>
        useRealtimeChannel({
          channel: 'emails:threads:u1',
          channelOptions,
          postgresChanges: [
            {
              filter: postgresFilter,
              handler: postgresHandler,
            },
          ],
          broadcast: [
            {
              event: 'thread:new',
              handler: broadcastHandler,
            },
          ],
          onSubscribed,
        }),
      { wrapper: createWrapper() }
    )

    expect(mockSupabaseChannel).toHaveBeenCalledTimes(1)
    expect(mockSupabaseChannel).toHaveBeenCalledWith('emails:threads:u1', channelOptions)

    expect(mockOn).toHaveBeenCalledTimes(2)
    expect(mockOn.mock.calls[0]).toEqual(['postgres_changes', postgresFilter, postgresHandler])
    expect(mockOn.mock.calls[1]?.[0]).toBe('broadcast')
    expect(mockOn.mock.calls[1]?.[1]).toEqual({ event: 'thread:new' })

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(onSubscribed).toHaveBeenCalledTimes(1)
    expect(onSubscribed).toHaveBeenCalledWith(CHANNEL_A)

    const broadcastCallback = getRegisteredBroadcastCallback()

    act(() => {
      broadcastCallback({ payload: broadcastPayload })
    })

    expect(broadcastHandler).toHaveBeenCalledTimes(1)
    expect(broadcastHandler).toHaveBeenCalledWith(broadcastPayload)

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledWith(CHANNEL_A)
  })

  it('ne déclenche pas onSubscribed si Supabase renvoie un statut différent de SUBSCRIBED', () => {
    setSubscribeStatus('CHANNEL_ERROR')

    const onSubscribed = vi.fn((channel: unknown) => {
      void channel
    })

    const { unmount } = renderHook(
      () =>
        useRealtimeChannel({
          channel: 'emails:threads:u1',
          onSubscribed,
        }),
      { wrapper: createWrapper() }
    )

    expect(mockSupabaseChannel).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(onSubscribed).not.toHaveBeenCalled()

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledWith(CHANNEL_A)
  })

  it('ne se réabonne pas quand seuls les handlers changent, puis se réabonne quand le nom du canal change', () => {
    const firstBroadcastHandler = vi.fn((payload: unknown) => {
      void payload
    })
    const secondBroadcastHandler = vi.fn((payload: unknown) => {
      void payload
    })
    const onSubscribed = vi.fn((channel: unknown) => {
      void channel
    })

    const { rerender, unmount } = renderHook(
      ({ channel, handler }: { channel: string; handler: (payload: unknown) => void }) =>
        useRealtimeChannel({
          channel,
          broadcast: [{ event: 'thread:sync', handler }],
          onSubscribed,
        }),
      {
        wrapper: createWrapper(),
        initialProps: {
          channel: 'emails:threads:u1',
          handler: firstBroadcastHandler,
        },
      }
    )

    expect(mockSupabaseChannel).toHaveBeenCalledTimes(1)
    expect(mockSupabaseChannel).toHaveBeenCalledWith('emails:threads:u1', undefined)
    expect(mockOn).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(onSubscribed).toHaveBeenCalledWith(CHANNEL_A)

    rerender({
      channel: 'emails:threads:u1',
      handler: secondBroadcastHandler,
    })

    expect(mockSupabaseChannel).toHaveBeenCalledTimes(1)
    expect(mockOn).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).not.toHaveBeenCalled()

    rerender({
      channel: 'emails:threads:u2',
      handler: secondBroadcastHandler,
    })

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledWith(CHANNEL_A)
    expect(mockSupabaseChannel).toHaveBeenCalledTimes(2)
    expect(mockSupabaseChannel).toHaveBeenLastCalledWith('emails:threads:u2', undefined)
    expect(mockSubscribe).toHaveBeenCalledTimes(2)
    expect(onSubscribed).toHaveBeenCalledWith(CHANNEL_B)

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledTimes(2)
    expect(mockRemoveChannel).toHaveBeenLastCalledWith(CHANNEL_B)
  })
})
