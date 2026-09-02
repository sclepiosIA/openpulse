import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const {
  AUTH_STATE,
  ROWS,
  mockFrom,
  selectMock,
  eqMock,
  orderMock,
  insertMock,
  updateMock,
  deleteMock,
  singleMock,
  setQueryResult,
  setSingleResult,
  resetSupabaseMock,
} = vi.hoisted(() => {
  type MockError = { message: string };
  type QueryResult = { data: unknown; error: MockError | null };
  type Fulfilled = (value: QueryResult) => unknown;
  type Rejected = (reason: unknown) => unknown;

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1', email: 't@t.co' } },
    isLoading: false,
  };

  const ROWS = [
    {
      id: 'own-default',
      user_id: 'u1',
      entity: 'contacts',
      name: 'Mes contacts prioritaires',
      view_type: 'table',
      filters: [{ field: 'priority', operator: 'eq', value: 'high' }],
      sort: [{ field: 'created_at', direction: 'desc' }],
      columns: ['name', 'email', 'priority'],
      is_shared: false,
      is_default: true,
      position: 0,
      icon: 'star',
      color: 'blue',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 'shared-kanban',
      user_id: 'u2',
      entity: 'contacts',
      name: 'Pipeline partagé',
      view_type: 'kanban',
      filters: [{ field: 'status', operator: 'in', value: ['new', 'active'] }],
      sort: [{ field: 'name', direction: 'asc' }],
      columns: ['name', 'status'],
      is_shared: true,
      is_default: false,
      position: 1,
      icon: null,
      color: 'green',
      created_at: '2024-01-03T00:00:00.000Z',
      updated_at: '2024-01-04T00:00:00.000Z',
    },
    {
      id: 'own-table',
      user_id: 'u1',
      entity: 'contacts',
      name: 'Liste complète',
      view_type: 'list',
      filters: [],
      sort: [],
      columns: ['name'],
      is_shared: true,
      is_default: false,
      position: 2,
      icon: null,
      color: null,
      created_at: '2024-01-05T00:00:00.000Z',
      updated_at: '2024-01-06T00:00:00.000Z',
    },
  ];

  let queryResult: QueryResult = { data: ROWS, error: null };
  let singleResult: QueryResult = { data: { id: 'created-view' }, error: null };

  const builder: Record<string, unknown> = {};

  const selectMock = vi.fn((_columns?: string) => builder);
  const eqMock = vi.fn((_column: string, _value: unknown) => builder);
  const gteMock = vi.fn((_column: string, _value: unknown) => builder);
  const lteMock = vi.fn((_column: string, _value: unknown) => builder);
  const inMock = vi.fn((_column: string, _values: unknown[]) => builder);
  const neqMock = vi.fn((_column: string, _value: unknown) => builder);
  const containsMock = vi.fn((_column: string, _value: unknown) => builder);
  const orderMock = vi.fn((_column: string, _options?: Record<string, unknown>) => builder);
  const limitMock = vi.fn((_count: number) => builder);
  const rangeMock = vi.fn((_from: number, _to: number) => builder);
  const insertMock = vi.fn((_values: unknown) => builder);
  const updateMock = vi.fn((_values: unknown) => builder);
  const deleteMock = vi.fn(() => builder);
  const singleMock = vi.fn(async () => singleResult);
  const maybeSingleMock = vi.fn(async () => singleResult);
  const thenMock = vi.fn((onFulfilled?: Fulfilled, onRejected?: Rejected) =>
    Promise.resolve(queryResult).then(onFulfilled, onRejected),
  );
  const catchMock = vi.fn((onRejected?: Rejected) => Promise.resolve(queryResult).catch(onRejected));

  Object.assign(builder, {
    select: selectMock,
    eq: eqMock,
    gte: gteMock,
    lte: lteMock,
    in: inMock,
    neq: neqMock,
    contains: containsMock,
    order: orderMock,
    limit: limitMock,
    range: rangeMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
    then: thenMock,
    catch: catchMock,
  });

  const mockFrom = vi.fn((_table: string) => builder);

  const resetSupabaseMock = () => {
    queryResult = { data: ROWS, error: null };
    singleResult = { data: { id: 'created-view' }, error: null };

    [
      mockFrom,
      selectMock,
      eqMock,
      gteMock,
      lteMock,
      inMock,
      neqMock,
      containsMock,
      orderMock,
      limitMock,
      rangeMock,
      insertMock,
      updateMock,
      deleteMock,
      singleMock,
      maybeSingleMock,
      thenMock,
      catchMock,
    ].forEach(mock => mock.mockClear());
  };

  const setQueryResult = (next: QueryResult) => {
    queryResult = next;
  };

  const setSingleResult = (next: QueryResult) => {
    singleResult = next;
  };

  return {
    AUTH_STATE,
    ROWS,
    mockFrom,
    selectMock,
    eqMock,
    orderMock,
    insertMock,
    updateMock,
    deleteMock,
    singleMock,
    setQueryResult,
    setSingleResult,
    resetSupabaseMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  useAuthSafe: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

import { useEntityViews, type EntityViewInput } from './useEntityViews';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useEntityViews', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('expose un état de chargement initial puis charge les vues', async () => {
    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.views).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.views).toHaveLength(3);
    expect(result.current.views[0].id).toBe('own-default');
  });

  it('retourne les vues, vues personnelles, vues partagées et la vue par défaut', async () => {
    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.views.map(view => view.name)).toEqual([
      'Mes contacts prioritaires',
      'Pipeline partagé',
      'Liste complète',
    ]);
    expect(result.current.ownViews.map(view => view.id)).toEqual(['own-default', 'own-table']);
    expect(result.current.sharedViews.map(view => view.id)).toEqual(['shared-kanban']);
    expect(result.current.defaultView).toEqual(ROWS[0]);

    expect(mockFrom).toHaveBeenCalledWith('entity_views');
    expect(selectMock).toHaveBeenCalledWith(
      'id,user_id,entity,name,view_type,filters,sort,columns,is_shared,is_default,position,icon,color,created_at,updated_at',
    );
    expect(eqMock).toHaveBeenCalledWith('entity', 'contacts');
    expect(orderMock).toHaveBeenNthCalledWith(1, 'position', { ascending: true });
    expect(orderMock).toHaveBeenNthCalledWith(2, 'created_at', { ascending: true });
  });

  it('passe en erreur quand Supabase renvoie une erreur de lecture', async () => {
    setQueryResult({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.views).toEqual([]);
    expect(result.current.ownViews).toEqual([]);
    expect(result.current.sharedViews).toEqual([]);
    expect(result.current.defaultView).toBeNull();
  });

  it('crée une vue avec les valeurs par défaut et la position courante', async () => {
    setSingleResult({ data: { id: 'new-view' }, error: null });

    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.views).toHaveLength(3);
    });

    const input: EntityViewInput = {
      name: 'Vue galerie',
      filters: [{ field: 'score', operator: 'gte', value: 10 }],
      columns: ['name', 'score'],
      is_shared: true,
      color: 'purple',
    };

    let createdId = '';
    await act(async () => {
      createdId = await result.current.createView(input);
    });

    expect(createdId).toBe('new-view');
    expect(insertMock).toHaveBeenCalledWith([
      {
        user_id: 'u1',
        entity: 'contacts',
        name: 'Vue galerie',
        view_type: 'table',
        filters: [{ field: 'score', operator: 'gte', value: 10 }],
        sort: [],
        columns: ['name', 'score'],
        is_shared: true,
        is_default: false,
        icon: null,
        color: 'purple',
        position: 3,
      },
    ]);
    expect(selectMock).toHaveBeenCalledWith('id');
    expect(singleMock).toHaveBeenCalledTimes(1);
  });

  it('met à jour une vue en sérialisant les champs structurés', async () => {
    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateView({
        id: 'own-table',
        patch: {
          name: 'Liste renommée',
          filters: [{ field: 'status', operator: 'eq', value: 'active' }],
          sort: [{ field: 'name', direction: 'asc' }],
          columns: ['name', 'email'],
        },
      });
    });

    expect(updateMock).toHaveBeenCalledWith({
      name: 'Liste renommée',
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      sort: [{ field: 'name', direction: 'asc' }],
      columns: ['name', 'email'],
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'own-table');
  });

  it('supprime une vue par identifiant', async () => {
    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteView('own-table');
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith('id', 'own-table');
  });

  it('définit une nouvelle vue par défaut après avoir désactivé la précédente', async () => {
    const { result } = renderHook(() => useEntityViews('contacts'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setDefaultView('own-table');
    });

    expect(updateMock).toHaveBeenNthCalledWith(1, { is_default: false });
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1');
    expect(eqMock).toHaveBeenCalledWith('entity', 'contacts');
    expect(eqMock).toHaveBeenCalledWith('is_default', true);
    expect(updateMock).toHaveBeenNthCalledWith(2, { is_default: true });
    expect(eqMock).toHaveBeenCalledWith('id', 'own-table');
  });
});