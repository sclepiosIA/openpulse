import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboardOverview, usePipelineBreakdown, useDashboardData } from './useDashboard'

const {
  AUTH_STATE,
  TOAST_FN,
  DEBUG_ERROR,
  OVERVIEW_RPC_DATA,
  BREAKDOWN_RPC_DATA,
  overviewError,
  breakdownError,
  mockRpc,
  queryPresets,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    loading: false,
    user: { id: 'u1', email: 't@t.co' },
  },
  TOAST_FN: vi.fn(),
  DEBUG_ERROR: vi.fn(),
  OVERVIEW_RPC_DATA: [
    {
      total_etablissements: '12',
      total_prospects: '5',
      total_pipeline: '8',
      total_contractuel: '2',
      total_production: '4',
      total_bloques: '1',
      valeur_bloquee: '1500',
      total_taches: '9',
      valeur_totale: '45000',
      valeur_pipeline: '12000',
    },
  ],
  BREAKDOWN_RPC_DATA: [
    { statut: 'prospect', count: '3', valeur_potentielle: '1000' },
    { statut: 'negociation', count: 2, valeur_potentielle: '2500' },
    { statut: 'contractuel', count: null, valeur_potentielle: null },
  ],
  overviewError: { message: 'overview failed' },
  breakdownError: { message: 'breakdown failed' },
  mockRpc: vi.fn(),
  queryPresets: {
    standard: {},
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    rpc: mockRpc,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets,
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.loading = false
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' }
  })

  describe('useDashboardOverview', () => {
    it('passe de isLoading au succès et transforme les valeurs métier', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_dashboard_overview') {
          return Promise.resolve({ data: OVERVIEW_RPC_DATA, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const { result } = renderHook(() => useDashboardOverview(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_overview')
      expect(result.current.data).toEqual({
        total_etablissements: 12,
        total_prospects: 5,
        total_pipeline: 8,
        total_contractuel: 2,
        total_production: 4,
        total_bloques: 1,
        valeur_bloquee: 1500,
        total_taches: 9,
        valeur_totale: 45000,
        valeur_pipeline: 12000,
      })
      expect(TOAST_FN).not.toHaveBeenCalled()
      expect(DEBUG_ERROR).not.toHaveBeenCalled()
    })

    it('remonte une erreur, passe en isError et déclenche toast + debug', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_dashboard_overview') {
          return Promise.resolve({ data: null, error: overviewError })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const { result } = renderHook(() => useDashboardOverview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_overview')
      expect(DEBUG_ERROR).toHaveBeenCalledWith('Error loading dashboard overview:', overviewError)
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Impossible de charger les statistiques du dashboard',
        variant: 'destructive',
      })
    })
  })

  describe('usePipelineBreakdown', () => {
    it('charge la répartition et convertit count/valeur_potentielle en nombres', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_pipeline_breakdown') {
          return Promise.resolve({ data: BREAKDOWN_RPC_DATA, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const { result } = renderHook(() => usePipelineBreakdown(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockRpc).toHaveBeenCalledWith('get_pipeline_breakdown')
      expect(result.current.data).toEqual([
        { statut: 'prospect', count: 3, valeur_potentielle: 1000 },
        { statut: 'negociation', count: 2, valeur_potentielle: 2500 },
        { statut: 'contractuel', count: 0, valeur_potentielle: 0 },
      ])
      expect(TOAST_FN).not.toHaveBeenCalled()
    })

    it('passe en isError et affiche le toast en cas d’échec', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_pipeline_breakdown') {
          return Promise.resolve({ data: null, error: breakdownError })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const { result } = renderHook(() => usePipelineBreakdown(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockRpc).toHaveBeenCalledWith('get_pipeline_breakdown')
      expect(DEBUG_ERROR).toHaveBeenCalledWith('Error loading pipeline breakdown:', breakdownError)
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Impossible de charger la répartition du pipeline',
        variant: 'destructive',
      })
    })
  })

  describe('useDashboardData', () => {
    it('charge overview et breakdown en parallèle avec un état agrégé cohérent', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_dashboard_overview') {
          return Promise.resolve({ data: OVERVIEW_RPC_DATA, error: null })
        }
        if (fn === 'get_pipeline_breakdown') {
          return Promise.resolve({ data: BREAKDOWN_RPC_DATA, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.overview).toBeUndefined()
      expect(result.current.breakdown).toBeUndefined()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_overview')
      expect(mockRpc).toHaveBeenCalledWith('get_pipeline_breakdown')
      expect(result.current.isLoadingOverview).toBe(false)
      expect(result.current.isLoadingBreakdown).toBe(false)
      expect(result.current.overview).toEqual({
        total_etablissements: 12,
        total_prospects: 5,
        total_pipeline: 8,
        total_contractuel: 2,
        total_production: 4,
        total_bloques: 1,
        valeur_bloquee: 1500,
        total_taches: 9,
        valeur_totale: 45000,
        valeur_pipeline: 12000,
      })
      expect(result.current.breakdown).toEqual([
        { statut: 'prospect', count: 3, valeur_potentielle: 1000 },
        { statut: 'negociation', count: 2, valeur_potentielle: 2500 },
        { statut: 'contractuel', count: 0, valeur_potentielle: 0 },
      ])
    })

    it('continue de fournir le breakdown mais reste en chargement tant que l’overview n’a pas fini', async () => {
      let resolveOverview:
        | ((value: { data: typeof OVERVIEW_RPC_DATA; error: null }) => void)
        | undefined

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_dashboard_overview') {
          return new Promise((resolve) => {
            resolveOverview = resolve
          })
        }
        if (fn === 'get_pipeline_breakdown') {
          return Promise.resolve({ data: BREAKDOWN_RPC_DATA, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const { result } = renderHook(() => useDashboardData(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.breakdown).toEqual([
          { statut: 'prospect', count: 3, valeur_potentielle: 1000 },
          { statut: 'negociation', count: 2, valeur_potentielle: 2500 },
          { statut: 'contractuel', count: 0, valeur_potentielle: 0 },
        ])
      })

      expect(result.current.overview).toBeUndefined()
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isLoadingBreakdown).toBe(false)
      expect(result.current.isLoadingOverview).toBe(true)

      resolveOverview?.({ data: OVERVIEW_RPC_DATA, error: null })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.overview).toEqual({
        total_etablissements: 12,
        total_prospects: 5,
        total_pipeline: 8,
        total_contractuel: 2,
        total_production: 4,
        total_bloques: 1,
        valeur_bloquee: 1500,
        total_taches: 9,
        valeur_totale: 45000,
        valeur_pipeline: 12000,
      })
    })

    it('déclenche un toast si la requête overview échoue', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_dashboard_overview') {
          return Promise.resolve({ data: null, error: overviewError })
        }
        if (fn === 'get_pipeline_breakdown') {
          return Promise.resolve({ data: BREAKDOWN_RPC_DATA, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      renderHook(() => useDashboardData(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(TOAST_FN).toHaveBeenCalledWith({
          title: 'Erreur',
          description: 'Statistiques indisponibles',
          variant: 'destructive',
        })
      })

      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_overview')
      expect(mockRpc).toHaveBeenCalledWith('get_pipeline_breakdown')
    })
  })
})
