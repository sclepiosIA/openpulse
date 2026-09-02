import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

const {
  BUDGET_ROWS,
  BUDGET_LIGNES_ROWS,
  BUDGET_VS_REEL_ROWS,
  CREATED_BUDGET,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  resetSupabaseMock,
  setSupabaseMode,
  getSupabaseCalls,
} = vi.hoisted(() => {
  type Mode = 'success' | 'error'

  type QueryError = {
    message: string
  }

  type QueryResult = {
    data: unknown
    error: QueryError | null
  }

  type SupabaseCall = {
    table: string
    method: string
    args: unknown[]
  }

  type SupabaseBuilder = {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<QueryResult | TResult>
  }

  const BUDGET_ROWS = [
    {
      id: 'budget-1',
      libelle: 'Budget principal',
      exercice_id: 'ex-2024',
      statut: 'valide',
    },
    {
      id: 'budget-2',
      libelle: 'Budget brouillon',
      exercice_id: null,
      statut: 'brouillon',
    },
  ]

  const BUDGET_LIGNES_ROWS = [
    {
      id: 'ligne-1',
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 1,
      montant: 1200,
      commentaire: 'Janvier',
    },
    {
      id: 'ligne-2',
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 2,
      montant: 1350,
      commentaire: null,
    },
  ]

  const BUDGET_VS_REEL_ROWS = [
    {
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 1,
      budget: 1200,
      reel: 950,
      ecart: 250,
    },
  ]

  const CREATED_BUDGET = {
    id: 'budget-new',
    libelle: 'Nouveau budget',
    exercice_id: 'ex-2025',
    statut: 'brouillon',
  }

  const ERROR_RESULT = {
    data: null,
    error: { message: 'x' },
  }

  let mode: Mode = 'success'
  let currentTable = ''
  let lastMutation: 'insert' | 'upsert' | 'delete' | 'update' | null = null
  const calls: SupabaseCall[] = []

  const pushCall = (method: string, args: unknown[]) => {
    calls.push({ table: currentTable, method, args })
  }

  const resolveResult = (): QueryResult => {
    if (mode === 'error') {
      return ERROR_RESULT
    }

    if (lastMutation === 'insert') {
      return { data: CREATED_BUDGET, error: null }
    }

    if (lastMutation === 'upsert' || lastMutation === 'delete' || lastMutation === 'update') {
      return { data: null, error: null }
    }

    if (currentTable === 'compta_budgets') {
      return { data: BUDGET_ROWS, error: null }
    }

    if (currentTable === 'compta_budget_lignes') {
      return { data: BUDGET_LIGNES_ROWS, error: null }
    }

    if (currentTable === 'v_compta_budget_vs_reel') {
      return { data: BUDGET_VS_REEL_ROWS, error: null }
    }

    return { data: [], error: null }
  }

  const builder = {} as SupabaseBuilder

  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      if (
        method === 'insert' ||
        method === 'upsert' ||
        method === 'delete' ||
        method === 'update'
      ) {
        lastMutation = method
      }

      pushCall(method, args)
      return builder
    }

  builder.select = vi.fn(chain('select'))
  builder.eq = vi.fn(chain('eq'))
  builder.gte = vi.fn(chain('gte'))
  builder.lte = vi.fn(chain('lte'))
  builder.in = vi.fn(chain('in'))
  builder.order = vi.fn(chain('order'))
  builder.limit = vi.fn(chain('limit'))
  builder.insert = vi.fn(chain('insert'))
  builder.update = vi.fn(chain('update'))
  builder.upsert = vi.fn(chain('upsert'))
  builder.delete = vi.fn(chain('delete'))
  builder.single = vi.fn(() => {
    pushCall('single', [])
    return Promise.resolve(resolveResult())
  })
  builder.maybeSingle = vi.fn(() => {
    pushCall('maybeSingle', [])
    return Promise.resolve(resolveResult())
  })
  builder.then = (onfulfilled, onrejected) =>
    Promise.resolve(resolveResult()).then(onfulfilled, onrejected)
  builder.catch = (onrejected) => Promise.resolve(resolveResult()).catch(onrejected)

  const mockFrom = vi.fn((table: string) => {
    currentTable = table
    lastMutation = null
    calls.push({ table, method: 'from', args: [table] })
    return builder
  })

  const resetSupabaseMock = () => {
    mode = 'success'
    currentTable = ''
    lastMutation = null
    calls.length = 0
    mockFrom.mockClear()
    builder.select.mockClear()
    builder.eq.mockClear()
    builder.gte.mockClear()
    builder.lte.mockClear()
    builder.in.mockClear()
    builder.order.mockClear()
    builder.limit.mockClear()
    builder.insert.mockClear()
    builder.update.mockClear()
    builder.upsert.mockClear()
    builder.delete.mockClear()
    builder.single.mockClear()
    builder.maybeSingle.mockClear()
  }

  return {
    BUDGET_ROWS,
    BUDGET_LIGNES_ROWS,
    BUDGET_VS_REEL_ROWS,
    CREATED_BUDGET,
    mockFrom,
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    resetSupabaseMock,
    setSupabaseMode: (nextMode: Mode) => {
      mode = nextMode
    },
    getSupabaseCalls: () => calls,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

import {
  useBudgetLignes,
  useBudgetVsReel,
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useUpsertBudgetLigne,
} from './useBudget'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  resetSupabaseMock()
  mockToastSuccess.mockClear()
  mockToastError.mockClear()
})

