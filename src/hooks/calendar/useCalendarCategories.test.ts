import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import {
  useCalendarCategories,
  useCreateCalendarCategory,
  useDeleteCalendarCategory,
  useUpdateCalendarCategory,
} from './useCalendarCategories'
import type { CalendarCategory } from './useCalendarCategories'

const {
  AUTH_STATE,
  ROWS,
  CREATED_ROW,
  UPDATED_ROW,
  QUERY_SUCCESS_RESPONSE,
  QUERY_ERROR_RESPONSE,
  CREATE_SUCCESS_RESPONSE,
  UPDATE_SUCCESS_RESPONSE,
  DELETE_SUCCESS_RESPONSE,
  MUTATION_ERROR,
  MUTATION_ERROR_RESPONSE,
  mockFrom,
  mockToast,
  supabaseState,
  builder,
} = vi.hoisted(() => {
  const AUTH_USER = { id: 'u1', email: 't@t.co' }
  const AUTH_STATE = {
    user: AUTH_USER,
    session: { user: AUTH_USER },
    isLoading: false,
  }

  const ROWS = [
    {
      id: 'cat-1',
      user_id: 'u1',
      name: 'Travail',
      color: '#2563eb',
      ordre: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'cat-2',
      user_id: 'u1',
      name: 'Famille',
      color: '#f97316',
      ordre: 2,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-04T00:00:00Z',
    },
  ]

  const CREATED_ROW = {
    id: 'cat-3',
    user_id: 'u1',
    name: 'Sport',
    color: '#10b981',
    ordre: 3,
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  }

  const UPDATED_ROW = {
    id: 'cat-1',
    user_id: 'u1',
    name: 'Travail',
    color: '#ef4444',
    ordre: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-06T00:00:00Z',
  }

  const QUERY_ERROR = { message: 'x' }
  const MUTATION_ERROR = { message: 'x' }

  const QUERY_SUCCESS_RESPONSE = { data: ROWS, error: null }
  const QUERY_ERROR_RESPONSE = { data: null, error: QUERY_ERROR }
  const CREATE_SUCCESS_RESPONSE = { data: CREATED_ROW, error: null }
  const UPDATE_SUCCESS_RESPONSE = { data: UPDATED_ROW, error: null }
  const DELETE_SUCCESS_RESPONSE = { data: null, error: null }
  const MUTATION_ERROR_RESPONSE = { data: null, error: MUTATION_ERROR }

  const supabaseState: { queryResponse: unknown; singleResponse: unknown } = {
    queryResponse: QUERY_SUCCESS_RESPONSE,
    singleResponse: CREATE_SUCCESS_RESPONSE,
  }

  const builder = {
    select: vi.fn((..._args: unknown[]) => undefined as unknown),
    eq: vi.fn((..._args: unknown[]) => undefined as unknown),
    gte: vi.fn((..._args: unknown[]) => undefined as unknown),
    lte: vi.fn((..._args: unknown[]) => undefined as unknown),
    in: vi.fn((..._args: unknown[]) => undefined as unknown),
    order: vi.fn((..._args: unknown[]) => undefined as unknown),
    limit: vi.fn((..._args: unknown[]) => undefined as unknown),
    insert: vi.fn((..._args: unknown[]) => undefined as unknown),
    update: vi.fn((..._args: unknown[]) => undefined as unknown),
    delete: vi.fn((..._args: unknown[]) => undefined as unknown),
    single: vi.fn(() => Promise.resolve(undefined as unknown)),
    maybeSingle: vi.fn(() => Promise.resolve(undefined as unknown)),
    then: vi.fn(
      (
        onfulfilled?: ((value: unknown) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null
      ) =>
        Promise.resolve(supabaseState.queryResponse).then(
          onfulfilled ?? undefined,
          onrejected ?? undefined
        )
    ),
    catch: vi.fn((onrejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(supabaseState.queryResponse).catch(onrejected ?? undefined)
    ),
  }

  const chain = (..._args: unknown[]) => builder

  builder.select.mockImplementation(chain)
  builder.eq.mockImplementation(chain)
  builder.gte.mockImplementation(chain)
  builder.lte.mockImplementation(chain)
  builder.in.mockImplementation(chain)
  builder.order.mockImplementation(chain)
  builder.limit.mockImplementation(chain)
  builder.insert.mockImplementation(chain)
  builder.update.mockImplementation(chain)
  builder.delete.mockImplementation(chain)
  builder.single.mockImplementation(() => Promise.resolve(supabaseState.singleResponse))
  builder.maybeSingle.mockImplementation(() => Promise.resolve(supabaseState.singleResponse))

  const mockFrom = vi.fn((_table: string) => builder)
  const mockToast = vi.fn()

  return {
    AUTH_STATE,
    ROWS,
    CREATED_ROW,
    UPDATED_ROW,
    QUERY_SUCCESS_RESPONSE,
    QUERY_ERROR_RESPONSE,
    CREATE_SUCCESS_RESPONSE,
    UPDATE_SUCCESS_RESPONSE,
    DELETE_SUCCESS_RESPONSE,
    MUTATION_ERROR,
    MUTATION_ERROR_RESPONSE,
    mockFrom,
    mockToast,
    supabaseState,
    builder,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}))

function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children)

  return { wrapper, client }
}

