import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

const { CURRENT_DATA, PREVIOUS_DATA, mockFrom, setErrorMode } = vi.hoisted(() => {
  let errorMode = false;

  const setErrorMode = (v: boolean) => {
    errorMode = v;
  };

  const CURRENT_DATA = [
    {
      id: 'c1',
      salaire_brut: 1000,
      cotisations_patronales: 200,
      profile_id: 'p1',
      mois: 'current-1',
    },
    {
      id: 'c2',
      salaire_brut: 1500,
      cotisations_patronales: 600,
      profile_id: 'p2',
      mois: 'current-2',
    },
  ];

  const PREVIOUS_DATA = [
    {
      id: 'p1',
      salaire_brut: 1200,
      cotisations_patronales: 300,
      profile_id: 'p1',
      mois: 'prev-1',
    },
  ];

  const mockFrom = vi.fn((_table: string) => {
    return {
      _gte: null as string | null,
      _lte: null as string | null,
      select(this: any) {
        return this;
      },
      gte(this: any, _field: string, val: string) {
        this._gte = val;
        return this;
      },
      lte(this: any, _field: string, val: string) {
        this._lte = val;
        return this;
      },
      then(this: any, resolve: (v: any) => void) {
        const now = new Date();
        const currentStart = startOfMonth(now);
        const currentEnd = endOfMonth(now);
        const previousStart = startOfMonth(subMonths(now, 1));
        const previousEnd = endOfMonth(subMonths(now, 1));
        const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
        const curGte = fmt(currentStart);
        const curLte = fmt(currentEnd);
        const prevGte = fmt(previousStart);
        const prevLte = fmt(previousEnd);

        if (this._gte === curGte && this._lte === curLte) {
          if (errorMode) {
            resolve({ data: null, error: { message: 'injected error' } });
            return;
          }
          resolve({ data: CURRENT_DATA, error: null });
          return;
        }

        if (this._gte === prevGte && this._lte === prevLte) {
          resolve({ data: PREVIOUS_DATA, error: null });
          return;
        }

        resolve({ data: [], error: null });
      },
      catch() {
        return this;
      },
    };
  });

  return { CURRENT_DATA, PREVIOUS_DATA, mockFrom, setErrorMode };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

import { useRHComparisons } from './useRHComparisons';

describe('useRHComparisons', () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('initially loading then computes KPIs correctly for month', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRHComparisons('month'), { wrapper });

    // initial state should be loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();

    // Expected calculations based on CURRENT_DATA and PREVIOUS_DATA defined in hoisted mock
    // CURRENT: two entries -> masse = (1000+200) + (1500+600) = 3300, effectifs = 2, coutMoyen = 1650
    // PREVIOUS: one entry -> masse = (1200+300) = 1500, effectifs = 1, coutMoyen = 1500
    expect(data?.current.masseSalariale).toBe(3300);
    expect(data?.previous.masseSalariale).toBe(1500);

    expect(data?.current.effectif).toBe(2);
    expect(data?.previous.effectif).toBe(1);

    expect(data?.current.coutMoyen).toBe(1650);
    expect(data?.previous.coutMoyen).toBe(1500);

    // Deltas
    expect(data?.delta.masseSalariale.value).toBe(1800);
    expect(data?.delta.masseSalariale.percentage).toBeCloseTo((1800 / 1500) * 100);

    expect(data?.delta.effectif.value).toBe(1);
    expect(data?.delta.effectif.percentage).toBeCloseTo((1 / 1) * 100);

    expect(data?.delta.coutMoyen.value).toBe(150);
    expect(data?.delta.coutMoyen.percentage).toBeCloseTo((150 / 1500) * 100);

    // Period strings should be formatted in French locale as in the hook
    const now = new Date();
    const currentStart = startOfMonth(now);
    const previousStart = startOfMonth(subMonths(now, 1));
    const expectedCurrentPeriode = format(currentStart, 'MMM yyyy', { locale: fr });
    const expectedPreviousPeriode = format(previousStart, 'MMM yyyy', { locale: fr });

    expect(data?.current.periode).toBe(expectedCurrentPeriode);
    expect(data?.previous.periode).toBe(expectedPreviousPeriode);
  });

  it('sets isError when supabase returns an error for current period', async () => {
    setErrorMode(true);
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRHComparisons('month'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(String(result.current.error?.message)).toContain('injected error');

    setErrorMode(false);
  });
});