/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useTeamCalendars, useTeamMembers } from './useTeamCalendars';

const {
  AUTH_STATE,
  TEAM_CALENDARS_ROWS,
  SHARED_CALENDARS_ROWS,
  PROFILES_ROWS,
  MEMBERS_ROWS,
  TEAM_ERROR,
  SHARED_ERROR,
  MEMBERS_ERROR,
  debugErrorMock,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'user-1', email: 'user@test.local' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  },
  TEAM_CALENDARS_ROWS: [
    {
      id: 'cal-team-1',
      name: 'Equipe Alpha',
      color: '#111111',
      description: 'Planning équipe',
      owner_id: 'owner-2',
      type: 'team',
      is_default: null,
      is_visible: null,
      timezone: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'cal-team-2',
      name: 'Equipe Beta',
      color: '#222222',
      description: 'Planning beta',
      owner_id: 'owner-3',
      type: 'weird-type',
      is_default: true,
      is_visible: false,
      timezone: 'UTC',
      created_at: '2024-02-01',
      updated_at: '2024-02-02',
    },
  ],
  SHARED_CALENDARS_ROWS: [
    {
      calendar: {
        id: 'cal-shared-1',
        name: 'Partagé Gamma',
        color: '#333333',
        description: 'Partagé',
        owner_id: 'owner-4',
        type: 'shared',
        is_default: false,
        is_visible: true,
        timezone: 'Europe/Berlin',
        created_at: '2024-03-01',
        updated_at: '2024-03-02',
      },
    },
    {
      calendar: {
        id: 'cal-team-1',
        name: 'Equipe Alpha duplicate',
        color: '#444444',
        description: 'Duplicate',
        owner_id: 'owner-2',
        type: 'shared',
        is_default: true,
        is_visible: true,
        timezone: 'Europe/Madrid',
        created_at: '2024-04-01',
        updated_at: '2024-04-02',
      },
    },
  ],
  PROFILES_ROWS: [
    {
      id: 'profile-2',
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice@test.local',
      user_id: 'owner-2',
    },
    {
      id: 'profile-3',
      prenom: null,
      nom: null,
      email: 'beta@test.local',
      user_id: 'owner-3',
    },
    {
      id: 'profile-4',
      prenom: 'Chloe',
      nom: 'Durand',
      email: 'chloe@test.local',
      user_id: 'owner-4',
    },
  ],
  MEMBERS_ROWS: [
    {
      id: 'profile-10',
      prenom: 'Anna',
      nom: 'Aubert',
      email: 'anna@test.local',
      user_id: 'member-1',
    },
    {
      id: 'profile-11',
      prenom: 'Benoit',
      nom: 'Bernard',
      email: 'benoit@test.local',
      user_id: 'member-2',
    },
  ],
  TEAM_ERROR: { message: 'team fetch failed' },
  SHARED_ERROR: { message: 'shared fetch failed' },
  MEMBERS_ERROR: { message: 'members fetch failed' },
  debugErrorMock: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueryResult = {
  data: unknown;
  error: unknown;
};

function createThenableBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

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

