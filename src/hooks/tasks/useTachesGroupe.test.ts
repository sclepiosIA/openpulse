import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTachesGroupe } from './useTachesGroupe';

const hoisted = vi.hoisted(() => {
  const TOAST = vi.fn();

  const TACHES_GROUPE = [
    {
      id: 'tg1',
      groupe_id: 'g1',
      niveau_tache: 'groupe',
      categorie_id: 'cat1',
      titre: 'Préparer planning',
      description: 'Desc 1',
      statut: 'A faire',
      priorite: 'high',
      echeance: '2024-01-10',
      date_realisation: undefined,
      responsable_id: 'u1',
      ordre: 1,
      commentaires: 'RAS',
      archive: false,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'tg2',
      groupe_id: 'g1',
      niveau_tache: 'groupe',
      categorie_id: 'cat2',
      titre: 'Valider budget',
      description: 'Desc 2',
      statut: 'En cours',
      priorite: 'medium',
      echeance: '2024-01-12',
      date_realisation: undefined,
      responsable_id: 'u2',
      ordre: 2,
      commentaires: 'Suivi',
      archive: false,
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ];

  const queryState = {
    data: TACHES_GROUPE as unknown,
    error: null as { message: string } | null,
  };

  const mockFrom = vi.fn();
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();
  const invalidateQueriesSpy = vi.fn();

  return {
    TOAST,
    TACHES_GROUPE,
    queryState,
    mockFrom,
    insertSpy,
    updateSpy,
    invalidateQueriesSpy,
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: hoisted.TOAST }),
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {
      staleTime: 120000,
      gcTime: 1800000,
    },
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: hoisted.invalidateQueriesSpy,
    }),
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = (table: string) => {
    const builder = {
      table,
      filters: [] as Array<{ type: string; args: unknown[] }>,
      select: vi.fn(() => builder),
      eq: vi.fn((...args: unknown[]) => {
        builder.filters.push({ type: 'eq', args });
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn((...args: unknown[]) => {
        builder.filters.push({ type: 'in', args });
        return builder;
      }),
      is: vi.fn((...args: unknown[]) => {
        builder.filters.push({ type: 'is', args });
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        hoisted.insertSpy(payload);
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        hoisted.updateSpy(payload);
        return builder;
      }),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => {
        if (table === 'taches' && hoisted.insertSpy.mock.calls.length > 0) {
          return { data: hoisted.INSERT_RESULT, error: hoisted.queryState.error };
        }
        if (table === 'taches' && hoisted.updateSpy.mock.calls.length > 0) {
          const lastUpdate = hoisted.updateSpy.mock.calls[hoisted.updateSpy.mock.calls.length - 1]?.[0];
          if (
            typeof lastUpdate === 'object' &&
            lastUpdate !== null &&
            'archive' in (lastUpdate as Record<string, unknown>)
          ) {
            return {
              data: {
                ...hoisted.ARCHIVE_RESULT,
                archive: (lastUpdate as Record<string, unknown>).archive,
              },
              error: hoisted.queryState.error,
            };
          }
          return { data: hoisted.UPDATE_RESULT, error: hoisted.queryState.error };
        }
        return { data: hoisted.queryState.data, error: hoisted.queryState.error };
      }),
      maybeSingle: vi.fn(async () => ({ data: hoisted.queryState.data, error: hoisted.queryState.error })),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        let response: unknown;
        if (table === 'etablissements_groupes') {
          response = { data: hoisted.ETABS_GROUPES, error: hoisted.queryState.error };
        } else if (table === 'taches') {
          const hasIn = builder.filters.some((f) => f.type === 'in');
          response = hasIn
            ? { data: hoisted.TACHES_ETABS, error: hoisted.queryState.error }
            : { data: hoisted.TACHES_GROUPE, error: hoisted.queryState.error };
        } else {
          response = { data: hoisted.queryState.data, error: hoisted.queryState.error };
        }
        return Promise.resolve(response).then(onFulfilled, onRejected);
      },
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
    };
    return builder;
  };

  hoisted.mockFrom.mockImplementation((table: string) => createBuilder(table));

  return {
    supabase: {
      from: hoisted.mockFrom,
    },
  };
});

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
  hoisted.TOAST.mockClear();
  hoisted.mockFrom.mockClear();
  hoisted.insertSpy.mockClear();
  hoisted.updateSpy.mockClear();
  hoisted.invalidateQueriesSpy.mockClear();
  hoisted.queryState.data = hoisted.TACHES_GROUPE;
  hoisted.queryState.error = null;
});

describe('useTachesGroupe', () => {
  it('charge les tâches groupe et retourne les valeurs métier attendues', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useTachesGroupe('g1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hoisted.mockFrom).toHaveBeenCalledWith('taches');
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].titre).toBe('Préparer planning');
    expect(result.current.data?.[1].statut).toBe('En cours');
  });

  it('retourne une erreur quand la requête échoue', async () => {
    const wrapper = createWrapper();
    hoisted.queryState.error = { message: 'x' };

    const { result } = renderHook(() => useTachesGroupe('g1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('x');
  });

  it('n’exécute pas la query sans groupeId', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useTachesGroupe(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(hoisted.mockFrom).not.toHaveBeenCalled();
  });
});