import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJarvisFavoritesMutations } from './useJarvisFavoritesMutations'

const {
  MOCK_FAVORITE,
  MOCK_FAVORITES_ORDER,
  mockFrom,
  mockUpdate,
  mockDelete,
  mockInsert,
  mockEq,
  mockSelect,
  mockSingle,
  mockThen,
  mockCatch,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError
} = vi.hoisted(() => {
  const MOCK_FAVORITE = {
    id: 'fav1',
    command: 'cmd',
    label: 'Label',
    description: null,
    icon: 'icon',
    shortcut_key: '1',
    usage_count: 2,
    order_index: 0
  }

  const MOCK_FAVORITES_ORDER = [
    { ...MOCK_FAVORITE, id: 'fav1', order_index: 0, shortcut_key: '1' },
    { ...MOCK_FAVORITE, id: 'fav2', order_index: 1, shortcut_key: '2' },
    { ...MOCK_FAVORITE, id: 'fav3', order_index: 2, shortcut_key: '3' }
  ]

  const builder: Record<string, unknown> = {}

  const mockUpdate = vi.fn().mockImplementation(() => builder)
  const mockDelete = vi.fn().mockImplementation(() => builder)
  const mockInsert = vi.fn().mockImplementation(() => builder)
  const mockEq = vi.fn().mockImplementation(() => builder)
  const mockSelect = vi.fn().mockImplementation(() => builder)
  const mockSingle = vi.fn()
  const mockThen = vi.fn().mockImplementation((onResolved: (value: unknown) => void) => {
    onResolved({ data: null, error: null })
    return Promise.resolve()
  })
  const mockCatch = vi.fn().mockImplementation(() => builder)

  builder.update = mockUpdate
  builder.delete = mockDelete
  builder.insert = mockInsert
  builder.eq = mockEq
  builder.select = mockSelect
  builder.single = mockSingle
  builder.maybeSingle = mockSingle
  builder.then = mockThen
  builder.catch = mockCatch

  const mockFrom = vi.fn().mockImplementation(() => builder)

  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()

  const mockSanitizeSupabaseError = vi.fn().mockImplementation((err: unknown) => {
    if (typeof err === 'object' && err && 'message' in err) {
      return (err as { message: string }).message
    }
    return 'Erreur'
  })

  return {
    MOCK_FAVORITE,
    MOCK_FAVORITES_ORDER,
    mockFrom,
    mockUpdate,
    mockDelete,
    mockInsert,
    mockEq,
    mockSelect,
    mockSingle,
    mockThen,
    mockCatch,
    mockToastSuccess,
    mockToastError,
    mockSanitizeSupabaseError
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom
  }
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError
  }
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })

  const Wrapper = (props: { children: React.ReactNode }) => {
    return (
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        props.children
      )
    )
  }

  return Wrapper
}

