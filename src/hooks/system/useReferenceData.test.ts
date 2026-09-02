import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAllReferenceData,
  useReferenceDataByType,
  useStatutsEtablissement,
  useRegions,
  useUpdateReferenceData,
  useCreateReferenceData,
  useDeleteReferenceData,
  getStatusStyleFromRef,
  getStatutsByPhase,
} from './useReferenceData';

const {
  ROWS,
  mockFrom,
  toastMock,
  sanitizeMock,
  chainState,
  lastBuilderRef,
} = vi.hoisted(() => {
  const ROWS_DATA = [
    {
      id: '1',
      type: 'statut_etablissement',
      code: 'prospect',
      label: 'Prospect',
      color: '#111111',
      ordre: 1,
      metadata: {
        badge_variant: 'secondary',
        border_color: 'border-l-blue-500',
        bg_color: 'bg-blue-50',
        text_color: 'text-blue-700',
        phase: 'commercial',
      },
      active: true,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    },
    {
      id: '2',
      type: 'statut_etablissement',
      code: 'client',
      label: 'Client',
      color: '#222222',
      ordre: 2,
      metadata: {
        phase: 'delivery',
      },
      active: true,
      created_at: '2024-01-03T00:00:00.000Z',
      updated_at: '2024-01-04T00:00:00.000Z',
    },
    {
      id: '3',
      type: 'region',
      code: 'idf',
      label: 'Île-de-France',
      color: null,
      ordre: 3,
      metadata: {},
      active: true,
      created_at: '2024-01-05T00:00:00.000Z',
      updated_at: '2024-01-06T00:00:00.000Z',
    },
  ];

  const state = {
    responseData: ROWS_DATA,
    responseError: null as { message: string } | null,
  };

  const lastBuilder = { current: null as null | Record<string, unknown> };

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};

    const chain = () => builder;

    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.limit = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.update = vi.fn(chain);
    builder.delete = vi.fn(chain);
    builder.single = vi.fn(async () => ({ data: state.responseData, error: state.responseError }));
    builder.maybeSingle = vi.fn(async () => ({ data: state.responseData, error: state.responseError }));
    builder.then = (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve({ data: state.responseData, error: state.responseError }).then(onFulfilled);
    builder.catch = (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: state.responseData, error: state.responseError }).catch(onRejected);

    lastBuilder.current = builder;
    return builder;
  };

  return {
    ROWS: ROWS_DATA,
    mockFrom: vi.fn(() => createBuilder()),
    toastMock: vi.fn(),
    sanitizeMock: vi.fn(() => 'Erreur propre'),
    chainState: state,
    lastBuilderRef: lastBuilder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useReferenceData', () => {
  beforeEach(() => {
    chainState.responseData = ROWS;
    chainState.responseError = null;
    mockFrom.mockClear();
    toastMock.mockClear();
    sanitizeMock.mockClear();
    lastBuilderRef.current = null;
  });

  it('charge toutes les données de référence puis expose les valeurs métier attendues', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAllReferenceData(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('reference_data');
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.map((row) => row.label)).toEqual(['Prospect', 'Client', 'Île-de-France']);
    expect(result.current.data?.[0]).toMatchObject({
      id: '1',
      type: 'statut_etablissement',
      code: 'prospect',
      ordre: 1,
      active: true,
    });
  });

  it('retourne une erreur quand la requête supabase échoue', async () => {
    chainState.responseData = null;
    chainState.responseError = { message: 'x' };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAllReferenceData(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Object);
    expect((result.current.error as Error).message).toBe('x');
  });

  it('filtre les données par type avec useReferenceDataByType et helpers typés', async () => {
    const wrapper = createWrapper();

    const byTypeHook = renderHook(() => useReferenceDataByType('statut_etablissement'), { wrapper });
    await waitFor(() => {
      expect(byTypeHook.result.current.isSuccess).toBe(true);
    });
    expect(byTypeHook.result.current.data).toHaveLength(2);
    expect(byTypeHook.result.current.data.map((row) => row.code)).toEqual(['prospect', 'client']);

    const statutsHook = renderHook(() => useStatutsEtablissement(), { wrapper });
    await waitFor(() => {
      expect(statutsHook.result.current.isSuccess).toBe(true);
    });
    expect(statutsHook.result.current.data.map((row) => row.label)).toEqual(['Prospect', 'Client']);

    const regionsHook = renderHook(() => useRegions(), { wrapper });
    await waitFor(() => {
      expect(regionsHook.result.current.isSuccess).toBe(true);
    });
    expect(regionsHook.result.current.data).toHaveLength(1);
    expect(regionsHook.result.current.data[0]).toMatchObject({
      code: 'idf',
      label: 'Île-de-France',
    });
  });

  it('calcule le style de statut depuis les métadonnées avec valeurs par défaut si absentes', () => {
    const styled = getStatusStyleFromRef(ROWS[0]);
    expect(styled).toEqual({
      badgeVariant: 'secondary',
      borderColor: 'border-l-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      phase: 'commercial',
    });

    const fallback = getStatusStyleFromRef(ROWS[1]);
    expect(fallback).toEqual({
      badgeVariant: 'outline',
      borderColor: 'border-l-muted',
      bgColor: 'bg-muted/50',
      textColor: 'text-muted-foreground',
      phase: 'delivery',
    });
  });

  it('filtre les statuts par phase', () => {
    const statuts = ROWS.filter((row) => row.type === 'statut_etablissement');
    const commercial = getStatutsByPhase(statuts, 'commercial');
    const delivery = getStatutsByPhase(statuts, 'delivery');

    expect(commercial).toHaveLength(1);
    expect(commercial[0].code).toBe('prospect');
    expect(delivery).toHaveLength(1);
    expect(delivery[0].code).toBe('client');
  });

  it('met à jour une donnée de référence et invalide le cache avec toast de succès', async () => {
    const invalidateQueries = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateReferenceData(), { wrapper });

    const payload = {
      id: '1',
      label: 'Prospect qualifié',
      color: '#333333',
      active: true,
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    const builder = lastBuilderRef.current;
    expect(mockFrom).toHaveBeenCalledWith('reference_data');
    expect(builder).not.toBeNull();

    const builderRecord = builder as Record<string, { mock: { calls: unknown[][] } }>;
    expect(builderRecord.update.mock.calls).toHaveLength(1);
    const updateArg = builderRecord.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.label).toBe('Prospect qualifié');
    expect(updateArg.color).toBe('#333333');
    expect(updateArg.active).toBe(true);
    expect(typeof updateArg.updated_at).toBe('string');
    expect(builderRecord.eq.mock.calls[0]).toEqual(['id', '1']);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reference-data'] });
    expect(toastMock).toHaveBeenCalledWith({ title: 'Donnée de référence mise à jour' });

    invalidateQueries.mockRestore();
  });

  it('gère l’erreur de mise à jour avec message sanitizé', async () => {
    chainState.responseData = null;
    chainState.responseError = { message: 'x' };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateReferenceData(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: '1', label: 'KO' })).rejects.toBeInstanceOf(Object);
    });

    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    });
  });

  it('crée une donnée de référence avec le bon payload et toast de succès', async () => {
    const invalidateQueries = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateReferenceData(), { wrapper });

    const newItem = {
      type: 'region',
      code: 'naq',
      label: 'Nouvelle-Aquitaine',
      color: null,
      ordre: 4,
      metadata: { zone: 'sud-ouest' },
      active: true,
    };

    await act(async () => {
      await result.current.mutateAsync(newItem);
    });

    const builder = lastBuilderRef.current as Record<string, { mock: { calls: unknown[][] } }>;
    expect(builder.insert.mock.calls[0][0]).toEqual(newItem);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reference-data'] });
    expect(toastMock).toHaveBeenCalledWith({ title: 'Donnée de référence créée' });

    invalidateQueries.mockRestore();
  });

  it('gère l’erreur de création', async () => {
    chainState.responseData = null;
    chainState.responseError = { message: 'x' };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateReferenceData(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          type: 'region',
          code: 'occ',
          label: 'Occitanie',
          color: null,
          ordre: 5,
          metadata: {},
          active: true,
        }),
      ).rejects.toBeInstanceOf(Object);
    });

    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    });
  });

  it('désactive une donnée de référence avec update active:false et toast de succès', async () => {
    const invalidateQueries = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteReferenceData(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('2');
    });

    const builder = lastBuilderRef.current as Record<string, { mock: { calls: unknown[][] } }>;
    const updateArg = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.active).toBe(false);
    expect(typeof updateArg.updated_at).toBe('string');
    expect(builder.eq.mock.calls[0]).toEqual(['id', '2']);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reference-data'] });
    expect(toastMock).toHaveBeenCalledWith({ title: 'Donnée désactivée' });

    invalidateQueries.mockRestore();
  });

  it('gère l’erreur de suppression logique', async () => {
    chainState.responseData = null;
    chainState.responseError = { message: 'x' };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteReferenceData(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('2')).rejects.toBeInstanceOf(Object);
    });

    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    });
  });
});