import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleData } from './usePeopleData';

const {
  SESSION_USER_ID,
  PROFILES,
  TEAM_STATS,
  RH_KPIS,
  ETABLISSEMENTS,
  refetchProfiles,
  refetchTeamStats,
  refetchRhKpis,
  refetchEtabs,
  mockUseProfilesWithRoles,
  mockUseTeamStats,
  mockUseRHKPIs,
  mockUseEtablissements,
  getSession,
  mockFrom,
  stableBuilder,
} = vi.hoisted(() => {
  const SESSION_USER_ID = 'u1';

  const PROFILES = [
    {
      id: 'u1',
      first_name: 'Alice',
      last_name: 'Martin',
      email: 'alice@example.test',
      role: 'admin',
      avatar_url: null,
      linkedin_url: 'https://lnkd.in/alice',
    },
    {
      id: 'u2',
      first_name: 'Bob',
      last_name: 'Durand',
      email: 'bob@example.test',
      role: 'member',
      avatar_url: null,
      linkedin_url: null,
    },
  ];

  const TEAM_STATS = {
    u1: {
      profileId: 'u1',
      totalTasks: 8,
      tasksInProgress: 2,
      tasksCompleted: 5,
      tasksOverdue: 1,
      completionRate: 62,
      avgCompletionTime: 4,
      totalProjects: 2,
      projectsByStatus: { active: 1, won: 1 },
      workload: 'medium',
      lastActivity: '2024-01-01',
    },
  };

  const RH_KPIS = {
    totalEmployees: 2,
    activeEmployees: 2,
    onboarding: 1,
  };

  const ETABLISSEMENTS = [
    {
      id: 'e1',
      nom: 'Clinique A',
      ville: 'Paris',
      statut: 'active',
      commercial_id: 'u1',
      chef_projet_id: 'u2',
      csm_id: null,
    },
    {
      id: 'e2',
      nom: 'Cabinet B',
      ville: 'Lyon',
      statut: 'pending',
      commercial_id: null,
      chef_projet_id: 'u1',
      csm_id: null,
    },
    {
      id: 'e3',
      nom: 'Hopital C',
      ville: 'Nice',
      statut: 'won',
      commercial_id: null,
      chef_projet_id: null,
      csm_id: 'u2',
    },
  ];

  const refetchProfiles = vi.fn();
  const refetchTeamStats = vi.fn();
  const refetchRhKpis = vi.fn();
  const refetchEtabs = vi.fn();

  const mockUseProfilesWithRoles = vi.fn();
  const mockUseTeamStats = vi.fn();
  const mockUseRHKPIs = vi.fn();
  const mockUseEtablissements = vi.fn();

  const getSession = vi.fn();

  const stableBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  stableBuilder.select.mockReturnValue(stableBuilder);
  stableBuilder.eq.mockReturnValue(stableBuilder);
  stableBuilder.neq.mockReturnValue(stableBuilder);
  stableBuilder.gte.mockReturnValue(stableBuilder);
  stableBuilder.lte.mockReturnValue(stableBuilder);
  stableBuilder.in.mockReturnValue(stableBuilder);
  stableBuilder.order.mockReturnValue(stableBuilder);
  stableBuilder.limit.mockReturnValue(stableBuilder);
  stableBuilder.insert.mockReturnValue(stableBuilder);
  stableBuilder.update.mockReturnValue(stableBuilder);
  stableBuilder.delete.mockReturnValue(stableBuilder);
  stableBuilder.upsert.mockReturnValue(stableBuilder);
  stableBuilder.single.mockResolvedValue({ data: null, error: null });
  stableBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
  stableBuilder.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) => Promise.resolve(onFulfilled({ data: null, error: null })));
  stableBuilder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  const mockFrom = vi.fn(() => stableBuilder);

  return {
    SESSION_USER_ID,
    PROFILES,
    TEAM_STATS,
    RH_KPIS,
    ETABLISSEMENTS,
    refetchProfiles,
    refetchTeamStats,
    refetchRhKpis,
    refetchEtabs,
    mockUseProfilesWithRoles,
    mockUseTeamStats,
    mockUseRHKPIs,
    mockUseEtablissements,
    getSession,
    mockFrom,
    stableBuilder,
  };
});

