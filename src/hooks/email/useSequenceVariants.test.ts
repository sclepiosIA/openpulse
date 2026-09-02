/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSequenceVariants, useUpsertVariant, useDeleteVariant, useDesignateWinners } from './useSequenceVariants';

const {
  VARIANTS_ROWS,
  STATS_ROWS,
  UPSERTED_ROW,
  WINNERS_ROWS,
  AUTH_STATE,
  toastSuccess,
  toastError,
  mockFrom,
  mockRpc,
  builder,
} = vi.hoisted(() => {
  const VARIANTS_ROWS = [
    {
      id: 'v1',
      sequence_id: 'seq-1',
      step_index: 1,
      variant_label: 'A',
      weight: 60,
      subject: 'Sujet A',
      body_html: '<p>A</p>',
      body_text: 'A',
      is_winner: true,
      is_active: true,
      metadata: { source: 'test' },
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'v2',
      sequence_id: 'seq-1',
      step_index: 1,
      variant_label: 'B',
      weight: 40,
      subject: 'Sujet B',
      body_html: '<p>B</p>',
      body_text: 'B',
      is_winner: false,
      is_active: true,
      metadata: { source: 'test' },
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ] as const;

  const STATS_ROWS = [
    {
      variant_id: 'v1',
      sends_count: 100,
      opens_count: 50,
      clicks_count: 20,
      replies_count: 10,
      bounces_count: 1,
      unsubscribes_count: 2,
      open_rate: 0.5,
      click_rate: 0.2,
      reply_rate: 0.1,
      last_recomputed_at: '2024-01-05',
    },
  ] as const;

  const UPSERTED_ROW = {
    id: 'v3',
    sequence_id: 'seq-1',
    step_index: 2,
    variant_label: 'C',
    weight: 100,
    subject: 'Sujet C',
    body_html: '<p>C</p>',
    body_text: 'C',
    is_winner: false,
    is_active: true,
    metadata: { kind: 'new' },
    created_at: '2024-02-01',
    updated_at: '2024-02-02',
  } as const;

  const WINNERS_ROWS = [
    {
      sequence_id: 'seq-1',
      step_index: 1,
      winner_variant_id: 'v1',
    },
    {
      sequence_id: 'seq-1',
      step_index: 2,
      winner_variant_id: 'v3',
    },
  ] as const;

  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  } as const;

  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  return {
    VARIANTS_ROWS,
    STATS_ROWS,
    UPSERTED_ROW,
    WINNERS_ROWS,
    AUTH_STATE,
    toastSuccess,
    toastError,
    mockFrom,
    mockRpc,
    builder,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

function resetBuilder() {
  builder.select.mockReset();
  builder.eq.mockReset();
  builder.gte.mockReset();
  builder.lte.mockReset();
  builder.in.mockReset();
  builder.order.mockReset();
  builder.limit.mockReset();
  builder.insert.mockReset();
  builder.update.mockReset();
  builder.upsert.mockReset();
  builder.delete.mockReset();
  builder.single.mockReset();
  builder.maybeSingle.mockReset();
  builder.then.mockReset();
  builder.catch.mockReset();

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.upsert.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);

  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.catch.mockReturnValue(Promise.resolve());

  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(onFulfilled({ data: null, error: null })),
  );
}

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
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
  vi.clearAllMocks();
  resetBuilder();
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('useSequenceVariants', () => {
  it('gère le chargement puis retourne les variantes enrichies avec leurs stats', async () => {
    let queryCall = 0;

    builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) => {
      queryCall += 1;
      if (queryCall === 1) {
        return Promise.resolve(onFulfilled({ data: VARIANTS_ROWS, error: null }));
      }
      return Promise.resolve(onFulfilled({ data: STATS_ROWS, error: null }));
    });

    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useSequenceVariants('seq-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_sequence_variants');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_sequence_variant_stats');

    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('sequence_id', 'seq-1');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'step_index', { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'variant_label', { ascending: true });
    expect(builder.in).toHaveBeenCalledWith('variant_id', ['v1', 'v2']);

    expect(result.current.data).toEqual([
      {
        ...VARIANTS_ROWS[0],
        stats: STATS_ROWS[0],
      },
      {
        ...VARIANTS_ROWS[1],
        stats: null,
      },
    ]);
    expect(result.current.data?.[0].stats?.open_rate).toBe(0.5);
    expect(result.current.data?.[1].variant_label).toBe('B');
  });

  it('passe en erreur quand la requête variantes échoue', async () => {
    builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(onFulfilled({ data: null, error: { message: 'x' } })),
    );
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useSequenceVariants('seq-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('email_sequence_variants');
  });
});

