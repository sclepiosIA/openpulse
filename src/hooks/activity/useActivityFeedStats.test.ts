import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { statsData, mockRpc } = vi.hoisted(() => ({
  statsData: {
    today: 5,
    week: 28,
    month: 112,
    by_type: {
      interaction: 10,
      tache: 8,
      email: 6,
      workflow: 4,
    },
    by_user: [
      { user_id: 'user-1', name: 'Alice', count: 15 },
      { user_id: 'user-2', name: 'Bob', count: 13 },
    ],
  },
  mockRpc: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: mockRpc },
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

describe('useActivityFeedStats', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('passe de isLoading à succès et retourne les stats complètes', async () => {
    const { useActivityFeedStats } = await import('./useActivityFeedStats')
    mockRpc.mockResolvedValue({ data: statsData, error: null })

    const { result } = renderHook(() => useActivityFeedStats(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.today).toBe(5)
    expect(result.current.data?.week).toBe(28)
    expect(result.current.data?.month).toBe(112)
    expect(result.current.data?.by_type?.interaction).toBe(10)
    expect(result.current.data?.by_user).toHaveLength(2)
    expect(result.current.data?.by_user?.[0].name).toBe('Alice')
    expect(mockRpc).toHaveBeenCalledWith('get_activity_feed_stats', {
      p_filters: {},
    })
  })

  it('passe les filtres dans le RPC', async () => {
    const { useActivityFeedStats } = await import('./useActivityFeedStats')
    mockRpc.mockResolvedValue({ data: statsData, error: null })

    const filters = { types: ['interaction' as const], user_ids: ['user-1'] }
    const { result } = renderHook(() => useActivityFeedStats(filters), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_activity_feed_stats', {
      p_filters: expect.objectContaining({ types: ['interaction'], user_ids: ['user-1'] }),
    })
  })

  it('retourne les valeurs par défaut quand data est null', async () => {
    const { useActivityFeedStats } = await import('./useActivityFeedStats')
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useActivityFeedStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.today).toBe(0)
    expect(result.current.data?.week).toBe(0)
    expect(result.current.data?.month).toBe(0)
    expect(result.current.data?.by_user).toHaveLength(0)
  })

  it('expose isError quand le RPC échoue', async () => {
    const { useActivityFeedStats } = await import('./useActivityFeedStats')
    const err = new Error('RPC indisponible')
    mockRpc.mockResolvedValue({ data: null, error: err })

    const { result } = renderHook(() => useActivityFeedStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })
})
