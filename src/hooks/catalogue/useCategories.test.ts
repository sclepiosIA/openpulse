// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useCategories } from './useCategories'

const {
  CATEGORIES,
  TOAST_FN,
  mockFrom,
  builder,
  SUCCESS_RESULT,
  ERROR_RESULT,
} = vi.hoisted(() => {
  const CATEGORIES = [
    {
      id: 'cat-1',
      nom: 'Urgent',
      description: 'Tâches prioritaires',
      couleur: '#ff0000',
      ordre: 1,
      created_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'cat-2',
      nom: 'Backlog',
      description: 'À planifier',
      couleur: '#00ff00',
      ordre: 2,
      created_at: '2024-01-02T00:00:00.000Z',
    },
  ]

  const SUCCESS_RESULT = { data: CATEGORIES, error: null }
  const ERROR_RESULT = { data: null, error: { message: 'x' } }

  const TOAST_FN = vi.fn()

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.gte.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.single.mockResolvedValue({ data: null, error: null })
  builder.maybeSingle.mockResolvedValue({ data: null, error: null })
  builder.catch.mockImplementation(() => builder)
  builder.then.mockImplementation((onFulfilled, onRejected) =>
    Promise.resolve(SUCCESS_RESULT).then(onFulfilled, onRejected)
  )

  const mockFrom = vi.fn(() => builder)

  return {
    CATEGORIES,
    TOAST_FN,
    mockFrom,
    builder,
    SUCCESS_RESULT,
    ERROR_RESULT,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    reference: {
      staleTime: 1800000,
    },
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    QueryClientProvider({ client: queryClient, children })
}

describe('useCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.gte.mockReturnValue(builder)
    builder.lte.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    builder.insert.mockReturnValue(builder)
    builder.update.mockReturnValue(builder)
    builder.delete.mockReturnValue(builder)
    builder.single.mockResolvedValue({ data: null, error: null })
    builder.maybeSingle.mockResolvedValue({ data: null, error: null })
    builder.catch.mockImplementation(() => builder)
    builder.then.mockImplementation((onFulfilled, onRejected) =>
      Promise.resolve(SUCCESS_RESULT).then(onFulfilled, onRejected)
    )
    mockFrom.mockReturnValue(builder)
  })

  it('charge les catégories triées et expose les valeurs métier attendues', async () => {
    const { result } = renderHook(() => useCategories(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('categories_taches')
    expect(builder.select).toHaveBeenCalledWith('id, nom, description, couleur, ordre, created_at')
    expect(builder.order).toHaveBeenCalledWith('ordre', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(100)

    expect(result.current.data).toEqual(CATEGORIES)
    expect(result.current.data?.map((item) => item.nom)).toEqual(['Urgent', 'Backlog'])
    expect(result.current.data?.map((item) => item.ordre)).toEqual([1, 2])
    expect(result.current.data?.[0]).toEqual({
      id: 'cat-1',
      nom: 'Urgent',
      description: 'Tâches prioritaires',
      couleur: '#ff0000',
      ordre: 1,
      created_at: '2024-01-01T00:00:00.000Z',
    })
    expect(result.current.data?.[1]).toEqual({
      id: 'cat-2',
      nom: 'Backlog',
      description: 'À planifier',
      couleur: '#00ff00',
      ordre: 2,
      created_at: '2024-01-02T00:00:00.000Z',
    })
    expect(TOAST_FN).not.toHaveBeenCalled()
  })

  it('passe en erreur et déclenche un toast si la requête supabase échoue', async () => {
    builder.then.mockImplementation((onFulfilled, onRejected) =>
      Promise.resolve(ERROR_RESULT).then(onFulfilled, onRejected)
    )

    const { result } = renderHook(() => useCategories(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(ERROR_RESULT.error)
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les catégories',
      variant: 'destructive',
    })
    expect(mockFrom).toHaveBeenCalledWith('categories_taches')
    expect(builder.select).toHaveBeenCalledWith('id, nom, description, couleur, ordre, created_at')
    expect(builder.order).toHaveBeenCalledWith('ordre', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(100)
    expect(result.current.data).toBeUndefined()
  })
})