describe('useUpsertVariant', () => {
  it('upsert une variante, invalide le cache et affiche un toast de succès', async () => {
    builder.single.mockResolvedValue({ data: UPSERTED_ROW, error: null });
    mockFrom.mockReturnValue(builder);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpsertVariant(), {
      wrapper: createWrapper(queryClient),
    });

    const payload = {
      sequence_id: 'seq-1',
      step_index: 2,
      variant_label: 'C',
      subject: 'Sujet C',
      weight: 100,
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_sequence_variants');
    expect(builder.upsert).toHaveBeenCalledWith([payload], {
      onConflict: 'sequence_id,step_index,variant_label',
    });
    expect(builder.select).toHaveBeenCalledWith();
    expect(builder.single).toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['sequence-variants', 'seq-1'] });
    expect(toastSuccess).toHaveBeenCalledWith('Variante enregistrée');
  });

  it('affiche un toast d’erreur quand l’upsert échoue', async () => {
    builder.single.mockResolvedValue({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useUpsertVariant(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sequence_id: 'seq-1',
          step_index: 2,
          variant_label: 'C',
        }),
      ).rejects.toMatchObject({ message: 'x' });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur : x');
  });
});

describe('useDeleteVariant', () => {
  it('supprime une variante, invalide le cache et affiche un toast de succès', async () => {
    builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(onFulfilled({ error: null })),
    );
    mockFrom.mockReturnValue(builder);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteVariant(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'v2', sequence_id: 'seq-1' });
    });

    expect(mockFrom).toHaveBeenCalledWith('email_sequence_variants');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'v2');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['sequence-variants', 'seq-1'] });
    expect(toastSuccess).toHaveBeenCalledWith('Variante supprimée');
  });

  it('passe en erreur et affiche un toast quand la suppression échoue', async () => {
    builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(onFulfilled({ error: { message: 'x' } })),
    );
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useDeleteVariant(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'v2', sequence_id: 'seq-1' })).rejects.toMatchObject({
        message: 'x',
      });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur : x');
  });
});

describe('useDesignateWinners', () => {
  it('appelle la rpc avec les seuils fournis, invalide la clé ciblée et affiche le bon message pluriel', async () => {
    mockRpc.mockResolvedValue({ data: WINNERS_ROWS, error: null });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDesignateWinners(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        sequence_id: 'seq-1',
        min_sends: 75,
        min_diff: 0.1,
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('designate_sequence_winners', {
      _sequence_id: 'seq-1',
      _min_sends: 75,
      _min_diff: 0.1,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['sequence-variants', 'seq-1'] });
    expect(toastSuccess).toHaveBeenCalledWith('2 gagnants désignés');
  });

  it('invalide la clé générique et affiche le message zéro résultat quand aucun gagnant n’est désignable', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDesignateWinners(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    expect(mockRpc).toHaveBeenCalledWith('designate_sequence_winners', {
      _sequence_id: undefined,
      _min_sends: 50,
      _min_diff: 0.05,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['sequence-variants'] });
    expect(toastSuccess).toHaveBeenCalledWith('Aucun gagnant désignable (seuils non atteints)');
  });

  it('passe en erreur et affiche un toast quand la rpc échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useDesignateWinners(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ sequence_id: 'seq-1' })).rejects.toMatchObject({
        message: 'x',
      });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur : x');
  });
});