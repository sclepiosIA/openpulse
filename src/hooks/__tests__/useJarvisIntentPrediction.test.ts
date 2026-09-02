import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/etablissements' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { useJarvisIntentPrediction } from '../jarvis/useJarvisIntentPrediction';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisIntentPrediction', () => {
  it('returns default state', () => {
    const { result } = renderHook(() => useJarvisIntentPrediction());
    expect(result.current.predictions).toEqual([]);
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('can be disabled', () => {
    const { result } = renderHook(() =>
      useJarvisIntentPrediction({ enabled: false })
    );
    expect(result.current.predictions).toEqual([]);
  });

  it('provides expected API', () => {
    const { result } = renderHook(() => useJarvisIntentPrediction());
    expect(typeof result.current.refreshPredictions).toBe('function');
    expect(typeof result.current.dismissPrediction).toBe('function');
    expect(result.current).toHaveProperty('highConfidencePredictions');
  });
});
