/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useThreadFolders, useFolderThreads, useThreadFolderMutations } from './useThreadFolders'

const {
  AUTH_STATE,
  TOAST_SUCCESS,
  TOAST_ERROR,
  mockFrom,
  mockInvalidateQueries,
  SELECT_THREAD_FOLDERS_ROWS,
  SELECT_FOLDER_THREADS_ROWS,
  SELECT_CURRENT_FOLDERS_ROWS,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  TOAST_SUCCESS: vi.fn(),
  TOAST_ERROR: vi.fn(),
  mockFrom: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  SELECT_THREAD_FOLDERS_ROWS: [{ folder_id: 'folder-a' }, { folder_id: 'folder-b' }],
  SELECT_FOLDER_THREADS_ROWS: [
    { thread_id: 'thread-2', added_at: '2024-01-02T00:00:00.000Z' },
    { thread_id: 'thread-1', added_at: '2024-01-01T00:00:00.000Z' },
  ],
  SELECT_CURRENT_FOLDERS_ROWS: [{ folder_id: 'folder-a' }, { folder_id: 'folder-c' }],
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: TOAST_SUCCESS,
    error: TOAST_ERROR,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type SupabaseError = { message: string } | null
type SupabaseResponse = {
  data: unknown
  error: SupabaseError
}

type ThenableBuilder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: PromiseLike<SupabaseResponse>['then']
  catch: Promise<SupabaseResponse>['catch']
}

function createThenableBuilder(response: SupabaseResponse): ThenableBuilder {
  const builder = {} as ThenableBuilder

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.upsert = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(response))
  builder.maybeSingle = vi.fn(() => Promise.resolve(response))
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(response).then(onFulfilled, onRejected)
  builder.catch = (onRejected) => Promise.resolve(response).catch(onRejected)

  return builder
}

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

  const wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useThreadFolders', () => {
  it("charge les dossiers d'un thread et retourne les folder_id réels", async () => {
    const builder = createThenableBuilder({
      data: SELECT_THREAD_FOLDERS_ROWS,
      error: null,
    })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useThreadFolders('thread-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('email_thread_folders')
    expect(builder.select).toHaveBeenCalledWith('folder_id')
    expect(builder.eq).toHaveBeenCalledWith('thread_id', 'thread-1')
    expect(result.current.data).toEqual(['folder-a', 'folder-b'])
  })

  it('passe en erreur si la requête supabase échoue', async () => {
    const builder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useThreadFolders('thread-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
  })

  it('ne lance pas la requête si threadId est absent', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useThreadFolders(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useFolderThreads', () => {
  it("charge les threads d'un dossier avec tri descendant sur added_at", async () => {
    const builder = createThenableBuilder({
      data: SELECT_FOLDER_THREADS_ROWS,
      error: null,
    })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFolderThreads('folder-z'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('email_thread_folders')
    expect(builder.select).toHaveBeenCalledWith('thread_id, added_at')
    expect(builder.eq).toHaveBeenCalledWith('folder_id', 'folder-z')
    expect(builder.order).toHaveBeenCalledWith('added_at', { ascending: false })
    expect(result.current.data).toEqual([
      { thread_id: 'thread-2', added_at: '2024-01-02T00:00:00.000Z' },
      { thread_id: 'thread-1', added_at: '2024-01-01T00:00:00.000Z' },
    ])
  })

  it('passe en erreur si la récupération des threads échoue', async () => {
    const builder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFolderThreads('folder-z'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
  })
})

describe('useThreadFolderMutations', () => {
  it('addThreadsToFolder envoie un upsert avec les bonnes lignes, invalide les queries et toast succès pluriel', async () => {
    const upsertBuilder = createThenableBuilder({
      data: null,
      error: null,
    })
    mockFrom.mockReturnValue(upsertBuilder)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    queryClient.invalidateQueries = mockInvalidateQueries

    const wrapper = ({ children }: React.PropsWithChildren) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useThreadFolderMutations(), { wrapper })

    await act(async () => {
      await result.current.addThreadsToFolder.mutateAsync({
        threadIds: ['thread-1', 'thread-2'],
        folderId: 'folder-a',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('email_thread_folders')
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      [
        { thread_id: 'thread-1', folder_id: 'folder-a', user_id: 'u1' },
        { thread_id: 'thread-2', folder_id: 'folder-a', user_id: 'u1' },
      ],
      { onConflict: 'thread_id,folder_id', ignoreDuplicates: true }
    )
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-folder-counts', 'u1'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['folder-threads'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['thread-folders', 'thread-1', 'u1'],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['thread-folders', 'thread-2', 'u1'],
    })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Fils rangés dans le dossier')
  })

  it('removeThreadFromFolder supprime le lien exact puis affiche le toast attendu', async () => {
    const deleteBuilder = createThenableBuilder({
      data: null,
      error: null,
    })
    mockFrom.mockReturnValue(deleteBuilder)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    queryClient.invalidateQueries = mockInvalidateQueries

    const wrapper = ({ children }: React.PropsWithChildren) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useThreadFolderMutations(), { wrapper })

    await act(async () => {
      await result.current.removeThreadFromFolder.mutateAsync({
        threadId: 'thread-9',
        folderId: 'folder-b',
      })
    })

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'thread_id', 'thread-9')
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(2, 'folder_id', 'folder-b')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['thread-folders', 'thread-9', 'u1'],
    })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Retiré du dossier')
  })

  it('setThreadFolders ajoute et retire les bons dossiers puis invalide le thread concerné', async () => {
    const selectBuilder = createThenableBuilder({
      data: SELECT_CURRENT_FOLDERS_ROWS,
      error: null,
    })
    const upsertBuilder = createThenableBuilder({
      data: null,
      error: null,
    })
    const deleteBuilder = createThenableBuilder({
      data: null,
      error: null,
    })

    mockFrom
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(upsertBuilder)
      .mockReturnValueOnce(deleteBuilder)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    queryClient.invalidateQueries = mockInvalidateQueries

    const wrapper = ({ children }: React.PropsWithChildren) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useThreadFolderMutations(), { wrapper })

    await act(async () => {
      await result.current.setThreadFolders.mutateAsync({
        threadId: 'thread-7',
        folderIds: ['folder-a', 'folder-b'],
      })
    })

    expect(selectBuilder.select).toHaveBeenCalledWith('folder_id')
    expect(selectBuilder.eq).toHaveBeenCalledWith('thread_id', 'thread-7')
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      [{ thread_id: 'thread-7', folder_id: 'folder-b', user_id: 'u1' }],
      { onConflict: 'thread_id,folder_id', ignoreDuplicates: true }
    )
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('thread_id', 'thread-7')
    expect(deleteBuilder.in).toHaveBeenCalledWith('folder_id', ['folder-c'])
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['thread-folders', 'thread-7', 'u1'],
    })
    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Dossiers mis à jour')
  })

  it('remonte une erreur de mutation via toast.error', async () => {
    const failingBuilder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFrom.mockReturnValue(failingBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useThreadFolderMutations(), { wrapper })

    await act(async () => {
      await expect(
        result.current.addThreadsToFolder.mutateAsync({
          threadIds: ['thread-1'],
          folderId: 'folder-a',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(TOAST_ERROR).toHaveBeenCalledWith('x')
  })
})
