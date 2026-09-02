/* @vitest-environment jsdom */

import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const {
  mockFrom,
  debugError,
  authenticatedAuth,
  RH_SALAIRES_ROWS,
  PROFILES_SALAIRES_ROWS,
  REVENUS_ROWS,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  debugError: vi.fn(),
  authenticatedAuth: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  RH_SALAIRES_ROWS: [
    { id: '1', salaire_brut: 4000 },
    { id: '2', salaire_brut: 3000 },
  ],
  PROFILES_SALAIRES_ROWS: [
    { salaire_brut: 4100 },
    { salaire_brut: 3900 },
  ],
  REVENUS_ROWS: [
    { montant_prevu: 1000, statut: 'paye' },
    { montant_prevu: 700, statut: 'brouillon' },
    { montant_prevu: 500, statut: 'paye' },
  ],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authenticatedAuth,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authenticatedAuth,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authenticatedAuth,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type Builder = {
  table: string;
  state: {
    table: string;
    selectArgs?: unknown[];
    filters: Array<{ method: string; args: unknown[] }>;
  };
  select: (...args: unknown[]) => Builder;
  eq: (...args: unknown[]) => Builder;
  gte: (...args: unknown[]) => Builder;
  lte: (...args: unknown[]) => Builder;
  in: (...args: unknown[]) => Builder;
  order: (...args: unknown[]) => Builder;
  limit: (...args: unknown[]) => Builder;
  insert: (...args: unknown[]) => Builder;
  update: (...args: unknown[]) => Builder;
  delete: (...args: unknown[]) => Builder;
  not: (...args: unknown[]) => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  then: <TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) => Promise<QueryResult | TResult>;
};

function setupSupabase(
  resolver: (state: Builder['state']) => QueryResult | Promise<QueryResult>
) {
  mockFrom.mockImplementation((table: string) => {
    const state: Builder['state'] = {
      table,
      filters: [],
    };

    const execute = () => Promise.resolve(resolver(state));

    const builder: Builder = {
      table,
      state,
      select: (...args) => {
        state.selectArgs = args;
        return builder;
      },
      eq: (...args) => {
        state.filters.push({ method: 'eq', args });
        return builder;
      },
      gte: (...args) => {
        state.filters.push({ method: 'gte', args });
        return builder;
      },
      lte: (...args) => {
        state.filters.push({ method: 'lte', args });
        return builder;
      },
      in: (...args) => {
        state.filters.push({ method: 'in', args });
        return builder;
      },
      order: (...args) => {
        state.filters.push({ method: 'order', args });
        return builder;
      },
      limit: (...args) => {
        state.filters.push({ method: 'limit', args });
        return builder;
      },
      insert: (...args) => {
        state.filters.push({ method: 'insert', args });
        return builder;
      },
      update: (...args) => {
        state.filters.push({ method: 'update', args });
        return builder;
      },
      delete: (...args) => {
        state.filters.push({ method: 'delete', args });
        return builder;
      },
      not: (...args) => {
        state.filters.push({ method: 'not', args });
        return execute();
      },
      single: () => execute(),
      maybeSingle: () => execute(),
      then: (onfulfilled, onrejected) => execute().then(onfulfilled, onrejected),
      catch: (onrejected) => execute().catch(onrejected),
    };

    return builder;
  });
}

