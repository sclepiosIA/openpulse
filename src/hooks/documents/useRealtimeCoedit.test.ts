import { createElement } from 'react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useRealtimeCoedit } from './useRealtimeCoedit'

const {
  AUTH_RESPONSE,
  PROFILE_RESPONSE,
  REMOTE_USER,
  mockUseAuth,
  mockUseCurrentProfile,
  mockFrom,
  mockChannel,
  mockSupabaseChannel,
  mockRemoveChannel,
  channelState,
  resetRealtimeMocks,
} = vi.hoisted(() => {
  type QueryResult = { data: Array<{ id: string }>; error: null | { message: string } }
  type BroadcastMessage = { payload?: Record<string, unknown> | null }
  type BroadcastHandler = (message: BroadcastMessage) => void
  type PresenceHandler = () => void
  type SubscribeCallback = (status: string) => void | Promise<void>

  const ROWS = [{ id: '1' }]
  const QUERY_RESULT: QueryResult = { data: ROWS, error: null }
  const SINGLE_RESULT = { data: ROWS[0], error: null }

  const AUTH_RESPONSE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const PROFILE_RESPONSE = {
    data: { prenom: 'Ada', nom: 'Lovelace', avatar_url: 'avatar.png' },
    isLoading: false,
    error: null,
  }

  const REMOTE_USER = {
    user_id: 'u2',
    user_name: 'Grace Hopper',
    user_avatar: null,
    user_color: '#3b82f6',
    cursor: { cell: 'B2' },
  }

  const mockUseAuth = vi.fn(() => AUTH_RESPONSE)
  const mockUseCurrentProfile = vi.fn(() => PROFILE_RESPONSE)

  const createBuilder = () => {
    const builder: Record<string, unknown> = {}

    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.neq = vi.fn(() => builder)
    builder.gte = vi.fn(() => builder)
    builder.lte = vi.fn(() => builder)
    builder.gt = vi.fn(() => builder)
    builder.lt = vi.fn(() => builder)
    builder.in = vi.fn(() => builder)
    builder.is = vi.fn(() => builder)
    builder.not = vi.fn(() => builder)
    builder.or = vi.fn(() => builder)
    builder.ilike = vi.fn(() => builder)
    builder.contains = vi.fn(() => builder)
    builder.order = vi.fn(() => builder)
    builder.limit = vi.fn(() => builder)
    builder.range = vi.fn(() => builder)
    builder.insert = vi.fn(() => builder)
    builder.update = vi.fn(() => builder)
    builder.upsert = vi.fn(() => builder)
    builder.delete = vi.fn(() => builder)
    builder.returns = vi.fn(() => builder)
    builder.single = vi.fn(() => Promise.resolve(SINGLE_RESULT))
    builder.maybeSingle = vi.fn(() => Promise.resolve(SINGLE_RESULT))
    builder.then = vi.fn((resolve?: (value: QueryResult) => unknown) => {
      if (resolve) return Promise.resolve(resolve(QUERY_RESULT))
      return Promise.resolve(QUERY_RESULT)
    })
    builder.catch = vi.fn(() => Promise.resolve(QUERY_RESULT))

    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())

  const broadcastHandlers: Record<string, BroadcastHandler[]> = {
    snapshot: [],
    'sync-request': [],
  }

  const presenceHandlers: Record<string, PresenceHandler[]> = {
    sync: [],
    join: [],
    leave: [],
  }

  const presenceState: Record<string, unknown[]> = {}

  const channelState = {
    broadcastHandlers,
    presenceHandlers,
    presenceState,
    subscribeCallback: undefined as SubscribeCallback | undefined,
    lastChannelName: '',
    lastChannelOptions: undefined as unknown,
  }

  const mockChannel = {
    on: vi.fn((type: string, filter: { event?: string }, callback: unknown) => {
      const event = filter.event
      if (typeof callback === 'function' && event) {
        if (type === 'broadcast') {
          if (!broadcastHandlers[event]) broadcastHandlers[event] = []
          broadcastHandlers[event].push(callback as BroadcastHandler)
        }
        if (type === 'presence') {
          if (!presenceHandlers[event]) presenceHandlers[event] = []
          presenceHandlers[event].push(callback as PresenceHandler)
        }
      }
      return mockChannel
    }),
    subscribe: vi.fn((callback?: SubscribeCallback) => {
      channelState.subscribeCallback = callback
      return mockChannel
    }),
    send: vi.fn(() => Promise.resolve({ error: null })),
    track: vi.fn(() => Promise.resolve({ error: null })),
    untrack: vi.fn(() => Promise.resolve({ error: null })),
    presenceState: vi.fn(() => presenceState),
  }

  const mockSupabaseChannel = vi.fn((name: string, options: unknown) => {
    channelState.lastChannelName = name
    channelState.lastChannelOptions = options
    return mockChannel
  })

  const mockRemoveChannel = vi.fn(() => Promise.resolve({ error: null }))

  const resetRealtimeMocks = () => {
    for (const key of Object.keys(broadcastHandlers)) {
      broadcastHandlers[key].length = 0
    }
    for (const key of Object.keys(presenceHandlers)) {
      presenceHandlers[key].length = 0
    }
    for (const key of Object.keys(presenceState)) {
      delete presenceState[key]
    }

    channelState.subscribeCallback = undefined
    channelState.lastChannelName = ''
    channelState.lastChannelOptions = undefined

    mockUseAuth.mockClear()
    mockUseCurrentProfile.mockClear()
    mockFrom.mockClear()
    mockChannel.on.mockClear()
    mockChannel.subscribe.mockClear()
    mockChannel.send.mockClear()
    mockChannel.track.mockClear()
    mockChannel.untrack.mockClear()
    mockChannel.presenceState.mockClear()
    mockSupabaseChannel.mockClear()
    mockRemoveChannel.mockClear()
  }

  return {
    AUTH_RESPONSE,
    PROFILE_RESPONSE,
    REMOTE_USER,
    mockUseAuth,
    mockUseCurrentProfile,
    mockFrom,
    mockChannel,
    mockSupabaseChannel,
    mockRemoveChannel,
    channelState,
    resetRealtimeMocks,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockSupabaseChannel,
    removeChannel: mockRemoveChannel,
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}))

