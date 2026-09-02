/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEntitySearch } from './useEntitySearch';

const {
  ETABLISSEMENTS_ROWS,
  TACHES_ROWS,
  CONTACTS_ROWS,
  GROUPES_ROWS,
  EVENEMENTS_ROWS,
  PARTENAIRES_ROWS,
  EMPTY_RESULTS,
  AUTH_STATE,
  debugError,
  sanitizePostgrestValue,
  mockFrom,
} = vi.hoisted(() => ({
  ETABLISSEMENTS_ROWS: [{ id: 'et1', nom: 'École Alpha', ville: 'Paris' }],
  TACHES_ROWS: [{ id: 'ta1', titre: 'Appeler Alpha', statut: 'ouverte' }],
  CONTACTS_ROWS: [{ id: 'co1', nom: 'Durand', prenom: 'Alice', fonction: 'Directrice' }],
  GROUPES_ROWS: [{ id: 'gr1', nom: 'Groupe Nord' }],
  EVENEMENTS_ROWS: [{ id: 'ev1', title: 'Réunion Alpha', start_time: '2099-05-10T09:00:00.000Z' }],
  PARTENAIRES_ROWS: [{ id: 'pa1', nom: 'Partenaire Beta', type_partenaire: 'Financeur', ville: 'Lyon' }],
  EMPTY_RESULTS: {
    etablissements: [],
    taches: [],
    contacts: [],
    groupes: [],
    evenements: [],
    partenaires: [],
  },
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  debugError: vi.fn(),
  sanitizePostgrestValue: vi.fn((value: string) => value),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createQueryClient() {
  return new QueryClient({
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
}

function createWrapper() {
  const queryClient = createQueryClient();

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

type TableName =
  | 'etablissements'
  | 'taches'
  | 'contacts'
  | 'groupes_etablissements'
  | 'calendar_events'
  | 'partenaires';

type QueryResponseRow =
  | { id: string; nom: string; ville: string }
  | { id: string; titre: string; statut: string }
  | { id: string; nom: string; prenom: string; fonction: string }
  | { id: string; nom: string }
  | { id: string; title: string; start_time: string }
  | { id: string; nom: string; type_partenaire: string; ville: string };

type QueryResult = {
  data: QueryResponseRow[] | null;
  error: { message: string } | null;
};

function createBuilder(result: Promise<QueryResult>) {
  const builder = {
    select: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    or: vi.fn(() => builder),
    single: vi.fn(() => result.then((value) => ({ data: value.data?.[0] ?? null, error: value.error }))),
    maybeSingle: vi.fn(() => result.then((value) => ({ data: value.data?.[0] ?? null, error: value.error }))),
    then: (
      onFulfilled?: ((value: QueryResult) => QueryResult | PromiseLike<QueryResult>) | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) => result.then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => PromiseLike<never>) | null) => result.catch(onRejected ?? undefined),
  };

  return builder;
}

function setupSupabaseSuccess() {
  const tableData: Record<TableName, QueryResponseRow[]> = {
    etablissements: ETABLISSEMENTS_ROWS,
    taches: TACHES_ROWS,
    contacts: CONTACTS_ROWS,
    groupes_etablissements: GROUPES_ROWS,
    calendar_events: EVENEMENTS_ROWS,
    partenaires: PARTENAIRES_ROWS,
  };

  mockFrom.mockImplementation((table: string) => {
    const typedTable = table as TableName;
    return createBuilder(Promise.resolve({ data: tableData[typedTable], error: null }));
  });
}

function setupSupabaseError() {
  mockFrom.mockImplementation((_table: string) => {
    return createBuilder(Promise.reject(new Error('x')));
  });
}

describe('useEntitySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne des résultats vides et ne lance pas de recherche pour une requête trop courte', async () => {
    setupSupabaseSuccess();

    const { result } = renderHook(() => useEntitySearch('a'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.hasResults).toBe(false);
    expect(result.current.allResults).toEqual([]);
    expect(result.current.results).toEqual(EMPTY_RESULTS);
  });

  it('charge puis mappe correctement tous les types de résultats', async () => {
    setupSupabaseSuccess();

    const { result } = renderHook(() => useEntitySearch('Al'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledTimes(6);
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.hasResults).toBe(true);
      expect(result.current.allResults).toHaveLength(6);
    });

    expect(sanitizePostgrestValue).toHaveBeenCalledTimes(2);
    expect(sanitizePostgrestValue).toHaveBeenNthCalledWith(1, 'Al');
    expect(sanitizePostgrestValue).toHaveBeenNthCalledWith(2, 'Al');

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'etablissements');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'taches');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'contacts');
    expect(mockFrom).toHaveBeenNthCalledWith(4, 'groupes_etablissements');
    expect(mockFrom).toHaveBeenNthCalledWith(5, 'calendar_events');
    expect(mockFrom).toHaveBeenNthCalledWith(6, 'partenaires');

    expect(result.current.results.etablissements[0]).toMatchObject({
      id: 'et1',
      type: 'etablissement',
      name: 'École Alpha',
      subtitle: 'Paris',
      url: '/etablissements/et1',
    });

    expect(result.current.results.taches[0]).toMatchObject({
      id: 'ta1',
      type: 'tache',
      name: 'Appeler Alpha',
      subtitle: 'ouverte',
      url: '/etablissements?tache=ta1',
    });

    expect(result.current.results.contacts[0]).toMatchObject({
      id: 'co1',
      type: 'contact',
      name: 'Alice Durand',
      subtitle: 'Directrice',
      url: '/contacts/co1',
    });

    expect(result.current.results.groupes[0]).toMatchObject({
      id: 'gr1',
      type: 'groupe',
      name: 'Groupe Nord',
      url: '/groupes/gr1',
    });

    expect(result.current.results.evenements[0]).toMatchObject({
      id: 'ev1',
      type: 'evenement',
      name: 'Réunion Alpha',
      subtitle: '10/05/2099',
      url: '/calendrier?event=ev1',
    });

    expect(result.current.results.partenaires[0]).toMatchObject({
      id: 'pa1',
      type: 'partenaire',
      name: 'Partenaire Beta',
      subtitle: 'Financeur',
      url: '/partenaires/pa1',
    });

    expect(result.current.allResults.map((item) => item.type)).toEqual([
      'etablissement',
      'tache',
      'contact',
      'groupe',
      'evenement',
      'partenaire',
    ]);
  });

  it('clearResults vide explicitement tous les résultats', async () => {
    setupSupabaseSuccess();

    const { result } = renderHook(() => useEntitySearch('Al'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.hasResults).toBe(true);
    });

    await act(async () => {
      result.current.clearResults();
    });

    expect(result.current.hasResults).toBe(false);
    expect(result.current.allResults).toEqual([]);
    expect(result.current.results).toEqual(EMPTY_RESULTS);
  });

  it('gère une erreur de recherche en journalisant et en laissant les résultats vides', async () => {
    setupSupabaseError();

    const { result } = renderHook(() => useEntitySearch('Al'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith('Entity search error:', expect.any(Error));
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(result.current.hasResults).toBe(false);
    expect(result.current.allResults).toEqual([]);
    expect(result.current.results).toEqual(EMPTY_RESULTS);
  });
});