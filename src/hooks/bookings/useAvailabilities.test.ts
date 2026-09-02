/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAvailabilities, useTeamAvailabilities } from './useAvailabilities'

const {
  AUTH_STATE,
  QUERY_ROWS,
  CREATED_ROW,
  UPDATED_ROW,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  } as {
    user: { id: string; email: string } | null
    session: { user: { id: string } }
    isLoading: boolean
  },
  QUERY_ROWS: [
    {
      id: 'a1',
      user_id: 'u1',
      title: 'Congé',
      start_time: '2024-01-10T09:00:00.000Z',
      end_time: '2024-01-10T11:00:00.000Z',
      is_recurring: null,
      recurrence_rule: null,
      type: null,
      notes: 'matin',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'a2',
      user_id: 'u2',
      title: 'Réunion',
      start_time: '2024-01-11T14:00:00.000Z',
      end_time: '2024-01-11T15:00:00.000Z',
      is_recurring: true,
      recurrence_rule: 'FREQ=WEEKLY',
      type: 'busy',
      notes: null,
      created_at: '2024-01-02T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    },
  ],
  CREATED_ROW: {
    id: 'a3',
    user_id: 'u1',
    title: 'Indisponible',
    start_time: '2024-02-01T09:00:00.000Z',
    end_time: '2024-02-01T10:00:00.000Z',
    is_recurring: false,
    recurrence_rule: null,
    type: 'unavailable',
    notes: 'rdv',
    created_at: '2024-02-01T00:00:00.000Z',
    updated_at: '2024-02-01T00:00:00.000Z',
  },
  UPDATED_ROW: {
    id: 'a1',
    user_id: 'u1',
    title: 'Congé modifié',
    start_time: '2024-01-10T09:00:00.000Z',
    end_time: '2024-01-10T12:00:00.000Z',
    is_recurring: false,
    recurrence_rule: null,
    type: 'tentative',
    notes: 'étendu',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type ResponseShape<T> = { data: T; error: { message: string } | null }

function createThenableBuilder<T>(response: ResponseShape<T>) {
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
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (
      onFulfilled?: (value: ResponseShape<T>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  }

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

describe('useAvailabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'user@test.local' }
  })

  it('charge les disponibilités, applique les filtres et normalise les champs', async () => {
    const builder = createThenableBuilder({ data: QUERY_ROWS, error: null })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAvailabilities('u1', '2024-01-01', '2024-01-31'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('user_availabilities')
    expect(builder.select).toHaveBeenCalledWith(
      'id, user_id, title, start_time, end_time, is_recurring, recurrence_rule, type, notes, created_at, updated_at'
    )
    expect(builder.order).toHaveBeenCalledWith('start_time', { ascending: true })
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.gte).toHaveBeenCalledWith('start_time', '2024-01-01')
    expect(builder.lte).toHaveBeenCalledWith('end_time', '2024-01-31')
    expect(result.current.availabilities).toEqual([
      {
        ...QUERY_ROWS[0],
        is_recurring: false,
        type: 'unavailable',
      },
      QUERY_ROWS[1],
    ])
  })

  it('passe en erreur si la requête échoue', async () => {
    const builder = createThenableBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAvailabilities('u1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.availabilities).toBeUndefined()
  })

  it('crée une indisponibilité avec les valeurs par défaut et invalide la query', async () => {
    const queryBuilder = createThenableBuilder({ data: QUERY_ROWS, error: null })
    const insertBuilder = createThenableBuilder({ data: CREATED_ROW, error: null })
    mockFrom.mockImplementation(() => {
      const callIndex = mockFrom.mock.calls.length
      return callIndex === 1 ? queryBuilder : insertBuilder
    })

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAvailabilities('u1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createAvailability({
        start_time: '2024-02-01T09:00:00.000Z',
        end_time: '2024-02-01T10:00:00.000Z',
        notes: 'rdv',
      })
    })

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      title: 'Indisponible',
      start_time: '2024-02-01T09:00:00.000Z',
      end_time: '2024-02-01T10:00:00.000Z',
      is_recurring: false,
      recurrence_rule: undefined,
      type: 'unavailable',
      notes: 'rdv',
    })
    expect(insertBuilder.select).toHaveBeenCalled()
    expect(insertBuilder.single).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-availabilities'] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Indisponibilité créée')
  })

  it('remonte une erreur de création si non authentifié', async () => {
    AUTH_STATE.user = null
    const queryBuilder = createThenableBuilder({ data: null, error: { message: 'Non authentifié' } })
    mockFrom.mockReturnValue(queryBuilder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAvailabilities('u1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      result.current.createAvailability({
        start_time: '2024-02-01T09:00:00.000Z',
        end_time: '2024-02-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Non authentifié')

    expect(mockDebugError).toHaveBeenCalledWith('Error creating availability:', expect.any(Error))
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la création de l'indisponibilité")
  })

  it('met à jour une indisponibilité', async () => {
    const queryBuilder = createThenableBuilder({ data: QUERY_ROWS, error: null })
    const updateBuilder = createThenableBuilder({ data: UPDATED_ROW, error: null })
    mockFrom.mockImplementation(() => {
      const callIndex = mockFrom.mock.calls.length
      return callIndex === 1 ? queryBuilder : updateBuilder
    })

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAvailabilities('u1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updateAvailability({
        id: 'a1',
        title: 'Congé modifié',
        end_time: '2024-01-10T12:00:00.000Z',
        type: 'tentative',
      })
    })

    expect(updateBuilder.update).toHaveBeenCalledWith({
      title: 'Congé modifié',
      end_time: '2024-01-10T12:00:00.000Z',
      type: 'tentative',
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'a1')
    expect(updateBuilder.select).toHaveBeenCalled()
    expect(updateBuilder.single).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-availabilities'] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Indisponibilité mise à jour')
  })

  it('supprime une indisponibilité', async () => {
    const queryBuilder = createThenableBuilder({ data: QUERY_ROWS, error: null })
    const deleteBuilder = createThenableBuilder({ data: null, error: null })
    mockFrom.mockImplementation(() => {
      const callIndex = mockFrom.mock.calls.length
      return callIndex === 1 ? queryBuilder : deleteBuilder
    })

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAvailabilities('u1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteAvailability('a2')
    })

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'a2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-availabilities'] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Indisponibilité supprimée')
  })
})

describe('useTeamAvailabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne vide et ne requête pas si aucun userId', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTeamAvailabilities([]), { wrapper })

    expect(result.current.data).toBeUndefined()
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('charge les disponibilités d’équipe avec filtres et normalisation', async () => {
    const builder = createThenableBuilder({ data: QUERY_ROWS, error: null })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTeamAvailabilities(['u1', 'u2'], '2024-01-01', '2024-01-31'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('user_availabilities')
    expect(builder.in).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(builder.limit).toHaveBeenCalledWith(500)
    expect(builder.gte).toHaveBeenCalledWith('start_time', '2024-01-01')
    expect(builder.lte).toHaveBeenCalledWith('end_time', '2024-01-31')
    expect(result.current.data).toEqual([
      {
        ...QUERY_ROWS[0],
        is_recurring: false,
        type: 'unavailable',
      },
      QUERY_ROWS[1],
    ])
  })

  it('passe en erreur si la requête équipe échoue', async () => {
    const builder = createThenableBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTeamAvailabilities(['u1']), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('x')
  })
})