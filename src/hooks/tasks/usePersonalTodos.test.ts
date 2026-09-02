/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  usePersonalTodos,
  useCreatePersonalTodo,
  useUpdatePersonalTodo,
  useTogglePersonalTodo,
  useDeletePersonalTodo,
  personalTodoKeys,
} from './usePersonalTodos'

const {
  SESSION,
  PROFILE,
  TODOS,
  CREATED_TODO,
  UPDATED_TODO,
  TOGGLED_DONE_TODO,
  TOGGLED_UNDONE_TODO,
  mockFrom,
  mockGetSession,
  mockUseCurrentProfile,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => ({
  SESSION: { user: { id: 'user-1', email: 't@t.co' } },
  PROFILE: { id: 'profile-1' },
  TODOS: [
    {
      id: 'todo-1',
      user_id: 'profile-1',
      project_id: 'project-1',
      etablissement_id: 'eta-1',
      title: 'Acheter du lait',
      description: 'Bio',
      is_done: false,
      done_at: null,
      done_by: null,
      priority: 'high' as const,
      due_date: '2025-01-10',
      due_time: '09:00',
      reminder_at: null,
      position: 0,
      labels: ['courses'],
      created_at: '2025-01-01T10:00:00.000Z',
      updated_at: '2025-01-01T10:00:00.000Z',
      etablissement: { id: 'eta-1', nom: 'Clinique' },
      project: { id: 'project-1', name: 'Maison', color: '#fff' },
    },
    {
      id: 'todo-2',
      user_id: 'profile-1',
      project_id: null,
      etablissement_id: null,
      title: 'Appeler',
      description: null,
      is_done: true,
      done_at: '2025-01-02T11:00:00.000Z',
      done_by: 'profile-1',
      priority: 'medium' as const,
      due_date: null,
      due_time: null,
      reminder_at: null,
      position: 1,
      labels: [],
      created_at: '2025-01-02T10:00:00.000Z',
      updated_at: '2025-01-02T11:00:00.000Z',
      etablissement: null,
      project: null,
    },
  ],
  CREATED_TODO: {
    id: 'todo-3',
    user_id: 'profile-1',
    title: 'Nouvelle todo',
    description: null,
    project_id: null,
    etablissement_id: null,
    priority: 'medium' as const,
    due_date: null,
    due_time: null,
    labels: [],
    position: 3,
    assigned_to: null,
    rd_user_story_id: null,
    support_ticket_id: null,
    visibility: 'personal' as const,
  },
  UPDATED_TODO: {
    id: 'todo-1',
    title: 'Titre modifié',
    is_done: false,
    priority: 'urgent' as const,
  },
  TOGGLED_DONE_TODO: {
    id: 'todo-1',
    is_done: true,
    done_at: '2025-01-03T12:00:00.000Z',
    done_by: 'profile-1',
  },
  TOGGLED_UNDONE_TODO: {
    id: 'todo-1',
    is_done: false,
    done_at: null,
    done_by: null,
  },
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockUseCurrentProfile: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/hooks/tasks/useUnifiedTodos', () => ({
  unifiedTodoKeys: {
    all: ['unified-todos'],
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
    },
  },
}))

type BuilderResult = {
  data: unknown
  error: { message: string } | null
}

function createBuilder(result: BuilderResult) {
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled: (value: BuilderResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }
  return builder
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children)
  }
}

