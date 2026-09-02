import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePulseSearch } from '../pulse/usePulseSearch';
import { supabase } from '@/integrations/supabase/client';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('usePulseSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => usePulseSearch());
    
    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.hasSearched).toBe(false);
  });

  it('does not search for queries shorter than 2 chars', async () => {
    const { result } = renderHook(() => usePulseSearch());
    
    await act(async () => {
      await result.current.search('a');
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.hasSearched).toBe(false);
  });

  it('searches with valid query', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        results: [{ id: '1', content: 'Test message', conversation_id: 'c-1' }],
        total: 1,
        query: 'test',
        limit: 20,
        offset: 0,
      },
      error: null,
    });

    const { result } = renderHook(() => usePulseSearch());
    
    await act(async () => {
      await result.current.search('test query');
    });

    expect(mockInvoke).toHaveBeenCalledWith('pulse-search', {
      body: { query: 'test query', conversation_id: undefined, limit: 20, offset: 0 },
    });
    expect(result.current.results).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.hasSearched).toBe(true);
  });

  it('clears search results', async () => {
    mockInvoke.mockResolvedValue({
      data: { results: [{ id: '1' }], total: 1, query: 'test', limit: 20, offset: 0 },
      error: null,
    });

    const { result } = renderHook(() => usePulseSearch());
    
    await act(async () => {
      await result.current.search('test query');
    });
    expect(result.current.hasSearched).toBe(true);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasSearched).toBe(false);
  });

  it('handles search errors gracefully', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Search failed') });

    const { result } = renderHook(() => usePulseSearch());
    
    await act(async () => {
      await result.current.search('test query');
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });
});
