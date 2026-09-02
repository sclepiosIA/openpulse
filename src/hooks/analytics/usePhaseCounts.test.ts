import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePhaseCounts } from './usePhaseCounts'

const { AUTH_STATE, PHASE_GROUPS_MOCK, RPC_ROWS_SUCCESS, RPC_ERROR, mockRpc, mockFrom } =
  vi.hoisted(() => {
    const AUTH_STATE_VALUE: {
      loading: boolean
      user: { id: string; email: string } | null
    } = {
      loading: false,
      user: { id: 'u1', email: 'u@test.io' },
    }

    const PHASE_GROUPS_VALUE = {
      commercial: { statuts: ['NOUVEAU', 'QUALIFICATION', 'DEVIS'] },
      deploiement: { statuts: ['A_PLANIFIER', 'EN_COURS_DEPLOIEMENT'] },
      production: { statuts: ['ACTIF', 'EN_PRODUCTION'] },
    }

    const RPC_ROWS_VALUE = [
      { statut: 'NOUVEAU', count: 2 },
      { statut: 'DEVIS', count: '3' },
      { statut: 'A_PLANIFIER', count: 4 },
      { statut: 'EN_COURS_DEPLOIEMENT', count: '1' },
      { statut: 'ACTIF', count: 5 },
      { statut: 'EN_PRODUCTION', count: '2' },
      { statut: 'INCONNU', count: 99 },
      { statut: null, count: 50 },
    ]

    const RPC_ERROR_VALUE = { message: 'x' }

    return {
      AUTH_STATE: AUTH_STATE_VALUE,
      PHASE_GROUPS_MOCK: PHASE_GROUPS_VALUE,
      RPC_ROWS_SUCCESS: RPC_ROWS_VALUE,
      RPC_ERROR: RPC_ERROR_VALUE,
      mockRpc: vi.fn(),
      mockFrom: vi.fn(),
    }
  })

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: PHASE_GROUPS_MOCK,
}))

vi.mock('@/lib/supabaseBrowser', () => {
  const createBuilder = () => {
    const result = { data: null, error: null }

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
      then(
        onFulfilled?: (value: typeof result) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return Promise.resolve(result).then(onFulfilled, onRejected)
      },
      catch(onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(result).catch(onRejected)
      },
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
    builder.single.mockResolvedValue(result)
    builder.maybeSingle.mockResolvedValue(result)

    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('usePhaseCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.loading = false
    AUTH_STATE.user = { id: 'u1', email: 'u@test.io' }
  })

  it('ne lance pas la requête tant que l’auth charge puis calcule les compteurs par phase depuis la RPC', async () => {
    AUTH_STATE.loading = true
    mockRpc.mockResolvedValue({ data: RPC_ROWS_SUCCESS, error: null })

    const wrapper = createWrapper()
    const { result, rerender } = renderHook(() => usePhaseCounts(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockRpc).not.toHaveBeenCalled()

    AUTH_STATE.loading = false
    rerender()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('get_phase_counts')
    expect(result.current.data).toEqual({
      commercial: 5,
      deploiement: 5,
      production: 7,
    })
  })

  it('retourne une erreur quand la RPC échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: RPC_ERROR })

    const wrapper = createWrapper()
    const { result } = renderHook(() => usePhaseCounts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('get_phase_counts')
    expect(result.current.error).toEqual(RPC_ERROR)
  })

  it('n’exécute pas la requête quand il n’y a pas d’utilisateur authentifié', () => {
    AUTH_STATE.user = null

    const wrapper = createWrapper()
    const { result } = renderHook(() => usePhaseCounts(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
