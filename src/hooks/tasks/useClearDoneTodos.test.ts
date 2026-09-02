// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useClearDoneTodos } from './useClearDoneTodos';

const {
  AUTH_STATE,
  PROFILE_ROW,
  selectResult,
  deleteResult,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const PROFILE_ROW = { id: 'profile-1' };

  const selectResult: { data: { id: string } | null; error: { message: string } | null } = {
    data: PROFILE_ROW,
    error: null,
  };

  const deleteResult: { data: null; error: { message: string } | null; count: number | null } = {
    data: null,
    error: null,
    count: 2,
  };

  const mockFrom = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockDebugError = vi.fn();

  return {
    AUTH_STATE,
    PROFILE_ROW,
    selectResult,
    deleteResult,
    mockFrom,
    mockToastSuccess,
    mockToastError,
    mockDebugError,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('./usePersonalTodos', () => ({
  personalTodoKeys: {
    all: ['personal-todos'],
  },
}));

vi.mock('./useUnifiedTodos', () => ({
  unifiedTodoKeys: {
    all: ['unified-todos'],
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
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
      single: vi.fn(() => Promise.resolve(selectResult)),
      maybeSingle: vi.fn(() => Promise.resolve(selectResult)),
      then: (
        onFulfilled?: (value: { data: null; error: { message: string } | null; count: number | null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(deleteResult).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(deleteResult).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

function createWrapper() {
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

describe('useClearDoneTodos', () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
    selectResult.data = PROFILE_ROW;
    selectResult.error = null;
    deleteResult.data = null;
    deleteResult.error = null;
    deleteResult.count = 2;
    mockFrom.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    mockDebugError.mockClear();
  });

  it('supprime les todos terminés du profil courant, retourne le count et invalide les bonnes clés', async () => {
    const { result } = renderHook(() => useClearDoneTodos(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(2);
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'profiles');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'personal_todos');

    const profileBuilder = mockFrom.mock.results[0]?.value as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };

    expect(profileBuilder.select).toHaveBeenCalledWith('id');
    expect(profileBuilder.eq).toHaveBeenCalledTimes(1);
    expect(profileBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(profileBuilder.maybeSingle).toHaveBeenCalledTimes(1);

    const deleteBuilder = mockFrom.mock.results[1]?.value as {
      delete: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };

    expect(deleteBuilder.delete).toHaveBeenCalledTimes(1);
    expect(deleteBuilder.eq).toHaveBeenCalledTimes(2);
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'profile-1');
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(2, 'is_done', true);

    expect(mockToastSuccess).toHaveBeenCalledWith('2 tâches terminées supprimées');
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockDebugError).not.toHaveBeenCalled();
  });

  it('utilise le singulier dans le toast de succès quand une seule tâche est supprimée', async () => {
    deleteResult.count = 1;

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper({ children: null }).props.client, 'invalidateQueries');

    const { result } = renderHook(() => useClearDoneTodos(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('1 tâche terminée supprimée');
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ['personal-todos'] });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ['unified-todos'] });
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: ['todos-unread-count'] });
  });

  it("passe en erreur si la suppression renvoie une erreur et affiche le toast d'erreur", async () => {
    deleteResult.error = { message: 'x' };
    deleteResult.count = null;

    const { result } = renderHook(() => useClearDoneTodos(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la suppression');
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith('Error clearing done todos:', { message: 'x' });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('passe en erreur si aucun profil utilisateur n’est trouvé', async () => {
    selectResult.data = null;

    const { result } = renderHook(() => useClearDoneTodos(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('Profile not found');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Profile not found');
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la suppression');
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});