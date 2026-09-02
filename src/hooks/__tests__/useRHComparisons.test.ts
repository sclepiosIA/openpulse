import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRHComparisons } from '../hr/useRHComparisons';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('useRHComparisons', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();

    mockFrom.mockImplementation(() =>
      createChainableProxy({
        data: [
          { profile_id: 'p1', salaire_brut: 3000, cotisations_patronales: 1200, mois: '2026-03-01' },
        ],
        error: null,
      })
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useRHComparisons(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('accepts type parameter', () => {
    const { result: monthResult } = renderHook(() => useRHComparisons('month'), { wrapper });
    expect(monthResult.current.isLoading).toBe(true);

    const { result: quarterResult } = renderHook(() => useRHComparisons('quarter'), { wrapper });
    expect(quarterResult.current.isLoading).toBe(true);

    const { result: yearResult } = renderHook(() => useRHComparisons('year'), { wrapper });
    expect(yearResult.current.isLoading).toBe(true);
  });
});
