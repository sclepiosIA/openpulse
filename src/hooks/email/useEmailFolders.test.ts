import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => {
  type SupabaseError = { message: string }

  type Folder = {
    id: string
    user_id: string
    name: string
    color: string
    icon: string | null
    parent_id: string | null
    position: number
    created_at: string
    updated_at: string
  }

  type CountRow = {
    folder_id: string
    thread_count: number
  }

  type QueryResponse<T> = {
    data: T | null
    error: SupabaseError | null
  }

  type ChainMethod = (...args: unknown[]) => Builder

  type Builder = {
    select: ChainMethod
    eq: ChainMethod
    gte: ChainMethod
    lte: ChainMethod
    in: ChainMethod
    order: ChainMethod
    limit: ChainMethod
    insert: ChainMethod
    update: ChainMethod
    delete: ChainMethod
    upsert: ChainMethod
    maybeSingle: () => Promise<QueryResponse<unknown>>
    single: () => Promise<QueryResponse<unknown>>
    then: Promise<QueryResponse<unknown>>['then']
    catch: Promise<QueryResponse<unknown>>['catch']
  }

  type Channel = {
    name: string
    on: (...args: unknown[]) => Channel
    subscribe: () => Channel
  }

  const USER = { id: 'u1', email: 't@t.co' }
  const AUTH = {
    user: USER,
    session: { user: USER },
    isLoading: false,
  }

  const FOLDERS: Folder[] = [
    {
      id: 'f1',
      user_id: 'u1',
      name: 'Inbox',
      color: '#0ea',
      icon: 'mail',
      parent_id: null,
      position: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'f2',
      user_id: 'u1',
      name: 'Later',
      color: '#f59',
      icon: null,
      parent_id: 'f1',
      position: 2,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-04T00:00:00Z',
    },
  ]

  const COUNTS: CountRow[] = [
    { folder_id: 'f1', thread_count: 3 },
    { folder_id: 'f2', thread_count: 0 },
  ]

  const CREATED: Folder = {
    id: 'f3',
    user_id: 'u1',
    name: 'Work',
    color: '#38b',
    icon: 'brief',
    parent_id: null,
    position: 3,
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  }

  const UPDATED: Folder = {
    id: 'f1',
    user_id: 'u1',
    name: 'New',
    color: '#0ea',
    icon: 'mail',
    parent_id: null,
    position: 4,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-06T00:00:00Z',
  }

  const ERROR: SupabaseError = { message: 'x' }

  const state: {
    foldersResponse: QueryResponse<Folder[]>
    countsResponse: QueryResponse<CountRow[]>
    singleResponse: QueryResponse<Folder>
    deleteResponse: QueryResponse<null>
  } = {
    foldersResponse: { data: FOLDERS, error: null },
    countsResponse: { data: COUNTS, error: null },
    singleResponse: { data: CREATED, error: null },
    deleteResponse: { data: null, error: null },
  }

  const mockSelect = vi.fn()
  const mockEq = vi.fn()
  const mockGte = vi.fn()
  const mockLte = vi.fn()
  const mockIn = vi.fn()
  const mockOrder = vi.fn()
  const mockLimit = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockUpsert = vi.fn()
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockOn = vi.fn()
  const mockSubscribe = vi.fn()
  const mockRemoveChannel = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockUseAuth = vi.fn(() => AUTH)

  const createBuilder = (table: string): Builder => {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
    const builder: Partial<Builder> = {}

    const chain = (mock: (...args: unknown[]) => void): ChainMethod => {
      return (...args: unknown[]) => {
        mock(...args)
        return builder as Builder
      }
    }

    builder.select = chain(mockSelect)
    builder.eq = chain(mockEq)
    builder.gte = chain(mockGte)
    builder.lte = chain(mockLte)
    builder.in = chain(mockIn)
    builder.order = chain(mockOrder)
    builder.limit = chain(mockLimit)
    builder.upsert = (...args: unknown[]) => {
      operation = 'insert'
      mockUpsert(...args)
      return builder as Builder
    }
    builder.insert = (...args: unknown[]) => {
      operation = 'insert'
      mockInsert(...args)
      return builder as Builder
    }
    builder.update = (...args: unknown[]) => {
      operation = 'update'
      mockUpdate(...args)
      return builder as Builder
    }
    builder.delete = (...args: unknown[]) => {
      operation = 'delete'
      mockDelete(...args)
      return builder as Builder
    }

    const resolveResponse = (): QueryResponse<unknown> => {
      if (table === 'email_folders' && operation === 'select') return state.foldersResponse
      if (operation === 'delete') return state.deleteResponse
      return state.singleResponse
    }

    builder.single = () => {
      mockSingle()
      return Promise.resolve(state.singleResponse)
    }
    builder.maybeSingle = () => {
      mockMaybeSingle()
      return Promise.resolve(state.singleResponse)
    }
    builder.then = (onfulfilled, onrejected) => {
      return Promise.resolve(resolveResponse()).then(onfulfilled, onrejected)
    }
    builder.catch = (onrejected) => {
      return Promise.resolve(resolveResponse()).catch(onrejected)
    }

    return builder as Builder
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table))
  const mockRpc = vi.fn((_functionName: string) => Promise.resolve(state.countsResponse))

  const mockChannel = vi.fn((name: string) => {
    const channel: Partial<Channel> = { name }
    channel.on = (...args: unknown[]) => {
      mockOn(...args)
      return channel as Channel
    }
    channel.subscribe = () => {
      mockSubscribe()
      return channel as Channel
    }
    return channel as Channel
  })

  return {
    AUTH,
    COUNTS,
    CREATED,
    ERROR,
    FOLDERS,
    UPDATED,
    mockChannel,
    mockDelete,
    mockEq,
    mockFrom,
    mockGte,
    mockIn,
    mockInsert,
    mockLimit,
    mockLte,
    mockMaybeSingle,
    mockOn,
    mockOrder,
    mockRemoveChannel,
    mockRpc,
    mockSelect,
    mockSingle,
    mockSubscribe,
    mockToastError,
    mockToastSuccess,
    mockUpdate,
    mockUpsert,
    mockUseAuth,
    state,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: h.mockFrom,
    rpc: h.mockRpc,
    channel: h.mockChannel,
    removeChannel: h.mockRemoveChannel,
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: h.mockUseAuth,
}))

