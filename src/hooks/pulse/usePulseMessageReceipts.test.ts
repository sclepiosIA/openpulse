import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { usePulseMessageReceipts } from './usePulseMessageReceipts'

const h = vi.hoisted(() => {
  const PROFILE = { id: 'u1', display_name: 'Test User' }
  const MESSAGES_RESULT = {
    data: [{ id: 'm1' }, { id: 'm2' }],
    error: null,
  }
  const RECEIPTS_RESULT = {
    data: [
      {
        message_id: 'm1',
        user_id: 'u2',
        delivered_at: '2024-01-01T10:00:00Z',
        read_at: '2024-01-01T11:00:00Z',
      },
      { message_id: 'm1', user_id: 'u3', delivered_at: '2024-01-01T10:05:00Z', read_at: null },
      { message_id: 'm2', user_id: 'u2', delivered_at: '2024-01-01T10:00:00Z', read_at: null },
    ],
    error: null,
  }
  const MEMBER_COUNT_RESULT = { count: 3, error: null, data: null }
  const ERROR_RESULT = { data: null, error: { message: 'x' } }

  const makeBuilder = (result: unknown) => {
    const builder: Record<string, unknown> = {}
    const methods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
    ]
    for (const m of methods) {
      builder[m] = vi.fn(() => builder)
    }
    builder.single = vi.fn(() => Promise.resolve(result))
    builder.maybeSingle = vi.fn(() => Promise.resolve(result))
    builder.then = (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    builder.catch = (reject?: (e: unknown) => unknown) => Promise.resolve(result).catch(reject)
    return builder
  }

  const mockFrom = vi.fn()
  const mockRpc = vi.fn()
  const mockChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  mockChannel.on.mockReturnValue(mockChannel)
  mockChannel.subscribe.mockReturnValue(mockChannel)
  const mockChannelFn = vi.fn(() => mockChannel)
  const mockRemoveChannel = vi.fn()

  return {
    PROFILE,
    MESSAGES_RESULT,
    RECEIPTS_RESULT,
    MEMBER_COUNT_RESULT,
    ERROR_RESULT,
    makeBuilder,
    mockFrom,
    mockRpc,
    mockChannel,
    mockChannelFn,
    mockRemoveChannel,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: h.mockFrom,
    rpc: h.mockRpc,
    channel: h.mockChannelFn,
    removeChannel: h.mockRemoveChannel,
  },
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: h.PROFILE, isLoading: false }),
}))

vi.mock('@/hooks/shared/useDebouncedValue', () => ({
  useDebouncedValue: <T>(value: T) => value,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/hooks/pulse/usePulseUnreadCount', () => ({
  pulseUnreadKeys: { total: ['pulse-unread-total'] },
}))

