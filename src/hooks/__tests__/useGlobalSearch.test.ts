import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (val: string) => val,
}));

import { useGlobalSearch } from '../search/useGlobalSearch';
import { supabase } from '@/integrations/supabase/client';

describe('useGlobalSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
    mockFrom.mockImplementation(() =>
      createChainableProxy({ data: [], error: null })
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('returns results structure with expected keys', () => {
    const { result } = renderHook(() => useGlobalSearch('test query'), { wrapper });
    expect(result.current).toHaveProperty('results');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current.results).toHaveProperty('etablissements');
    expect(result.current.results).toHaveProperty('emails');
    expect(result.current.results).toHaveProperty('taches');
  });

  it('does not search for short queries', () => {
    const { result } = renderHook(() => useGlobalSearch('a'), { wrapper });
    expect(result.current.isLoading).toBe(false);
  });

  it('queries multiple tables for valid search', async () => {
    renderHook(() => useGlobalSearch('recherche test', true, {
      canViewAllEtablissements: true,
      canViewAllEmails: true,
      canViewCalendar: true,
    }), { wrapper });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalled();
    });
  });
});