vi.mock('sonner', () => ({
  toast: {
    success: h.mockToastSuccess,
    error: h.mockToastError,
  },
}))

import { useEmailFolders } from './useEmailFolders'

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'r') })

  h.state.foldersResponse = { data: h.FOLDERS, error: null }
  h.state.countsResponse = { data: h.COUNTS, error: null }
  h.state.singleResponse = { data: h.CREATED, error: null }
  h.state.deleteResponse = { data: null, error: null }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useEmailFolders', () => {
  it('expose un état de chargement initial', async () => {
    const { result } = renderHook(() => useEmailFolders(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.folders).toEqual([])
    expect(result.current.counts).toEqual({})

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('charge les dossiers et les compteurs de messages', async () => {
    const { result, unmount } = renderHook(() => useEmailFolders(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isError).toBe(false)
    expect(result.current.folders).toEqual(h.FOLDERS)
    expect(result.current.folders[0]?.name).toBe('Inbox')
    expect(result.current.folders[1]?.parent_id).toBe('f1')
    expect(result.current.counts).toEqual({ f1: 3, f2: 0 })

    expect(h.mockUseAuth).toHaveBeenCalled()
    expect(h.mockFrom).toHaveBeenCalledWith('email_folders')
    expect(h.mockRpc).toHaveBeenCalledWith('get_email_folder_counts')
    expect(h.mockOrder).toHaveBeenCalledWith('position', { ascending: true })
    expect(h.mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(h.mockChannel).toHaveBeenCalledWith('email-folders-u1-r')
    expect(h.mockChannel).toHaveBeenCalledWith('email-thread-folders-u1-r')

    unmount()

    expect(h.mockRemoveChannel).toHaveBeenCalledTimes(2)
  })

  it('passe isError à true quand la requête des dossiers échoue', async () => {
    h.state.foldersResponse = { data: null, error: h.ERROR }

    const { result } = renderHook(() => useEmailFolders(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.folders).toEqual([])
    expect(result.current.counts).toEqual({ f1: 3, f2: 0 })
  })

  it('crée un dossier avec un nom trimé et affiche le toast de succès', async () => {
    const { result } = renderHook(() => useEmailFolders(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(2)
    })

    await act(async () => {
      await result.current.createFolder.mutateAsync({
        name: ' Work ',
        color: '#38b',
        icon: 'brief',
      })
    })

    expect(h.mockInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      name: 'Work',
      color: '#38b',
      icon: 'brief',
      parent_id: null,
    })
    expect(h.mockSingle).toHaveBeenCalled()
    expect(h.mockToastSuccess).toHaveBeenCalledWith('Dossier créé')
    expect(h.mockToastError).not.toHaveBeenCalled()
  })

  it("met à jour un dossier en envoyant uniquement le patch sans l'id", async () => {
    h.state.singleResponse = { data: h.UPDATED, error: null }

    const { result } = renderHook(() => useEmailFolders(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(2)
    })

    await act(async () => {
      await result.current.updateFolder.mutateAsync({
        id: 'f1',
        name: 'New',
        position: 4,
      })
    })

    expect(h.mockUpdate).toHaveBeenCalledWith({
      name: 'New',
      position: 4,
    })
    expect(h.mockEq).toHaveBeenCalledWith('id', 'f1')
    expect(h.mockToastSuccess).toHaveBeenCalledWith('Dossier mis à jour')
  })

  it('supprime un dossier et invalide les compteurs via le succès de mutation', async () => {
    const { result } = renderHook(() => useEmailFolders(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(2)
    })

    await act(async () => {
      await result.current.deleteFolder.mutateAsync('f2')
    })

    expect(h.mockDelete).toHaveBeenCalledTimes(1)
    expect(h.mockEq).toHaveBeenCalledWith('id', 'f2')
    expect(h.mockToastSuccess).toHaveBeenCalledWith('Dossier supprimé')
    expect(h.mockToastError).not.toHaveBeenCalled()
  })
})
