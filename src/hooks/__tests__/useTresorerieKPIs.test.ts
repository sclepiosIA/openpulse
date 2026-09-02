import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/hooks/tresorerie/useTresoreriePrevisionnel', () => ({
  useTresoreriePrevisionnel: () => ({
    previsions: [
      { mois: '2026-03', moisLabel: 'Mars 2026', soldePrevu: 50000, fluxTresorerie: 5000, depensesSalaires: 15000 },
      { mois: '2026-04', moisLabel: 'Avr 2026', soldePrevu: 45000, fluxTresorerie: -5000, depensesSalaires: 15000 },
    ],
    etablissementsPrevisions: [
      { probabilite: 1.0, revenuMensuelEstime: 3000 },
      { probabilite: 0.6, revenuMensuelEstime: 2000 },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

import { useTresorerieKPIs } from '../tresorerie/useTresorerieKPIs';
import { supabase } from '@/integrations/supabase/client';

describe('useTresorerieKPIs', () => {
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

  it('returns KPI structure with expected fields', () => {
    const { result } = renderHook(() => useTresorerieKPIs(), { wrapper });
    expect(result.current).toHaveProperty('cashburnMoyen6MoisPasses');
    expect(result.current).toHaveProperty('cashburnMoyenProjete6Mois');
    expect(result.current).toHaveProperty('cashburnSalairesUniquement');
    expect(result.current).toHaveProperty('facturesEnAttente');
    expect(result.current).toHaveProperty('caParExercice');
    expect(result.current).toHaveProperty('fondsPropreActuels');
    expect(result.current).toHaveProperty('projectionFinAnnee');
    expect(result.current).toHaveProperty('prochainTrouTresorerie');
    expect(result.current).toHaveProperty('pipelineNiveaux');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('refetch');
  });

  it('calculates salaires cashburn from previsions', () => {
    const { result } = renderHook(() => useTresorerieKPIs(), { wrapper });
    // 2 previsions × 15000 / 2 = 15000
    expect(result.current.cashburnSalairesUniquement).toBe(15000);
  });

  it('computes pipeline niveaux from etablissements', () => {
    const { result } = renderHook(() => useTresorerieKPIs(), { wrapper });
    // Production (prob 1.0) + Négociation (prob 0.6)
    expect(result.current.pipelineNiveaux.length).toBeGreaterThanOrEqual(1);
  });

  it('detects no trou de trésorerie when all positive', () => {
    const { result } = renderHook(() => useTresorerieKPIs(), { wrapper });
    expect(result.current.prochainTrouTresorerie).toBeNull();
  });

  it('provides refetch function', () => {
    const { result } = renderHook(() => useTresorerieKPIs(), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
  });
});
