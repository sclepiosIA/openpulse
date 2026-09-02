import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn() } }));

const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
const mockIlike = vi.fn().mockReturnValue({ order: mockOrder });
const mockOr = vi.fn().mockReturnValue({ order: mockOrder });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === 'contacts') return { or: mockOr };
        if (table === 'calendar_events') return { ilike: () => ({ gte: mockGte }) };
        return { ilike: mockIlike };
      },
    }),
  },
}));

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (val: string) => val, // No debounce in tests
}));

import { useEntitySearch } from '../search/useEntitySearch';
import { supabase } from '@/integrations/supabase/client';

describe('useEntitySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results for empty query', () => {
    const { result } = renderHook(() => useEntitySearch(''));
    expect(result.current.hasResults).toBe(false);
    expect(result.current.allResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('returns empty results for short query', () => {
    const { result } = renderHook(() => useEntitySearch('a'));
    expect(result.current.hasResults).toBe(false);
  });

  it('clears results', () => {
    const { result } = renderHook(() => useEntitySearch(''));
    act(() => result.current.clearResults());
    expect(result.current.allResults).toEqual([]);
  });
});
