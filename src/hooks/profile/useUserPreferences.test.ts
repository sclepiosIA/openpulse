import React, { type PropsWithChildren } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUserPreferences } from './useUserPreferences'

const { AUTH_STATE, TOAST_FN, DEBUG_ERROR, PREFERENCES_ROW, mockFrom, mockRpc, builder } =
  vi.hoisted(() => {
    const AUTH_STATE = {
      user: { id: 'u1', email: 'user@test.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    }

    const TOAST_FN = vi.fn()
    const DEBUG_ERROR = vi.fn()

    const PREFERENCES_ROW = {
      preferences: {
        theme: 'dark',
        favorite_groupes: ['g1'],
        favorite_partenaires: ['p1'],
        saved_views_groupes: {
          vueA: { filter: 'active' },
        },
      },
    }

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
    builder.maybeSingle.mockResolvedValue({ data: PREFERENCES_ROW, error: null })
    builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: PREFERENCES_ROW, error: null }).then(onFulfilled)
    )
    builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: PREFERENCES_ROW, error: null }).catch(onRejected)
    )

    const mockFrom = vi.fn(() => builder)
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

    return {
      AUTH_STATE,
      TOAST_FN,
      DEBUG_ERROR,
      PREFERENCES_ROW,
      mockFrom,
      mockRpc,
      builder,
    }
  })

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useUserPreferences', () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: 'u1', email: 'user@test.co' }
    AUTH_STATE.session = { user: { id: 'u1' } }
    AUTH_STATE.isLoading = false

    mockFrom.mockClear()
    mockRpc.mockClear()
    TOAST_FN.mockClear()
    DEBUG_ERROR.mockClear()

    builder.select.mockClear()
    builder.eq.mockClear()
    builder.gte.mockClear()
    builder.lte.mockClear()
    builder.in.mockClear()
    builder.order.mockClear()
    builder.limit.mockClear()
    builder.insert.mockClear()
    builder.update.mockClear()
    builder.delete.mockClear()
    builder.single.mockClear()
    builder.maybeSingle.mockClear()
    builder.then.mockClear()
    builder.catch.mockClear()

    builder.maybeSingle.mockResolvedValue({ data: PREFERENCES_ROW, error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('charge les préférences utilisateur puis expose les valeurs métier attendues', async () => {
    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.preferences).toEqual({})

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(builder.select).toHaveBeenCalledWith('preferences')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.maybeSingle).toHaveBeenCalled()

    expect(result.current.preferences).toEqual(PREFERENCES_ROW.preferences)
    expect(result.current.getPreference('theme')).toBe('dark')
    expect(result.current.getPreference('missing_key', 'fallback')).toBe('fallback')
    expect(result.current.isFavoriteGroupe('g1')).toBe(true)
    expect(result.current.isFavoriteGroupe('g2')).toBe(false)
    expect(result.current.isFavoritePartenaire('p1')).toBe(true)
    expect(result.current.isFavoritePartenaire('p2')).toBe(false)
    expect(result.current.getSavedViews()).toEqual({
      vueA: { filter: 'active' },
    })
    expect(TOAST_FN).not.toHaveBeenCalled()
  })

  it('gère une erreur de chargement avec toast et arrêt du loading', async () => {
    builder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    })

    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.preferences).toEqual({})
    expect(DEBUG_ERROR).toHaveBeenCalled()
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger vos préférences',
      variant: 'destructive',
    })
  })

  it('met à jour une préférence de façon optimiste et appelle la RPC avec les bons paramètres', async () => {
    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePreference('theme', 'light')
    })

    expect(result.current.getPreference('theme')).toBe('light')
    expect(mockRpc).toHaveBeenCalledWith('update_user_preference', {
      preference_key: 'theme',
      preference_value: 'light',
    })
  })

  it('toggle les favoris groupes et retourne le bon état', async () => {
    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let added = false
    await act(async () => {
      added = await result.current.toggleFavoriteGroupe('g2')
    })

    expect(added).toBe(true)
    expect(result.current.isFavoriteGroupe('g2')).toBe(true)
    expect(mockRpc).toHaveBeenLastCalledWith('update_user_preference', {
      preference_key: 'favorite_groupes',
      preference_value: ['g1', 'g2'],
    })

    let removed = false
    await act(async () => {
      removed = await result.current.toggleFavoriteGroupe('g1')
    })

    expect(removed).toBe(false)
    expect(result.current.isFavoriteGroupe('g1')).toBe(false)
    expect(mockRpc).toHaveBeenLastCalledWith('update_user_preference', {
      preference_key: 'favorite_groupes',
      preference_value: ['g2'],
    })
  })

  it('toggle les favoris partenaires et gère les vues sauvegardées', async () => {
    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let added = false
    await act(async () => {
      added = await result.current.toggleFavoritePartenaire('p2')
    })

    expect(added).toBe(true)
    expect(result.current.isFavoritePartenaire('p2')).toBe(true)
    expect(mockRpc).toHaveBeenLastCalledWith('update_user_preference', {
      preference_key: 'favorite_partenaires',
      preference_value: ['p1', 'p2'],
    })

    await act(async () => {
      await result.current.saveView('vueB', { sort: 'name' })
    })

    expect(result.current.getSavedViews()).toEqual({
      vueA: { filter: 'active' },
      vueB: { sort: 'name' },
    })
    expect(mockRpc).toHaveBeenLastCalledWith('update_user_preference', {
      preference_key: 'saved_views_groupes',
      preference_value: {
        vueA: { filter: 'active' },
        vueB: { sort: 'name' },
      },
    })

    await act(async () => {
      await result.current.deleteView('vueA')
    })

    expect(result.current.getSavedViews()).toEqual({
      vueB: { sort: 'name' },
    })
    expect(mockRpc).toHaveBeenLastCalledWith('update_user_preference', {
      preference_key: 'saved_views_groupes',
      preference_value: {
        vueB: { sort: 'name' },
      },
    })
  })

  it('ne charge pas depuis supabase sans utilisateur et garde des préférences vides', async () => {
    AUTH_STATE.user = null
    AUTH_STATE.session = null

    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.preferences).toEqual({})
    expect(result.current.getPreference('theme', 'fallback')).toBe('fallback')

    await act(async () => {
      await result.current.updatePreference('theme', 'light')
    })

    expect(mockRpc).not.toHaveBeenCalled()
    expect(result.current.preferences).toEqual({})
  })
})
