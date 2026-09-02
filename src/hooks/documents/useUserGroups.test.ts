// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useUserGroups,
  useGroupMembers,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAddGroupMember,
  useRemoveGroupMember,
} from './useUserGroups';

const {
  AUTH_STATE,
  GROUP_ROWS,
  MEMBER_ROWS,
  MEMBER_DETAIL_ROWS,
  insertMock,
  updateMock,
  deleteMock,
  eqMock,
  orderMock,
  selectMock,
  mockFrom,
  toastSuccess,
  toastError,
  setSupabaseResponses,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'u1@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const GROUP_ROWS = [
    {
      id: 'g1',
      name: 'Admins',
      description: 'Admin team',
      color: '#111111',
      created_by: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'g2',
      name: 'Editors',
      description: 'Editors team',
      color: '#222222',
      created_by: 'u1',
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ];

  const MEMBER_ROWS = [
    { group_id: 'g1', user_id: 'u1' },
    { group_id: 'g1', user_id: 'u2' },
    { group_id: 'g2', user_id: 'u3' },
  ];

  const MEMBER_DETAIL_ROWS = [
    {
      id: 'm1',
      group_id: 'g1',
      user_id: 'u1',
      added_by: 'u2',
      added_at: '2024-02-01',
      profile: [{ id: 'u1', nom: 'Doe', prenom: 'John', email: 'john@t.co', avatar_url: null }],
    },
    {
      id: 'm2',
      group_id: 'g1',
      user_id: 'u2',
      added_by: 'u1',
      added_at: '2024-02-02',
      profile: { id: 'u2', nom: 'Smith', prenom: 'Jane', email: 'jane@t.co', avatar_url: 'img' },
    },
  ];

  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const deleteMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const selectMock = vi.fn();
  const mockFrom = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  let responseQueue: Array<{ data: unknown; error: unknown }> = [];

  const setSupabaseResponses = (responses: Array<{ data: unknown; error: unknown }>) => {
    responseQueue = [...responses];
  };

  const consumeResponse = () => Promise.resolve(responseQueue.shift() ?? { data: null, error: null });

  const createBuilder = () => {
    const builder = {
      select: selectMock.mockImplementation(() => builder),
      eq: eqMock.mockImplementation(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: orderMock.mockImplementation(() => builder),
      limit: vi.fn(() => builder),
      insert: insertMock.mockImplementation(() => builder),
      update: updateMock.mockImplementation(() => builder),
      delete: deleteMock.mockImplementation(() => builder),
      single: vi.fn(() => consumeResponse()),
      maybeSingle: vi.fn(() => consumeResponse()),
      then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        consumeResponse().then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => consumeResponse().catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    AUTH_STATE,
    GROUP_ROWS,
    MEMBER_ROWS,
    MEMBER_DETAIL_ROWS,
    insertMock,
    updateMock,
    deleteMock,
    eqMock,
    orderMock,
    selectMock,
    mockFrom,
    toastSuccess,
    toastError,
    setSupabaseResponses,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
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

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
}

describe('useUserGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseResponses([]);
  });

  it('charge les groupes puis calcule le nombre de membres', async () => {
    setSupabaseResponses([
      { data: GROUP_ROWS, error: null },
      { data: MEMBER_ROWS, error: null },
    ]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUserGroups(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'user_groups');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'user_group_members');
    expect(orderMock).toHaveBeenCalledWith('name');
    expect(result.current.data).toEqual([
      {
        ...GROUP_ROWS[0],
        members: [],
        member_count: 2,
      },
      {
        ...GROUP_ROWS[1],
        members: [],
        member_count: 1,
      },
    ]);
  });

  it('passe en erreur si la requête groupes échoue', async () => {
    setSupabaseResponses([{ data: null, error: { message: 'groups failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUserGroups(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({ message: 'groups failed' });
    expect(mockFrom).toHaveBeenCalledWith('user_groups');
  });

  it('passe en erreur si la requête membres échoue', async () => {
    setSupabaseResponses([
      { data: GROUP_ROWS, error: null },
      { data: null, error: { message: 'members failed' } },
    ]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUserGroups(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({ message: 'members failed' });
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'user_group_members');
  });
});

describe('useGroupMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseResponses([]);
  });

  it('ne lance pas la requête si groupId est null', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroupMembers(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('charge les membres du groupe et normalise profile', async () => {
    setSupabaseResponses([{ data: MEMBER_DETAIL_ROWS, error: null }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroupMembers('g1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('user_group_members');
    expect(eqMock).toHaveBeenCalledWith('group_id', 'g1');
    expect(result.current.data).toEqual([
      {
        ...MEMBER_DETAIL_ROWS[0],
        profile: MEMBER_DETAIL_ROWS[0].profile[0],
      },
      {
        ...MEMBER_DETAIL_ROWS[1],
        profile: MEMBER_DETAIL_ROWS[1].profile,
      },
    ]);
  });

  it('passe en erreur si la requête membres échoue', async () => {
    setSupabaseResponses([{ data: null, error: { message: 'members failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroupMembers('g1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual({ message: 'members failed' });
    expect(eqMock).toHaveBeenCalledWith('group_id', 'g1');
  });
});

describe('mutations de groupes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseResponses([]);
  });

  it('crée un groupe avec les valeurs attendues puis invalide et toast success', async () => {
    setSupabaseResponses([{ data: [], error: null }]);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'New group',
        description: 'Desc',
        color: '#abcdef',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('user_groups');
    expect(insertMock).toHaveBeenCalledWith({
      name: 'New group',
      description: 'Desc',
      color: '#abcdef',
      created_by: 'u1',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] });
    expect(toastSuccess).toHaveBeenCalledWith('Groupe créé');
  });

  it('utilise les valeurs par défaut lors de la création', async () => {
    setSupabaseResponses([{ data: [], error: null }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Default group' });
    });

    expect(insertMock).toHaveBeenCalledWith({
      name: 'Default group',
      description: null,
      color: '#6366f1',
      created_by: 'u1',
    });
  });

  it('remonte une erreur de création et affiche le toast erreur', async () => {
    setSupabaseResponses([{ data: null, error: { message: 'create failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateGroup(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ name: 'Broken' })).rejects.toEqual({ message: 'create failed' });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création du groupe');
  });

  it('met à jour un groupe avec le bon id et les bonnes données', async () => {
    setSupabaseResponses([{ data: [], error: null }]);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'g1',
        name: 'Updated',
        description: 'Updated desc',
        color: '#123456',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('user_groups');
    expect(updateMock).toHaveBeenCalledWith({
      name: 'Updated',
      description: 'Updated desc',
      color: '#123456',
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'g1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] });
    expect(toastSuccess).toHaveBeenCalledWith('Groupe modifié');
  });

  it('remonte une erreur de mise à jour et affiche le toast erreur', async () => {
    setSupabaseResponses([{ data: null, error: { message: 'update failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateGroup(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'g1', name: 'Nope' })).rejects.toEqual({
        message: 'update failed',
      });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur lors de la modification');
  });

  it('supprime un groupe avec le bon id puis invalide et toast success', async () => {
    setSupabaseResponses([{ data: [], error: null }]);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('g2');
    });

    expect(mockFrom).toHaveBeenCalledWith('user_groups');
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', 'g2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] });
    expect(toastSuccess).toHaveBeenCalledWith('Groupe supprimé');
  });

  it('remonte une erreur de suppression et affiche le toast erreur', async () => {
    setSupabaseResponses([{ data: null, error: { message: 'delete failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteGroup(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('g2')).rejects.toEqual({ message: 'delete failed' });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression');
  });
});

describe('mutations de membres', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseResponses([]);
  });

  it('ajoute un membre avec les valeurs attendues puis invalide les bonnes clés', async () => {
    setSupabaseResponses([{ data: [], error: null }]);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddGroupMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ groupId: 'g1', userId: 'u2' });
    });

    expect(mockFrom).toHaveBeenCalledWith('user_group_members');
    expect(insertMock).toHaveBeenCalledWith({
      group_id: 'g1',
      user_id: 'u2',
      added_by: 'u1',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-group-members', 'g1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] });
    expect(toastSuccess).toHaveBeenCalledWith('Membre ajouté');
  });

  it("remonte une erreur d'ajout et affiche le toast erreur", async () => {
    setSupabaseResponses([{ data: null, error: { message: 'add failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddGroupMember(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ groupId: 'g1', userId: 'u2' })).rejects.toEqual({
        message: 'add failed',
      });
    });

    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'ajout du membre");
  });

  it('retire un membre avec le bon id puis invalide les bonnes clés', async () => {
    setSupabaseResponses([{ data: [], error: null }]);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRemoveGroupMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ memberId: 'm1', groupId: 'g1' });
    });

    expect(mockFrom).toHaveBeenCalledWith('user_group_members');
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', 'm1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-group-members', 'g1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] });
    expect(toastSuccess).toHaveBeenCalledWith('Membre retiré');
  });

  it('remonte une erreur de retrait et affiche le toast erreur', async () => {
    setSupabaseResponses([{ data: null, error: { message: 'remove failed' } }]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveGroupMember(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ memberId: 'm1', groupId: 'g1' })).rejects.toEqual({
        message: 'remove failed',
      });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur lors du retrait');
  });
});