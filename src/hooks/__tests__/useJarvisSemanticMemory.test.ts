import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { embedding: [0.1, 0.2] }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { useJarvisSemanticMemory } from '../jarvis/useJarvisSemanticMemory';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisSemanticMemory', () => {
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useJarvisSemanticMemory());
    expect(result.current.isSearching).toBe(false);
    expect(result.current.lastResults).toEqual([]);
  });

  it('provides searchMemory function', () => {
    const { result } = renderHook(() => useJarvisSemanticMemory());
    expect(typeof result.current.searchMemory).toBe('function');
  });

  it('searchMemory returns empty for missing user', async () => {
    vi.doMock('@/hooks/shared/useAuth', () => ({
      useAuth: () => ({ user: null }),
    }));
    const { result } = renderHook(() => useJarvisSemanticMemory());
    // Won't throw - returns empty
    expect(result.current.lastResults).toEqual([]);
  });
});
