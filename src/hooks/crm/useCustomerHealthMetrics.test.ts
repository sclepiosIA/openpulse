import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { useCustomerHealthMetrics, useBulkHealthMetrics, useUpdateHealthMetrics } from './useCustomerHealthMetrics'

const {
  MOCK_SINGLE_METRICS,
  MOCK_BULK_METRICS,
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
  mockIn,
  mockUpsert,
  mockSingle,
  mockThen,
  mockCatch,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => {
  const MOCK_SINGLE_METRICS = {
    id: 'm1',
    etablissement_id: 'e1',
    health_score: 80,
    health_status: 'healthy',
    adoption_rate: 0.9,
    taux_utilisation_cotation: 0.8,
    taux_completion_dossier: 0.85,
    taux_uhcd_mono_rum: 0.7,
    nombre_avis_specialise: 10,
    nombre_ccmu_2_plus: 5,
    nombre_ccmu_3_plus: 2,
    nps_score: 50,
    nps_survey_date: '2024-01-01',
    satisfaction_score: 4.5,
    support_tickets_open: 1,
    support_tickets_closed_30d: 5,
    avg_resolution_time_hours: 12,
    last_ticket_date: '2024-01-02',
    payment_status: 'on_time',
    contract_value: 10000,
    contract_start_date: '2023-01-01',
    contract_end_date: '2025-01-01',
    roi_annuel: 1.5,
    calculated_at: '2024-01-03',
    notes: 'RAS',
  }

  const MOCK_BULK_METRICS = [
    {
      ...MOCK_SINGLE_METRICS,
      id: 'm1',
      etablissement_id: 'e1',
    },
    {
      ...MOCK_SINGLE_METRICS,
      id: 'm2',
      etablissement_id: 'e2',
      health_score: 60,
      health_status: 'at-risk',
    },
  ]

  const builder: Record<string, unknown> = {}
  const mockSelect = vi.fn(() => builder)
  const mockEq = vi.fn(() => builder)
  const mockMaybeSingle = vi.fn()
  const mockIn = vi.fn(() => builder)
  const mockUpsert = vi.fn(() => builder)
  const mockSingle = vi.fn()
  const mockThen = vi.fn()
  const mockCatch = vi.fn()

  builder.select = mockSelect
  builder.eq = mockEq
  builder.in = mockIn
  builder.upsert = mockUpsert
  builder.maybeSingle = mockMaybeSingle
  builder.single = mockSingle
  builder.then = mockThen
  builder.catch = mockCatch

  const mockFrom = vi.fn(() => builder)

  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()

  const mockSanitizeSupabaseError = vi.fn((error: Error) => `Sanitized: ${error.message}`)

  return {
    MOCK_SINGLE_METRICS,
    MOCK_BULK_METRICS,
    mockFrom,
    mockSelect,
    mockEq,
    mockMaybeSingle,
    mockIn,
    mockUpsert,
    mockSingle,
    mockThen,
    mockCatch,
    mockToastSuccess,
    mockToastError,
    mockSanitizeSupabaseError,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
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

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  )

  return { Wrapper, queryClient }
}

describe('useCustomerHealthMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ne lance pas la requête quand etablissementId est undefined', () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useCustomerHealthMetrics(undefined), {
      wrapper: Wrapper,
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('récupère les métriques de santé pour un établissement (succès)', async () => {
    const { Wrapper } = createWrapper()

    mockMaybeSingle.mockResolvedValueOnce({
      data: MOCK_SINGLE_METRICS,
      error: null,
    })

    const { result, rerender } = renderHook(
      ({ id }) => useCustomerHealthMetrics(id),
      {
        wrapper: Wrapper,
        initialProps: { id: 'e1' },
      }
    )

    expect(result.current.isLoading).toBe(true)

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('customer_health_metrics')
    expect(mockSelect).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('etablissement_id', 'e1')
    expect(mockMaybeSingle).toHaveBeenCalled()

    const data = result.current.data
    expect(data).not.toBeNull()
    expect(data?.etablissement_id).toBe('e1')
    expect(data?.health_score).toBe(80)
    expect(data?.health_status).toBe('healthy')
    expect(data?.support_tickets_open).toBe(1)

    rerender({ id: 'e1' })

    expect(result.current.data?.id).toBe('m1')
  })

  it('gère une erreur de chargement (isError)', async () => {
    const { Wrapper } = createWrapper()

    const error = new Error('Test error')
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error,
    })

    const { result } = renderHook(() => useCustomerHealthMetrics('e1'), {
      wrapper: Wrapper,
    })

    await vi.waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useBulkHealthMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne une Map vide quand etablissementIds est undefined ou vide', () => {
    const { Wrapper } = createWrapper()

    const { result: resultUndefined } = renderHook(
      () => useBulkHealthMetrics(undefined),
      { wrapper: Wrapper }
    )
    expect(resultUndefined.current.data).toBeUndefined()
    expect(resultUndefined.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()

    const { result: resultEmpty } = renderHook(
      () => useBulkHealthMetrics([]),
      { wrapper: Wrapper }
    )

    expect(resultEmpty.current.data).toBeUndefined()
    expect(resultEmpty.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('récupère les métriques de plusieurs établissements (succès)', async () => {
    const { Wrapper } = createWrapper()

    mockThen.mockImplementationOnce((onFulfilled: (value: unknown) => unknown) => {
      onFulfilled({ data: MOCK_BULK_METRICS, error: null })
      return { catch: mockCatch }
    })

    const { result } = renderHook(
      () => useBulkHealthMetrics(['e1', 'e2']),
      { wrapper: Wrapper }
    )

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('customer_health_metrics')
    expect(mockSelect).toHaveBeenCalled()
    expect(mockIn).toHaveBeenCalledWith('etablissement_id', ['e1', 'e2'])

    const map = result.current.data
    expect(map).toBeInstanceOf(Map)
    expect(map?.size).toBe(2)

    const m1 = map?.get('e1')
    const m2 = map?.get('e2')

    expect(m1?.id).toBe('m1')
    expect(m1?.health_status).toBe('healthy')
    expect(m2?.id).toBe('m2')
    expect(m2?.health_status).toBe('at-risk')
  })

  it('gère une erreur pour le bulk (isError)', async () => {
    const { Wrapper } = createWrapper()

    const error = new Error('Bulk error')

    mockThen.mockImplementationOnce(() => {
      throw error
    })

    const { result } = renderHook(
      () => useBulkHealthMetrics(['e1']),
      { wrapper: Wrapper }
    )

    await vi.waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(error)
  })
})

describe('useUpdateHealthMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('met à jour les métriques et invalide les queries (succès)', async () => {
    const { Wrapper, queryClient } = createWrapper()

    const updatedRow = { ...MOCK_SINGLE_METRICS, health_score: 95 }

    mockSingle.mockResolvedValueOnce({
      data: updatedRow,
      error: null,
    })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateHealthMetrics(), {
      wrapper: Wrapper,
    })

    const payload = {
      etablissement_id: 'e1',
      health_score: 95,
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('customer_health_metrics')
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const upsertArg = mockUpsert.mock.calls[0][0]
    expect(upsertArg.etablissement_id).toBe('e1')
    expect(upsertArg.health_score).toBe(95)
    expect(typeof upsertArg.updated_at).toBe('string')

    expect(mockSelect).toHaveBeenCalled()
    expect(mockSingle).toHaveBeenCalled()

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['customer-health-metrics'],
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Métriques mises à jour')
  })

  it('affiche une erreur toastée en cas d’échec', async () => {
    const { Wrapper } = createWrapper()

    const error = new Error('Update failed')

    mockSingle.mockResolvedValueOnce({
      data: null,
      error,
    })

    const { result } = renderHook(() => useUpdateHealthMetrics(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          etablissement_id: 'e1',
          health_score: 50,
        })
      ).rejects.toThrow('Update failed')
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(error)
    expect(mockToastError).toHaveBeenCalledWith(
      `Sanitized: ${error.message}`
    )
  })
})