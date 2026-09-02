import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCsmKpisMensuels } from './useCsmKpisMensuels'

const {
  ROWS_ALL,
  ROWS_FILTERED,
  UPSERTED_ROW,
  ORDER_RESULT_SUCCESS,
  ORDER_RESULT_ERROR,
  SINGLE_RESULT_SUCCESS,
  SINGLE_RESULT_ERROR,
  DELETE_RESULT_SUCCESS,
  DELETE_RESULT_ERROR,
  mockToastError,
  mockSanitizeSupabaseError,
  mockFrom,
  mockFromExtended,
  state,
} = vi.hoisted(() => {
  const ROWS_ALL = [
    {
      id: 'kpi-1',
      etablissement_id: 'eta-1',
      mois: '2024-01',
      taux_uhcd_backend: 12,
      taux_uhcd_compte: 10,
      palier_eme: 8,
      objectif_eme: 9,
      taux_utilisation: 75,
      passages_total: 120,
      dossiers_traites: 110,
      eme: 8.5,
      sort_order: 1,
      created_at: '2024-01-10',
      updated_at: '2024-01-11',
    },
    {
      id: 'kpi-2',
      etablissement_id: 'eta-2',
      mois: '2024-02',
      taux_uhcd_backend: 15,
      taux_uhcd_compte: 14,
      palier_eme: 7,
      objectif_eme: 8,
      taux_utilisation: 81,
      passages_total: 130,
      dossiers_traites: 125,
      eme: 7.9,
      sort_order: 2,
      created_at: '2024-02-10',
      updated_at: '2024-02-11',
    },
  ]

  const ROWS_FILTERED = [
    {
      id: 'kpi-1',
      etablissement_id: 'eta-1',
      mois: '2024-01',
      taux_uhcd_backend: 12,
      taux_uhcd_compte: 10,
      palier_eme: 8,
      objectif_eme: 9,
      taux_utilisation: 75,
      passages_total: 120,
      dossiers_traites: 110,
      eme: 8.5,
      sort_order: 1,
      created_at: '2024-01-10',
      updated_at: '2024-01-11',
    },
  ]

  const UPSERTED_ROW = {
    id: 'kpi-3',
    etablissement_id: 'eta-1',
    mois: '2024-03',
    taux_utilisation: 82,
  }

  const ORDER_RESULT_SUCCESS = { data: ROWS_ALL, error: null as { message: string } | null }
  const ORDER_RESULT_ERROR = { data: null, error: { message: 'fetch failed' } }

  const SINGLE_RESULT_SUCCESS = { data: UPSERTED_ROW, error: null as { message: string } | null }
  const SINGLE_RESULT_ERROR = { data: null, error: { message: 'upsert failed' } }

  const DELETE_RESULT_SUCCESS = { data: null, error: null as { message: string } | null }
  const DELETE_RESULT_ERROR = { data: null, error: { message: 'delete failed' } }

  const mockToastError = vi.fn()
  const mockSanitizeSupabaseError = vi.fn(
    (error: { message?: string }) => `sanitized:${error.message ?? 'unknown'}`
  )
  const mockFrom = vi.fn()
  const mockFromExtended = vi.fn()

  const state = {
    orderResult: ORDER_RESULT_SUCCESS as {
      data: typeof ROWS_ALL | null
      error: { message: string } | null
    },
    singleResult: SINGLE_RESULT_SUCCESS as {
      data: typeof UPSERTED_ROW | null
      error: { message: string } | null
    },
    deleteResult: DELETE_RESULT_SUCCESS as { data: null; error: { message: string } | null },
    filterEtablissementId: undefined as string | undefined,
    lastTable: '',
    upsertPayload: null as Record<string, unknown> | null,
    deleteId: undefined as string | undefined,
  }

  return {
    ROWS_ALL,
    ROWS_FILTERED,
    UPSERTED_ROW,
    ORDER_RESULT_SUCCESS,
    ORDER_RESULT_ERROR,
    SINGLE_RESULT_SUCCESS,
    SINGLE_RESULT_ERROR,
    DELETE_RESULT_SUCCESS,
    DELETE_RESULT_ERROR,
    mockToastError,
    mockSanitizeSupabaseError,
    mockFrom,
    mockFromExtended,
    state,
  }
})

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/supabaseTyped', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'etablissement_id') {
          state.filterEtablissementId = value
        }
        if (column === 'id') {
          state.deleteId = value
        }
        return builder
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => {
        if (state.orderResult.error) {
          return Promise.resolve(state.orderResult)
        }
        if (state.filterEtablissementId === 'eta-1') {
          return Promise.resolve({ data: ROWS_FILTERED, error: null })
        }
        return Promise.resolve(state.orderResult)
      }),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn((payload: Record<string, unknown>) => {
        state.upsertPayload = payload
        return builder
      }),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(state.singleResult)),
      maybeSingle: vi.fn(() => Promise.resolve(state.singleResult)),
      then: (onFulfilled: (value: { data: null; error: { message: string } | null }) => unknown) =>
        Promise.resolve(state.deleteResult).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(state.deleteResult).catch(onRejected),
    }
    return builder
  }

  mockFromExtended.mockImplementation((table: string) => {
    state.lastTable = table
    return createBuilder()
  })

  return {
    fromExtended: mockFromExtended,
  }
})