vi.mock('../profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: mockUseProfilesWithRoles,
}));

vi.mock('./useTeamStats', () => ({
  useTeamStats: mockUseTeamStats,
}));

vi.mock('./useRHKPIs', () => ({
  useRHKPIs: mockUseRHKPIs,
}));

vi.mock('../crm/useEtablissements', () => ({
  useEtablissements: mockUseEtablissements,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession,
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient, children });
  };
}

describe('usePeopleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: SESSION_USER_ID,
          },
        },
      },
    });

    mockUseProfilesWithRoles.mockReturnValue({
      data: PROFILES,
      isLoading: false,
      isError: false,
      refetch: refetchProfiles,
    });

    mockUseTeamStats.mockReturnValue({
      data: TEAM_STATS,
      isLoading: false,
      isError: false,
      refetch: refetchTeamStats,
    });

    mockUseRHKPIs.mockReturnValue({
      data: RH_KPIS,
      isLoading: false,
      isError: false,
      refetch: refetchRhKpis,
    });

    mockUseEtablissements.mockReturnValue({
      data: ETABLISSEMENTS,
      isLoading: false,
      isError: false,
      refetch: refetchEtabs,
    });
  });

  it('combine les profils, stats, projets assignés et récupère currentUserId', async () => {
    const { result } = renderHook(() => usePeopleData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe(SESSION_USER_ID);
    });

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.rhKpis).toEqual(RH_KPIS);
    expect(result.current.profiles).toHaveLength(2);

    expect(result.current.profiles[0]).toMatchObject({
      id: 'u1',
      first_name: 'Alice',
      role: 'admin',
      stats: TEAM_STATS.u1,
      assignedProjects: [
        { id: 'e1', nom: 'Clinique A', ville: 'Paris', statut: 'active' },
        { id: 'e2', nom: 'Cabinet B', ville: 'Lyon', statut: 'pending' },
      ],
    });

    expect(result.current.profiles[1]).toMatchObject({
      id: 'u2',
      first_name: 'Bob',
      role: 'member',
      assignedProjects: [
        { id: 'e1', nom: 'Clinique A', ville: 'Paris', statut: 'active' },
        { id: 'e3', nom: 'Hopital C', ville: 'Nice', statut: 'won' },
      ],
    });

    expect(result.current.profiles[1].stats).toEqual({
      profileId: 'u2',
      totalTasks: 0,
      tasksInProgress: 0,
      tasksCompleted: 0,
      tasksOverdue: 0,
      completionRate: 0,
      avgCompletionTime: 0,
      totalProjects: 0,
      projectsByStatus: {},
      workload: 'low',
      lastActivity: null,
    });
  });

  it('expose isLoading pendant le chargement puis succès', async () => {
    mockUseProfilesWithRoles.mockReturnValue({
      data: PROFILES,
      isLoading: true,
      isError: false,
      refetch: refetchProfiles,
    });

    const { result, rerender } = renderHook(() => usePeopleData(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.profiles).toHaveLength(2);

    mockUseProfilesWithRoles.mockReturnValue({
      data: PROFILES,
      isLoading: false,
      isError: false,
      refetch: refetchProfiles,
    });

    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profiles[0].assignedProjects).toEqual([
      { id: 'e1', nom: 'Clinique A', ville: 'Paris', statut: 'active' },
      { id: 'e2', nom: 'Cabinet B', ville: 'Lyon', statut: 'pending' },
    ]);
  });

  it('retourne isError si une source est en erreur', async () => {
    mockUseRHKPIs.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchRhKpis,
    });

    const { result } = renderHook(() => usePeopleData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe(SESSION_USER_ID);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rhKpis).toBeNull();
    expect(result.current.profiles).toHaveLength(2);
  });

  it('appelle les refetch de toutes les sources', async () => {
    const { result } = renderHook(() => usePeopleData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe(SESSION_USER_ID);
    });

    await act(async () => {
      result.current.refetch();
    });

    expect(refetchProfiles).toHaveBeenCalledWith();
    expect(refetchTeamStats).toHaveBeenCalledWith();
    expect(refetchRhKpis).toHaveBeenCalledWith();
    expect(refetchEtabs).toHaveBeenCalledWith();
  });
});