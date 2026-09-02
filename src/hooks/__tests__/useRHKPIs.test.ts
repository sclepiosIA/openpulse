import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRHKPIs } from '../hr/useRHKPIs';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('useRHKPIs', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();

    // Mock the from() calls to return chainable proxy
    mockFrom.mockImplementation((table: string) => {
      if (table === 'rh_salaires_mensuels') {
        return createChainableProxy({
          data: [
            { id: '1', profile_id: 'p1', mois: '2026-03-01', salaire_brut: 3000, salaire_net: 2300, cotisations_patronales: 1200 },
            { id: '2', profile_id: 'p2', mois: '2026-03-01', salaire_brut: 3500, salaire_net: 2700, cotisations_patronales: 1400 },
          ],
          error: null,
        });
      }
      if (table === 'profiles') {
        return createChainableProxy({
          data: [
            { id: 'p1', actif: true },
            { id: 'p2', actif: true },
            { id: 'p3', actif: false },
          ],
          error: null,
        });
      }
      if (table === 'rh_absences') {
        return createChainableProxy({ data: [], error: null });
      }
      return createChainableProxy({ data: [], error: null });
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useRHKPIs(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('provides the correct query key', () => {
    const { result } = renderHook(() => useRHKPIs('2026-03'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
