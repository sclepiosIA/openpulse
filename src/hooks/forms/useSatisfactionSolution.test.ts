/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useUserSatisfactionSolution,
  useCreateSatisfactionSolution,
  type SatisfactionSolution,
} from './useSatisfactionSolution';

const {
  LIST_ROWS,
  INSERTED_ROW,
  AUTH_STATE,
  builderState,
  mockFrom,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
  latestBuilders,
} = vi.hoisted(() => {
  const LIST_ROWS: SatisfactionSolution[] = [
    {
      id: 'row-1',
      user_id: 'user-1',
      etablissement_id: 'etab-1',
      date_reponse: '2024-03-10',
      satisfaction_solution: 9,
      satisfaction_csm: 8,
      facilite_utilisation: 7,
      intuitivite_interface: 8,
      rapidite_execution: 9,
      temps_gagne: 8,
      confort_usage: 7,
      reduction_stress: 6,
      modules_utilises: 'agenda,facturation',
      recommandation_collegues: 9,
      ressenti_roi: 'positif',
      fonctionnalites_preferees: 'planning',
      fonctionnalites_manquantes: 'export',
      irritants: 'aucun',
      suggestions: 'plus de filtres',
      commentaire_libre: 'tres utile',
      token_enquete: 'tok-a1',
      repondu_via: 'web',
      created_at: '2024-03-10T10:00:00.000Z',
    },
    {
      id: 'row-2',
      user_id: 'user-1',
      etablissement_id: 'etab-1',
      date_reponse: '2024-02-01',
      satisfaction_solution: 6,
      created_at: '2024-02-01T08:00:00.000Z',
    },
  ];

  const INSERTED_ROW: SatisfactionSolution = {
    id: 'row-new',
    user_id: 'user-1',
    etablissement_id: 'etab-1',
    date_reponse: '2024-04-01',
    satisfaction_solution: 10,
    created_at: '2024-04-01T09:00:00.000Z',
  };

  const AUTH_STATE = {
    user: { id: 'user-1', email: 't@t.co' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const builderState = {
    data: LIST_ROWS as SatisfactionSolution[] | SatisfactionSolution | null,
    error: null as { message: string } | null,
    singleData: INSERTED_ROW as SatisfactionSolution | null,
    singleError: null as { message: string } | null,
  };

  const mockFrom = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const sanitizeSupabaseError = vi.fn((error: { message?: string }) => `sanitized:${error.message ?? 'unknown'}`);
  const latestBuilders: Array<Record<string, ReturnType<typeof vi.fn>>> = [];

  return {
    LIST_ROWS,
    INSERTED_ROW,
    AUTH_STATE,
    builderState,
    mockFrom,
    toastSuccess,
    toastError,
    sanitizeSupabaseError,
    latestBuilders,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({
        data: builderState.singleData,
        error: builderState.singleError,
      })),
      single: vi.fn(async () => ({
        data: builderState.singleData,
        error: builderState.singleError,
      })),
      then: (
        onFulfilled?: (value: {
          data: typeof builderState.data;
          error: typeof builderState.error;
        }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({
          data: builderState.data,
          error: builderState.error,
        }).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({
          data: builderState.data,
          error: builderState.error,
        }).catch(onRejected),
    };

    latestBuilders.push(builder);
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient, invalidateQueries };
}

describe('useSatisfactionSolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builderState.data = LIST_ROWS;
    builderState.error = null;
    builderState.singleData = INSERTED_ROW;
    builderState.singleError = null;
    latestBuilders.length = 0;
  });

  it('charge puis retourne les reponses de satisfaction de l utilisateur avec les bons appels Supabase', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUserSatisfactionSolution('user-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('enquetes_satisfaction_solution');
    expect(result.current.data).toEqual(LIST_ROWS);
    expect(result.current.data?.[0].satisfaction_solution).toBe(9);
    expect(result.current.data?.[0].repondu_via).toBe('web');
    expect(result.current.data?.[1].date_reponse).toBe('2024-02-01');

    const builder = latestBuilders[0];
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('date_reponse', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(100);
  });

  it('ne lance pas la query quand userId est vide', () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUserSatisfactionSolution(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passe en erreur si Supabase renvoie une erreur sur la liste', async () => {
    const { wrapper } = createWrapper();
    builderState.error = { message: 'x' };
    builderState.data = null;

    const { result } = renderHook(() => useUserSatisfactionSolution('user-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
  });

  it('cree une enquete, affiche un toast de succes et invalide les bonnes queries', async () => {
    const { wrapper, invalidateQueries } = createWrapper();

    const payload: Partial<SatisfactionSolution> = {
      user_id: 'user-1',
      etablissement_id: 'etab-1',
      date_reponse: '2024-04-01',
      satisfaction_solution: 10,
      commentaire_libre: 'super',
    };

    const { result } = renderHook(() => useCreateSatisfactionSolution(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('enquetes_satisfaction_solution');
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(INSERTED_ROW);
      expect(result.current.data?.id).toBe('row-new');
      expect(result.current.data?.satisfaction_solution).toBe(10);
    });

    const builder = latestBuilders[0];
    expect(builder.insert).toHaveBeenCalledWith([payload]);
    expect(builder.select).toHaveBeenCalledWith();
    expect(builder.single).toHaveBeenCalled();

    expect(toastSuccess).toHaveBeenCalledWith('Enquête de satisfaction enregistrée');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['satisfaction-solution'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement-analytics'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['global-analytics'] });
  });

  it('passe en erreur sur creation et affiche le message sanitize', async () => {
    const { wrapper } = createWrapper();
    builderState.singleData = null;
    builderState.singleError = { message: 'x' };

    const payload: Partial<SatisfactionSolution> = {
      user_id: 'user-1',
      etablissement_id: 'etab-1',
      date_reponse: '2024-04-01',
      satisfaction_solution: 4,
    };

    const { result } = renderHook(() => useCreateSatisfactionSolution(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toMatchObject({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(sanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }));
    expect(toastError).toHaveBeenCalledWith('sanitized:x');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