describe('useBudget', () => {
  it('charge puis retourne les budgets triés avec les valeurs métier attendues', async () => {
    const { result } = renderHook(() => useBudgets(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(BUDGET_ROWS)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'budget-1',
      libelle: 'Budget principal',
      exercice_id: 'ex-2024',
      statut: 'valide',
    })
    expect(result.current.data?.[1]).toMatchObject({
      id: 'budget-2',
      libelle: 'Budget brouillon',
      exercice_id: null,
      statut: 'brouillon',
    })
    expect(mockFrom).toHaveBeenCalledWith('compta_budgets')
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'select',
      args: ['*'],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('expose isError quand la récupération des budgets échoue', async () => {
    setSupabaseMode('error')

    const { result } = renderHook(() => useBudgets(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(result.current.data).toBeUndefined()
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'select',
      args: ['*'],
    })
  })

  it('retourne les lignes du budget demandé et filtre par budget_id', async () => {
    const { result } = renderHook(() => useBudgetLignes('budget-1'), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(BUDGET_LIGNES_ROWS)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'ligne-1',
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 1,
      montant: 1200,
      commentaire: 'Janvier',
    })
    expect(result.current.data?.[1]).toMatchObject({
      id: 'ligne-2',
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 2,
      montant: 1350,
      commentaire: null,
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budget_lignes',
      method: 'select',
      args: ['*'],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budget_lignes',
      method: 'eq',
      args: ['budget_id', 'budget-1'],
    })
  })

  it('ne lance pas la requête des lignes quand budgetId est null', () => {
    const { result } = renderHook(() => useBudgetLignes(null), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('expose isError quand la récupération des lignes échoue', async () => {
    setSupabaseMode('error')

    const { result } = renderHook(() => useBudgetLignes('budget-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budget_lignes',
      method: 'eq',
      args: ['budget_id', 'budget-1'],
    })
  })

  it('retourne le comparatif budget vs réel du budget demandé', async () => {
    const { result } = renderHook(() => useBudgetVsReel('budget-1'), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(BUDGET_VS_REEL_ROWS)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]).toMatchObject({
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 1,
      budget: 1200,
      reel: 950,
      ecart: 250,
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'v_compta_budget_vs_reel',
      method: 'select',
      args: ['*'],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'v_compta_budget_vs_reel',
      method: 'eq',
      args: ['budget_id', 'budget-1'],
    })
  })

  it('ne lance pas la requête du comparatif quand budgetId est null', () => {
    const { result } = renderHook(() => useBudgetVsReel(null), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('expose isError quand la récupération du comparatif échoue', async () => {
    setSupabaseMode('error')

    const { result } = renderHook(() => useBudgetVsReel('budget-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'v_compta_budget_vs_reel',
      method: 'eq',
      args: ['budget_id', 'budget-1'],
    })
  })

  it('crée un budget, invalide la liste et affiche un toast de succès', async () => {
    const { result } = renderHook(() => useCreateBudget(), { wrapper: createWrapper() })
    const payload = { libelle: 'Nouveau budget', exercice_id: 'ex-2025' }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(CREATED_BUDGET)
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'insert',
      args: [payload],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'select',
      args: [],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'single',
      args: [],
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Budget créé')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('affiche un toast erreur quand la création échoue', async () => {
    setSupabaseMode('error')
    const { result } = renderHook(() => useCreateBudget(), { wrapper: createWrapper() })
    const payload = { libelle: 'Budget erreur' }
    let caughtError: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync(payload)
      } catch (error) {
        caughtError = error
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(caughtError).toMatchObject({ message: 'x' })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'insert',
      args: [payload],
    })
    expect(mockToastError).toHaveBeenCalledWith('x')
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('upsert une ligne de budget avec la contrainte attendue', async () => {
    const { result } = renderHook(() => useUpsertBudgetLigne(), { wrapper: createWrapper() })
    const payload = {
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 3,
      montant: 1500,
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budget_lignes',
      method: 'upsert',
      args: [payload, { onConflict: 'budget_id,compte_id,mois' }],
    })
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('affiche un toast erreur quand l’upsert de ligne échoue', async () => {
    setSupabaseMode('error')
    const { result } = renderHook(() => useUpsertBudgetLigne(), { wrapper: createWrapper() })
    const payload = {
      budget_id: 'budget-1',
      compte_id: 'compte-701',
      mois: 3,
      montant: 1500,
    }
    let caughtError: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync(payload)
      } catch (error) {
        caughtError = error
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(caughtError).toMatchObject({ message: 'x' })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budget_lignes',
      method: 'upsert',
      args: [payload, { onConflict: 'budget_id,compte_id,mois' }],
    })
    expect(mockToastError).toHaveBeenCalledWith('x')
  })

  it('supprime un budget et affiche un toast de succès', async () => {
    const { result } = renderHook(() => useDeleteBudget(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('budget-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'delete',
      args: [],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'eq',
      args: ['id', 'budget-1'],
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Budget supprimé')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('expose isError quand la suppression échoue', async () => {
    setSupabaseMode('error')
    const { result } = renderHook(() => useDeleteBudget(), { wrapper: createWrapper() })
    let caughtError: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync('budget-1')
      } catch (error) {
        caughtError = error
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(caughtError).toMatchObject({ message: 'x' })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'delete',
      args: [],
    })
    expect(getSupabaseCalls()).toContainEqual({
      table: 'compta_budgets',
      method: 'eq',
      args: ['id', 'budget-1'],
    })
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
