/* @vitest-environment jsdom */

import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useTodoProjects,
  useTodoProject,
  useCreateTodoProject,
  useUpdateTodoProject,
  useDeleteTodoProject,
  useAddProjectMember,
  useRemoveProjectMember,
  todoProjectKeys,
} from './useTodoProjects';

const {
  PROFILE,
  PROJECT_ROWS,
  PROJECT_DETAIL,
  CREATED_PROJECT,
  UPDATED_PROJECT,
  TARGET_USER,
  ADDED_MEMBER,
  mockFrom,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
  debugError,
} = vi.hoisted(() => ({
  PROFILE: { id: 'user-1' },
  PROJECT_ROWS: [
    {
      id: 'p1',
      owner_id: 'user-1',
      name: 'Inbox',
      description: null,
      color: null,
      icon: null,
      is_shared: null,
      position: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'p2',
      owner_id: 'user-1',
      name: 'Work',
      description: 'Tasks',
      color: '#123456',
      icon: 'briefcase',
      is_shared: true,
      position: 3,
      created_at: '2024-02-01',
      updated_at: '2024-02-02',
    },
  ],
  PROJECT_DETAIL: {
    id: 'p1',
    owner_id: 'user-1',
    name: 'Inbox',
    description: null,
    color: null,
    icon: null,
    is_shared: null,
    position: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
  },
  CREATED_PROJECT: {
    id: 'p3',
    owner_id: 'user-1',
    name: 'New Project',
    description: null,
    color: '#6366f1',
    icon: 'folder',
    is_shared: false,
    position: 4,
    created_at: '2024-03-01',
    updated_at: '2024-03-01',
  },
  UPDATED_PROJECT: {
    id: 'p1',
    owner_id: 'user-1',
    name: 'Inbox Updated',
    description: 'Updated desc',
    color: '#abcdef',
    icon: 'star',
    is_shared: true,
    position: 7,
    created_at: '2024-01-01',
    updated_at: '2024-03-02',
  },
  TARGET_USER: { id: 'user-2' },
  ADDED_MEMBER: {
    id: 'm1',
    project_id: 'p1',
    user_id: 'user-2',
    role: 'admin',
    added_by: 'user-1',
  },
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  sanitizeSupabaseError: vi.fn((error: Error) => `sanitized:${error.message}`),
  debugError: vi.fn(),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: PROFILE }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueueResult = { data?: unknown; error?: unknown };

function createThenableBuilder(results: QueueResult[]) {
  let queue = [...results];

  const resolveNext = () => Promise.resolve(queue.shift() ?? { data: null, error: null });

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
    single: vi.fn(() => resolveNext()),
    maybeSingle: vi.fn(() => resolveNext()),
    then: (onFulfilled?: (value: QueueResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      resolveNext().then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => resolveNext().catch(onRejected),
  };

  return builder;
}

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  return {
    queryClient,
    wrapper: ({ children }: PropsWithChildren) => React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('todoProjectKeys', () => {
  it('returns stable query keys shapes', () => {
    expect(todoProjectKeys.all).toEqual(['todo-projects']);
    expect(todoProjectKeys.list()).toEqual(['todo-projects', 'list']);
    expect(todoProjectKeys.detail('p1')).toEqual(['todo-projects', 'detail', 'p1']);
  });
});

describe('useTodoProjects', () => {
  it('loads projects and applies fallback business values', async () => {
    const builder = createThenableBuilder([{ data: PROJECT_ROWS, error: null }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodoProjects(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('todo_projects');
    expect(builder.select).toHaveBeenCalledWith('id, owner_id, name, description, color, icon, is_shared, position, created_at, updated_at');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'position', { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(500);

    expect(result.current.data).toEqual([
      {
        id: 'p1',
        owner_id: 'user-1',
        name: 'Inbox',
        description: null,
        color: '#6366f1',
        icon: 'folder',
        is_shared: false,
        position: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
      {
        id: 'p2',
        owner_id: 'user-1',
        name: 'Work',
        description: 'Tasks',
        color: '#123456',
        icon: 'briefcase',
        is_shared: true,
        position: 3,
        created_at: '2024-02-01',
        updated_at: '2024-02-02',
      },
    ]);
  });

  it('goes to error state when fetch fails', async () => {
    const error = { message: 'x' };
    const builder = createThenableBuilder([{ data: null, error }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodoProjects(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
    expect(debugError).toHaveBeenCalledWith('Error fetching todo projects:', error);
  });
});

describe('useTodoProject', () => {
  it('loads a single project with fallback values', async () => {
    const builder = createThenableBuilder([{ data: PROJECT_DETAIL, error: null }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodoProject('p1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('todo_projects');
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1');

    expect(result.current.data).toEqual({
      id: 'p1',
      owner_id: 'user-1',
      name: 'Inbox',
      description: null,
      color: '#6366f1',
      icon: 'folder',
      is_shared: false,
      position: 0,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    });
  });

  it('goes to error state when detail fetch fails', async () => {
    const error = { message: 'x' };
    const builder = createThenableBuilder([{ data: null, error }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodoProject('p1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
    expect(debugError).toHaveBeenCalledWith('Error fetching todo project:', error);
  });
});

describe('useCreateTodoProject', () => {
  it('creates a project with computed position and invalidates queries', async () => {
    const builder = createThenableBuilder([
      { data: { position: 3 }, error: null },
      { data: CREATED_PROJECT, error: null },
    ]);
    mockFrom.mockReturnValue(builder);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTodoProject(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'New Project' });
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'todo_projects');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'todo_projects');
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'user-1');
    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'user-1',
      name: 'New Project',
      description: null,
      color: '#6366f1',
      icon: 'folder',
      is_shared: false,
      position: 4,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.all });
    expect(toastSuccess).toHaveBeenCalledWith('Projet créé');
  });

  it('sets error state when creation fails', async () => {
    const error = { message: 'x' };
    const builder = createThenableBuilder([
      { data: { position: 0 }, error: null },
      { data: null, error },
    ]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTodoProject(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ name: 'Broken' })).rejects.toEqual(error);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalledWith('Error creating project:', error);
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création');
  });
});

describe('useUpdateTodoProject', () => {
  it('updates only provided fields', async () => {
    const builder = createThenableBuilder([{ data: UPDATED_PROJECT, error: null }]);
    mockFrom.mockReturnValue(builder);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateTodoProject(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'p1',
        name: 'Inbox Updated',
        description: 'Updated desc',
        color: '#abcdef',
        icon: 'star',
        is_shared: true,
        position: 7,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('todo_projects');
    expect(builder.update).toHaveBeenCalledWith({
      name: 'Inbox Updated',
      description: 'Updated desc',
      color: '#abcdef',
      icon: 'star',
      is_shared: true,
      position: 7,
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.all });
  });

  it('sets error state when update fails', async () => {
    const error = { message: 'x' };
    const builder = createThenableBuilder([{ data: null, error }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateTodoProject(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'p1', name: 'Nope' })).rejects.toEqual(error);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalledWith('Error updating project:', error);
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la mise à jour');
  });
});

describe('useDeleteTodoProject', () => {
  it('deletes a project and invalidates queries', async () => {
    const builder = createThenableBuilder([{ data: null, error: null }]);
    mockFrom.mockReturnValue(builder);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTodoProject(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('p1');
    });

    expect(mockFrom).toHaveBeenCalledWith('todo_projects');
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.all });
    expect(toastSuccess).toHaveBeenCalledWith('Projet supprimé');
  });

  it('sets error state when delete fails', async () => {
    const error = { message: 'x' };
    const builder = createThenableBuilder([{ data: null, error }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTodoProject(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('p1')).rejects.toEqual(error);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalledWith('Error deleting project:', error);
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression');
  });
});

describe('useAddProjectMember', () => {
  it('adds a member and invalidates detail and list queries', async () => {
    const builder = createThenableBuilder([
      { data: TARGET_USER, error: null },
      { data: ADDED_MEMBER, error: null },
    ]);
    mockFrom.mockReturnValue(builder);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddProjectMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1', email: 'member@test.dev', role: 'admin' });
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'profiles');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'todo_project_members');
    expect(builder.eq).toHaveBeenCalledWith('email', 'member@test.dev');
    expect(builder.insert).toHaveBeenCalledWith({
      project_id: 'p1',
      user_id: 'user-2',
      role: 'admin',
      added_by: 'user-1',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.detail('p1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.list() });
    expect(toastSuccess).toHaveBeenCalledWith('Membre ajouté');
  });

  it('sanitizes and shows error when add member fails', async () => {
    const error = new Error('x');
    const builder = createThenableBuilder([
      { data: TARGET_USER, error: null },
      { data: null, error },
    ]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddProjectMember(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ projectId: 'p1', email: 'member@test.dev' })).rejects.toEqual(error);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(sanitizeSupabaseError).toHaveBeenCalledWith(error);
    expect(toastError).toHaveBeenCalledWith('sanitized:x');
  });
});

describe('useRemoveProjectMember', () => {
  it('removes a member and invalidates detail and list queries', async () => {
    const builder = createThenableBuilder([{ data: null, error: null }]);
    mockFrom.mockReturnValue(builder);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRemoveProjectMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1', memberId: 'm1' });
    });

    expect(mockFrom).toHaveBeenCalledWith('todo_project_members');
    expect(builder.eq).toHaveBeenCalledWith('id', 'm1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.detail('p1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: todoProjectKeys.list() });
    expect(toastSuccess).toHaveBeenCalledWith('Membre retiré');
  });

  it('sets error state when remove member fails', async () => {
    const error = { message: 'x' };
    const builder = createThenableBuilder([{ data: null, error }]);
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveProjectMember(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ projectId: 'p1', memberId: 'm1' })).rejects.toEqual(error);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(debugError).toHaveBeenCalledWith('Error removing member:', error);
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression');
  });
});