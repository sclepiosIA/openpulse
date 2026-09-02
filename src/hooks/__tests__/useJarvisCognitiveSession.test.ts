import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { useJarvisCognitiveSession } from '../jarvis/useJarvisCognitiveSession';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisCognitiveSession', () => {
  it('initializes with null session', () => {
    const { result } = renderHook(() => useJarvisCognitiveSession());
    expect(result.current.session).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('provides session management functions', () => {
    const { result } = renderHook(() => useJarvisCognitiveSession());
    expect(typeof result.current.initSession).toBe('function');
    expect(typeof result.current.addToMemory).toBe('function');
    expect(typeof result.current.resolveCorefereces).toBe('function');
    expect(typeof result.current.resetSession).toBe('function');
  });

  it('provides clarification management', () => {
    const { result } = renderHook(() => useJarvisCognitiveSession());
    expect(typeof result.current.addClarification).toBe('function');
    expect(typeof result.current.answerClarification).toBe('function');
  });
});
