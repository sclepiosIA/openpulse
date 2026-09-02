import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { ROWS, DEPENSES, OPERATIONS_ERR, MUTATION_ERR, state, mockFrom, mockToast } = vi.hoisted(() => {
  type OperationRow = {
    id: string
    date_operation: string
    libelle: string
    montant: number
    categorie_code: string | null
    depense_id: string | null
    notes: string | null
    qonto_transaction_id: string | null
  }

  type DepenseRow = {
    id: string
    nom: string
    montant: number
    statut: string | null
  }

  const ROWS: OperationRow[] = [
    {
      id: 't1',
      date_operation: '2024-05-10',
      libelle: 'CB Supermarché',
      montant: -42.5,
      categorie_code: null,
      depense_id: 'd1',
      notes: null,
      qonto_transaction_id: 'q1',
    },
    {
      id: 't2',
      date_operation: '2024-05-09',
      libelle: 'CB Essence',
      montant: -60,
      categorie_code: 'CARB',
      depense_id: null,
      notes: 'plein',
      qonto_transaction_id: 'q2',
    },
  ]

  const DEPENSES: DepenseRow[] = [{ id: 'd1', nom: 'Courses', montant: 42.5, statut: 'payee' }]

  const OPERATIONS_ERR = { message: 'boom' }
  const MUTATION_ERR = { message: 'update failed' }

  interface State {
    operations: { data: OperationRow[] | null; error: { message: string } | null }
    depenses: { data: DepenseRow[] | null; error: { message: string } | null }
    mutationError: { message: string } | null
    updateCalls: Array<{ table: string; payload: Record<string, unknown>; eq?: [string, string] }>
  }

  const state: State = {
    operations: { data: ROWS, error: null },
    depenses: { data: DEPENSES, error: null },
    mutationError: null,
    updateCalls: [],
  }

  type BuilderResponse = { data: unknown; error: { message: string } | null }
  type Builder = {
    select: (...args: unknown[]) => Builder
    update: (payload: Record<string, unknown>) => Builder
    eq: (...args: unknown[]) => Builder
    in: (...args: unknown[]) => Builder
    order: (...args: unknown[]) => Builder
    limit: (...args: unknown[]) => Builder
    insert: (...args: unknown[]) => Builder
    delete: (...args: unknown[]) => Builder
    single: () => Promise<BuilderResponse>
    maybeSingle: () => Promise<BuilderResponse>
    then: (onFulfilled: (value: BuilderResponse) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
    catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>
  }

  const createBuilder = (table: string): Builder => {
    const callState: {
      table: string
      action: 'select' | 'update' | 'insert' | 'delete' | null
      filters: Array<{ type: 'eq' | 'in'; args: unknown[] }>
      selectArgs?: unknown[]
      update?: Record<string, unknown>
    } = { table, action: null, filters: [] }

    const getResponse = (): BuilderResponse => {
      if (callState.action === 'select') {
        if (table === 'tresorerie_operations_bancaires') {
          return { data: state.operations.data, error: state.operations.error }
        }
        if (table === 'tresorerie_depenses') {
          return { data: state.depenses.data, error: state.depenses.error }
        }
        return { data: null, error: null }
      }
      if (callState.action === 'update') {
        if (state.mutationError) {
          return { data: null, error: state.mutationError }
        }
        return { data: null, error: null }
      }
      return { data: null, error: null }
    }

    const b: Builder = {
      select: (...args: unknown[]) => {
        callState.action = 'select'
        callState.selectArgs = args
        return b
      },
      update: (payload: Record<string, unknown>) => {
        callState.action = 'update'
        callState.update = payload
        state.updateCalls.push({ table, payload })
        return b
      },
      eq: (...args: unknown[]) => {
        callState.filters.push({ type: 'eq', args })
        if (callState.action === 'update' && args[0] === 'id' && typeof args[1] === 'string') {
          const last = state.updateCalls[state.updateCalls.length - 1]
          if (last) last.eq = ['id', args[1] as string]
        }
        return b
      },
      in: (...args: unknown[]) => {
        callState.filters.push({ type: 'in', args })
        return b
      },
      order: (..._args: unknown[]) => b,
      limit: (..._args: unknown[]) => b,
      insert: (..._args: unknown[]) => {
        callState.action = 'insert'
        return b
      },
      delete: (..._args: unknown[]) => {
        callState.action = 'delete'
        return b
      },
      single: async () => getResponse(),
      maybeSingle: async () => getResponse(),
      then: (onFulfilled: (value: BuilderResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(getResponse()).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(getResponse()).catch(onRejected),
    }
    return b
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table))
  const mockToast = vi.fn()

  return { ROWS, DEPENSES, OPERATIONS_ERR, MUTATION_ERR, state, mockFrom, mockToast }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { useQontoDebits } from './useQontoDebits'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { Wrapper, queryClient }
}

describe('useQontoDebits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.operations = { data: ROWS, error: null }
    state.depenses = { data: DEPENSES, error: null }
    state.mutationError = null
    state.updateCalls.length = 0
  })

  it('returns isLoading initially and then debits with linked depenses', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useQontoDebits(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.debits.length).toBe(2)
    })

    const t1 = result.current.debits.find((d) => d.id === 't1')
    const t2 = result.current.debits.find((d) => d.id === 't2')

    expect(t1).toBeTruthy()
    expect(t1?.libelle).toBe('CB Supermarché')
    expect(t1?.depense_liee).toEqual({ id: 'd1', nom: 'Courses', montant: 42.5, statut: 'payee' })

    expect(t2).toBeTruthy()
    expect(t2?.libelle).toBe('CB Essence')
    expect(t2?.depense_liee).toBeNull()
  })

  it('handles query error state', async () => {
    const { Wrapper, queryClient } = createWrapper()
    state.operations = { data: null, error: OPERATIONS_ERR }

    const { result } = renderHook(() => useQontoDebits(), { wrapper: Wrapper })
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      const q = queryClient.getQueryState(['qonto-debits'])
      expect(q?.status).toBe('error')
      const err = q?.error as { message: string } | undefined
      expect(err?.message).toBe('boom')
    })

    expect(result.current.debits).toEqual([])
  })

  it('updates categorie and invalidates query on success', async () => {
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useQontoDebits(), { wrapper: Wrapper })

    await waitFor(() => {
      const q = queryClient.getQueryState(['qonto-debits'])
      expect(Boolean(q && (q.status === 'success' || q.status === 'error'))).toBe(true)
    })

    await act(async () => {
      result.current.updateCategorie({ id: 't2', categorie_code: 'FOOD' })
    })

    await waitFor(() => {
      expect(state.updateCalls.length).toBe(1)
      const call = state.updateCalls[0]
      expect(call.table).toBe('tresorerie_operations_bancaires')
      expect(call.payload).toEqual({ categorie_code: 'FOOD' })
      expect(call.eq).toEqual(['id', 't2'])
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['qonto-debits'] })
    })
  })

  it('shows toast on mutation error', async () => {
    const { Wrapper, queryClient } = createWrapper()
    state.mutationError = MUTATION_ERR
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useQontoDebits(), { wrapper: Wrapper })

    await act(async () => {
      result.current.updateCategorie({ id: 't1', categorie_code: 'FOOD' })
    })

    await waitFor(() => {
      expect(state.updateCalls.length).toBe(1)
      expect(mockToast).toHaveBeenCalledTimes(1)
      const arg = mockToast.mock.calls[0][0]
      expect(arg).toEqual({ title: 'Erreur', description: 'update failed', variant: 'destructive' })
      expect(invalidateSpy).not.toHaveBeenCalled()
    })
  })
})