// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupeEtablissements } from './useGroupeEtablissements';

const {
  AUTH_STATE,
  DEBUG_ERROR,
  GROUPE_ID,
  ETABS_RELATIONS,
  TACHES_ROWS,
  mockFrom,
  mockDebugError,
  builderState,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const DEBUG_ERROR = { message: 'x' };
  const GROUPE_ID = 'g1';

  const ETABS_RELATIONS = [
    {
      etablissements: {
        id: 'e1',
        nom: 'Etablissement A',
        ville: 'Paris',
        statut: 'actif',
        progression: 65,
        engagement_score: 82,
      },
    },
    {
      etablissements: {
        id: 'e2',
        nom: 'Etablissement B',
        ville: 'Lyon',
        statut: 'actif',
        progression: 40,
        engagement_score: 70,
      },
    },
  ];

  const TACHES_ROWS = [
    {
      id: 't1',
      titre: 'Audit sécurité',
      statut: 'En cours',
      echeance: '2025-02-01',
      priorite: 'haute',
      etablissement_id: 'e1',
    },
    {
      id: 't2',
      titre: 'Former équipe',
      statut: 'À faire',
      echeance: '2025-02-10',
      priorite: 'moyenne',
      etablissement_id: 'e1',
    },
    {
      id: 't3',
      titre: 'Mettre à jour procédure',
      statut: 'En cours',
      echeance: '2025-03-01',
      priorite: 'basse',
      etablissement_id: 'e2',
    },
  ];

  const builderState = {
    mode: 'success' as 'success' | 'error' | 'empty',
    currentTable: '',
  };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.is.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.neq.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);

  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });

  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
    let value: unknown;

    if (builderState.currentTable === 'etablissements_groupes') {
      if (builderState.mode === 'error') {
        value = { data: null, error: DEBUG_ERROR };
      } else if (builderState.mode === 'empty') {
        value = { data: [], error: null };
      } else {
        value = { data: ETABS_RELATIONS, error: null };
      }
    } else if (builderState.currentTable === 'taches') {
      value = { data: TACHES_ROWS, error: null };
    } else {
      value = { data: null, error: null };
    }

    return Promise.resolve(value).then(onFulfilled, onRejected);
  });

  builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) => {
    return Promise.resolve().catch(onRejected);
  });

  const mockFrom = vi.fn((table: string) => {
    builderState.currentTable = table;
    return builder;
  });

  const mockDebugError = vi.fn();

  return {
    AUTH_STATE,
    DEBUG_ERROR,
    GROUPE_ID,
    ETABS_RELATIONS,
    TACHES_ROWS,
    mockFrom,
    mockDebugError,
    builderState,
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

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

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

describe('useGroupeEtablissements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builderState.mode = 'success';
    builderState.currentTable = '';
  });

  it('charge puis retourne les établissements du groupe avec leurs tâches actives associées', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useGroupeEtablissements(GROUPE_ID), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'etablissements_groupes');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'taches');

    expect(result.current.data).toEqual([
      {
        id: 'e1',
        nom: 'Etablissement A',
        ville: 'Paris',
        statut: 'actif',
        progression: 65,
        engagement_score: 82,
        taches: [
          {
            id: 't1',
            titre: 'Audit sécurité',
            statut: 'En cours',
            echeance: '2025-02-01',
            priorite: 'haute',
            etablissement_id: 'e1',
          },
          {
            id: 't2',
            titre: 'Former équipe',
            statut: 'À faire',
            echeance: '2025-02-10',
            priorite: 'moyenne',
            etablissement_id: 'e1',
          },
        ],
      },
      {
        id: 'e2',
        nom: 'Etablissement B',
        ville: 'Lyon',
        statut: 'actif',
        progression: 40,
        engagement_score: 70,
        taches: [
          {
            id: 't3',
            titre: 'Mettre à jour procédure',
            statut: 'En cours',
            echeance: '2025-03-01',
            priorite: 'basse',
            etablissement_id: 'e2',
          },
        ],
      },
    ]);

    expect(result.current.data?.[0]?.taches).toHaveLength(2);
    expect(result.current.data?.[1]?.taches?.[0]?.titre).toBe('Mettre à jour procédure');
  });

  it('ne lance pas la requête et retourne undefined quand groupeId est absent', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useGroupeEtablissements(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retourne null et journalise l’erreur Supabase quand la première requête échoue', async () => {
    builderState.mode = 'error';
    const wrapper = createWrapper();

    const { result } = renderHook(() => useGroupeEtablissements(GROUPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(mockDebugError).toHaveBeenCalledWith('[useGroupeEtablissements] Error:', DEBUG_ERROR);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});