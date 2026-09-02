/**
 * Tests for useJarvisGamification hook (JARVIS V12.0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              total_score: 500,
              weekly_score: 100,
              level: 3,
              experience_points: 500,
              time_saved_minutes: 120,
              tasks_auto_completed: 25,
              emails_processed: 50,
              suggestions_accepted: 40,
              suggestions_rejected: 5,
              current_streak_days: 5,
              badges: [{ id: 'early_adopter' }, { id: 'speed_demon' }],
            },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              total_score: 500,
              weekly_score: 100,
              level: 3,
              experience_points: 500,
              time_saved_minutes: 120,
              tasks_auto_completed: 25,
              emails_processed: 50,
              suggestions_accepted: 40,
              suggestions_rejected: 5,
              current_streak_days: 5,
              badges: [{ id: 'early_adopter' }, { id: 'speed_demon' }],
            },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

// Mock auth
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useJarvisGamification } from '@/hooks/jarvis/useJarvisGamification'
import { supabase } from '@/integrations/supabase/client'

describe('useJarvisGamification', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  it('should initialize and fetch user score', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.score).not.toBeNull()
    expect(result.current.score?.totalScore).toBe(500)
    expect(result.current.score?.level).toBe(3)
  })

  it('should provide tracking functions', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.trackTimeSaved).toBe('function')
    expect(typeof result.current.trackTaskCompleted).toBe('function')
    expect(typeof result.current.trackEmailProcessed).toBe('function')
    expect(typeof result.current.trackSuggestionResponse).toBe('function')
  })

  it('should call RPC when tracking time saved', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.trackTimeSaved(30)
    })

    expect(supabase.rpc).toHaveBeenCalledWith('increment_jarvis_score', {
      p_user_id: 'test-user-id',
      p_score_type: 'time_saved',
      p_value: 30,
    })
  })

  it('should get earned badges', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const earnedBadges = result.current.getEarnedBadges()
    expect(Array.isArray(earnedBadges)).toBe(true)
  })

  it('should get available badges', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const availableBadges = result.current.getAvailableBadges()
    expect(Array.isArray(availableBadges)).toBe(true)
  })

  it('should provide addScore function for challenges', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.addScore).toBe('function')

    await act(async () => {
      await result.current.addScore(50, 'Challenge completed')
    })

    expect(supabase.rpc).toHaveBeenCalledWith('increment_jarvis_score', {
      p_user_id: 'test-user-id',
      p_score_type: 'challenge_completed',
      p_value: 50,
    })
  })

  it('should provide refreshScore function', async () => {
    const { result } = renderHook(() => useJarvisGamification(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.refreshScore).toBe('function')
  })
})
