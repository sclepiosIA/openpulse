import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTresorerieRevenus, useTresorerieRevenusPaginated } from './useTresorerieRevenus';

const { ROWS, PAGE_ROWS, mockFrom, makeBuilder, toastFn } = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'rev-1',
      etablissement_id: 'etab-1',
      mois: '2024-06',
      montant_prevu: 1200,
      montant_paye: null,
      statut: 'contractualise',
      type_revenu: 'abonnement',
      date_facture: null,
      date_paiement_reel: null,
      date_prevue: null,
      numero_facture: null,
      notes: null,
      source_modele: null,
      categorie_code: null,
      etablissements: { id: 'etab-1', nom: 'EHPAD Les Lilas' },
    },
    {
      id: 'rev-2',
      etablissement_id: 'etab-2',
      mois: '2024-05',
      montant_prevu: 800,
      montant_paye: 800,
      statut: 'paye',
      type_revenu: 'abonnement',
      date_facture: '2024-05-01',
      date_paiement_reel: '2024-05-10',
      date_prevue: null,
      numero_facture: 'FAC-002',
      notes: null,
      source_modele: null,
      categorie_code: null,
      etablissements: { id: 'etab-2', nom: 'Résidence Soleil' },
    },
  ];

  const PAGE_ROWS = [
    {
      id: 'rev-10',
      etablissement_id: 'etab-1',
      mois: '2024-06',
      montant_prevu: 500,
      montant_paye: null,
      statut: 'facture',
      type_revenu: 'abonnement',
      date_facture: '2024-06-01',
      date_paiement_reel: null,
      date_prevue: null,
      numero_facture: 'FAC-100',
      notes: null,
      source_modele: null,
      categorie_code: null,
      etablissements: { id: 'etab-1', nom: 'EHPAD Les Lilas' },
    },
  ];

  type Result = { data: unknown; error: unknown; count?: number | null };

  function makeBuilder(result: Result) {
    const b: Record<string, unknown> = {};
    const methods = [
      'select',
      'order',
      'limit',
      'eq',
      'gte',
      'lte',
      'in',
      'range',
      'insert',
      'update',
      'delete',
      'neq',
      'ilike',
    ];
    for (const m of methods) {
      b[m] = vi.fn(() => b);
    }
    b.single = vi.fn(() => Promise.resolve(result));
    b.maybeSingle = vi.fn(() => Promise.resolve(result));
    b.then = (onFulfilled?: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    b.catch = (onRejected?: (e: unknown) => unknown) => Promise.resolve(result).catch(onRejected);
    return b as Record<string, ReturnType<typeof vi.fn>> & {
      then: (f?: (v: Result) => unknown) => Promise<unknown>;
    };
  }

  const mockFrom = vi.fn();
  const toastFn = vi.fn();

  return { ROWS, PAGE_ROWS, mockFrom, makeBuilder, toastFn };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: { message?: string }) => e?.message ?? 'erreur',
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  toastFn.mockReset();
});

