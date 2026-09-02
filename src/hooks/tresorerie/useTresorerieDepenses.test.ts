import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTresorerieDepenses, useTresorerieDepensesPaginated } from './useTresorerieDepenses';

const { ROWS, APAYER, PAGE_ROWS, EMPTY, mockFrom, mockToast } = vi.hoisted(() => {
  const ROWS = [
    {
      id: '1',
      nom: 'Loyer',
      montant: 1200,
      date_prevue: '2024-06-01',
      date_paiement_reel: null,
      statut: 'en_attente',
      categorie_code: 'LOYER',
      source: 'manuel_previsionnel',
      notes: null,
    },
    {
      id: '2',
      nom: 'Assurance',
      montant: 350,
      date_prevue: '2024-05-15',
      date_paiement_reel: '2024-05-15',
      statut: 'paye',
      categorie_code: 'ASSUR',
      source: 'manuel_previsionnel',
      notes: 'annuelle',
    },
  ];
  const APAYER = [
    {
      id: '2',
      nom: 'Assurance',
      montant: 350,
      date_prevue: '2024-05-15',
      date_paiement_reel: '2024-05-15',
      statut: 'paye',
      categorie_code: 'ASSUR',
      source: 'manuel_previsionnel',
      notes: 'annuelle',
    },
    {
      id: '3',
      nom: 'Fournisseur X',
      montant: 800,
      date_prevue: '1900-01-01',
      date_paiement_reel: null,
      statut: 'en_attente',
      categorie_code: null,
      source: null,
      notes: null,
    },
  ];
  const PAGE_ROWS = [
    {
      id: '10',
      nom: 'Abonnement logiciel',
      montant: 49.9,
      date_prevue: '2024-07-01',
      date_paiement_reel: null,
      statut: 'en_attente',
      categorie_code: 'SOFT',
      source: null,
      notes: null,
    },
  ];
  const EMPTY = { data: [], error: null };
  return {
    ROWS,
    APAYER,
    PAGE_ROWS,
    EMPTY,
    mockFrom: vi.fn(),
    mockToast: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: { message?: string }) => e?.message ?? 'erreur',
}));

interface SupaResult {
  data: unknown;
  error: { message: string } | null;
  count?: number;
}

const CHAIN_METHODS = [
  'select',
  'neq',
  'eq',
  'gte',
  'lte',
  'in',
  'order',
  'limit',
  'range',
  'ilike',
  'insert',
  'update',
  'delete',
] as const;

function makeBuilder(result: SupaResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (
      onFulfilled?: (v: SupaResult) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise<unknown>;
    catch: (onRejected?: (e: unknown) => unknown) => Promise<unknown>;
  } = Object.assign(
    Object.fromEntries(CHAIN_METHODS.map((m) => [m, vi.fn()])),
    {
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (
        onFulfilled?: (v: SupaResult) => unknown,
        onRejected?: (e: unknown) => unknown
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(result).catch(onRejected),
    }
  );
  for (const m of CHAIN_METHODS) {
    builder[m].mockReturnValue(builder);
  }
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockToast.mockClear();
});

describe('useTresorerieDepenses', () => {
  it('charge puis retourne les dépenses dédupliquées par id', async () => {
    const recentBuilder = makeBuilder({ data: ROWS, error: null });
    const aPayerBuilder = makeBuilder({ data: APAYER, error: null });
    const builders = [recentBuilder, aPayerBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepenses(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.depenses).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFrom).toHaveBeenCalledWith('tresorerie_depenses');
    // 2 (recents) + 2 (à payer) avec un doublon id '2' => 3 uniques
    expect(result.current.depenses).toHaveLength(3);
    expect(result.current.depenses.map((d) => d.id)).toEqual(['1', '2', '3']);
    expect(result.current.depenses[0].nom).toBe('Loyer');
    expect(result.current.depenses[0].montant).toBe(1200);
    expect(result.current.depenses[2].date_prevue).toBe('1900-01-01');

    expect(recentBuilder.neq).toHaveBeenCalledWith('date_prevue', '1900-01-01');
    expect(recentBuilder.order).toHaveBeenCalledWith('date_prevue', { ascending: false });
    expect(recentBuilder.limit).toHaveBeenCalledWith(500);
    expect(aPayerBuilder.eq).toHaveBeenCalledWith('date_prevue', '1900-01-01');
  });

  it(
    'passe en isError quand supabase renvoie une erreur',
    async () => {
      mockFrom.mockImplementation(() =>
        makeBuilder({ data: null, error: { message: 'x' } })
      );

      const { result } = renderHook(() => useTresorerieDepenses(), {
        wrapper: createWrapper(),
      });

      // retry: 2 défini dans le hook => attendre les tentatives
      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 9000,
      });
      expect(result.current.depenses).toEqual([]);
    },
    12000
  );

  it('createDepense insère avec statut par défaut et source manuel_previsionnel', async () => {
    const recentBuilder = makeBuilder({ data: ROWS, error: null });
    const aPayerBuilder = makeBuilder({ data: [], error: null });
    const insertBuilder = makeBuilder({ data: null, error: null });
    const builders = [recentBuilder, aPayerBuilder, insertBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepenses(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createDepense({
        nom: 'Nouvelle dépense',
        montant: 99.5,
        date_prevue: '2024-08-01',
      });
    });

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalledTimes(1));
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Nouvelle dépense',
        montant: 99.5,
        date_prevue: '2024-08-01',
        categorie_code: null,
        notes: null,
        statut: 'en_attente',
        source: 'manuel_previsionnel',
        source_id: expect.any(String),
      })
    );
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: 'Dépense créée' })
    );
  });

  it('marquerPayee met à jour le statut en "paye" avec la date du jour', async () => {
    const recentBuilder = makeBuilder({ data: ROWS, error: null });
    const aPayerBuilder = makeBuilder({ data: [], error: null });
    const updateBuilder = makeBuilder({ data: null, error: null });
    const builders = [recentBuilder, aPayerBuilder, updateBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepenses(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.marquerPayee('1');
    });

    await waitFor(() => expect(updateBuilder.update).toHaveBeenCalledTimes(1));
    expect(updateBuilder.update).toHaveBeenCalledWith({
      statut: 'paye',
      date_paiement_reel: new Date().toISOString().split('T')[0],
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', '1');
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: 'Dépense mise à jour' })
    );
  });

  it('deleteDepense supprime la ligne ciblée', async () => {
    const recentBuilder = makeBuilder({ data: ROWS, error: null });
    const aPayerBuilder = makeBuilder({ data: [], error: null });
    const deleteBuilder = makeBuilder({ data: null, error: null });
    const builders = [recentBuilder, aPayerBuilder, deleteBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepenses(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.deleteDepense('2');
    });

    await waitFor(() => expect(deleteBuilder.delete).toHaveBeenCalledTimes(1));
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', '2');
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: 'Dépense supprimée' })
    );
  });

  it('createDepense en erreur déclenche un toast destructive', async () => {
    const recentBuilder = makeBuilder({ data: [], error: null });
    const aPayerBuilder = makeBuilder({ data: [], error: null });
    const insertBuilder = makeBuilder({ data: null, error: { message: 'insert failed' } });
    const builders = [recentBuilder, aPayerBuilder, insertBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepenses(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createDepense({
        nom: 'KO',
        montant: 1,
        date_prevue: '2024-08-01',
      });
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erreur',
          description: 'insert failed',
          variant: 'destructive',
        })
      )
    );
  });
});

