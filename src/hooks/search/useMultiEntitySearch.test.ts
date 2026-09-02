// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMultiEntitySearch } from './useMultiEntitySearch';

const {
  ETABLISSEMENTS_ROWS,
  GROUPES_ROWS,
  PARTENAIRES_ROWS,
  EMPTY_ROWS,
  authValue,
  mockFrom,
  mockDebugError,
  mockSanitize,
  buildersByTable,
} = vi.hoisted(() => {
  const ETABLISSEMENTS_ROWS = [
    { id: 'e1', nom: 'Clinique Paris', ville: 'Paris', region: 'Île-de-France' },
  ];
  const GROUPES_ROWS = [
    { id: 'g1', nom: 'Groupe Santé', type: 'Réseau' },
  ];
  const PARTENAIRES_ROWS = [
    { id: 'p1', nom: 'Partenaire Lyon', ville: 'Lyon', type_partenaire: 'Financeur' },
  ];
  const EMPTY_ROWS: Array<never> = [];
  const authValue = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };
  const mockDebugError = vi.fn();
  const mockSanitize = vi.fn((value: string) => value);

  type TableName = 'etablissements' | 'groupes_etablissements' | 'partenaires';
  type Row =
    | { id: string; nom: string; ville: string; region: string }
    | { id: string; nom: string; type: string }
    | { id: string; nom: string; ville: string; type_partenaire: string };

  const makeBuilder = (table: TableName) => {
    const builderState: {
      table: TableName;
      data: Row[] | Array<never>;
      error: null | { message: string };
    } = {
      table,
      data:
        table === 'etablissements'
          ? ETABLISSEMENTS_ROWS
          : table === 'groupes_etablissements'
            ? GROUPES_ROWS
            : PARTENAIRES_ROWS,
      error: null,
    };

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
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: builderState.data[0] ?? null, error: builderState.error })),
      single: vi.fn(async () => ({ data: builderState.data[0] ?? null, error: builderState.error })),
      then: (
        onFulfilled?: (value: { data: Row[] | Array<never>; error: null | { message: string } }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: builderState.data, error: builderState.error }).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: builderState.data, error: builderState.error }).catch(onRejected),
      __setResponse: (data: Row[] | Array<never>, error: null | { message: string }) => {
        builderState.data = data;
        builderState.error = error;
      },
    };

    return builder;
  };

  const buildersByTable = {
    etablissements: makeBuilder('etablissements'),
    groupes_etablissements: makeBuilder('groupes_etablissements'),
    partenaires: makeBuilder('partenaires'),
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === 'etablissements' || table === 'groupes_etablissements' || table === 'partenaires') {
      return buildersByTable[table];
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    ETABLISSEMENTS_ROWS,
    GROUPES_ROWS,
    PARTENAIRES_ROWS,
    EMPTY_ROWS,
    authValue,
    mockFrom,
    mockDebugError,
    mockSanitize,
    buildersByTable,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: mockSanitize,
}));

vi.mock('../shared/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('lucide-react', () => {
  const Building2 = () => null;
  const Users = () => null;
  const Handshake = () => null;
  return { Building2, Users, Handshake };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authValue,
}));

function createWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return Wrapper;
}

describe('useMultiEntitySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildersByTable.etablissements.__setResponse(ETABLISSEMENTS_ROWS, null);
    buildersByTable.groupes_etablissements.__setResponse(GROUPES_ROWS, null);
    buildersByTable.partenaires.__setResponse(PARTENAIRES_ROWS, null);
    mockSanitize.mockImplementation((value: string) => value);
  });

  it('retourne des résultats vides et ne cherche pas pour une requête trop courte', async () => {
    const { result } = renderHook(() => useMultiEntitySearch('a'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.results).toEqual({
      etablissements: [],
      groupes: [],
      partenaires: [],
    });
    expect(result.current.allResults).toEqual([]);
    expect(result.current.hasResults).toBe(false);
  });

  it('effectue la recherche multi-entités et mappe les valeurs métier correctement', async () => {
    const { result } = renderHook(() => useMultiEntitySearch('  Paris  '), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.hasResults).toBe(true);
    });

    expect(mockSanitize).toHaveBeenCalledWith('paris');

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'etablissements');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'groupes_etablissements');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'partenaires');

    expect(buildersByTable.etablissements.select).toHaveBeenCalledWith('id, nom, ville, region');
    expect(buildersByTable.etablissements.or).toHaveBeenCalledWith('nom.ilike.%paris%,ville.ilike.%paris%');
    expect(buildersByTable.etablissements.limit).toHaveBeenCalledWith(10);

    expect(buildersByTable.groupes_etablissements.select).toHaveBeenCalledWith('id, nom, type');
    expect(buildersByTable.groupes_etablissements.ilike).toHaveBeenCalledWith('nom', '%paris%');
    expect(buildersByTable.groupes_etablissements.limit).toHaveBeenCalledWith(10);

    expect(buildersByTable.partenaires.select).toHaveBeenCalledWith('id, nom, ville, type_partenaire');
    expect(buildersByTable.partenaires.or).toHaveBeenCalledWith('nom.ilike.%paris%,ville.ilike.%paris%');
    expect(buildersByTable.partenaires.limit).toHaveBeenCalledWith(10);

    expect(result.current.results.etablissements).toHaveLength(1);
    expect(result.current.results.groupes).toHaveLength(1);
    expect(result.current.results.partenaires).toHaveLength(1);

    expect(result.current.results.etablissements[0]).toMatchObject({
      id: 'e1',
      type: 'etablissement',
      name: 'Clinique Paris',
      subtitle: 'Paris, Île-de-France',
    });

    expect(result.current.results.groupes[0]).toMatchObject({
      id: 'g1',
      type: 'groupe',
      name: 'Groupe Santé',
      subtitle: 'Réseau',
    });

    expect(result.current.results.partenaires[0]).toMatchObject({
      id: 'p1',
      type: 'partenaire',
      name: 'Partenaire Lyon',
      subtitle: 'Lyon • Financeur',
    });

    expect(result.current.allResults.map((item) => item.id)).toEqual(['e1', 'g1', 'p1']);
    expect(result.current.hasResults).toBe(true);
  });

  it('gère une erreur de recherche en vidant les résultats', async () => {
    const failingError = { message: 'x' };
    buildersByTable.etablissements.__setResponse(EMPTY_ROWS, failingError);
    buildersByTable.groupes_etablissements.__setResponse(EMPTY_ROWS, null);
    buildersByTable.partenaires.__setResponse(EMPTY_ROWS, null);
    mockFrom.mockImplementationOnce(() => {
      throw new Error('x');
    });

    const { result } = renderHook(() => useMultiEntitySearch('ly'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(mockDebugError).toHaveBeenCalledWith('Error searching entities:', expect.any(Error));
    expect(result.current.results).toEqual({
      etablissements: [],
      groupes: [],
      partenaires: [],
    });
    expect(result.current.allResults).toEqual([]);
    expect(result.current.hasResults).toBe(false);
  });
});