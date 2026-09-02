import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';
import { useTeamStats, useTeamOverviewStats } from './useTeamStats';

const { PROFILES, ETABS, TACHES, mockFrom, mockRpc } = vi.hoisted(() => {
  const PROFILES = [{ id: 'u1' }, { id: 'u2' }];
  const ETABS = [
    { id: 'e1', statut: 'Actif', commercial_id: 'u1', chef_projet_id: null, csm_id: null },
    { id: 'e2', statut: 'Actif', commercial_id: null, chef_projet_id: 'u1', csm_id: null },
    { id: 'e3', statut: null, commercial_id: null, chef_projet_id: null, csm_id: 'u2' },
  ];
  const TACHES = [
    {
      id: 't1',
      responsable_id: 'u1',
      statut: 'Terminé',
      echeance: null,
      date_realisation: '2024-01-03T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-03-01T00:00:00Z',
      archive: false,
    },
    {
      id: 't2',
      responsable_id: 'u1',
      statut: 'Terminé',
      echeance: null,
      date_realisation: '2024-01-05T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-03-05T00:00:00Z',
      archive: false,
    },
    {
      id: 't3',
      responsable_id: 'u1',
      statut: 'En cours',
      echeance: null,
      date_realisation: null,
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z',
      archive: false,
    },
    {
      id: 't4',
      responsable_id: 'u1',
      statut: 'À faire',
      echeance: '2020-01-01T00:00:00Z',
      date_realisation: null,
      created_at: '2024-02-10T00:00:00Z',
      updated_at: '2024-02-10T00:00:00Z',
      archive: false,
    },
  ];
  return {
    PROFILES,
    ETABS,
    TACHES,
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

type QueryResult = { data: unknown; error: { message: string } | null };

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (
    onFulfilled?: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).catch(onRejected);
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: PROFILES, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'etablissements') {
      return createBuilder({ data: ETABS, error: null });
    }
    if (table === 'taches') {
      return createBuilder({ data: TACHES, error: null });
    }
    return createBuilder({ data: [], error: null });
  });
});

describe('useTeamStats', () => {
  it('démarre en état de chargement', () => {
    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('calcule les statistiques de u1 correctement', async () => {
    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stats = result.current.data;
    expect(stats).toBeDefined();
    const u1 = stats?.['u1'];
    expect(u1).toBeDefined();
    expect(u1?.profileId).toBe('u1');
    expect(u1?.totalTasks).toBe(4);
    expect(u1?.tasksCompleted).toBe(2);
    expect(u1?.tasksInProgress).toBe(1);
    expect(u1?.tasksOverdue).toBe(1);
    expect(u1?.completionRate).toBe(50);
    expect(u1?.avgCompletionTime).toBe(3);
    expect(u1?.totalProjects).toBe(2);
    expect(u1?.projectsByStatus).toEqual({ Actif: 2 });
    expect(u1?.workload).toBe('low');
    expect(u1?.lastActivity).toEqual(new Date('2024-03-05T00:00:00Z'));
  });

  it('calcule les statistiques de u2 (aucune tâche, un projet sans statut)', async () => {
    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const u2 = result.current.data?.['u2'];
    expect(u2).toBeDefined();
    expect(u2?.totalTasks).toBe(0);
    expect(u2?.tasksCompleted).toBe(0);
    expect(u2?.completionRate).toBe(0);
    expect(u2?.avgCompletionTime).toBe(0);
    expect(u2?.totalProjects).toBe(1);
    expect(u2?.projectsByStatus).toEqual({ Inconnu: 1 });
    expect(u2?.workload).toBe('low');
    expect(u2?.lastActivity).toBeNull();
  });

  it('appelle le rpc get_profiles_public et les bonnes tables', async () => {
    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_profiles_public');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockFrom).toHaveBeenCalledWith('taches');
  });

  it('passe en erreur si le rpc des profils échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeUndefined();
  });

  it('passe en erreur si la requête taches échoue', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'taches') {
        return createBuilder({ data: null, error: { message: 'x' } });
      }
      return createBuilder({ data: ETABS, error: null });
    });

    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: 'x' });
  });
});

describe('useTeamOverviewStats', () => {
  it('démarre en état de chargement', () => {
    const { result } = renderHook(() => useTeamOverviewStats(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('calcule les statistiques globales de l’équipe', async () => {
    const { result } = renderHook(() => useTeamOverviewStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      totalMembers: 2,
      activeMembers: 2,
      totalProjects: 3,
      totalTasks: 4,
      avgCompletionRate: 50,
      tasksOverdueTotal: 1,
    });
  });

  it('retourne des zéros quand les données sont nulles', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => createBuilder({ data: null, error: null }));

    const { result } = renderHook(() => useTeamOverviewStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      totalMembers: 0,
      activeMembers: 0,
      totalProjects: 0,
      totalTasks: 0,
      avgCompletionRate: 0,
      tasksOverdueTotal: 0,
    });
  });
});