const { STATE, SALAIRES, PROFILES, ABSENCES, mockFrom } = vi.hoisted(() => {
  const SALAIRES = [
    // Latest month (2024-06-01) two salaries
    { id: 's1', profile_id: 'p1', mois: '2024-06-01', salaire_brut: 3000, salaire_net: 2400, cotisations_patronales: 500 },
    { id: 's2', profile_id: 'p2', mois: '2024-06-01', salaire_brut: 2000, salaire_net: 1600, cotisations_patronales: 300 },
    // Previous month (2024-05-01)
    { id: 's3', profile_id: 'p1', mois: '2024-05-01', salaire_brut: 2500, salaire_net: 2000, cotisations_patronales: 400 },
  ];

  const PROFILES = [
    { id: 'p1', actif: true },
    { id: 'p2', actif: true },
    { id: 'p3', actif: false },
  ];

  const ABSENCES = [
    // One absence entirely inside June 2024 (3 days)
    { id: 'a1', date_debut: '2024-06-03', date_fin: '2024-06-05' },
    // An absence outside the month (should be filtered out)
    { id: 'a2', date_debut: '2024-04-01', date_fin: '2024-04-02' },
  ];

  const STATE = { salairesError: false, profilesError: false, absencesError: false };

  const mockFrom = (tableName: string) => {
    const ctx: {
      table: string;
      orderArgs?: { field: string; opts?: Record<string, unknown> } | null;
      gteField?: string | null;
      gteValue?: string | null;
      lteField?: string | null;
      lteValue?: string | null;
    } = { table: tableName, orderArgs: null, gteField: null, gteValue: null, lteField: null, lteValue: null };

    const builder: any = {
      select: vi.fn(() => builder),
      order: vi.fn((field: string, opts?: Record<string, unknown>) => {
        ctx.orderArgs = { field, opts };
        return builder;
      }),
      eq: vi.fn(() => builder),
      gte: vi.fn((field: string, value: string) => {
        ctx.gteField = field;
        ctx.gteValue = value;
        return builder;
      }),
      lte: vi.fn((field: string, value: string) => {
        ctx.lteField = field;
        ctx.lteValue = value;
        return builder;
      }),
      in: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => ({ then: (res: any) => Promise.resolve(res({ data: [], error: null })) })),
      update: vi.fn(() => ({ then: (res: any) => Promise.resolve(res({ data: [], error: null })) })),
      delete: vi.fn(() => ({ then: (res: any) => Promise.resolve(res({ data: [], error: null })) })),
      single: vi.fn(() => builder),
      maybeSingle: vi.fn(() => builder),
      catch: vi.fn(() => builder),
      then: (resolve: any, reject: any) => {
        return new Promise((res) => {
          let data: any = null;
          let error: any = null;

          if (ctx.table === 'rh_salaires_mensuels') {
            if (STATE.salairesError) {
              data = null;
              error = { message: 'salaires error' };
            } else {
              data = SALAIRES.slice();
              if (ctx.orderArgs) {
                const ascending = (ctx.orderArgs.opts && (ctx.orderArgs.opts as any).ascending) ?? true;
                data.sort((a: any, b: any) => (a.mois < b.mois ? -1 : a.mois > b.mois ? 1 : 0));
                if (!ascending) data = data.reverse();
              }
            }
          } else if (ctx.table === 'profiles') {
            if (STATE.profilesError) {
              data = null;
              error = { message: 'profiles error' };
            } else {
              data = PROFILES.slice();
            }
          } else if (ctx.table === 'rh_absences') {
            if (STATE.absencesError) {
              data = null;
              error = { message: 'absences error' };
            } else {
              data = ABSENCES.filter((a) => {
                if (ctx.gteValue && a.date_debut < ctx.gteValue) return false;
                if (ctx.lteValue && a.date_fin > ctx.lteValue) return false;
                return true;
              });
            }
          } else {
            data = null;
          }

          res({ data, error });
        }).then(resolve, reject);
      },
    };

    return builder;
  };

  return { STATE, SALAIRES, PROFILES, ABSENCES, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));
vi.mock('@/lib/queryPresets', () => ({ queryPresets: { frequent: { staleTime: 30000 } } }));

import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRHKPIs } from './useRHKPIs';

describe('useRHKPIs', () => {
  const createWrapper = () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
  };

  beforeEach(() => {
    STATE.salairesError = false;
    STATE.profilesError = false;
    STATE.absencesError = false;
  });

  it('calculates KPIs correctly when data is present', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useRHKPIs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy();
    });

    const data = result.current.data;
    // masse_salariale_mensuelle = (3000+500) + (2000+300) = 3500 + 2300 = 5800
    expect(data?.masse_salariale_mensuelle).toBe(5800);
    // nette mensuelle = 2400 + 1600 = 4000
    expect(data?.masse_salariale_nette_mensuelle).toBe(4000);
    // brute mensuelle = 3000 + 2000 = 5000
    expect(data?.masse_salariale_brute_mensuelle).toBe(5000);

    // Annual sums consider s1,s2,s3 (two months)
    // masse_salariale_annuelle = (3500 + 2300 + 2900) = 8700
    expect(data?.masse_salariale_annuelle).toBe(8700);
    // nette annuelle = 2400 + 1600 + 2000 = 6000
    expect(data?.masse_salariale_nette_annuelle).toBe(6000);
    // brute annuelle = 3000 + 2000 + 2500 = 7500
    expect(data?.masse_salariale_brute_annuelle).toBe(7500);

    // Effectifs
    expect(data?.effectif_total).toBe(3);
    expect(data?.effectif_actif).toBe(2);

    // Absence: one absence from 2024-06-03 to 2024-06-05 => 3 days
    // taux_absenteisme = (3 / (2 * 22)) * 100 = ~6.8181818
    expect(data?.taux_absenteisme).toBeCloseTo((3 / (2 * 22)) * 100, 6);

    // cout moyen = masse_salariale_mensuelle / effectif_actif = 5800 / 2 = 2900
    expect(data?.cout_moyen_salaire).toBe(2900);
  });

  it('uses provided mois parameter in YYYY-MM format (adds -01) to filter salaires', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useRHKPIs('2024-05'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy();
    });

    const data = result.current.data;
    // For May 2024 only s3 is present:
    // masse_salariale_mensuelle = 2500 + 400 = 2900
    expect(data?.masse_salariale_mensuelle).toBe(2900);
    // nette mensuelle = 2000
    expect(data?.masse_salariale_nette_mensuelle).toBe(2000);
    // brute mensuelle = 2500
    expect(data?.masse_salariale_brute_mensuelle).toBe(2500);

    // effectifs remain based on profiles
    expect(data?.effectif_total).toBe(3);
    expect(data?.effectif_actif).toBe(2);

    // Absences inside May 2024: none in ABSENCES -> taux 0 (effectif_actif > 0)
    expect(data?.taux_absenteisme).toBe(0);
    // cout moyen = 2900 / 2 = 1450
    expect(data?.cout_moyen_salaire).toBe(1450);
  });

  it('sets isError when supabase returns an error for salaires', async () => {
    STATE.salairesError = true;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useRHKPIs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBeTruthy();
    });

    expect(result.current.error).toBeDefined();
    expect((result.current.error as any).message).toBe('salaires error');
  });
});