function createWrapper() {
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

describe('useCsmKpisMensuels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.orderResult = ORDER_RESULT_SUCCESS
    state.singleResult = SINGLE_RESULT_SUCCESS
    state.deleteResult = DELETE_RESULT_SUCCESS
    state.filterEtablissementId = undefined
    state.lastTable = ''
    state.upsertPayload = null
    state.deleteId = undefined
  })

  it('expose un état de chargement puis retourne les KPIs filtrés par établissement', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels('eta-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(state.lastTable).toBe('csm_kpis_mensuels')
    expect(state.filterEtablissementId).toBe('eta-1')
    expect(result.current.data).toEqual(ROWS_FILTERED)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0]).toMatchObject({
      id: 'kpi-1',
      etablissement_id: 'eta-1',
      mois: '2024-01',
      taux_utilisation: 75,
      passages_total: 120,
      dossiers_traites: 110,
      eme: 8.5,
      sort_order: 1,
    })
  })

  it('retourne tous les KPIs quand aucun établissement n’est fourni', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(state.filterEtablissementId).toBeUndefined()
    expect(result.current.data).toEqual(ROWS_ALL)
    expect(result.current.data.map((row) => row.etablissement_id)).toEqual(['eta-1', 'eta-2'])
    expect(result.current.data[1]).toMatchObject({
      id: 'kpi-2',
      mois: '2024-02',
      taux_utilisation: 81,
      sort_order: 2,
    })
  })

  it('passe en erreur React Query quand le chargement échoue', async () => {
    state.orderResult = ORDER_RESULT_ERROR

    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels('eta-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
  })

  it('upsert un KPI, supprime id absent du payload et invalide la query', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      etablissement_id: 'eta-1',
      mois: '2024-03',
      taux_utilisation: 82,
      id: undefined,
    }

    await act(async () => {
      await result.current.upsert(payload)
    })

    expect(mockFromExtended).toHaveBeenCalledWith('csm_kpis_mensuels')
    expect(state.upsertPayload).toEqual({
      etablissement_id: 'eta-1',
      mois: '2024-03',
      taux_utilisation: 82,
    })
  })

  it('affiche un toast d’erreur si le upsert échoue', async () => {
    state.singleResult = SINGLE_RESULT_ERROR

    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(
        result.current.upsert({
          etablissement_id: 'eta-1',
          mois: '2024-04',
          taux_utilisation: 60,
        })
      ).rejects.toMatchObject({ message: 'upsert failed' })
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'upsert failed' })
    )
    expect(mockToastError).toHaveBeenCalledWith('sanitized:upsert failed')
  })

  it('supprime un KPI par id et invalide la query', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.remove('kpi-1')
    })

    expect(state.deleteId).toBe('kpi-1')
    expect(mockFromExtended).toHaveBeenCalledWith('csm_kpis_mensuels')
  })

  it('affiche un toast d’erreur si la suppression échoue', async () => {
    state.deleteResult = DELETE_RESULT_ERROR

    const wrapper = createWrapper()

    const { result } = renderHook(() => useCsmKpisMensuels('eta-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(result.current.remove('kpi-1')).rejects.toMatchObject({
        message: 'delete failed',
      })
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'delete failed' })
    )
    expect(mockToastError).toHaveBeenCalledWith('sanitized:delete failed')
  })
})
