/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useQontoCredits } from './useQontoCredits'

const {
  CREDIT_ROWS,
  REVENUE_ROWS,
  ETAB_ROWS,
  LINKED_ROWS,
  FORECAST_ROWS,
  toastMock,
  mockFrom,
  state,
} = vi.hoisted(() => {
  const CREDIT_ROWS = [
    {
      id: 'op-1',
      date_operation: '2024-04-10',
      libelle: 'Virement client A',
      montant: 1500,
      categorie_code: 'CAT-A',
      recette_id: 'rev-1',
      notes: 'note A',
      qonto_transaction_id: 'txn-1',
    },
    {
      id: 'op-2',
      date_operation: '2024-04-09',
      libelle: 'Virement client B',
      montant: 700,
      categorie_code: null,
      recette_id: null,
      notes: null,
      qonto_transaction_id: 'txn-2',
    },
  ]

  const REVENUE_ROWS = [
    {
      id: 'rev-1',
      montant_prevu: 1500,
      mois: '2024-04',
      statut: 'contractualise',
      etablissement_id: 'etab-1',
    },
  ]

  const ETAB_ROWS = [{ id: 'etab-1', nom: 'Campus Paris' }]

  const LINKED_ROWS = [{ recette_id: 'rev-1' }]

  const FORECAST_ROWS = [
    {
      id: 'rev-1',
      montant_prevu: 1500,
      mois: '2024-04',
      etablissement_id: 'etab-1',
      statut: 'contractualise',
      type_revenu: 'formation',
      notes: 'deja lie',
    },
    {
      id: 'rev-2',
      montant_prevu: 900,
      mois: '2024-05',
      etablissement_id: 'etab-1',
      statut: 'contractualise',
      type_revenu: 'acompte',
      notes: 'a lier',
    },
  ]

  const toastMock = vi.fn()

  const state = {
    creditsError: false,
    forecastError: false,
    mutationErrorMessage: null as string | null,
    fromCalls: [] as string[],
    updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
    filters: [] as Array<{ table: string; method: string; args: unknown[] }>,
  }

  const responseForTable = (table: string, selectArg: string | undefined) => {
    if (table === 'tresorerie_operations_bancaires') {
      if (state.creditsError && selectArg && selectArg.includes('id, date_operation')) {
        return { data: null, error: { message: 'credits failed' } }
      }
      if (selectArg === 'recette_id') {
        return { data: LINKED_ROWS, error: null }
      }
      return { data: CREDIT_ROWS, error: null }
    }

    if (table === 'tresorerie_revenus') {
      if (state.forecastError && selectArg && selectArg.includes('type_revenu')) {
        return { data: null, error: { message: 'forecast failed' } }
      }
      if (selectArg && selectArg.includes('type_revenu')) {
        return { data: FORECAST_ROWS, error: null }
      }
      return { data: REVENUE_ROWS, error: null }
    }

    if (table === 'etablissements') {
      return { data: ETAB_ROWS, error: null }
    }

    return { data: [], error: null }
  }

  const mockFrom = vi.fn((table: string) => {
    state.fromCalls.push(table)

    let lastSelectArg: string | undefined

    const builder = {
      select: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'select', args })
        lastSelectArg = typeof args[0] === 'string' ? args[0] : undefined
        return builder
      }),
      eq: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'eq', args })
        return builder
      }),
      gte: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'gte', args })
        return builder
      }),
      lte: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'lte', args })
        return builder
      }),
      in: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'in', args })
        return builder
      }),
      order: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'order', args })
        return builder
      }),
      limit: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'limit', args })
        return builder
      }),
      not: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'not', args })
        return builder
      }),
      neq: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'neq', args })
        return builder
      }),
      insert: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'insert', args })
        return builder
      }),
      update: vi.fn((values: Record<string, unknown>) => {
        state.updates.push({ table, values })
        return builder
      }),
      delete: vi.fn((...args: unknown[]) => {
        state.filters.push({ table, method: 'delete', args })
        return builder
      }),
      single: vi.fn(async () => responseForTable(table, lastSelectArg)),
      maybeSingle: vi.fn(async () => responseForTable(table, lastSelectArg)),
      then: (
        onFulfilled: (value: {
          data: unknown
          error: { message: string } | null
        }) => unknown
      ) => {
        const isMutation = state.updates.some((entry) => entry.table === table)
        const response = isMutation && state.mutationErrorMessage
          ? { data: null, error: { message: state.mutationErrorMessage } }
          : responseForTable(table, lastSelectArg)
        return Promise.resolve(response).then(onFulfilled)
      },
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(responseForTable(table, lastSelectArg)).catch(onRejected),
    }

    return builder
  })

  return {
    CREDIT_ROWS,
    REVENUE_ROWS,
    ETAB_ROWS,
    LINKED_ROWS,
    FORECAST_ROWS,
    toastMock,
    mockFrom,
    state,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return Wrapper
}