describe('useJarvisFavoritesMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('incrementUsage met à jour usage_count et last_used_at avec eq sur id', async () => {
    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const fav = { ...MOCK_FAVORITE, usage_count: 2 }
    const beforeCall = Date.now()

    await act(async () => {
      await result.current.incrementUsage(fav)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_favorite_commands')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockUpdate.mock.calls[0][0] as { usage_count: number; last_used_at: string }
    expect(updateArg.usage_count).toBe(3)
    const lastUsedAt = new Date(updateArg.last_used_at).getTime()
    expect(lastUsedAt).toBeGreaterThanOrEqual(beforeCall)
    expect(mockEq).toHaveBeenCalledWith('id', fav.id)
  })

  it('incrementUsage gère usage_count null en le passant à 1', async () => {
    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const fav = { ...MOCK_FAVORITE, usage_count: null }

    await act(async () => {
      await result.current.incrementUsage(fav)
    })

    const updateArg = mockUpdate.mock.calls[0][0] as { usage_count: number }
    expect(updateArg.usage_count).toBe(1)
  })

  it('addFavorite insère un favori et retourne la donnée avec toast success', async () => {
    const insertResult = { ...MOCK_FAVORITE, id: 'newFav', shortcut_key: '3', order_index: 2 }
    mockSingle.mockResolvedValueOnce({ data: insertResult, error: null })

    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const userId = 'user-1'
    const data = { command: '  cmd-new  ', label: '  Label New  ', icon: 'icon-new' }
    const currentCount = 2

    let returned: unknown
    await act(async () => {
      returned = await result.current.addFavorite(userId, data, currentCount)
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertArg = mockInsert.mock.calls[0][0] as {
      user_id: string
      command: string
      label: string
      icon: string | null
      order_index: number
      shortcut_key: string | null
    }
    expect(insertArg.user_id).toBe(userId)
    expect(insertArg.command).toBe('cmd-new')
    expect(insertArg.label).toBe('Label New')
    expect(insertArg.icon).toBe('icon-new')
    expect(insertArg.order_index).toBe(currentCount)
    expect(insertArg.shortcut_key).toBe('3')

    expect(mockSelect).toHaveBeenCalled()
    expect(mockSingle).toHaveBeenCalled()

    expect(mockToastSuccess).toHaveBeenCalledWith('Commande ajoutée aux favoris')
    expect(returned).toEqual(insertResult)
  })

  it('addFavorite assigne shortcut_key à null si currentCount >= 9', async () => {
    const insertResult = { ...MOCK_FAVORITE, id: 'fav-x', shortcut_key: null, order_index: 10 }
    mockSingle.mockResolvedValueOnce({ data: insertResult, error: null })

    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const userId = 'user-2'
    const data = { command: 'cmd-10', label: 'Label 10' }
    const currentCount = 10

    await act(async () => {
      await result.current.addFavorite(userId, data, currentCount)
    })

    const insertArg = mockInsert.mock.calls[0][0] as { order_index: number; shortcut_key: string | null }
    expect(insertArg.order_index).toBe(10)
    expect(insertArg.shortcut_key).toBeNull()
  })

  it('addFavorite gère une erreur de duplication (code 23505) avec toast spécifique et retourne null', async () => {
    const error = { code: '23505', message: 'duplicate key' }
    mockSingle.mockResolvedValueOnce({ data: null, error })

    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const userId = 'user-3'
    const data = { command: 'cmd', label: 'Label' }
    const currentCount = 1

    let returned: unknown
    await act(async () => {
      returned = await result.current.addFavorite(userId, data, currentCount)
    })

    expect(mockToastError).toHaveBeenCalledWith('Cette commande est déjà dans vos favoris')
    expect(returned).toBeNull()
  })

  it('addFavorite gère une autre erreur en utilisant sanitizeSupabaseError et retourne null', async () => {
    const error = { code: '99999', message: 'supabase error' }
    mockSanitizeSupabaseError.mockReturnValueOnce('Erreur lisible')
    mockSingle.mockResolvedValueOnce({ data: null, error })

    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const userId = 'user-4'
    const data = { command: 'cmd-e', label: 'Label-e' }
    const currentCount = 0

    let returned: unknown
    await act(async () => {
      returned = await result.current.addFavorite(userId, data, currentCount)
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(error)
    expect(mockToastError).toHaveBeenCalledWith('Erreur lisible')
    expect(returned).toBeNull()
  })

  it('removeFavorite supprime le favori et affiche un toast success', async () => {
    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const id = 'fav-remove'

    await act(async () => {
      await result.current.removeFavorite(id)
    })

    expect(mockFrom).toHaveBeenCalledWith('jarvis_favorite_commands')
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith('id', id)
    expect(mockToastSuccess).toHaveBeenCalledWith('Favori supprimé')
  })

  it('reorderFavorites met à jour order_index et shortcut_key pour chaque favori', async () => {
    const { result } = renderHook(() => useJarvisFavoritesMutations(), {
      wrapper: createWrapper()
    })

    const newOrder = [
      { ...MOCK_FAVORITE, id: 'favA' },
      { ...MOCK_FAVORITE, id: 'favB' },
      { ...MOCK_FAVORITE, id: 'favC' },
      { ...MOCK_FAVORITE, id: 'favD' },
      { ...MOCK_FAVORITE, id: 'favE' },
      { ...MOCK_FAVORITE, id: 'favF' },
      { ...MOCK_FAVORITE, id: 'favG' },
      { ...MOCK_FAVORITE, id: 'favH' },
      { ...MOCK_FAVORITE, id: 'favI' },
      { ...MOCK_FAVORITE, id: 'favJ' }
    ]

    await act(async () => {
      await result.current.reorderFavorites(newOrder)
    })

    expect(mockFrom).toHaveBeenCalledTimes(newOrder.length)
    expect(mockUpdate).toHaveBeenCalledTimes(newOrder.length)
    expect(mockEq).toHaveBeenCalledTimes(newOrder.length)

    for (let i = 0; i < newOrder.length; i++) {
      const updateArgs = mockUpdate.mock.calls[i][0] as { order_index: number; shortcut_key: string | null }
      expect(updateArgs.order_index).toBe(i)
      if (i < 9) {
        expect(updateArgs.shortcut_key).toBe(String(i + 1))
      } else {
        expect(updateArgs.shortcut_key).toBeNull()
      }
      const eqArgs = mockEq.mock.calls[i]
      expect(eqArgs[0]).toBe('id')
      expect(eqArgs[1]).toBe(newOrder[i].id)
    }
  })
})