vi.mock('@/components/pulse/MessageReadReceipt', () => ({
  MessageReadReceipt: () => null,
  default: () => null,
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

function setupSuccessMocks() {
  h.mockFrom.mockImplementation((table: string) => {
    if (table === 'pulse_messages') return h.makeBuilder(h.MESSAGES_RESULT)
    if (table === 'pulse_message_receipts') return h.makeBuilder(h.RECEIPTS_RESULT)
    if (table === 'pulse_conversation_members') return h.makeBuilder(h.MEMBER_COUNT_RESULT)
    return h.makeBuilder({ data: null, error: null })
  })
  h.mockRpc.mockResolvedValue({ data: null, error: null })
}

describe('usePulseMessageReceipts', () => {
  beforeEach(() => {
    h.mockFrom.mockReset()
    h.mockRpc.mockReset()
    h.mockChannelFn.mockClear()
    h.mockRemoveChannel.mockClear()
    h.mockChannel.on.mockClear()
    h.mockChannel.subscribe.mockClear()
    h.mockChannel.on.mockReturnValue(h.mockChannel)
    h.mockChannel.subscribe.mockReturnValue(h.mockChannel)
    setupSuccessMocks()
  })

  it('charge les receipts et calcule les statuts par message', async () => {
    const { result } = renderHook(() => usePulseMessageReceipts('conv-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.receipts).toEqual([])

    await waitFor(() => {
      expect(result.current.receipts).toHaveLength(3)
    })

    await waitFor(() => {
      expect(result.current.isGroupChat).toBe(true)
    })

    const statusM1 = result.current.getMessageReceiptStatus('m1', 'u1', true)
    expect(statusM1).toEqual({
      deliveredCount: 2,
      readCount: 1,
      totalRecipients: 2,
      status: 'read',
    })

    const statusM2 = result.current.getMessageReceiptStatus('m2', 'u1', true)
    expect(statusM2).toEqual({
      deliveredCount: 1,
      readCount: 0,
      totalRecipients: 2,
      status: 'sent',
    })
  })

  it('retourne le résumé par défaut pour un message sans receipt ou non possédé', async () => {
    const { result } = renderHook(() => usePulseMessageReceipts('conv-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.receipts).toHaveLength(3)
    })

    const notOwn = result.current.getMessageReceiptStatus('m1', 'u2', false)
    expect(notOwn).toEqual({
      deliveredCount: 0,
      readCount: 0,
      totalRecipients: 0,
      status: 'sent',
    })

    await waitFor(() => {
      expect(result.current.isGroupChat).toBe(true)
    })

    const unknownMessage = result.current.getMessageReceiptStatus('m-inconnu', 'u1', true)
    expect(unknownMessage.status).toBe('sent')
    expect(unknownMessage.totalRecipients).toBe(2)
    expect(unknownMessage.deliveredCount).toBe(0)
    expect(unknownMessage.readCount).toBe(0)
  })

  it('appelle mark_messages_as_delivered au montage avec le profil courant', async () => {
    renderHook(() => usePulseMessageReceipts('conv-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(h.mockRpc).toHaveBeenCalledWith('mark_messages_as_delivered', {
        p_user_id: 'u1',
      })
    })
  })

  it('markAsRead déclenche le RPC mark_messages_as_read avec les bons paramètres', async () => {
    const { result } = renderHook(() => usePulseMessageReceipts('conv-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.receipts).toHaveLength(3)
    })

    await act(async () => {
      result.current.markAsRead()
    })

    await waitFor(() => {
      expect(h.mockRpc).toHaveBeenCalledWith('mark_messages_as_read', {
        p_conversation_id: 'conv-1',
        p_user_id: 'u1',
      })
    })
  })

  it('retourne un tableau vide si la requête des messages échoue', async () => {
    h.mockFrom.mockImplementation((table: string) => {
      if (table === 'pulse_messages') return h.makeBuilder(h.ERROR_RESULT)
      if (table === 'pulse_conversation_members') return h.makeBuilder(h.MEMBER_COUNT_RESULT)
      return h.makeBuilder({ data: null, error: null })
    })

    const { result } = renderHook(() => usePulseMessageReceipts('conv-err'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(h.mockFrom).toHaveBeenCalledWith('pulse_messages')
    })

    expect(result.current.receipts).toEqual([])
    expect(result.current.getMessageReceiptStatus('m1', 'u1', true).status).toBe('sent')
  })

  it('ne lance aucune requête de receipts quand conversationId est undefined', async () => {
    const { result } = renderHook(() => usePulseMessageReceipts(undefined), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(h.mockRpc).toHaveBeenCalledWith('mark_messages_as_delivered', {
        p_user_id: 'u1',
      })
    })

    expect(result.current.receipts).toEqual([])
    expect(result.current.isGroupChat).toBe(false)
    expect(h.mockFrom).not.toHaveBeenCalledWith('pulse_messages')
    expect(h.mockChannelFn).not.toHaveBeenCalled()
  })

  it("s'abonne au canal realtime et le retire au démontage", async () => {
    const { unmount } = renderHook(() => usePulseMessageReceipts('conv-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(h.mockChannelFn).toHaveBeenCalledWith(expect.stringMatching(/^receipts-conv-1-/))
    })
    expect(h.mockChannel.subscribe).toHaveBeenCalled()

    unmount()

    expect(h.mockRemoveChannel).toHaveBeenCalledWith(h.mockChannel)
  })
})
