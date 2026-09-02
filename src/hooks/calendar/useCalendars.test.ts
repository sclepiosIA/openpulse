/* @vitest-environment jsdom */

import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useCalendars,
  useCalendar,
  useDefaultCalendar,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
  useToggleCalendarVisibility,
} from './useCalendars'

const {
  AUTH_STATE,
  CALENDARS_ROWS,
  SINGLE_CALENDAR,
  CREATED_DEFAULT_CALENDAR,
  CREATED_CALENDAR,
  UPDATED_CALENDAR,
  TOGGLED_CALENDAR,
  toastSuccess,
  toastError,
  debugError,
  mockFrom,
  mockUseAuth,
  referencePreset,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  CALENDARS_ROWS: [
    {
      id: 'c1',
      owner_id: 'u1',
      name: 'Travail',
      description: 'Calendrier pro',
      color: '#111111',
      type: 'work',
      is_default: true,
      is_visible: true,
      timezone: 'Europe/Paris',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'c2',
      owner_id: 'u1',
      name: 'Perso',
      description: 'Calendrier perso',
      color: '#222222',
      type: 'personal',
      is_default: false,
      is_visible: false,
      timezone: 'Europe/Paris',
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ],
  SINGLE_CALENDAR: {
    id: 'c1',
    owner_id: 'u1',
    name: 'Travail',
    description: 'Calendrier pro',
    color: '#111111',
    type: 'work',
    is_default: true,
    is_visible: true,
    timezone: 'Europe/Paris',
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
  },
  CREATED_DEFAULT_CALENDAR: {
    id: 'c3',
    owner_id: 'u1',
    name: 'Mon calendrier',
    description: null,
    color: '#3B82F6',
    type: 'personal',
    is_default: true,
    is_visible: true,
    timezone: 'Europe/Paris',
    created_at: '2024-02-01',
    updated_at: '2024-02-01',
  },
  CREATED_CALENDAR: {
    id: 'c4',
    owner_id: 'u1',
    name: 'Nouveau',
    description: 'Desc',
    color: '#abcdef',
    type: 'personal',
    is_default: false,
    is_visible: true,
    timezone: 'Europe/Paris',
    created_at: '2024-03-01',
    updated_at: '2024-03-01',
  },
  UPDATED_CALENDAR: {
    id: 'c1',
    owner_id: 'u1',
    name: 'Travail modifié',
    description: 'Maj',
    color: '#ff0000',
    type: 'work',
    is_default: true,
    is_visible: true,
    timezone: 'Europe/Paris',
    created_at: '2024-01-01',
    updated_at: '2024-04-01',
  },
  TOGGLED_CALENDAR: {
    id: 'c2',
    owner_id: 'u1',
    name: 'Perso',
    description: 'Calendrier perso',
    color: '#222222',
    type: 'personal',
    is_default: false,
    is_visible: true,
    timezone: 'Europe/Paris',
    created_at: '2024-01-03',
    updated_at: '2024-04-02',
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
  mockFrom: vi.fn(),
  mockUseAuth: vi.fn(),
  referencePreset: { staleTime: 1800000 },
}))

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

