import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useCurrentTresorerieSolde, useProchainePaie } from './useTresorerieWidgetData';

const {
  SOLDE_ROW,
  CATEGORIE_ROW,
  DEPENSE_ROW,
  builderState,
  mockFrom,
  resetSupabaseMock,
  setQueryResult,
} = vi.hoisted(() => {
  type SupabaseError = { message: string };
  type QueryResult = { data: unknown; error: SupabaseError | null };

  type Builder = {
    _table: string;
    select: (s: string) => Builder;
    eq: (k: string, v: unknown) => Builder;
    gte: (k: string, v: unknown) => Builder;
    lte: (k: string, v: unknown) => Builder;
    in: (k: string, v: unknown[]) => Builder;
    order: (k: string, opts?: { ascending?: boolean }) => Builder;
    limit: (n: number) => Builder;
    insert: (...args: unknown[]) => Builder;
    update: (...args: unknown[]) => Builder;
    delete: (...args: unknown[]) => Builder;
    maybeSingle: () => Promise<QueryResult>;
    single: () => Promise<QueryResult>;
    then: Promise<QueryResult>['then'];
    catch: Promise<QueryResult>['catch'];
  };

  const SOLDE_ROW = {
    id: 's1',
    date: '2026-06-01',
    solde_debut: 1000,
    solde_fin: 1200,
    total_recettes: 500,
    total_depenses: 300,
    created_at: '2026-06-01T10:00:00Z',
  };

  const CATEGORIE_ROW = { id: 'cat1' };

  const DEPENSE_ROW = {
    id: 'd1',
    nom: 'Salaires nets',
    montant: 4200,
    date_prevue: '2026-06-15',
    categorie_code: 'DEP_SALAIRES_NETS',
    statut: 'PREVUE',
  };

  const builderState: {
    calls: Array<{ table: string; method: string; args: unknown[] }>;
    resultsByTable: Record<string, QueryResult>;
    whereByTable: Record<string, Record<string, unknown>>;
  } = {
    calls: [],
    resultsByTable: {},
    whereByTable: {},
  };

  const recordCall = (table: string, method: string, args: unknown[]) => {
    builderState.calls.push({ table, method, args });
  };

  const createBuilder = (table: string): Builder => {
    const getResult = (): QueryResult => builderState.resultsByTable[table] ?? { data: null, error: null };

    const builder: Partial<Builder> = {
      _table: table,
      select: (...args: unknown[]) => {
        recordCall(table, 'select', args);
        return builder as Builder;
      },
      eq: (...args: unknown[]) => {
        recordCall(table, 'eq', args);
        const [k, v] = args as [string, unknown];
        builderState.whereByTable[table] = builderState.whereByTable[table] ?? {};
        builderState.whereByTable[table][k] = v;
        return builder as Builder;
      },
      gte: (...args: unknown[]) => {
        recordCall(table, 'gte', args);
        const [k, v] = args as [string, unknown];
        builderState.whereByTable[table] = builderState.whereByTable[table] ?? {};
        builderState.whereByTable[table][k] = v;
        return builder as Builder;
      },
      lte: (...args: unknown[]) => {
        recordCall(table, 'lte', args);
        return builder as Builder;
      },
      in: (...args: unknown[]) => {
        recordCall(table, 'in', args);
        return builder as Builder;
      },
      order: (...args: unknown[]) => {
        recordCall(table, 'order', args);
        return builder as Builder;
      },
      limit: (...args: unknown[]) => {
        recordCall(table, 'limit', args);
        return builder as Builder;
      },
      insert: (...args: unknown[]) => {
        recordCall(table, 'insert', args);
        return builder as Builder;
      },
      update: (...args: unknown[]) => {
        recordCall(table, 'update', args);
        return builder as Builder;
      },
      delete: (...args: unknown[]) => {
        recordCall(table, 'delete', args);
        return builder as Builder;
      },
      maybeSingle: async () => {
        recordCall(table, 'maybeSingle', []);
        return getResult();
      },
      single: async () => {
        recordCall(table, 'single', []);
        return getResult();
      },
    };

    const promise = Promise.resolve(getResult());
    (builder as Builder).then = promise.then.bind(promise);
    (builder as Builder).catch = promise.catch.bind(promise);

    return builder as Builder;
  };

  const mockFrom = vi.fn((table: string) => {
    recordCall(table, 'from', [table]);
    return createBuilder(table);
  });

  const resetSupabaseMock = () => {
    builderState.calls = [];
    builderState.resultsByTable = {};
    builderState.whereByTable = {};
    mockFrom.mockClear();
  };

  const setQueryResult = (table: string, result: QueryResult) => {
    builderState.resultsByTable[table] = result;
  };

  return {
    SOLDE_ROW,
    CATEGORIE_ROW,
    DEPENSE_ROW,
    builderState,
    mockFrom,
    resetSupabaseMock,
    setQueryResult,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useTresorerieWidgetData', () => {
  it('useCurrentTresorerieSolde: loading -> success et requête correctement construite', async () => {
    resetSupabaseMock();
    setQueryResult('tresorerie_solde', { data: SOLDE_ROW, error: null });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useCurrentTresorerieSolde(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(SOLDE_ROW);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_solde');

    const calls = builderState.calls.filter((c) => c.table === 'tresorerie_solde').map((c) => c.method);
    expect(calls).toEqual(['from', 'select', 'order', 'limit', 'maybeSingle']);
  });

  it('useCurrentTresorerieSolde: error -> isError true', async () => {
    resetSupabaseMock();
    setQueryResult('tresorerie_solde', { data: null, error: { message: 'x' } });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useCurrentTresorerieSolde(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
  });

  it('useProchainePaie: loading -> success, fetch catégorie puis dépense, et retourne la dépense', async () => {
    resetSupabaseMock();
    setQueryResult('tresorerie_categories', { data: CATEGORIE_ROW, error: null });
    setQueryResult('tresorerie_depenses', { data: DEPENSE_ROW, error: null });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useProchainePaie(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(DEPENSE_ROW);

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'tresorerie_categories');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'tresorerie_depenses');

    expect(builderState.whereByTable.tresorerie_categories?.code).toBe('DEP_SALAIRES_NETS');
    expect(builderState.whereByTable.tresorerie_depenses?.categorie_id).toBe(CATEGORIE_ROW.id);

    const callsCat = builderState.calls.filter((c) => c.table === 'tresorerie_categories').map((c) => c.method);
    expect(callsCat).toEqual(['from', 'select', 'eq', 'maybeSingle']);

    const callsDep = builderState.calls.filter((c) => c.table === 'tresorerie_depenses').map((c) => c.method);
    expect(callsDep).toEqual(['from', 'select', 'eq', 'gte', 'order', 'limit', 'maybeSingle']);

    const gteArgs = builderState.calls.find((c) => c.table === 'tresorerie_depenses' && c.method === 'gte')?.args;
    expect(gteArgs && gteArgs[0]).toBe('date_prevue');
    expect(gteArgs && typeof gteArgs[1]).toBe('string');
    expect(gteArgs && (gteArgs[1] as string).length).toBe(7);
  });

  it('useProchainePaie: si catégorie absente -> retourne null (sans requête depenses)', async () => {
    resetSupabaseMock();
    setQueryResult('tresorerie_categories', { data: null, error: null });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useProchainePaie(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_categories');
  });

  it('useProchainePaie: erreur côté depenses -> retourne null (isSuccess) et ne throw pas', async () => {
    resetSupabaseMock();
    setQueryResult('tresorerie_categories', { data: CATEGORIE_ROW, error: null });
    setQueryResult('tresorerie_depenses', { data: null, error: { message: 'x' } });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useProchainePaie(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('useProchainePaie: erreur côté categorie (data null) -> retourne null et ne requête pas depenses', async () => {
    resetSupabaseMock();
    setQueryResult('tresorerie_categories', { data: null, error: { message: 'x' } });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useProchainePaie(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_categories');
  });
});