describe('useTresorerieDepensesPaginated', () => {
  it('retourne les données paginées avec totalCount et totalPages', async () => {
    const pageBuilder = makeBuilder({ data: PAGE_ROWS, error: null, count: 60 });
    const builders = [pageBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(
      () =>
        useTresorerieDepensesPaginated({
          page: 1,
          pageSize: 25,
          sortField: 'date_prevue',
          sortDirection: 'asc',
          filters: { search: 'abc', statut: 'en_attente', dateDebut: '2024-01-01' },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.depenses).toHaveLength(1);
    expect(result.current.depenses[0].nom).toBe('Abonnement logiciel');
    expect(result.current.totalCount).toBe(60);
    expect(result.current.totalPages).toBe(3);

    expect(pageBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(pageBuilder.ilike).toHaveBeenCalledWith('nom', '%abc%');
    expect(pageBuilder.eq).toHaveBeenCalledWith('statut', 'en_attente');
    expect(pageBuilder.gte).toHaveBeenCalledWith('date_prevue', '2024-01-01');
    expect(pageBuilder.order).toHaveBeenCalledWith('date_prevue', { ascending: true });
    expect(pageBuilder.range).toHaveBeenCalledWith(0, 24);
  });

  it('calcule le range pour la page 3 et applique le filtre dateFin', async () => {
    const pageBuilder = makeBuilder({ data: [], error: null, count: 0 });
    const builders = [pageBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(
      () =>
        useTresorerieDepensesPaginated({
          page: 3,
          pageSize: 10,
          filters: { dateFin: '2024-12-31', categorie: 'SOFT' },
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(pageBuilder.range).toHaveBeenCalledWith(20, 29);
    expect(pageBuilder.lte).toHaveBeenCalledWith('date_prevue', '2024-12-31');
    expect(pageBuilder.eq).toHaveBeenCalledWith('categorie_code', 'SOFT');
    expect(pageBuilder.order).toHaveBeenCalledWith('date_prevue', { ascending: false });
    expect(result.current.depenses).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.totalPages).toBe(0);
  });

  it("ignore les filtres statut/categorie quand ils valent 'tous'", async () => {
    const pageBuilder = makeBuilder({ data: PAGE_ROWS, error: null, count: 1 });
    const builders = [pageBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(
      () =>
        useTresorerieDepensesPaginated({
          filters: { statut: 'tous', categorie: 'tous' },
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(pageBuilder.eq).not.toHaveBeenCalled();
    expect(pageBuilder.ilike).not.toHaveBeenCalled();
    expect(result.current.totalCount).toBe(1);
    expect(result.current.totalPages).toBe(1);
  });

  it('updateDepense (paginated) appelle update + eq et affiche un toast succès', async () => {
    const pageBuilder = makeBuilder({ data: PAGE_ROWS, error: null, count: 1 });
    const updateBuilder = makeBuilder({ data: null, error: null });
    const builders = [pageBuilder, updateBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepensesPaginated(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.updateDepense({ id: '10', updates: { montant: 60 } });
    });

    await waitFor(() => expect(updateBuilder.update).toHaveBeenCalledTimes(1));
    expect(updateBuilder.update).toHaveBeenCalledWith({ montant: 60 });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', '10');
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: 'Dépense mise à jour' })
    );
  });

  it('deleteDepense (paginated) en erreur affiche un toast destructive', async () => {
    const pageBuilder = makeBuilder({ data: PAGE_ROWS, error: null, count: 1 });
    const deleteBuilder = makeBuilder({ data: null, error: { message: 'delete failed' } });
    const builders = [pageBuilder, deleteBuilder];
    mockFrom.mockImplementation(() => builders.shift() ?? makeBuilder(EMPTY));

    const { result } = renderHook(() => useTresorerieDepensesPaginated(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.deleteDepense('10');
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erreur',
          description: 'delete failed',
          variant: 'destructive',
        })
      )
    );
  });
});