describe('usePersonalTodos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentProfile.mockReturnValue({ data: PROFILE, isLoading: false })
    mockGetSession.mockResolvedValue({ data: { session: SESSION } })
  })

  it('charge puis retourne les todos avec filtres appliqués', async () => {
    const builder = createBuilder({ data: TODOS, error: null })
    mockFrom.mockReturnValue(builder)

    const client = createClient()

    const { result } = renderHook(() => usePersonalTodos({ projectId: 'project-1', done: false }), {
      wrapper: createWrapper(client),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('personal_todos')
    expect(builder.select).toHaveBeenCalled()
    expect(builder.order).toHaveBeenNthCalledWith(1, 'position', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'project_id', 'project-1')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'is_done', false)
    expect(result.current.data).toEqual(TODOS)
    expect(result.current.data?.[0].title).toBe('Acheter du lait')
    expect(result.current.data?.[0].project?.name).toBe('Maison')
    expect(result.current.data?.[1].is_done).toBe(true)
  })

  it('passe en erreur si la requête supabase échoue', async () => {
    const error = { message: 'x' }
    const builder = createBuilder({ data: null, error })
    mockFrom.mockReturnValue(builder)

    const client = createClient()

    const { result } = renderHook(() => usePersonalTodos(), {
      wrapper: createWrapper(client),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(error)
    expect(debugError).toHaveBeenCalledWith('Error fetching personal todos:', error)
  })
})

describe('useCreatePersonalTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentProfile.mockReturnValue({ data: PROFILE, isLoading: false })
    mockGetSession.mockResolvedValue({ data: { session: SESSION } })
  })

  it('crée une todo, calcule la position et invalide les caches', async () => {
    const profilesBuilder = createBuilder({ data: { id: 'profile-1' }, error: null })
    const maxPosBuilder = createBuilder({ data: { position: 2 }, error: null })
    const insertBuilder = createBuilder({ data: CREATED_TODO, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder
      if (table === 'personal_todos') {
        if (mockFrom.mock.calls.filter(([t]) => t === 'personal_todos').length === 1) return maxPosBuilder
        return insertBuilder
      }
      return createBuilder({ data: null, error: null })
    })

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useCreatePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Nouvelle todo',
      })
    })

    expect(mockGetSession).toHaveBeenCalled()
    expect(profilesBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(maxPosBuilder.eq).toHaveBeenCalledWith('user_id', 'profile-1')
    expect(maxPosBuilder.order).toHaveBeenCalledWith('position', { ascending: false })
    expect(maxPosBuilder.limit).toHaveBeenCalledWith(1)
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'profile-1',
      title: 'Nouvelle todo',
      description: null,
      project_id: null,
      etablissement_id: null,
      priority: 'medium',
      due_date: null,
      due_time: null,
      labels: [],
      position: 3,
      assigned_to: null,
      rd_user_story_id: null,
      support_ticket_id: null,
      visibility: 'personal',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: personalTodoKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unified-todos'] })
    expect(toastSuccess).toHaveBeenCalledWith('Todo créée')
  })

  it('passe en erreur si la création échoue', async () => {
    const profilesBuilder = createBuilder({ data: { id: 'profile-1' }, error: null })
    const maxPosBuilder = createBuilder({ data: { position: 0 }, error: null })
    const error = { message: 'x' }
    const insertBuilder = createBuilder({ data: null, error })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder
      if (table === 'personal_todos') {
        if (mockFrom.mock.calls.filter(([t]) => t === 'personal_todos').length === 1) return maxPosBuilder
        return insertBuilder
      }
      return createBuilder({ data: null, error: null })
    })

    const client = createClient()

    const { result } = renderHook(() => useCreatePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ title: 'Nouvelle todo' })).rejects.toEqual(error)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(debugError).toHaveBeenCalledWith('Error creating todo:', error)
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création')
  })
})