describe('useQontoCredits', () => {
  beforeEach(() => {
    state.creditsError = false
    state.forecastError = false
    state.mutationErrorMessage = null
    state.fromCalls = []
    state.updates = []
    state.filters = []
    mockFrom.mockClear()
    toastMock.mockClear()
  })

  it('charge puis retourne les crédits enrichis et les recettes prévisionnelles non liées', async () => {
    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.credits).toEqual([])
    expect(result.current.forecastRevenus).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.credits).toHaveLength(2)
    expect(result.current.credits[0]).toEqual({
      id: 'op-1',
      date_operation: '2024-04-10',
      libelle: 'Virement client A',
      montant: 1500,
      categorie_code: 'CAT-A',
      recette_id: 'rev-1',
      notes: 'note A',
      qonto_transaction_id: 'txn-1',
      recette_previsionnelle: {
        id: 'rev-1',
        montant_prevu: 1500,
        mois: '2024-04',
        etablissement_nom: 'Campus Paris',
        statut: 'contractualise',
      },
    })
    expect(result.current.credits[1]).toEqual({
      id: 'op-2',
      date_operation: '2024-04-09',
      libelle: 'Virement client B',
      montant: 700,
      categorie_code: null,
      recette_id: null,
      notes: null,
      qonto_transaction_id: 'txn-2',
      recette_previsionnelle: null,
    })

    expect(result.current.forecastRevenus).toEqual([
      {
        id: 'rev-2',
        montant_prevu: 900,
        mois: '2024-05',
        etablissement_id: 'etab-1',
        etablissement_nom: 'Campus Paris',
        statut: 'contractualise',
        type_revenu: 'acompte',
        notes: 'a lier',
      },
    ])

    expect(mockFrom).toHaveBeenCalledWith('tresorerie_operations_bancaires')
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_revenus')
    expect(mockFrom).toHaveBeenCalledWith('etablissements')
  })

  it('passe en erreur de query quand le chargement des crédits échoue', async () => {
    state.creditsError = true

    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.credits).toEqual([])
    expect(result.current.forecastRevenus).toEqual([
      {
        id: 'rev-2',
        montant_prevu: 900,
        mois: '2024-05',
        etablissement_id: 'etab-1',
        etablissement_nom: 'Campus Paris',
        statut: 'contractualise',
        type_revenu: 'acompte',
        notes: 'a lier',
      },
    ])
  })

  it('retourne une liste vide de forecastRevenus quand la query des prévisionnels échoue', async () => {
    state.forecastError = true

    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.credits[0].recette_previsionnelle).toEqual({
      id: 'rev-1',
      montant_prevu: 1500,
      mois: '2024-04',
      etablissement_nom: 'Campus Paris',
      statut: 'contractualise',
    })
    expect(result.current.forecastRevenus).toEqual([])
  })

  it('linkToForecast met à jour les deux tables et affiche un toast de succès', async () => {
    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.linkToForecast({ operationId: 'op-2', recetteId: 'rev-2' })
    })

    await waitFor(() => {
      expect(state.updates).toHaveLength(2)
    })

    expect(state.updates[0]).toEqual({
      table: 'tresorerie_operations_bancaires',
      values: { recette_id: 'rev-2' },
    })
    expect(state.updates[1].table).toBe('tresorerie_revenus')
    expect(state.updates[1].values.statut).toBe('paye')
    expect(typeof state.updates[1].values.date_paiement_reel).toBe('string')

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Lié avec succès',
      description: 'Le virement a été relié à la recette prévisionnelle',
    })
  })

  it('unlinkForecast supprime le lien et remet la recette en contractualise', async () => {
    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.unlinkForecast({ operationId: 'op-1', recetteId: 'rev-1' })
    })

    await waitFor(() => {
      expect(state.updates).toHaveLength(2)
    })

    expect(state.updates[0]).toEqual({
      table: 'tresorerie_operations_bancaires',
      values: { recette_id: null },
    })
    expect(state.updates[1]).toEqual({
      table: 'tresorerie_revenus',
      values: { statut: 'contractualise', date_paiement_reel: null },
    })

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Délié',
      description: 'Le lien avec la recette prévisionnelle a été supprimé',
    })
  })

  it('updateCategorie met à jour la catégorie de l opération', async () => {
    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.updateCategorie({ id: 'op-2', categorie_code: 'CAT-Z' })
    })

    await waitFor(() => {
      expect(state.updates).toHaveLength(1)
    })

    expect(state.updates[0]).toEqual({
      table: 'tresorerie_operations_bancaires',
      values: { categorie_code: 'CAT-Z' },
    })
  })

  it('affiche un toast destructif quand une mutation échoue', async () => {
    state.mutationErrorMessage = 'mutation failed'

    const { result } = renderHook(() => useQontoCredits(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.updateCategorie({ id: 'op-2', categorie_code: 'CAT-X' })
    })

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'mutation failed',
        variant: 'destructive',
      })
    })
  })
})