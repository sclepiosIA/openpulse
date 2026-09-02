import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSignatureEvents } from './useSignatureEvents'

const {
  EVENTS,
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
  AUTH_STATE,
  builder,
  channelObject,
  mockFrom,
  mockChannel,
  mockRemoveChannel,
  selectMock,
  eqMock,
  orderMock,
  thenMock,
  catchMock,
  onMock,
  subscribeMock,
} = vi.hoisted(() => {
  const EVENTS = [
    {
      id: 'evt-1',
      request_id: 'req-1',
      type: 'created',
      created_at: '2024-01-02T10:00:00Z',
    },
    {
      id: 'evt-2',
      request_id: 'req-1',
      type: 'sent',
      created_at: '2024-01-01T10:00:00Z',
    },
  ]

  const SUCCESS_RESPONSE = { data: EVENTS, error: null }
  const ERROR_RESPONSE = { data: null, error: { message: 'x' } }

  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const selectMock = vi.fn()
  const eqMock = vi.fn()
  const orderMock = vi.fn()
  const thenMock = vi.fn()
  const catchMock = vi.fn()

  const builder = {
    select: selectMock,
    eq: eqMock,
    order: orderMock,
    then: thenMock,
    catch: catchMock,
  }

  selectMock.mockReturnValue(builder)
  eqMock.mockReturnValue(builder)
  orderMock.mockResolvedValue(SUCCESS_RESPONSE)
  thenMock.mockImplementation(
    (
      onFulfilled?: (value: typeof SUCCESS_RESPONSE) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(SUCCESS_RESPONSE).then(onFulfilled, onRejected)
  )
  catchMock.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(SUCCESS_RESPONSE).catch(onRejected)
  )

  const mockFrom = vi.fn(() => builder)

  const subscribeMock = vi.fn()
  const onMock = vi.fn()
  const channelObject = {
    on: onMock,
    subscribe: subscribeMock,
  }
  onMock.mockReturnValue(channelObject)
  subscribeMock.mockReturnValue(channelObject)

  const mockChannel = vi.fn(() => channelObject)
  const mockRemoveChannel = vi.fn()

  return {
    EVENTS,
    SUCCESS_RESPONSE,
    ERROR_RESPONSE,
    AUTH_STATE,
    builder,
    channelObject,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    selectMock,
    eqMock,
    orderMock,
    thenMock,
    catchMock,
    onMock,
    subscribeMock,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children)
  }
}

describe('useSignatureEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    selectMock.mockReturnValue(builder)
    eqMock.mockReturnValue(builder)
    orderMock.mockResolvedValue(SUCCESS_RESPONSE)
    thenMock.mockImplementation(
      (
        onFulfilled?: (value: typeof SUCCESS_RESPONSE) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(SUCCESS_RESPONSE).then(onFulfilled, onRejected)
    )
    catchMock.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(SUCCESS_RESPONSE).catch(onRejected)
    )

    onMock.mockReturnValue(channelObject)
    subscribeMock.mockReturnValue(channelObject)
    mockFrom.mockReturnValue(builder)
    mockChannel.mockReturnValue(channelObject)
  })

  it('charge puis retourne les événements et configure la souscription realtime', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useSignatureEvents('req-1'), {
      wrapper: createWrapper(queryClient),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.fetchStatus).toBe('fetching')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('signature_events')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqMock).toHaveBeenCalledWith('request_id', 'req-1')
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false })

    expect(result.current.data).toEqual(EVENTS)
    expect(result.current.data?.map((event) => event.id)).toEqual(['evt-1', 'evt-2'])
    expect(result.current.data?.[0]?.type).toBe('created')
    expect(result.current.data?.[1]?.type).toBe('sent')

    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^signature_events_req-1-/))
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'signature_events',
        filter: 'request_id=eq.req-1',
      },
      expect.any(Function)
    )
    expect(subscribeMock).toHaveBeenCalledTimes(1)
  })

  it('passe en erreur quand la requête Supabase échoue', async () => {
    orderMock.mockResolvedValue(ERROR_RESPONSE)
    thenMock.mockImplementation(
      (
        onFulfilled?: (value: typeof ERROR_RESPONSE) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(ERROR_RESPONSE).then(onFulfilled, onRejected)
    )
    catchMock.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(ERROR_RESPONSE).catch(onRejected)
    )

    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useSignatureEvents('req-1'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(ERROR_RESPONSE.error)
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('signature_events')
    expect(eqMock).toHaveBeenCalledWith('request_id', 'req-1')
  })

  it('n’exécute pas la query ni la souscription sans requestId, puis nettoie la channel au démontage', async () => {
    const queryClient = createTestQueryClient()

    const { result, rerender, unmount } = renderHook(
      (props: { requestId: string | undefined | null }) => useSignatureEvents(props.requestId),
      {
        initialProps: { requestId: undefined },
        wrapper: createWrapper(queryClient),
      }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.status).toBe('pending')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockChannel).not.toHaveBeenCalled()

    rerender({ requestId: 'req-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('signature_events')
    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^signature_events_req-1-/))

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObject)
  })

  it('invalide la query quand le callback realtime est déclenché', async () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useSignatureEvents('req-1'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(onMock).toHaveBeenCalled()
    })

    const realtimeCallback = onMock.mock.calls[0]?.[2] as (() => void) | undefined
    expect(typeof realtimeCallback).toBe('function')

    await act(async () => {
      if (realtimeCallback) {
        realtimeCallback()
      }
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['signature-events', 'req-1'],
    })
  })
})