type Snapshot = {
  title: string
  cells: string[]
}

type HookProps = {
  documentId: string | undefined
  enabled: boolean
  snapshot: Snapshot
  onRemoteSnapshot: (snapshot: Snapshot) => void
  debounceMs?: number
  channelKind: string
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function getSubscribeCallback() {
  const callback = channelState.subscribeCallback
  if (typeof callback !== 'function') {
    throw new Error('subscribe callback missing')
  }
  return callback
}

function emitBroadcast(
  event: 'snapshot' | 'sync-request',
  payload: Record<string, unknown> | null
) {
  for (const handler of channelState.broadcastHandlers[event]) {
    handler({ payload })
  }
}

function emitPresence(event: 'sync' | 'join' | 'leave') {
  for (const handler of channelState.presenceHandlers[event]) {
    handler()
  }
}

function renderCoedit(overrides: Partial<HookProps> = {}) {
  const onRemoteSnapshot = vi.fn((snapshot: Snapshot) => {
    void snapshot
  })

  const props: HookProps = {
    documentId: 'doc1',
    enabled: true,
    snapshot: { title: 'Initial', cells: ['A1'] },
    onRemoteSnapshot,
    debounceMs: 50,
    channelKind: 'sheet',
    ...overrides,
  }

  const view = renderHook((currentProps: HookProps) => useRealtimeCoedit<Snapshot>(currentProps), {
    initialProps: props,
    wrapper: createWrapper(),
  })

  return { ...view, props, onRemoteSnapshot }
}

beforeEach(() => {
  vi.useFakeTimers()
  resetRealtimeMocks()
  mockUseAuth.mockReturnValue(AUTH_RESPONSE)
  mockUseCurrentProfile.mockReturnValue(PROFILE_RESPONSE)
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('useRealtimeCoedit', () => {
  it('returns an idle disconnected state when realtime coedit is disabled', () => {
    const { result } = renderCoedit({ enabled: false })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.isSynced).toBe(false)
    expect(result.current.connectedUsers).toEqual([])
    expect(mockSupabaseChannel).not.toHaveBeenCalled()
  })

  it('connects to the document channel, tracks presence, syncs users and broadcasts local snapshots', async () => {
    const { result, rerender, props, unmount } = renderCoedit()

    expect(mockSupabaseChannel).toHaveBeenCalledWith('coedit-sheet-doc1', {
      config: {
        broadcast: { self: false },
        presence: { key: 'u1' },
      },
    })

    await act(async () => {
      await getSubscribeCallback()('SUBSCRIBED')
    })

    expect(result.current.isConnected).toBe(true)
    expect(mockChannel.track).toHaveBeenCalledWith({
      user_id: 'u1',
      user_name: 'Ada Lovelace',
      user_avatar: 'avatar.png',
      user_color: '#8b5cf6',
      cursor: null,
    })
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'sync-request',
      payload: { sender: 'u1' },
    })

    channelState.presenceState.self = [
      {
        user_id: 'u1',
        user_name: 'Ada Lovelace',
        user_avatar: 'avatar.png',
        user_color: '#8b5cf6',
        cursor: null,
      },
    ]
    channelState.presenceState.peer = [REMOTE_USER]

    act(() => {
      emitPresence('sync')
    })

    expect(result.current.connectedUsers).toEqual([REMOTE_USER])

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.isSynced).toBe(true)

    const changedSnapshot: Snapshot = { title: 'Changed', cells: ['B2'] }

    rerender({ ...props, snapshot: changedSnapshot })

    act(() => {
      vi.advanceTimersByTime(50)
    })

    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'snapshot',
      payload: {
        sender: 'u1',
        revision: 1,
        data: changedSnapshot,
      },
    })

    act(() => {
      result.current.broadcastCursor({ row: 2, col: 3 })
    })

    expect(mockChannel.track).toHaveBeenCalledWith({
      user_id: 'u1',
      user_name: 'Ada Lovelace',
      user_avatar: 'avatar.png',
      user_color: '#8b5cf6',
      cursor: { row: 2, col: 3 },
    })

    unmount()

    expect(mockChannel.untrack).toHaveBeenCalledTimes(1)
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('applies only newer remote snapshots and ignores self or stale broadcasts', async () => {
    const { onRemoteSnapshot } = renderCoedit()

    await act(async () => {
      await getSubscribeCallback()('SUBSCRIBED')
    })

    const remoteSnapshot: Snapshot = { title: 'Remote', cells: ['C3'] }
    const staleSnapshot: Snapshot = { title: 'Stale', cells: ['D4'] }
    const selfSnapshot: Snapshot = { title: 'Self', cells: ['E5'] }

    act(() => {
      emitBroadcast('snapshot', {
        sender: 'u2',
        revision: 5,
        data: remoteSnapshot,
      })
    })

    expect(onRemoteSnapshot).toHaveBeenCalledTimes(1)
    expect(onRemoteSnapshot).toHaveBeenCalledWith(remoteSnapshot)

    act(() => {
      emitBroadcast('snapshot', {
        sender: 'u2',
        revision: 4,
        data: staleSnapshot,
      })
      emitBroadcast('snapshot', {
        sender: 'u1',
        revision: 6,
        data: selfSnapshot,
      })
      vi.advanceTimersByTime(0)
    })

    expect(onRemoteSnapshot).toHaveBeenCalledTimes(1)
  })

  it('responds to sync requests with the latest local snapshot', async () => {
    const latestSnapshot: Snapshot = { title: 'Latest', cells: ['F6'] }
    renderCoedit({ snapshot: latestSnapshot })

    await act(async () => {
      await getSubscribeCallback()('SUBSCRIBED')
    })

    act(() => {
      emitBroadcast('sync-request', {
        sender: 'u2',
      })
    })

    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'snapshot',
      payload: {
        sender: 'u1',
        revision: 1,
        data: latestSnapshot,
      },
    })
  })

  it('marks the channel disconnected when Supabase realtime reports an error status', async () => {
    const { result } = renderCoedit()

    await act(async () => {
      await getSubscribeCallback()('SUBSCRIBED')
    })

    expect(result.current.isConnected).toBe(true)

    await act(async () => {
      await getSubscribeCallback()('CHANNEL_ERROR')
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.isSynced).toBe(false)
  })
})
