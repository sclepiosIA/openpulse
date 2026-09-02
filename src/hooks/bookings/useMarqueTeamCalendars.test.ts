// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useMarqueTeamCalendars } from './useMarqueTeamCalendars'

const {
  AUTH_USER,
  CALENDARS_ROWS,
  PROFILES_ROWS,
  EMPTY_ROWS,
  QUERY_PRESETS_REFERENCE,
  mockUseAuth,
  mockFrom,
  mockSelect,
  mockEq,
  mockNeq,
  mockIn,
  mockGte,
  mockLte,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  builder,
  tableResponses,
  state,
} = vi.hoisted(() => {
  const AUTH_USER = { id: 'user-current' }

  const CALENDARS_ROWS = [
    {
      id: 'cal-1',
      name: 'Agenda Dr Martin',
      color: '#FF0000',
      description: 'Calendrier principal',
      owner_id: 'owner-1',
      type: null,
      is_default: true,
      is_visible: null,
      timezone: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'cal-2',
      name: 'Agenda Dr Dupont',
      color: '#00FF00',
      description: 'Secondaire',
      owner_id: 'owner-2',
      type: 'team',
      is_default: true,
      is_visible: false,
      timezone: 'Europe/London',
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
    {
      id: 'cal-3',
      name: 'Agenda Inactif',
      color: '#0000FF',
      description: 'Doit être filtré',
      owner_id: 'owner-3',
      type: 'personal',
      is_default: true,
      is_visible: true,
      timezone: 'Europe/Paris',
      created_at: '2024-01-05',
      updated_at: '2024-01-06',
    },
    {
      id: 'cal-4',
      name: 'Agenda Sans Profil',
      color: '#CCCCCC',
      description: 'Doit être filtré',
      owner_id: 'owner-4',
      type: 'personal',
      is_default: true,
      is_visible: true,
      timezone: 'Europe/Paris',
      created_at: '2024-01-07',
      updated_at: '2024-01-08',
    },
  ]

  const PROFILES_ROWS = [
    {
      id: 'profile-1',
      prenom: 'Alice',
      nom: 'Martin',
      avatar_url: 'avatar-a',
      user_id: 'owner-1',
      actif: true,
    },
    {
      id: 'profile-2',
      prenom: 'Bob',
      nom: 'Dupont',
      avatar_url: null,
      user_id: 'owner-2',
      actif: true,
    },
    {
      id: 'profile-3',
      prenom: 'Charles',
      nom: 'Inactif',
      avatar_url: null,
      user_id: 'owner-3',
      actif: false,
    },
  ]

  const EMPTY_ROWS: [] = []
  const QUERY_PRESETS_REFERENCE = {}

  const tableResponses: {
    calendars: {
      data: typeof CALENDARS_ROWS | null | typeof EMPTY_ROWS
      error: { message: string } | null
    }
    profiles: {
      data: typeof PROFILES_ROWS | null | typeof EMPTY_ROWS
      error: { message: string } | null
    }
  } = {
    calendars: { data: CALENDARS_ROWS, error: null },
    profiles: { data: PROFILES_ROWS, error: null },
  }

  const state = {
    currentTable: '',
  }

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
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

  const mockSelect = builder.select
  const mockEq = builder.eq
  const mockNeq = builder.neq
  const mockIn = builder.in
  const mockGte = builder.gte
  const mockLte = builder.lte
  const mockOrder = builder.order
  const mockLimit = builder.limit
  const mockInsert = builder.insert
  const mockUpdate = builder.update
  const mockDelete = builder.delete
  const mockSingle = builder.single
  const mockMaybeSingle = builder.maybeSingle
  const mockThen = builder.then
  const mockCatch = builder.catch

  mockSelect.mockImplementation(() => builder)
  mockEq.mockImplementation(() => builder)
  mockNeq.mockImplementation(() => builder)
  mockIn.mockImplementation(() => builder)
  mockGte.mockImplementation(() => builder)
  mockLte.mockImplementation(() => builder)
  mockOrder.mockImplementation(() => builder)
  mockLimit.mockImplementation(() => builder)
  mockInsert.mockImplementation(() => builder)
  mockUpdate.mockImplementation(() => builder)
  mockDelete.mockImplementation(() => builder)
  mockSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  mockMaybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }))

  const mockFrom = vi.fn((table: string) => {
    state.currentTable = table
    return builder
  })

  mockThen.mockImplementation(
    (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      const response =
        state.currentTable === 'calendars' ? tableResponses.calendars : tableResponses.profiles
      return Promise.resolve(response).then(onFulfilled, onRejected)
    }
  )

  mockCatch.mockImplementation((onRejected?: (reason: unknown) => unknown) => {
    const response =
      state.currentTable === 'calendars' ? tableResponses.calendars : tableResponses.profiles
    return Promise.resolve(response).catch(onRejected)
  })

  const mockUseAuth = vi.fn(() => ({ user: AUTH_USER }))

  return {
    AUTH_USER,
    CALENDARS_ROWS,
    PROFILES_ROWS,
    EMPTY_ROWS,
    QUERY_PRESETS_REFERENCE,
    mockUseAuth,
    mockFrom,
    mockSelect,
    mockEq,
    mockNeq,
    mockIn,
    mockGte,
    mockLte,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    mockThen,
    mockCatch,
    builder,
    tableResponses,
    state,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    reference: QUERY_PRESETS_REFERENCE,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return QueryClientProvider({ client: queryClient, children: props.children })
  }
}

