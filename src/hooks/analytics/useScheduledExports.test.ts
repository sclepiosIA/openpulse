// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useScheduledExports,
  useUpsertScheduledExport,
  useDeleteScheduledExport,
} from './useScheduledExports'

const {
  ROWS,
  UPDATED_ROW,
  INSERTED_ROW,
  SESSION_RESPONSE,
  toastSuccess,
  toastError,
  mockFrom,
  authGetSession,
  state,
} = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'exp-2',
      dashboard_id: 'dash-1',
      format: 'xlsx' as const,
      frequency: 'weekly' as const,
      hour_utc: 9,
      day_of_week: 1,
      day_of_month: null,
      recipients: ['ops@example.com'],
      is_active: true,
      next_run_at: '2024-02-02T09:00:00Z',
      last_run_at: '2024-01-26T09:00:00Z',
      last_status: 'success',
      error_message: null,
      created_at: '2024-01-20T10:00:00Z',
    },
    {
      id: 'exp-1',
      dashboard_id: 'dash-1',
      format: 'pdf' as const,
      frequency: 'daily' as const,
      hour_utc: 8,
      day_of_week: null,
      day_of_month: null,
      recipients: ['team@example.com', 'owner@example.com'],
      is_active: true,
      next_run_at: '2024-02-01T08:00:00Z',
      last_run_at: '2024-01-31T08:00:00Z',
      last_status: 'success',
      error_message: null,
      created_at: '2024-01-10T12:00:00Z',
    },
  ]

  const UPDATED_ROW = {
    id: 'exp-1',
    dashboard_id: 'dash-1',
    format: 'pdf' as const,
    frequency: 'monthly' as const,
    hour_utc: 14,
    day_of_week: null,
    day_of_month: 15,
    recipients: ['finance@example.com'],
    is_active: false,
    next_run_at: '2024-02-15T14:00:00Z',
    last_run_at: null,
    last_status: null,
    error_message: null,
    created_at: '2024-01-10T12:00:00Z',
  }

  const INSERTED_ROW = {
    id: 'exp-3',
    dashboard_id: 'dash-1',
    format: 'xlsx' as const,
    frequency: 'daily' as const,
    hour_utc: 6,
    day_of_week: null,
    day_of_month: null,
    recipients: ['new@example.com'],
    is_active: true,
    next_run_at: null,
    last_run_at: null,
    last_status: null,
    error_message: null,
    created_at: '2024-02-01T06:00:00Z',
    created_by: 'user-1',
  }

  const SESSION_RESPONSE = {
    data: {
      session: {
        user: {
          id: 'user-1',
        },
      },
    },
    error: null,
  }

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const mockFrom = vi.fn()
  const authGetSession = vi.fn()

  const state = {
    selectResult: { data: ROWS, error: null as null | { message: string } },
    singleResult: { data: UPDATED_ROW as unknown, error: null as null | { message: string } },
    deleteResult: { data: null as null, error: null as null | { message: string } },
  }

  return {
    ROWS,
    UPDATED_ROW,
    INSERTED_ROW,
    SESSION_RESPONSE,
    toastSuccess,
    toastError,
    mockFrom,
    authGetSession,
    state,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      table: '',
      operation: 'select' as 'select' | 'update' | 'insert' | 'delete',
      payload: undefined as unknown,
      filters: [] as Array<{ type: string; args: unknown[] }>,
      selectArgs: undefined as unknown,
      orderArgs: undefined as unknown,
      select: vi.fn(function (...args: unknown[]) {
        this.selectArgs = args
        return this
      }),
      eq: vi.fn(function (...args: unknown[]) {
        this.filters.push({ type: 'eq', args })
        return this
      }),
      gte: vi.fn(function (...args: unknown[]) {
        this.filters.push({ type: 'gte', args })
        return this
      }),
      lte: vi.fn(function (...args: unknown[]) {
        this.filters.push({ type: 'lte', args })
        return this
      }),
      in: vi.fn(function (...args: unknown[]) {
        this.filters.push({ type: 'in', args })
        return this
      }),
      order: vi.fn(function (...args: unknown[]) {
        this.orderArgs = args
        return this
      }),
      limit: vi.fn(function (...args: unknown[]) {
        return this
      }),
      insert: vi.fn(function (payload: unknown) {
        this.operation = 'insert'
        this.payload = payload
        return this
      }),
      update: vi.fn(function (payload: unknown) {
        this.operation = 'update'
        this.payload = payload
        return this
      }),
      delete: vi.fn(function () {
        this.operation = 'delete'
        return this
      }),
      single: vi.fn(function () {
        if (this.operation === 'insert') {
          return Promise.resolve({
            data: state.singleResult.error ? null : INSERTED_ROW,
            error: state.singleResult.error,
          })
        }
        return Promise.resolve(state.singleResult)
      }),
      maybeSingle: vi.fn(function () {
        return this.single()
      }),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        const result =
          this.operation === 'delete'
            ? Promise.resolve(state.deleteResult)
            : Promise.resolve(state.selectResult)
        return result.then(onFulfilled, onRejected)
      },
      catch(onRejected: (reason: unknown) => unknown) {
        const result =
          this.operation === 'delete'
            ? Promise.resolve(state.deleteResult)
            : Promise.resolve(state.selectResult)
        return result.catch(onRejected)
      },
    }
    return builder
  }

  mockFrom.mockImplementation((table: string) => {
    const builder = createBuilder()
    builder.table = table
    return builder
  })

  authGetSession.mockResolvedValue(SESSION_RESPONSE)

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: authGetSession,
      },
    },
  }
})

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children)
  }
}

