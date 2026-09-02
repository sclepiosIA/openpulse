import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockRpc = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { useActivityFeedStats } from '../activity/useActivityFeedStats'
import { supabase } from '@/integrations/supabase/client';

describe('useActivityFeedStats', () => {
  let queryClient: QueryClient
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    vi.clearAllMocks()
  })

  it('calls get_activity_feed_stats RPC with filters', async () => {
    mockRpc.mockResolvedValue({
      data: { today: 1, week: 2, month: 3, by_type: {}, by_user: [] },
      error: null,
    })
    const { result } = renderHook(
      () => useActivityFeedStats({ types: ['task'] as unknown as never }),

      { wrapper }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockRpc).toHaveBeenCalledWith(
      'get_activity_feed_stats',
      expect.objectContaining({
        p_filters: expect.any(Object),
      })
    )
    expect(result.current.data).toEqual({ today: 1, week: 2, month: 3, by_type: {}, by_user: [] })
  })

  it('returns default shape when data is missing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useActivityFeedStats(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual({ today: 0, week: 0, month: 0, by_type: {}, by_user: [] })
  })

  it('surfaces an error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('boom') })
    const { result } = renderHook(() => useActivityFeedStats(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })
})
