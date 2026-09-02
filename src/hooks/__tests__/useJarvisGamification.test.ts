import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useJarvisGamification } from '../jarvis/useJarvisGamification';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  const mockResult = vi.fn().mockResolvedValue({
    data: {
      total_score: 500,
      weekly_score: 50,
      level: 3,
      experience_points: 500,
      time_saved_minutes: 120,
      tasks_auto_completed: 30,
      emails_processed: 80,
      suggestions_accepted: 15,
      suggestions_rejected: 2,
      current_streak_days: 5,
      badges: [{ id: 'early_adopter' }],
    },
    error: null,
  });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockResult,
            maybeSingle: mockResult,
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

describe('useJarvisGamification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns gamification functions and state', () => {
    const { result } = renderHook(() => useJarvisGamification());
    
    expect(result.current.isLoading).toBeDefined();
    expect(typeof result.current.trackTimeSaved).toBe('function');
    expect(typeof result.current.trackTaskCompleted).toBe('function');
    expect(typeof result.current.trackEmailProcessed).toBe('function');
    expect(typeof result.current.trackSuggestionResponse).toBe('function');
    expect(typeof result.current.getEarnedBadges).toBe('function');
    expect(typeof result.current.getAvailableBadges).toBe('function');
    expect(typeof result.current.refreshScore).toBe('function');
    expect(typeof result.current.addScore).toBe('function');
  });

  it('getEarnedBadges returns empty array when no score loaded', () => {
    const { result } = renderHook(() => useJarvisGamification());
    const badges = result.current.getEarnedBadges();
    expect(Array.isArray(badges)).toBe(true);
  });

  it('getAvailableBadges returns badge definitions when no score', () => {
    const { result } = renderHook(() => useJarvisGamification());
    const available = result.current.getAvailableBadges();
    expect(Array.isArray(available)).toBe(true);
    expect(available.length).toBeGreaterThan(0);
    expect(available[0]).toHaveProperty('id');
    expect(available[0]).toHaveProperty('name');
    expect(available[0]).toHaveProperty('icon');
  });
});