describe('useScheduledExports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.selectResult = { data: ROWS, error: null }
    state.singleResult = { data: UPDATED_ROW, error: null }
    state.deleteResult = { data: null, error: null }
    authGetSession.mockResolvedValue(SESSION_RESPONSE)
  })

  it('charge les exports planifiés pour un dashboard et retourne les valeurs métier attendues', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useScheduledExports('dash-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const builder = mockFrom.mock.results[0]?.value as {
      select: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      order: ReturnType<typeof vi.fn>
    }

    expect(mockFrom).toHaveBeenCalledWith('custom_dashboard_exports')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('dashboard_id', 'dash-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result.current.data).toEqual(ROWS)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].id).toBe('exp-2')
    expect(result.current.data?.[0].format).toBe('xlsx')
    expect(result.current.data?.[0].frequency).toBe('weekly')
    expect(result.current.data?.[1].recipients).toEqual(['team@example.com', 'owner@example.com'])
  })

  it('ne lance pas la requête si dashboardId est undefined', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useScheduledExports(undefined), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('passe en erreur quand la requête supabase échoue', async () => {
    state.selectResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()

    const { result } = renderHook(() => useScheduledExports('dash-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
    expect(result.current.error?.message).toBe('x')
  })
})

describe('useUpsertScheduledExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.selectResult = { data: ROWS, error: null }
    state.singleResult = { data: UPDATED_ROW, error: null }
    state.deleteResult = { data: null, error: null }
    authGetSession.mockResolvedValue(SESSION_RESPONSE)
  })

  it('met à jour une planification existante avec le bon payload et invalide la requête ciblée', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useUpsertScheduledExport(), { wrapper })

    const input = {
      id: 'exp-1',
      dashboard_id: 'dash-1',
      format: 'pdf' as const,
      frequency: 'monthly' as const,
      hour_utc: 14,
      day_of_month: 15,
      recipients: ['finance@example.com'],
      is_active: false,
    }

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    const builder = mockFrom.mock.results[0]?.value as {
      update: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      select: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
    }

    expect(mockFrom).toHaveBeenCalledWith('custom_dashboard_exports')
    expect(builder.update).toHaveBeenCalledWith({
      dashboard_id: 'dash-1',
      format: 'pdf',
      frequency: 'monthly',
      hour_utc: 14,
      day_of_week: null,
      day_of_month: 15,
      recipients: ['finance@example.com'],
      is_active: false,
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'exp-1')
    expect(builder.select).toHaveBeenCalledWith()
    expect(builder.single).toHaveBeenCalled()
    expect(authGetSession).not.toHaveBeenCalled()
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['scheduled_exports', 'dash-1'] })
    expect(toastSuccess).toHaveBeenCalledWith('Planification enregistrée')
  })

  it('crée une planification avec created_by depuis la session et les valeurs par défaut', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useUpsertScheduledExport(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        dashboard_id: 'dash-1',
        format: 'xlsx',
        frequency: 'daily',
        hour_utc: 6,
        recipients: ['new@example.com'],
      })
    })

    const builder = mockFrom.mock.results[0]?.value as {
      insert: ReturnType<typeof vi.fn>
      select: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
    }

    expect(authGetSession).toHaveBeenCalledTimes(1)
    expect(builder.insert).toHaveBeenCalledWith({
      dashboard_id: 'dash-1',
      format: 'xlsx',
      frequency: 'daily',
      hour_utc: 6,
      day_of_week: null,
      day_of_month: null,
      recipients: ['new@example.com'],
      is_active: true,
      created_by: 'user-1',
    })
    expect(builder.select).toHaveBeenCalledWith()
    expect(builder.single).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Planification enregistrée')
  })

  it('remonte une erreur de mutation et affiche le toast error', async () => {
    state.singleResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()

    const { result } = renderHook(() => useUpsertScheduledExport(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'exp-1',
          dashboard_id: 'dash-1',
          format: 'pdf',
        }),
      ).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toastError).toHaveBeenCalledWith('x')
  })
})

describe('useDeleteScheduledExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.selectResult = { data: ROWS, error: null }
    state.singleResult = { data: UPDATED_ROW, error: null }
    state.deleteResult = { data: null, error: null }
  })

  it('supprime une planification par id, invalide la clé racine et affiche un succès', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useDeleteScheduledExport(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('exp-2')
    })

    const builder = mockFrom.mock.results[0]?.value as {
      delete: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
    }

    expect(mockFrom).toHaveBeenCalledWith('custom_dashboard_exports')
    expect(builder.delete).toHaveBeenCalledWith()
    expect(builder.eq).toHaveBeenCalledWith('id', 'exp-2')
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['scheduled_exports'] })
    expect(toastSuccess).toHaveBeenCalledWith('Planification supprimée')
  })

  it('passe en erreur si la suppression échoue', async () => {
    state.deleteResult = { data: null, error: { message: 'x' } }

    const wrapper = createWrapper()

    const { result } = renderHook(() => useDeleteScheduledExport(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('exp-2')).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})