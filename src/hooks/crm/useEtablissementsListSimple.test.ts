// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEtablissementsListSimple } from './useEtablissementsListSimple';

const {
  SIMPLE_ROWS,
  EMPTY_ROWS,
  mockFrom,
  mockSelect,
  mockOrder,
  mockEq,
  mockGte,
  mockLte,
  mockIn,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const SIMPLE_ROWS = [
    { id: 'eta-1', nom: 'Alpha' },
    { id: 'eta-2', nom: 'Beta' },
  ];
  const EMPTY_ROWS: Array<{ id: string; nom: string }> = [];

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockOrder = vi.fn();
  const mockEq = vi.fn();
  const mockGte = vi.fn();
  const mockLte = vi.fn();
  const mockIn = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();

  return {
    SIMPLE_ROWS,
    EMPTY_ROWS,
    mockFrom,
    mockSelect,
    mockOrder,
    mockEq,
    mockGte,
    mockLte,
    mockIn,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
  };
});

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createBuilder(result: QueryResult) {
  const builder = {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return builder;
    },
    eq: (...args: unknown[]) => {
      mockEq(...args);
      return builder;
    },
    gte: (...args: unknown[]) => {
      mockGte(...args);
      return builder;
    },
    lte: (...args: unknown[]) => {
      mockLte(...args);
      return builder;
    },
    in: (...args: unknown[]) => {
      mockIn(...args);
      return builder;
    },
    order: (...args: unknown[]) => {
      mockOrder(...args);
      return Promise.resolve(result);
    },
    limit: (...args: unknown[]) => {
      mockLimit(...args);
      return builder;
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return builder;
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return builder;
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return builder;
    },
    single: (...args: unknown[]) => {
      mockSingle(...args);
      return Promise.resolve(result);
    },
    maybeSingle: (...args: unknown[]) => {
      mockMaybeSingle(...args);
      return Promise.resolve(result);
    },
    then: (
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
  };

  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

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

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEtablissementsListSimple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge puis retourne la liste simplifiée des établissements', async () => {
    mockFrom.mockReturnValue(createBuilder({ data: SIMPLE_ROWS, error: null }));

    const { result } = renderHook(() => useEtablissementsListSimple(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledWith('id, nom');
    expect(mockOrder).toHaveBeenCalledTimes(1);
    expect(mockOrder).toHaveBeenCalledWith('nom');

    expect(result.current.data).toEqual(SIMPLE_ROWS);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map((row) => row.nom)).toEqual(['Alpha', 'Beta']);
    expect(result.current.data?.[0]).toEqual({ id: 'eta-1', nom: 'Alpha' });
    expect(result.current.data?.[1]).toEqual({ id: 'eta-2', nom: 'Beta' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('retourne un tableau vide quand supabase renvoie data null', async () => {
    mockFrom.mockReturnValue(createBuilder({ data: null, error: null }));

    const { result } = renderHook(() => useEtablissementsListSimple(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockSelect).toHaveBeenCalledWith('id, nom');
    expect(mockOrder).toHaveBeenCalledWith('nom');
    expect(result.current.data).toEqual(EMPTY_ROWS);
    expect(result.current.data).toHaveLength(0);
    expect(result.current.isError).toBe(false);
  });

  it('passe en erreur quand la requête supabase échoue', async () => {
    const failure = new Error('x');

    mockFrom.mockReturnValue({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          order: (...orderArgs: unknown[]) => {
            mockOrder(...orderArgs);
            return Promise.reject(failure);
          },
        };
      },
      then: (
        onFulfilled?: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.reject(failure).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => Promise.reject(failure).catch(onRejected),
    });

    const { result } = renderHook(() => useEtablissementsListSimple(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledWith('id, nom');
    expect(mockOrder).toHaveBeenCalledTimes(1);
    expect(mockOrder).toHaveBeenCalledWith('nom');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});