describe('useTeamCalendars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH_STATE.user = { id: 'user-1', email: 'user@test.local' };
  });

  it('charge puis retourne les calendriers d’équipe et partagés dédupliqués avec profils et valeurs normalisées', async () => {
    const calendarsBuilder = createThenableBuilder({
      data: TEAM_CALENDARS_ROWS,
      error: null,
    });
    const sharesBuilder = createThenableBuilder({
      data: SHARED_CALENDARS_ROWS,
      error: null,
    });
    const profilesBuilder = createThenableBuilder({
      data: PROFILES_ROWS,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calendars') return calendarsBuilder;
      if (table === 'calendar_shares') return sharesBuilder;
      if (table === 'profiles') return profilesBuilder;
      return createThenableBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTeamCalendars(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'calendars');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'calendar_shares');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'profiles');

    expect(calendarsBuilder.select).toHaveBeenCalledWith(
      'id, name, color, description, owner_id, type, is_default, is_visible, timezone, created_at, updated_at'
    );
    expect(calendarsBuilder.eq).toHaveBeenCalledWith('type', 'team');
    expect(calendarsBuilder.neq).toHaveBeenCalledWith('owner_id', 'user-1');
    expect(calendarsBuilder.limit).toHaveBeenCalledWith(100);

    expect(sharesBuilder.select).toHaveBeenCalledWith(`
          calendar:calendars (*)
        `);
    expect(sharesBuilder.eq).toHaveBeenCalledWith('shared_with_user_id', 'user-1');

    expect(profilesBuilder.select).toHaveBeenCalledWith('id, prenom, nom, email, user_id');
    expect(profilesBuilder.in).toHaveBeenCalledWith(
      'user_id',
      expect.arrayContaining(['owner-2', 'owner-3', 'owner-4'])
    );

    expect(result.current.data).toHaveLength(3);

    const first = result.current.data?.find((c) => c.id === 'cal-team-1');
    const second = result.current.data?.find((c) => c.id === 'cal-team-2');
    const shared = result.current.data?.find((c) => c.id === 'cal-shared-1');

    expect(first).toMatchObject({
      id: 'cal-team-1',
      name: 'Equipe Alpha',
      type: 'team',
      is_default: false,
      is_visible: true,
      timezone: 'Europe/Paris',
      owner_profile: {
        id: 'profile-2',
        prenom: 'Alice',
        nom: 'Martin',
        email: 'alice@test.local',
        user_id: 'owner-2',
      },
    });

    expect(second).toMatchObject({
      id: 'cal-team-2',
      name: 'Equipe Beta',
      type: 'personal',
      is_default: true,
      is_visible: false,
      timezone: 'UTC',
      owner_profile: {
        id: 'profile-3',
        prenom: '',
        nom: '',
        email: 'beta@test.local',
        user_id: 'owner-3',
      },
    });

    expect(shared).toMatchObject({
      id: 'cal-shared-1',
      name: 'Partagé Gamma',
      type: 'shared',
      is_default: false,
      is_visible: true,
      timezone: 'Europe/Berlin',
      owner_profile: {
        id: 'profile-4',
        prenom: 'Chloe',
        nom: 'Durand',
        email: 'chloe@test.local',
        user_id: 'owner-4',
      },
    });
  });

  it('passe en erreur si utilisateur non authentifié', async () => {
    AUTH_STATE.user = null;

    const { result } = renderHook(() => useTeamCalendars(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Non authentifié');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passe en erreur et log si la récupération des calendriers équipe échoue', async () => {
    const calendarsBuilder = createThenableBuilder({
      data: null,
      error: TEAM_ERROR,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calendars') return calendarsBuilder;
      return createThenableBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTeamCalendars(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(TEAM_ERROR);
    expect(debugErrorMock).toHaveBeenCalledWith('Error fetching team calendars:', TEAM_ERROR);
  });

  it('passe en erreur et log si la récupération des calendriers partagés échoue', async () => {
    const calendarsBuilder = createThenableBuilder({
      data: TEAM_CALENDARS_ROWS,
      error: null,
    });
    const sharesBuilder = createThenableBuilder({
      data: null,
      error: SHARED_ERROR,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calendars') return calendarsBuilder;
      if (table === 'calendar_shares') return sharesBuilder;
      return createThenableBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTeamCalendars(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(SHARED_ERROR);
    expect(debugErrorMock).toHaveBeenCalledWith('Error fetching shared calendars:', SHARED_ERROR);
  });
});

describe('useTeamMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge puis retourne la liste des membres triée via la requête profiles', async () => {
    const profilesBuilder = createThenableBuilder({
      data: MEMBERS_ROWS,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder;
      return createThenableBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTeamMembers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(profilesBuilder.select).toHaveBeenCalledWith('id, prenom, nom, email, user_id');
    expect(profilesBuilder.order).toHaveBeenCalledWith('nom');
    expect(profilesBuilder.limit).toHaveBeenCalledWith(200);
    expect(result.current.data).toEqual(MEMBERS_ROWS);
  });

  it('passe en erreur si la récupération des membres échoue', async () => {
    const profilesBuilder = createThenableBuilder({
      data: null,
      error: MEMBERS_ERROR,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder;
      return createThenableBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTeamMembers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(MEMBERS_ERROR);
  });
});