describe('useTresorerieRevenus', () => {
  it('charge puis renvoie les revenus avec leurs établissements', async () => {
    const builder = makeBuilder({ data: ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useTresorerieRevenus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.revenus).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.revenus).toHaveLength(2);
    expect(result.current.revenus[0].id).toBe('rev-1');
    expect(result.current.revenus[0].montant_prevu).toBe(1200);
    expect(result.current.revenus[0].etablissements?.nom).toBe('EHPAD Les Lilas');
    expect(result.current.revenus[1].statut).toBe('paye');
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_revenus');
    expect(builder.order).toHaveBeenCalledWith('mois', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(500);
  });

  it('passe en erreur quand supabase renvoie une erreur', async () => {
    const builder = makeBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useTresorerieRevenus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 9000 });
    expect(result.current.revenus).toEqual([]);
  }, 10000);

  it('createRevenu insère avec les valeurs par défaut et affiche un toast de succès', async () => {
    const builder = makeBuilder({ data: ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useTresorerieRevenus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createRevenu({
        etablissement_id: 'etab-1',
        mois: '2024-07',
        montant_prevu: 1500,
      });
    });

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith({ title: 'Revenu créé avec succès' }),
    );

    expect(builder.insert).toHaveBeenCalledWith({
      etablissement_id: 'etab-1',
      mois: '2024-07',
      montant_prevu: 1500,
      type_revenu: 'abonnement',
      statut: 'contractualise',
      notes: null,
    });
  });

  it('marquerPaye met à jour le statut, le montant payé et la date du jour', async () => {
    const builder = makeBuilder({ data: ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useTresorerieRevenus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.marquerPaye('rev-1', 1200);
    });

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith({ title: 'Revenu mis à jour' }),
    );

    const today = new Date().toISOString().split('T')[0];
    expect(builder.update).toHaveBeenCalledWith({
      statut: 'paye',
      date_paiement_reel: today,
      montant_paye: 1200,
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'rev-1');
  });

  it('marquerFacture met à jour le statut facture avec la date de facture', async () => {
    const builder = makeBuilder({ data: ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useTresorerieRevenus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.marquerFacture('rev-2');
    });

    await waitFor(() => expect(toastFn).toHaveBeenCalled());

    const today = new Date().toISOString().split('T')[0];
    expect(builder.update).toHaveBeenCalledWith({
      statut: 'facture',
      date_facture: today,
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'rev-2');
  });
});

describe('useTresorerieRevenusPaginated', () => {
  it('renvoie les revenus paginés avec totalCount et totalPages', async () => {
    const builder = makeBuilder({ data: PAGE_ROWS, error: null, count: 60 });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(
      () => useTresorerieRevenusPaginated({ page: 1, pageSize: 25 }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.revenus).toHaveLength(1);
    expect(result.current.revenus[0].numero_facture).toBe('FAC-100');
    expect(result.current.totalCount).toBe(60);
    expect(result.current.totalPages).toBe(3);
    expect(builder.range).toHaveBeenCalledWith(0, 24);
    expect(builder.order).toHaveBeenCalledWith('mois', { ascending: false });
  });

  it('applique les filtres statut/date et le filtre search côté client', async () => {
    const builder = makeBuilder({ data: PAGE_ROWS, error: null, count: 1 });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(
      () =>
        useTresorerieRevenusPaginated({
          page: 2,
          pageSize: 10,
          filters: {
            statut: 'facture',
            dateDebut: '2024-01-15',
            dateFin: '2024-12-31',
            search: 'introuvable',
          },
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(builder.eq).toHaveBeenCalledWith('statut', 'facture');
    expect(builder.gte).toHaveBeenCalledWith('mois', '2024-01');
    expect(builder.lte).toHaveBeenCalledWith('mois', '2024-12');
    expect(builder.range).toHaveBeenCalledWith(10, 19);
    expect(result.current.revenus).toEqual([]);
    expect(result.current.totalCount).toBe(1);
  });

  it('filtre search par nom d\'établissement et conserve les lignes correspondantes', async () => {
    const builder = makeBuilder({ data: PAGE_ROWS, error: null, count: 1 });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(
      () => useTresorerieRevenusPaginated({ filters: { search: 'lilas' } }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.revenus).toHaveLength(1);
    expect(result.current.revenus[0].etablissements?.nom).toBe('EHPAD Les Lilas');
  });

  it('updateRevenu déclenche un toast d\'erreur quand la mise à jour échoue', async () => {
    const okBuilder = makeBuilder({ data: PAGE_ROWS, error: null, count: 1 });
    const failBuilder = makeBuilder({ data: null, error: { message: 'maj impossible' } });
    mockFrom.mockReturnValueOnce(okBuilder).mockReturnValue(failBuilder);

    const { result } = renderHook(() => useTresorerieRevenusPaginated(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.updateRevenu({ id: 'rev-10', updates: { statut: 'paye' } });
    });

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'maj impossible',
        variant: 'destructive',
      }),
    );
  });
});