describe('calculateAutomaticExpenses', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('expose un état de chargement puis calcule les salaires bruts RH et met en cache', async () => {
    setupSupabase((state) => {
      if (state.table === 'rh_salaires_mensuels') {
        return { data: RH_SALAIRES_ROWS, error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');

    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['total-salaires-bruts', '2025-11'],
          queryFn: () => mod.calculateTotalSalairesBruts('2025-11'),
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7000);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('rh_salaires_mensuels');

    const second = await mod.calculateTotalSalairesBruts('2025-11');
    expect(second).toBe(7000);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('fallback sur profiles.salaire_brut quand RH est vide, puis calcule nets/cotisations/urssaf/retraite/prevoyance', async () => {
    setupSupabase((state) => {
      if (state.table === 'rh_salaires_mensuels') {
        return { data: [], error: null };
      }
      if (state.table === 'profiles') {
        const hasNot = state.filters.some((f) => f.method === 'not');
        if (hasNot) {
          return { data: PROFILES_SALAIRES_ROWS, error: null };
        }
        return { count: 2, data: null, error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');

    const total = await mod.calculateTotalSalairesBruts('2025-12');
    const nets = await mod.calculateSalairesNets('2025-12');
    const cotisations = await mod.calculateCotisationsPatronales('2025-12');
    const urssaf = await mod.calculateURSSAF('2025-12');
    const retraite = await mod.calculateRetraite('2025-12');
    const prevoyance = await mod.calculatePrevoyance('2025-12');

    expect(total).toBe(8000);
    expect(nets).toBe(6240);
    expect(cotisations).toBe(3600);
    expect(urssaf).toBe(3600);
    expect(retraite).toBe(640);
    expect(prevoyance).toBe(120);

    expect(mockFrom).toHaveBeenCalledWith('rh_salaires_mensuels');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('fallback sur le nombre de profiles actifs pour le nombre employés et la mutuelle', async () => {
    setupSupabase((state) => {
      if (state.table === 'rh_salaires_mensuels') {
        return { count: 0, data: null, error: null };
      }
      if (state.table === 'profiles') {
        return { count: 3, data: null, error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');

    const count = await mod.calculateNombreEmployes('2025-11');
    const mutuelle = await mod.calculateMutuelle('2025-11');

    expect(count).toBe(3);
    expect(mutuelle).toBe(180);
  });

  it('utilise le fallback par défaut à 3500€ brut moyen quand RH et salaires profiles sont indisponibles', async () => {
    setupSupabase((state) => {
      if (state.table === 'rh_salaires_mensuels') {
        return { data: [], error: null };
      }
      if (state.table === 'profiles') {
        const hasNot = state.filters.some((f) => f.method === 'not');
        if (hasNot) {
          return { data: [], error: null };
        }
        return { count: 4, data: null, error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');

    const total = await mod.calculateTotalSalairesBruts('2025-11');
    expect(total).toBe(14000);
  });

  it('calcule le CA HT et la TVA sur les revenus payés du mois', async () => {
    setupSupabase((state) => {
      if (state.table === 'tresorerie_revenus') {
        return { data: REVENUS_ROWS, error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');
    const mois = new Date('2025-11-15');

    const caht = await mod.calculateCAHT(mois);
    const tva = await mod.calculateTVA(mois);

    expect(caht).toBe(1500);
    expect(tva).toBe(225);
  });

  it('calcule toutes les dépenses automatiques avec les abonnements fixes', async () => {
    setupSupabase((state) => {
      if (state.table === 'rh_salaires_mensuels') {
        const selectFirstArg = state.selectArgs?.[0];
        if (selectFirstArg === 'salaire_brut') {
          return { data: RH_SALAIRES_ROWS, error: null };
        }
        if (selectFirstArg === 'id') {
          return { count: 2, data: null, error: null };
        }
      }
      if (state.table === 'tresorerie_revenus') {
        return { data: REVENUS_ROWS, error: null };
      }
      if (state.table === 'profiles') {
        return { count: 2, data: null, error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');
    const result = await mod.calculateAllAutomaticExpenses(new Date('2025-11-15'));

    expect(result).toEqual({
      DEP_SALAIRES_NETS: 5460,
      DEP_COTISATIONS: 3150,
      DEP_URSSAF: 3150,
      DEP_RETRAITE: 560,
      DEP_MUTUELLE: 120,
      DEP_PREVOYANCE: 105,
      DEP_TVA: 225,
      DEP_GITHUB: 44,
      DEP_SUPABASE: 25,
      DEP_AZURE: 200,
      DEP_NOTION: 80,
      DEP_FIGMA: 45,
    });
  });

  it('passe en erreur dans un hook query si la fonction rejette', async () => {
    setupSupabase(() => ({ data: null, error: null }));

    const mod = await import('./calculateAutomaticExpenses');
    const rejection = vi
      .spyOn(mod, 'calculateCAHT')
      .mockRejectedValueOnce(new Error('x'));

    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['caht-error'],
          queryFn: () => mod.calculateCAHT(new Date('2025-11-15')),
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');

    rejection.mockRestore();
  });

  it('retourne 0 et loggue en debug si la récupération du CA échoue avec { data:null, error:{ message:"x" } }', async () => {
    setupSupabase((state) => {
      if (state.table === 'tresorerie_revenus') {
        return { data: null, error: { message: 'x' } };
      }
      return { data: null, error: null };
    });

    const mod = await import('./calculateAutomaticExpenses');
    const value = await mod.calculateCAHT(new Date('2025-11-15'));

    expect(value).toBe(0);
    expect(debugError).toHaveBeenCalled();
    expect(debugError.mock.calls[0]?.[0]).toContain('Erreur récupération CA:');
    expect(debugError.mock.calls[0]?.[1]).toEqual({ message: 'x' });
  });
});