describe('useMarqueTeamCalendars', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    state.currentTable = ''
    mockUseAuth.mockReturnValue({ user: AUTH_USER })

    tableResponses.calendars.data = CALENDARS_ROWS
    tableResponses.calendars.error = null
    tableResponses.profiles.data = PROFILES_ROWS
    tableResponses.profiles.error = null

    mockSelect.mockImplementation(() => builder)
    mockEq.mockImplementation(() => builder)
    mockNeq.mockImplementation(() => builder)
    mockIn.mockImplementation(() => builder)
    mockGte.mockImplementation(() => builder)
    mockLte.mockImplementation(() => builder)
    mockOrder.mockImplementation(() => builder)
    mockLimit.mockImplementation(() => builder)
    mockInsert.mockImplementation(() => builder)
    mockUpdate.mockImplementation(() => builder)
    mockDelete.mockImplementation(() => builder)
    mockSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }))
    mockMaybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }))
    mockThen.mockImplementation(
      (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        const response =
          state.currentTable === 'calendars' ? tableResponses.calendars : tableResponses.profiles
        return Promise.resolve(response).then(onFulfilled, onRejected)
      }
    )
    mockCatch.mockImplementation((onRejected?: (reason: unknown) => unknown) => {
      const response =
        state.currentTable === 'calendars' ? tableResponses.calendars : tableResponses.profiles
      return Promise.resolve(response).catch(onRejected)
    })
  })

  it('passe par isLoading puis retourne uniquement les calendriers des autres membres actifs avec les valeurs normalisées', async () => {
    const { result } = renderHook(() => useMarqueTeamCalendars(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.fetchStatus).toBe('fetching')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledTimes(2)
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'calendars')
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'profiles')

    expect(mockSelect).toHaveBeenNthCalledWith(
      1,
      'id, name, color, description, owner_id, type, is_default, is_visible, timezone, created_at, updated_at'
    )
    expect(mockEq).toHaveBeenCalledWith('is_default', true)
    expect(mockNeq).toHaveBeenCalledWith('owner_id', AUTH_USER.id)
    expect(mockLimit).toHaveBeenCalledWith(50)
    expect(mockSelect).toHaveBeenNthCalledWith(2, 'id, prenom, nom, avatar_url, user_id, actif')
    expect(mockIn).toHaveBeenCalledWith('user_id', ['owner-1', 'owner-2', 'owner-3', 'owner-4'])

    expect(result.current.data).toEqual([
      {
        id: 'cal-1',
        name: 'Agenda Dr Martin',
        color: '#FF0000',
        description: 'Calendrier principal',
        owner_id: 'owner-1',
        type: 'personal',
        is_default: true,
        is_visible: true,
        timezone: 'Europe/Paris',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        owner_profile: {
          id: 'profile-1',
          prenom: 'Alice',
          nom: 'Martin',
          avatar_url: 'avatar-a',
          user_id: 'owner-1',
          actif: true,
        },
      },
      {
        id: 'cal-2',
        name: 'Agenda Dr Dupont',
        color: '#00FF00',
        description: 'Secondaire',
        owner_id: 'owner-2',
        type: 'team',
        is_default: true,
        is_visible: false,
        timezone: 'Europe/London',
        created_at: '2024-01-03',
        updated_at: '2024-01-04',
        owner_profile: {
          id: 'profile-2',
          prenom: 'Bob',
          nom: 'Dupont',
          avatar_url: null,
          user_id: 'owner-2',
          actif: true,
        },
      },
    ])

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.map((calendar) => calendar.id)).toEqual(['cal-1', 'cal-2'])
    expect(result.current.data?.some((calendar) => calendar.id === 'cal-3')).toBe(false)
    expect(result.current.data?.some((calendar) => calendar.id === 'cal-4')).toBe(false)
  })

  it('retourne une liste vide quand aucun calendrier par défaut n’est trouvé et ne charge pas les profils', async () => {
    tableResponses.calendars.data = EMPTY_ROWS

    const { result } = renderHook(() => useMarqueTeamCalendars(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(mockIn).not.toHaveBeenCalled()
  })

  it('retourne isError quand la requête calendriers échoue', async () => {
    tableResponses.calendars.data = null
    tableResponses.calendars.error = { message: 'x' }

    const { result } = renderHook(() => useMarqueTeamCalendars(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.error?.message).toBe('x')
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('calendars')
  })

  it('n’exécute pas la query si aucun utilisateur n’est authentifié', () => {
    mockUseAuth.mockReturnValue({ user: null })

    const { result } = renderHook(() => useMarqueTeamCalendars(), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
