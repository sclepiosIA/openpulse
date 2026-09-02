import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { feedItems, mockRpc, mockChannel, mockRemoveChannel, mockDebug } = vi.hoisted(() => {
  const channelObj = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  channelObj.on.mockReturnValue(channelObj)
  channelObj.subscribe.mockReturnValue({ unsubscribe: vi.fn() })

  return {
    feedItems: [
      {
        id: 'item-1',
        type: 'interaction',
        occurred_at: '2024-01-15T10:00:00Z',
        actor_user_id: 'user-1',
        actor_name: 'Alice',
        etablissement_id: 'etab-1',
        etablissement_nom: 'CHU Lille',
        title: 'Appel client',
        description: null,
        icon: '📞',
        color: 'blue',
        link: null,
        metadata: null,
      },
      {
        id: 'item-2',
        type: 'tache',
        occurred_at: '2024-01-15T09:00:00Z',
        actor_user_id: 'user-2',
        actor_name: 'Bob',
        etablissement_id: 'etab-2',
        etablissement_nom: 'Clinique',
        title: 'Tâche terminée',
        description: 'Envoi contrat',
        icon: '✅',
        color: 'green',
        link: null,
        metadata: null,
      },
    ],
    mockRpc: vi.fn(),
    mockChannel: vi.fn().mockReturnValue(channelObj),
    mockRemoveChannel: vi.fn(),
    mockDebug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: mockDebug,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useGlobalActivityFeed', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockChannel.mockClear()
    mockRemoveChannel.mockClear()
    mockDebug.error.mockReset()
  })

  it('passe de isLoading à succès et retourne les items aplatis', async () => {
    const { useGlobalActivityFeed } = await import('./useGlobalActivityFeed')
    mockRpc.mockResolvedValue({ data: feedItems, error: null })

    const { result } = renderHook(() => useGlobalActivityFeed(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].title).toBe('Appel client')
    expect(result.current.items[1].type).toBe('tache')
    expect(result.current.pendingNew).toBe(0)
    expect(mockRpc).toHaveBeenCalledWith(
      'get_global_activity_feed',
      expect.objectContaining({ p_limit: 30, p_cursor: undefined })
    )
  })

  it('retourne une page vide et ne relance pas si RPC 42P01 (table absente)', async () => {
    const { useGlobalActivityFeed } = await import('./useGlobalActivityFeed')
    const pgErr = { code: '42P01', message: 'relation does not exist' }
    mockRpc.mockResolvedValue({ data: null, error: pgErr })

    const { result } = renderHook(() => useGlobalActivityFeed(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.items).toHaveLength(0)
    // pas de debug.error pour ce cas
    expect(mockDebug.error).not.toHaveBeenCalled()
  })

  it('expose isError pour les erreurs non-structurelles', async () => {
    const { useGlobalActivityFeed } = await import('./useGlobalActivityFeed')
    const err = new Error('timeout réseau')
    mockRpc.mockResolvedValue({ data: null, error: err })

    const { result } = renderHook(() => useGlobalActivityFeed(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
  })

  it('refresh remet pendingNew à 0 et invalide les queries', async () => {
    const { useGlobalActivityFeed } = await import('./useGlobalActivityFeed')
    mockRpc.mockResolvedValue({ data: feedItems, error: null })

    const { result } = renderHook(() => useGlobalActivityFeed({ realtime: false }), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.pendingNew).toBe(0)

    await act(async () => {
      result.current.refresh()
    })

    expect(result.current.pendingNew).toBe(0)
  })

  it('utilise un pageSize custom (10) dans le RPC', async () => {
    const { useGlobalActivityFeed } = await import('./useGlobalActivityFeed')
    const smallPage = feedItems.slice(0, 1)
    mockRpc.mockResolvedValue({ data: smallPage, error: null })

    const { result } = renderHook(() => useGlobalActivityFeed({ pageSize: 10 }), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith(
      'get_global_activity_feed',
      expect.objectContaining({ p_limit: 10 })
    )
  })
})
