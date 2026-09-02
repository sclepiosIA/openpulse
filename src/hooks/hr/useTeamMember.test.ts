import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsTeamMember, useTeamMemberProfile } from './useTeamMember';

const {
  AUTH_STATE,
  mockUseAuth,
  mockDebugError,
  mockFrom,
  PROFILE_ROW,
  TEAM_ROLE_ROW,
  NON_TEAM_ROLE_ROW,
  createBuilder,
} = vi.hoisted(() => {
  const AUTH_STATE: {
    user: { id: string; email: string } | null;
    session: { user: { id: string } } | null;
    isLoading: boolean;
  } = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const PROFILE_ROW = {
    id: 'p1',
    nom: 'Dupont',
    prenom: 'Marie',
    user_id: 'u1',
  };

  const TEAM_ROLE_ROW = { role: 'chef_projet' };
  const NON_TEAM_ROLE_ROW = null;

  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockDebugError = vi.fn();

  const createBuilder = () => {
    const builder = {
      __table: '',
      __result: { data: null as unknown, error: null as { message: string } | null },
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
      single: vi.fn(() => Promise.resolve(builder.__result)),
      maybeSingle: vi.fn(() => Promise.resolve(builder.__result)),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(builder.__result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(builder.__result).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    const builder = createBuilder();
    builder.__table = table;

    if (table === 'user_roles') {
      builder.__result = { data: TEAM_ROLE_ROW, error: null };
    } else if (table === 'profiles') {
      builder.__result = { data: PROFILE_ROW, error: null };
    } else {
      builder.__result = { data: null, error: null };
    }

    return builder;
  });

  return {
    AUTH_STATE,
    mockUseAuth,
    mockDebugError,
    mockFrom,
    PROFILE_ROW,
    TEAM_ROLE_ROW,
    NON_TEAM_ROLE_ROW,
    createBuilder,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
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
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useTeamMember', () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
    AUTH_STATE.session = { user: { id: 'u1' } };
    AUTH_STATE.isLoading = false;
    mockUseAuth.mockImplementation(() => AUTH_STATE);
    mockDebugError.mockReset();
    mockFrom.mockReset();
    mockFrom.mockImplementation((table: string) => {
      const builder = createBuilder();
      builder.__table = table;

      if (table === 'user_roles') {
        builder.__result = { data: TEAM_ROLE_ROW, error: null };
      } else if (table === 'profiles') {
        builder.__result = { data: PROFILE_ROW, error: null };
      } else {
        builder.__result = { data: null, error: null };
      }

      return builder;
    });
  });

  describe('useIsTeamMember', () => {
    it('passe de isLoading à succès et retourne true pour un rôle équipe', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useIsTeamMember(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_roles');

      const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>;
      expect(builder.select).toHaveBeenCalledWith('role');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.in).toHaveBeenCalledWith('role', ['admin', 'csm', 'chef_projet', 'commercial']);
      expect(builder.maybeSingle).toHaveBeenCalled();
    });

    it('retourne false sans requête si aucun utilisateur connecté', async () => {
      AUTH_STATE.user = null;
      AUTH_STATE.session = null;

      const wrapper = createWrapper();

      const { result } = renderHook(() => useIsTeamMember(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(false);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('retourne false et log l’erreur quand la requête Supabase échoue', async () => {
      mockFrom.mockImplementation((table: string) => {
        const builder = createBuilder();
        builder.__table = table;
        if (table === 'user_roles') {
          builder.__result = { data: null, error: { message: 'x' } };
        }
        return builder;
      });

      const wrapper = createWrapper();

      const { result } = renderHook(() => useIsTeamMember(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(mockDebugError).toHaveBeenCalledWith('Error checking team member:', { message: 'x' });
    });
  });

  describe('useTeamMemberProfile', () => {
    it('passe de isLoading à succès et retourne le profil enrichi avec la fonction métier', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useTeamMemberProfile(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        id: 'p1',
        nom: 'Dupont',
        prenom: 'Marie',
        user_id: 'u1',
        role: 'chef_projet',
        fonction: 'Chef de projet',
      });

      expect(mockFrom).toHaveBeenNthCalledWith(1, 'profiles');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'user_roles');

      const profileBuilder = mockFrom.mock.results[0]?.value as ReturnType<typeof createBuilder>;
      expect(profileBuilder.select).toHaveBeenCalledWith('id, nom, prenom, user_id');
      expect(profileBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(profileBuilder.maybeSingle).toHaveBeenCalled();

      const roleBuilder = mockFrom.mock.results[1]?.value as ReturnType<typeof createBuilder>;
      expect(roleBuilder.select).toHaveBeenCalledWith('role');
      expect(roleBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(roleBuilder.maybeSingle).toHaveBeenCalled();
    });

    it('retourne null sans requête si aucun utilisateur connecté', async () => {
      AUTH_STATE.user = null;
      AUTH_STATE.session = null;

      const wrapper = createWrapper();

      const { result } = renderHook(() => useTeamMemberProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('retourne null et log l’erreur quand la récupération du profil échoue', async () => {
      mockFrom.mockImplementation((table: string) => {
        const builder = createBuilder();
        builder.__table = table;

        if (table === 'profiles') {
          builder.__result = { data: null, error: { message: 'x' } };
        } else if (table === 'user_roles') {
          builder.__result = { data: TEAM_ROLE_ROW, error: null };
        }

        return builder;
      });

      const wrapper = createWrapper();

      const { result } = renderHook(() => useTeamMemberProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
      expect(mockDebugError).toHaveBeenCalledWith('Error fetching team member profile:', { message: 'x' });
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('retourne le profil avec role et fonction null si aucun rôle trouvé', async () => {
      mockFrom.mockImplementation((table: string) => {
        const builder = createBuilder();
        builder.__table = table;

        if (table === 'profiles') {
          builder.__result = { data: PROFILE_ROW, error: null };
        } else if (table === 'user_roles') {
          builder.__result = { data: NON_TEAM_ROLE_ROW, error: null };
        }

        return builder;
      });

      const wrapper = createWrapper();

      const { result } = renderHook(() => useTeamMemberProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        id: 'p1',
        nom: 'Dupont',
        prenom: 'Marie',
        user_id: 'u1',
        role: null,
        fonction: null,
      });
    });
  });
});