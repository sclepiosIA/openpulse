import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAnalyticsCalculator } from './useAnalyticsCalculator'

const { AUTH_STATE, mockFrom, toastSuccess, toastError, navigateMock } = vi.hoisted(() => {
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
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  builder.select.mockImplementation(() => builder)
  builder.eq.mockImplementation(() => builder)
  builder.gte.mockImplementation(() => builder)
  builder.lte.mockImplementation(() => builder)
  builder.in.mockImplementation(() => builder)
  builder.order.mockImplementation(() => builder)
  builder.limit.mockImplementation(() => builder)
  builder.insert.mockImplementation(() => builder)
  builder.update.mockImplementation(() => builder)
  builder.delete.mockImplementation(() => builder)
  builder.upsert.mockImplementation(() => builder)
  builder.single.mockResolvedValue({ data: null, error: null })
  builder.maybeSingle.mockResolvedValue({ data: null, error: null })
  builder.then.mockImplementation(
    (
      onFulfilled?: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
  )
  builder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)
  )

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => builder),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    navigateMock: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

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

describe('useAnalyticsCalculator', () => {
  const params = {
    passages: 1200,
    baseline: 10,
    cible: 15,
    taux_mono: 50,
    taux_avis_baseline: 10,
    taux_avis_cible: 20,
    taux_ccmu2_baseline: 30,
    taux_ccmu2_cible: 25,
    taux_ccmu3_baseline: 15,
    taux_ccmu3_cible: 10,
    TARIF_UHCD: 100,
    TARIF_AVIS_SPE: 50,
    TARIF_CCMU2: 20,
    TARIF_CCMU3: 40,
    BONUS_MONORUM: 0.05,
  }


  const analyticsParams = {
    uhcdMois: 10,
    consultMois: 90,
    plusMois: 5,
    totalProj: 1800,
  }

  it('calcule correctement les métriques annuelles, revenus, ROI et projections', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useAnalyticsCalculator({ params, analyticsParams }), {
      wrapper,
    })

    expect(result.current.uhcdAn).toBe(120)
    expect(result.current.consultAn).toBe(1080)
    expect(result.current.uhcdMarqueAn).toBe(60)
    expect(result.current.totalPassagesInit).toBe(1200)

    expect(result.current.pctUhcd).toBeCloseTo(10, 5)
    expect(result.current.pctUhcdPlus).toBeCloseTo(15, 5)

    expect(result.current.uhcdPlusTotal).toBe(180)
    expect(result.current.consultAnPlus).toBe(1020)

    expect(result.current.revUhcdBase).toBe(12000)
    expect(result.current.revAvisBase).toBe(5400)
    expect(result.current.revCcmu2Base).toBe(6480)
    expect(result.current.revCcmu3Base).toBe(6480)
    expect(result.current.revTotalBase).toBe(30360)

    expect(result.current.revUhcdPlus).toBe(18000)
    expect(result.current.revAvisPlus).toBe(10200)
    expect(result.current.revCcmu2Plus).toBe(5100)
    expect(result.current.revCcmu3Plus).toBe(4080)
    expect(result.current.gainMonoRUM).toBe(900)
    expect(result.current.revTotalPlus).toBe(38280)

    expect(result.current.roiAnUhcdPct).toBeCloseTo(50, 5)
    expect(result.current.roiAnTotalPct).toBeCloseTo(26.087, 3)

    expect(result.current.scale).toBeCloseTo(1.5, 5)
    expect(result.current.uhcdProj).toBe(180)
    expect(result.current.uhcdPlusProj).toBe(270)
  })

  it('gère les cas limites avec volumes nuls sans division invalide', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        useAnalyticsCalculator({
          params,
          analyticsParams: {
            uhcdMois: 0,
            consultMois: 0,
            plusMois: 0,
            totalProj: 500,
          },
        }),
      { wrapper }
    )

    expect(result.current.uhcdAn).toBe(0)
    expect(result.current.consultAn).toBe(0)
    expect(result.current.totalPassagesInit).toBe(0)
    expect(result.current.pctUhcd).toBe(0)
    expect(result.current.pctUhcdPlus).toBe(0)
    expect(result.current.uhcdPlusTotal).toBe(0)
    expect(result.current.consultAnPlus).toBe(0)
    expect(result.current.revTotalBase).toBe(0)
    expect(result.current.revTotalPlus).toBe(0)
    expect(result.current.gainMonoRUM).toBe(0)
    expect(result.current.roiAnUhcdPct).toBe(0)
    expect(result.current.roiAnTotalPct).toBe(0)
    expect(result.current.scale).toBe(1)
    expect(result.current.uhcdProj).toBe(0)
    expect(result.current.uhcdPlusProj).toBe(0)
  })

  it('recalcule quand les paramètres changent avec des assertions métier précises', () => {
    const wrapper = createWrapper()

    const { result, rerender } = renderHook(
      ({
        currentParams,
        currentAnalyticsParams,
      }: {
        currentParams: typeof params
        currentAnalyticsParams: typeof analyticsParams
      }) =>
        useAnalyticsCalculator({
          params: currentParams,
          analyticsParams: currentAnalyticsParams,
        }),
      {
        wrapper,
        initialProps: {
          currentParams: params,
          currentAnalyticsParams: analyticsParams,
        },
      }
    )

    expect(result.current.revUhcdBase).toBe(12000)
    expect(result.current.consultAnPlus).toBe(1020)

    const nextAnalyticsParams = {
      uhcdMois: 20,
      consultMois: 80,
      plusMois: 10,
      totalProj: 2400,
    }

    rerender({
      currentParams: params,
      currentAnalyticsParams: nextAnalyticsParams,
    })

    expect(result.current.uhcdAn).toBe(240)
    expect(result.current.consultAn).toBe(960)
    expect(result.current.uhcdMarqueAn).toBe(120)
    expect(result.current.totalPassagesInit).toBe(1200)

    expect(result.current.pctUhcd).toBeCloseTo(20, 5)
    expect(result.current.pctUhcdPlus).toBeCloseTo(30, 5)

    expect(result.current.uhcdPlusTotal).toBe(360)
    expect(result.current.consultAnPlus).toBe(840)

    expect(result.current.revUhcdBase).toBe(24000)
    expect(result.current.revAvisBase).toBe(4800)
    expect(result.current.revCcmu2Base).toBe(5760)
    expect(result.current.revCcmu3Base).toBe(5760)
    expect(result.current.revTotalBase).toBe(40320)

    expect(result.current.revUhcdPlus).toBe(36000)
    expect(result.current.revAvisPlus).toBe(8400)
    expect(result.current.revCcmu2Plus).toBe(4200)
    expect(result.current.revCcmu3Plus).toBe(3360)
    expect(result.current.gainMonoRUM).toBe(1800)
    expect(result.current.revTotalPlus).toBe(53760)

    expect(result.current.roiAnUhcdPct).toBeCloseTo(50, 5)
    expect(result.current.roiAnTotalPct).toBeCloseTo(((53760 - 40320) / 40320) * 100, 5)
    expect(result.current.scale).toBe(2)
    expect(result.current.uhcdProj).toBe(480)
    expect(result.current.uhcdPlusProj).toBe(720)
  })
})