describe('useUpdatePersonalTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentProfile.mockReturnValue({ data: PROFILE, isLoading: false })
    mockGetSession.mockResolvedValue({ data: { session: SESSION } })
  })

  it('met à jour une todo et renseigne done_at/done_by quand is_done=true', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-03T12:00:00.000Z'))

    const profilesBuilder = createBuilder({ data: { id: 'profile-1' }, error: null })
    const updateBuilder = createBuilder({ data: UPDATED_TODO, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder
      if (table === 'personal_todos') return updateBuilder
      return createBuilder({ data: null, error: null })
    })

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useUpdatePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'todo-1',
        title: 'Titre modifié',
        priority: 'urgent',
        is_done: true,
      })
    })

    expect(updateBuilder.update).toHaveBeenCalledWith({
      title: 'Titre modifié',
      priority: 'urgent',
      is_done: true,
      done_at: '2025-01-03T12:00:00.000Z',
      done_by: 'profile-1',
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'todo-1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: personalTodoKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unified-todos'] })

    vi.useRealTimers()
  })

  it('passe en erreur si la mise à jour échoue', async () => {
    const error = { message: 'x' }
    const updateBuilder = createBuilder({ data: null, error })
    mockFrom.mockReturnValue(updateBuilder)

    const client = createClient()

    const { result } = renderHook(() => useUpdatePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'todo-1', title: 'oops' })).rejects.toEqual(error)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(debugError).toHaveBeenCalledWith('Error updating todo:', error)
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la mise à jour')
  })
})

describe('useTogglePersonalTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentProfile.mockReturnValue({ data: PROFILE, isLoading: false })
    mockGetSession.mockResolvedValue({ data: { session: SESSION } })
  })

  it('toggle une todo à done=true et affiche un toast de succès', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-03T12:00:00.000Z'))

    const profilesBuilder = createBuilder({ data: { id: 'profile-1' }, error: null })
    const updateBuilder = createBuilder({ data: TOGGLED_DONE_TODO, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesBuilder
      if (table === 'personal_todos') return updateBuilder
      return createBuilder({ data: null, error: null })
    })

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useTogglePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: 'todo-1', is_done: true })
    })

    expect(updateBuilder.update).toHaveBeenCalledWith({
      is_done: true,
      done_at: '2025-01-03T12:00:00.000Z',
      done_by: 'profile-1',
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'todo-1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: personalTodoKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unified-todos'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todos-unread-count'] })
    expect(toastSuccess).toHaveBeenCalledWith('Todo terminée')

    vi.useRealTimers()
  })

  it('toggle une todo à done=false sans profil lookup et sans toast de succès', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-03T12:00:00.000Z'))

    const updateBuilder = createBuilder({ data: TOGGLED_UNDONE_TODO, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'personal_todos') return updateBuilder
      return createBuilder({ data: null, error: null })
    })

    const client = createClient()

    const { result } = renderHook(() => useTogglePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: 'todo-1', is_done: false })
    })

    expect(mockGetSession).not.toHaveBeenCalled()
    expect(updateBuilder.update).toHaveBeenCalledWith({
      is_done: false,
      done_at: null,
      done_by: null,
    })
    expect(toastSuccess).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('passe en erreur si le toggle échoue', async () => {
    const error = { message: 'x' }
    const updateBuilder = createBuilder({ data: null, error })
    mockFrom.mockReturnValue(updateBuilder)

    const client = createClient()

    const { result } = renderHook(() => useTogglePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'todo-1', is_done: false })).rejects.toEqual(error)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(debugError).toHaveBeenCalledWith('Error toggling todo:', error)
    expect(toastError).toHaveBeenCalledWith('Erreur')
  })
})

describe('useDeletePersonalTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentProfile.mockReturnValue({ data: PROFILE, isLoading: false })
    mockGetSession.mockResolvedValue({ data: { session: SESSION } })
  })

  it('supprime une todo et invalide les caches', async () => {
    const deleteBuilder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(deleteBuilder)

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useDeletePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync('todo-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('personal_todos')
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'todo-1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: personalTodoKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unified-todos'] })
    expect(toastSuccess).toHaveBeenCalledWith('Todo supprimée')
  })

  it('passe en erreur si la suppression échoue', async () => {
    const error = { message: 'x' }
    const deleteBuilder = createBuilder({ data: null, error })
    mockFrom.mockReturnValue(deleteBuilder)

    const client = createClient()

    const { result } = renderHook(() => useDeletePersonalTodo(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(result.current.mutateAsync('todo-1')).rejects.toEqual(error)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(debugError).toHaveBeenCalledWith('Error deleting todo:', error)
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression')
  })
})