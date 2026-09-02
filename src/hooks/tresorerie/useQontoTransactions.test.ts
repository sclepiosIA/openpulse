import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useQontoTransactions } from './useQontoTransactions'

const {
  state,
  resetState,
  mockFrom,
  mockInvoke,
  mockToastSuccess,
  mockToastError,
  mockSanitize,
} = vi.hoisted(() => {
  const TX_ROWS = [
    {
      id: 't1',
      qonto_transaction_id: 'q1',
      date_operation: '2024-03-10',
      date_valeur: '2024-03-10',
      montant: 1500,
      libelle: 'Facture client A',
      type_operation: 'credit',
      categorie_code: null,
      reconcilie: false,
      recette_id: null,
      depense_id: null,
      notes: null,
      qonto_account_id: 'acc1',
      raw_qonto_data: null,
      created_at: '2024-03-10T00:00:00Z',
    },
    {
      id: 't2',
      qonto_transaction_id: 'q2',
      date_operation: '2024-03-05',
      date_valeur: '2024-03-05',
      montant: -200,
      libelle: 'Abonnement SaaS',
      type_operation: 'debit',
      categorie_code: null,
      reconcilie: true,
      recette_id: 'r9',
      depense_id: null,
      notes: null,
      qonto_account_id: 'acc1',
      raw_qonto_data: null,
      created_at: '2024-03-05T00:00:00Z',
    },
  ]

  const CONNECTION = {
    id: 'c1',
    organization_id: 'org1',
    is_active: true,
    last_sync_at: '2024-03-01T00:00:00Z',
    bank_accounts: [{ iban: 'FR76TEST', balance: 12345.67, name: 'Compte principal' }],
    last_error: null,
    sync_count: 5,
  }

  type Result = { data: unknown; error: { message: string } | null }

  const state = {
    results: {} as Record<string, Result>,
    updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
    builders: [] as Array<{ table: string; builder: Record<string, ReturnType<typeof vi.fn>> }>,
  }

  const resetState = () => {
    state.results = {
      tresorerie_operations_bancaires: { data: TX_ROWS, error: null },
      tresorerie_qonto_connections: { data: CONNECTION, error: null },
      tresorerie_revenus: { data: null, error: null },
    }
    state.updates = []
    state.builders = []
  }
  resetState()

  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {}
    const chainMethods = ['select', 'order', 'limit', 'eq', 'or', 'gte', 'lte', 'in', 'insert', 'delete']
    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder)
    }
    builder.update = vi.fn((payload: Record<string, unknown>) => {
      state.updates.push({ table, payload })
      return builder
    })
    builder.maybeSingle = vi.fn(() => Promise.resolve(state.results[table]))
    builder.single = vi.fn(() => Promise.resolve(state.results[table]))
    builder.then = (
      resolve?: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(state.results[table]).then(resolve, reject)
    builder.catch = (reject?: (e: unknown) => unknown) =>
      Promise.resolve(state.results[table]).catch(reject)
    state.builders.push({ table, builder: builder as Record<string, ReturnType<typeof vi.fn>> })
    return builder
  }

  const mockFrom = vi.fn((table: string) => makeBuilder(table))
  const mockInvoke = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockSanitize = vi.fn((e: unknown) =>
    e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  )

  return { state, resetState, mockFrom, mockInvoke, mockToastSuccess, mockToastError, mockSanitize }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}))

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useQontoTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })

  it('est en chargement initialement puis retourne les transactions et la connexion', async () => {
    const { result } = renderHook(() => useQontoTransactions(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.transactions).toEqual([])

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.transactions).toHaveLength(2)
    expect(result.current.transactions[0].libelle).toBe('Facture client A')
    expect(result.current.transactions[0].montant).toBe(1500)
    expect(result.current.transactions[1].type_operation).toBe('debit')

    await waitFor(() => expect(result.current.isConnectionLoading).toBe(false))
    expect(result.current.connection?.organization_id).toBe('org1')
    expect(result.current.connection?.sync_count).toBe(5)
    expect(result.current.connection?.bank_accounts?.[0]?.name).toBe('Compte principal')

    expect(mockFrom).toHaveBeenCalledWith('tresorerie_operations_bancaires')
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_qonto_connections')
  })

  it('applique les filtres type/fromDate/toDate sur la requête', async () => {
    const { result } = renderHook(
      () =>
        useQontoTransactions({
          type: 'credit',
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const opsEntry = state.builders.find((b) => b.table === 'tresorerie_operations_bancaires')
    expect(opsEntry).toBeDefined()
    expect(opsEntry?.builder.eq).toHaveBeenCalledWith('type_operation', 'credit')
    expect(opsEntry?.builder.gte).toHaveBeenCalledWith('date_operation', '2024-01-01')
    expect(opsEntry?.builder.lte).toHaveBeenCalledWith('date_operation', '2024-12-31')
    expect(opsEntry?.builder.order).toHaveBeenCalledWith('date_operation', { ascending: false })
    expect(opsEntry?.builder.limit).toHaveBeenCalledWith(2000)
  })

  it('passe en erreur si la requête transactions échoue', async () => {
    state.results.tresorerie_operations_bancaires = {
      data: null,
      error: { message: 'x' },
    }

    const { result } = renderHook(() => useQontoTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(result.current.transactions).toEqual([])
  }, 10000)

  it('synchronise via la fonction edge et affiche un toast de succès', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        transactions_fetched: 3,
        auto_reconciled: 1,
        transactions_skipped: 0,
        total_from_qonto: 10,
      },
      error: null,
    })

    const { result } = renderHook(() => useQontoTransactions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.sync({ days_back: 30 })
    })

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    expect(mockInvoke).toHaveBeenCalledWith('qonto-sync-transactions', {
      body: { days_back: 30 },
    })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Synchronisation Qonto réussie',
      expect.objectContaining({
        description: '3 nouvelles transactions importées, 1 rapprochées automatiquement (10 total Qonto)',
      })
    )
  })

  it('affiche un toast d’erreur si la config Qonto est manquante', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, config_missing: true },
      error: null,
    })

    const { result } = renderHook(() => useQontoTransactions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.sync()
    })

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    expect(mockToastError).toHaveBeenCalledWith(
      'Erreur de synchronisation Qonto',
      expect.objectContaining({
        description: expect.stringContaining('Configuration Qonto manquante'),
        duration: 8000,
      })
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('rapproche une transaction et met à jour le revenu en payé', async () => {
    const { result } = renderHook(() => useQontoTransactions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    state.results.tresorerie_operations_bancaires = {
      data: { date_operation: '2024-03-10' },
      error: null,
    }

    await act(async () => {
      result.current.reconcile({ transactionId: 't1', revenuId: 'r1' })
    })

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Rapprochement effectué'))

    const opUpdate = state.updates.find((u) => u.table === 'tresorerie_operations_bancaires')
    expect(opUpdate?.payload).toEqual({ recette_id: 'r1', reconcilie: true })

    const revUpdate = state.updates.find((u) => u.table === 'tresorerie_revenus')
    expect(revUpdate?.payload).toEqual({
      statut: 'paye',
      date_paiement_reel: '2024-03-10',
    })
  })

  it('annule un rapprochement et repasse le revenu en facture', async () => {
    const { result } = renderHook(() => useQontoTransactions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.unreconcile({ transactionId: 't2', revenuId: 'r9' })
    })

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Rapprochement annulé'))

    const opUpdate = state.updates.find((u) => u.table === 'tresorerie_operations_bancaires')
    expect(opUpdate?.payload).toEqual({ recette_id: null, reconcilie: false })

    const revUpdate = state.updates.find((u) => u.table === 'tresorerie_revenus')
    expect(revUpdate?.payload).toEqual({ statut: 'facture', date_paiement_reel: null })
  })
})