describe('useCalendarCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseState.queryResponse = QUERY_SUCCESS_RESPONSE
    supabaseState.singleResponse = CREATE_SUCCESS_RESPONSE
  })

  it('expose le chargement puis retourne les catégories triées de l’utilisateur authentifié', async () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useCalendarCategories(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(ROWS)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toEqual({
      id: 'cat-1',
      user_id: 'u1',
      name: 'Travail',
      color: '#2563eb',
      ordre: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    })
    expect(result.current.data?.[1]?.name).toBe('Famille')
    expect(mockFrom).toHaveBeenCalledWith('calendar_event_categories')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'ordre', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: true })
  })

  it('passe en erreur quand Supabase retourne une erreur sur la requête de catégories', async () => {
    supabaseState.queryResponse = QUERY_ERROR_RESPONSE
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useCalendarCategories(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('calendar_event_categories')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
  })
})

describe('useCreateCalendarCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseState.queryResponse = QUERY_SUCCESS_RESPONSE
    supabaseState.singleResponse = CREATE_SUCCESS_RESPONSE
  })

  it('crée une catégorie avec le user_id authentifié', async () => {
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useCreateCalendarCategory(), { wrapper })
    let created: CalendarCategory | undefined

    await act(async () => {
      created = await result.current.mutateAsync({ name: 'Sport', color: '#10b981' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(created).toEqual(CREATED_ROW)
    expect(result.current.data).toEqual(CREATED_ROW)
    expect(mockFrom).toHaveBeenCalledWith('calendar_event_categories')
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      name: 'Sport',
      color: '#10b981',
    })
    expect(builder.select).toHaveBeenCalledWith()
    expect(builder.single).toHaveBeenCalledTimes(1)
  })

  it('passe en erreur et affiche un toast destructif quand la création échoue', async () => {
    supabaseState.singleResponse = MUTATION_ERROR_RESPONSE
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useCreateCalendarCategory(), { wrapper })
    let caught: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync({ name: 'Sport', color: '#10b981' })
      } catch (error) {
        caught = error
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(caught).toEqual(MUTATION_ERROR)
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      name: 'Sport',
      color: '#10b981',
    })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})

describe('useUpdateCalendarCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseState.queryResponse = QUERY_SUCCESS_RESPONSE
    supabaseState.singleResponse = UPDATE_SUCCESS_RESPONSE
  })

  it('met à jour uniquement les champs fournis pour la catégorie ciblée', async () => {
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUpdateCalendarCategory(), { wrapper })
    let updated: CalendarCategory | undefined

    await act(async () => {
      updated = await result.current.mutateAsync({ id: 'cat-1', color: '#ef4444' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updated).toEqual(UPDATED_ROW)
    expect(result.current.data).toEqual(UPDATED_ROW)
    expect(mockFrom).toHaveBeenCalledWith('calendar_event_categories')
    expect(builder.update).toHaveBeenCalledWith({ color: '#ef4444' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'cat-1')
    expect(builder.select).toHaveBeenCalledWith()
    expect(builder.single).toHaveBeenCalledTimes(1)
  })

  it('passe en erreur et affiche un toast destructif quand la mise à jour échoue', async () => {
    supabaseState.singleResponse = MUTATION_ERROR_RESPONSE
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUpdateCalendarCategory(), { wrapper })
    let caught: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'cat-1', name: 'Bureau' })
      } catch (error) {
        caught = error
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(caught).toEqual(MUTATION_ERROR)
    expect(builder.update).toHaveBeenCalledWith({ name: 'Bureau' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'cat-1')
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})

describe('useDeleteCalendarCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseState.queryResponse = DELETE_SUCCESS_RESPONSE
    supabaseState.singleResponse = CREATE_SUCCESS_RESPONSE
  })

  it('supprime la catégorie ciblée par son id', async () => {
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useDeleteCalendarCategory(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('cat-2')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendar_event_categories')
    expect(builder.delete).toHaveBeenCalledWith()
    expect(builder.eq).toHaveBeenCalledWith('id', 'cat-2')
  })

  it('passe en erreur et affiche un toast destructif quand la suppression échoue', async () => {
    supabaseState.queryResponse = MUTATION_ERROR_RESPONSE
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useDeleteCalendarCategory(), { wrapper })
    let caught: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync('cat-2')
      } catch (error) {
        caught = error
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(caught).toEqual(MUTATION_ERROR)
    expect(builder.delete).toHaveBeenCalledWith()
    expect(builder.eq).toHaveBeenCalledWith('id', 'cat-2')
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })
})