function createBuilder(config?: {
  selectResult?: QueryResult<unknown>
  maybeSingleResult?: QueryResult<unknown>
  singleResult?: QueryResult<unknown>
  insertSingleResult?: QueryResult<unknown>
  updateSingleResult?: QueryResult<unknown>
  deleteResult?: QueryResult<unknown>
}) {
  const state = {
    mode: 'select' as 'select' | 'insert' | 'update' | 'delete',
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => {
      state.mode = 'insert'
      return builder
    }),
    update: vi.fn(() => {
      state.mode = 'update'
      return builder
    }),
    delete: vi.fn(() => {
      state.mode = 'delete'
      return builder
    }),
    single: vi.fn(() => {
      if (state.mode === 'insert') {
        return Promise.resolve(config?.insertSingleResult ?? { data: null, error: null })
      }
      if (state.mode === 'update') {
        return Promise.resolve(config?.updateSingleResult ?? { data: null, error: null })
      }
      return Promise.resolve(config?.singleResult ?? { data: null, error: null })
    }),
    maybeSingle: vi.fn(() => Promise.resolve(config?.maybeSingleResult ?? { data: null, error: null })),
    then: (
      onFulfilled: (value: QueryResult<unknown>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => {
      const result =
        state.mode === 'delete'
          ? (config?.deleteResult ?? { data: null, error: null })
          : (config?.selectResult ?? { data: null, error: null })
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
    catch: (onRejected: (reason: unknown) => unknown) => {
      const result =
        state.mode === 'delete'
          ? (config?.deleteResult ?? { data: null, error: null })
          : (config?.selectResult ?? { data: null, error: null })
      return Promise.resolve(result).catch(onRejected)
    },
  }

  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    reference: referencePreset,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useCalendars', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('charge les calendriers puis retourne les valeurs métier attendues', async () => {
    const builder = createBuilder({
      selectResult: { data: CALENDARS_ROWS, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCalendars(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(builder.select).toHaveBeenCalledWith(
      'id, owner_id, name, description, color, type, is_default, is_visible, timezone, created_at, updated_at'
    )
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'u1')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'is_default', { ascending: false })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'name')
    expect(result.current.data).toEqual(CALENDARS_ROWS)
    expect(result.current.data?.[0]?.name).toBe('Travail')
    expect(result.current.data?.[0]?.is_default).toBe(true)
    expect(result.current.data?.[1]?.is_visible).toBe(false)
  })

  it('passe en erreur quand la requête des calendriers échoue', async () => {
    const builder = createBuilder({
      selectResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCalendars(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('retourne un calendrier unique par id', async () => {
    const builder = createBuilder({
      maybeSingleResult: { data: SINGLE_CALENDAR, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCalendar('c1'), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1')
    expect(builder.maybeSingle).toHaveBeenCalled()
    expect(result.current.data).toEqual(SINGLE_CALENDAR)
    expect(result.current.data?.name).toBe('Travail')
  })

  it('passe en erreur quand la récupération d un calendrier échoue', async () => {
    const builder = createBuilder({
      maybeSingleResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCalendar('c1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useDefaultCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('retourne le calendrier par défaut existant', async () => {
    const builder = createBuilder({
      maybeSingleResult: { data: SINGLE_CALENDAR, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDefaultCalendar(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.eq).toHaveBeenNthCalledWith(1, 'owner_id', 'u1')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'is_default', true)
    expect(result.current.data).toEqual(SINGLE_CALENDAR)
  })

  it('crée un calendrier par défaut si aucun n existe', async () => {
    const builder = createBuilder({
      maybeSingleResult: { data: null, error: null },
      insertSingleResult: { data: CREATED_DEFAULT_CALENDAR, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDefaultCalendar(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'u1',
      name: 'Mon calendrier',
      color: '#3B82F6',
      type: 'personal',
      is_default: true,
    })
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()
    expect(result.current.data).toEqual(CREATED_DEFAULT_CALENDAR)
    expect(result.current.data?.name).toBe('Mon calendrier')
  })

  it('passe en erreur quand la récupération du calendrier par défaut échoue', async () => {
    const builder = createBuilder({
      maybeSingleResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDefaultCalendar(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useCreateCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('crée un calendrier avec les bonnes valeurs et affiche un toast de succès', async () => {
    const builder = createBuilder({
      insertSingleResult: { data: CREATED_CALENDAR, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateCalendar(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Nouveau',
        description: 'Desc',
        color: '#abcdef',
        type: 'personal',
        is_default: false,
        timezone: 'Europe/Paris',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'u1',
      name: 'Nouveau',
      description: 'Desc',
      color: '#abcdef',
      type: 'personal',
      is_default: false,
      timezone: 'Europe/Paris',
    })
    expect(toastSuccess).toHaveBeenCalledWith('Calendrier créé')
    expect(result.current.data).toEqual(CREATED_CALENDAR)
  })

  it('passe en erreur et loggue quand la création échoue', async () => {
    const builder = createBuilder({
      insertSingleResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateCalendar(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          name: 'Nouveau',
          description: 'Desc',
          color: '#abcdef',
          type: 'personal',
          is_default: false,
          timezone: 'Europe/Paris',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la création du calendrier')
    expect(debugError).toHaveBeenCalledWith('Create calendar error:', expect.objectContaining({ message: 'x' }))
  })
})

describe('useUpdateCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('met à jour un calendrier avec le bon payload', async () => {
    const builder = createBuilder({
      updateSingleResult: { data: UPDATED_CALENDAR, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateCalendar(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'c1',
        name: 'Travail modifié',
        description: 'Maj',
        color: '#ff0000',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(builder.update).toHaveBeenCalledWith({
      name: 'Travail modifié',
      description: 'Maj',
      color: '#ff0000',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1')
    expect(toastSuccess).toHaveBeenCalledWith('Calendrier mis à jour')
    expect(result.current.data).toEqual(UPDATED_CALENDAR)
  })

  it('passe en erreur et loggue quand la mise à jour échoue', async () => {
    const builder = createBuilder({
      updateSingleResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateCalendar(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'c1',
          name: 'Travail modifié',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la mise à jour')
    expect(debugError).toHaveBeenCalledWith('Update calendar error:', expect.objectContaining({ message: 'x' }))
  })
})

describe('useDeleteCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('supprime un calendrier par id et affiche un toast de succès', async () => {
    const builder = createBuilder({
      deleteResult: { data: null, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteCalendar(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('c2')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'c2')
    expect(toastSuccess).toHaveBeenCalledWith('Calendrier supprimé')
  })

  it('passe en erreur et loggue quand la suppression échoue', async () => {
    const builder = createBuilder({
      deleteResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteCalendar(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.mutateAsync('c2')).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression')
    expect(debugError).toHaveBeenCalledWith('Delete calendar error:', expect.objectContaining({ message: 'x' }))
  })
})

describe('useToggleCalendarVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('met à jour la visibilité d un calendrier', async () => {
    const builder = createBuilder({
      updateSingleResult: { data: TOGGLED_CALENDAR, error: null },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleCalendarVisibility(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'c2', is_visible: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('calendars')
    expect(builder.update).toHaveBeenCalledWith({ is_visible: true })
    expect(builder.eq).toHaveBeenCalledWith('id', 'c2')
    expect(result.current.data).toEqual(TOGGLED_CALENDAR)
    expect(result.current.data?.is_visible).toBe(true)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('passe en erreur quand la mise à jour de visibilité échoue', async () => {
    const builder = createBuilder({
      updateSingleResult: { data: null, error: { message: 'x' } },
    })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleCalendarVisibility(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'c2', is_visible: true })).rejects.toMatchObject({
        message: 'x',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(builder.update).toHaveBeenCalledWith({ is_visible: true })
    expect(builder.eq).toHaveBeenCalledWith('id', 'c2')
  })
})