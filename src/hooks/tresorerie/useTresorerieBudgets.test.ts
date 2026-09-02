import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTresorerieBudgets } from './useTresorerieBudgets';

const h = vi.hoisted(() => {
  type Result = { data: unknown; error: unknown };
  type Builder = {
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
    upsert: (...args: unknown[]) => Builder;
    single: () => Promise<Result>;
    maybeSingle: () => Promise<Result>;
    then: (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>;
  };

  const BUDGETS = [
    {
      id: 'b1',
      categorie_code: 'LOYER',
      mois: '2025-01',
      montant_prevu: 1000,
      montant_alerte: null,
      notes: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      created_by: 'u1',
    },
    {
      id: 'b2',
      categorie_code: 'EAU',
      mois: '2025-01',
      montant_prevu: 500,
      montant_alerte: null,
      notes: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      created_by: 'u1',
    },
  ];
  const CATEGORIES = [{ id: 'c1', code: 'LOYER', nom: 'Loyer', couleur: '#ff0000' }];
  const DEPENSES = [{ categorie_code: 'LOYER', montant: 1200, statut: 'paye' }];

  const results: Record<string, Result> = {
    tresorerie_budgets: { data: BUDGETS, error: null },
    tresorerie_categories: { data: CATEGORIES, error: null },
    tresorerie_depenses: { data: DEPENSES, error: null },
  };

  const spies = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
  };

  const makeBuilder = (table: string): Builder => {
    const getResult = (): Result => results[table] ?? { data: null, error: null };
    const builder: Builder = {
      select: () => builder,
      eq: (...args: unknown[]) => {
        spies.eq(...args);
        return builder;
      },
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (...args: unknown[]) => {
        spies.insert(...args);
        return builder;
      },
      update: (...args: unknown[]) => {
        spies.update(...args);
        return builder;
      },
      delete: () => {
        spies.delete();
        return builder;
      },
      upsert: (...args: unknown[]) => {
        spies.upsert(...args);
        return builder;
      },
      single: () => Promise.resolve(getResult()),
      maybeSingle: () => Promise.resolve(getResult()),
      then: (onFulfilled, onRejected) => Promise.resolve(getResult()).then(onFulfilled, onRejected),
      catch: (onRejected) => Promise.resolve(getResult()).then(undefined, onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));
  const mockToast = vi.fn();
  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  return { BUDGETS, CATEGORIES, DEPENSES, results, spies, mockFrom, mockToast, AUTH };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: h.mockFrom },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => h.AUTH,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: h.mockToast }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: unknown) => (e instanceof Error ? e.message : 'erreur'),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useTresorerieBudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.results.tresorerie_budgets = { data: h.BUDGETS, error: null };
    h.results.tresorerie_categories = { data: h.CATEGORIES, error: null };
    h.results.tresorerie_depenses = { data: h.DEPENSES, error: null };
  });

  it('charge puis enrichit les budgets avec les montants réels et les totaux', async () => {
    const { result } = renderHook(() => useTresorerieBudgets('2025-01'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.budgets).toHaveLength(2);

    const loyer = result.current.budgets[0];
    expect(loyer.categorie_code).toBe('LOYER');
    expect(loyer.montant_reel).toBe(1200);
    expect(loyer.pourcentage_utilise).toBe(120);
    expect(loyer.est_depasse).toBe(true);
    expect(loyer.est_alerte).toBe(true);
    expect(loyer.categorie).toEqual({ id: 'c1', code: 'LOYER', nom: 'Loyer', couleur: '#ff0000' });

    const eau = result.current.budgets[1];
    expect(eau.montant_reel).toBe(0);
    expect(eau.pourcentage_utilise).toBe(0);
    expect(eau.est_depasse).toBe(false);
    expect(eau.est_alerte).toBe(false);
    expect(eau.categorie).toBeUndefined();

    expect(result.current.totaux).toEqual({ prevu: 1500, reel: 1200, nbDepasse: 1, nbAlerte: 0 });
    expect(result.current.categories).toHaveLength(1);
    expect(h.mockFrom).toHaveBeenCalledWith('tresorerie_budgets');
    expect(h.mockFrom).toHaveBeenCalledWith('tresorerie_depenses');
  });

  it('passe en erreur si la requête catégories échoue', async () => {
    h.results.tresorerie_categories = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useTresorerieBudgets('2025-01'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('createBudget insère le budget avec created_by et affiche le toast de succès', async () => {
    const { result } = renderHook(() => useTresorerieBudgets('2025-01'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createBudget({
        categorie_code: 'LOYER',
        mois: '2025-01',
        montant_prevu: 2000,
      });
    });

    await waitFor(() =>
      expect(h.spies.insert).toHaveBeenCalledWith({
        categorie_code: 'LOYER',
        mois: '2025-01',
        montant_prevu: 2000,
        montant_alerte: null,
        notes: null,
        created_by: 'u1',
      })
    );
    await waitFor(() =>
      expect(h.mockToast).toHaveBeenCalledWith({ title: 'Budget créé avec succès' })
    );
  });

  it('updateBudget envoie les updates sur le bon id', async () => {
    const { result } = renderHook(() => useTresorerieBudgets('2025-01'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.updateBudget({ id: 'b1', updates: { montant_prevu: 3000 } });
    });

    await waitFor(() =>
      expect(h.spies.update).toHaveBeenCalledWith({ montant_prevu: 3000 })
    );
    expect(h.spies.eq).toHaveBeenCalledWith('id', 'b1');
    await waitFor(() =>
      expect(h.mockToast).toHaveBeenCalledWith({ title: 'Budget mis à jour' })
    );
  });

  it('deleteBudget supprime le budget par id', async () => {
    const { result } = renderHook(() => useTresorerieBudgets('2025-01'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.deleteBudget('b2');
    });

    await waitFor(() => expect(h.spies.delete).toHaveBeenCalled());
    expect(h.spies.eq).toHaveBeenCalledWith('id', 'b2');
    await waitFor(() =>
      expect(h.mockToast).toHaveBeenCalledWith({ title: 'Budget supprimé' })
    );
  });

  it('duplicateBudgets fait un upsert des budgets du mois précédent vers le mois courant', async () => {
    const { result } = renderHook(() => useTresorerieBudgets('2025-02'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.duplicateBudgets('2025-01');
    });

    await waitFor(() =>
      expect(h.spies.upsert).toHaveBeenCalledWith(
        [
          {
            categorie_code: 'LOYER',
            mois: '2025-02',
            montant_prevu: 1000,
            montant_alerte: null,
            notes: null,
            created_by: 'u1',
          },
          {
            categorie_code: 'EAU',
            mois: '2025-02',
            montant_prevu: 500,
            montant_alerte: null,
            notes: null,
            created_by: 'u1',
          },
        ],
        { onConflict: 'categorie_code,mois' }
      )
    );
    await waitFor(() =>
      expect(h.mockToast).toHaveBeenCalledWith({ title: 'Budgets dupliqués avec succès' })
    );
  });

  it('duplicateBudgets affiche un toast destructive si aucun budget précédent', async () => {
    h.results.tresorerie_budgets = { data: [], error: null };

    const { result } = renderHook(() => useTresorerieBudgets('2025-02'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.duplicateBudgets('2025-01');
    });

    await waitFor(() =>
      expect(h.mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Aucun budget trouvé pour le mois précédent',
        variant: 'destructive',
      })
    );
    expect(h.spies.upsert).not.toHaveBeenCalled();
  });
});