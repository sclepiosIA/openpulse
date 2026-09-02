import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProductionStats } from './useProductionStats'

const { mockCalculateEtablissementValue, AUTH_STATE, navigateMock, toastSuccess, toastError } =
  vi.hoisted(() => ({
    mockCalculateEtablissementValue: vi.fn(),
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }))

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: mockCalculateEtablissementValue,
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
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

describe('useProductionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calcule correctement les statistiques métier complètes', async () => {
    const now = new Date()
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const expired5DaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString()
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 6,
      now.getDate()
    ).toISOString()
    const twoMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 2,
      now.getDate()
    ).toISOString()
    const fourMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 4,
      now.getDate()
    ).toISOString()

    const etablissements = [
      { id: 'e1', date_signature: oneMonthAgo },
      { id: 'e2', date_signature: sixMonthsAgo },
      { id: 'e3', date_signature: twoMonthsAgo },
      { id: 'e4', date_signature: fourMonthsAgo },
    ]

    const healthScores = new Map([
      ['e1', { status: 'healthy', score: 90 }],
      ['e2', { status: 'at-risk', score: 40 }],
      ['e3', { status: 'churn-risk', score: 20 }],
      ['e4', { status: 'onboarding', score: 70 }],
    ])

    const healthMetrics = new Map([
      ['e1', { nps_score: 50, contract_end_date: in10Days }],
      ['e2', { nps_score: 10, contract_end_date: in60Days }],
      ['e3', { nps_score: -20, contract_end_date: expired5DaysAgo }],
      ['e4', {}],
    ])

    mockCalculateEtablissementValue.mockImplementation((etab: { id: string }) => {
      const values: Record<string, number> = {
        e1: 1000,
        e2: 2000,
        e3: 500,
        e4: 1500,
      }
      return values[etab.id]
    })

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useProductionStats(etablissements, healthScores, healthMetrics),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.totalClients).toBe(4)
    })

    expect(mockCalculateEtablissementValue).toHaveBeenCalledTimes(4)
    expect(result.current.totalRevenue).toBe(5000)
    expect(result.current.averageNPS).toBe(40 / 3)
    expect(result.current.averageHealthScore).toBe(50)

    expect(result.current.byHealth.healthy).toEqual({
      count: 1,
      revenue: 1000,
      nps: 50,
      npsCount: 1,
    })
    expect(result.current.byHealth.atRisk).toEqual({
      count: 1,
      revenue: 2000,
      nps: 10,
      npsCount: 1,
    })
    expect(result.current.byHealth.churnRisk).toEqual({
      count: 1,
      revenue: 500,
      nps: -20,
      npsCount: 1,
    })
    expect(result.current.byHealth.onboarding).toEqual({
      count: 1,
      revenue: 1500,
      nps: 0,
      npsCount: 0,
    })

    expect(result.current.renewals.next30Days).toEqual([etablissements[0]])
    expect(result.current.renewals.next90Days).toEqual([etablissements[1]])
    expect(result.current.renewals.expired).toEqual([etablissements[2]])

    expect(result.current.trends).toEqual({
      recentlyLaunched: 2,
      stable: 2,
    })
  })

  it('retourne 0 et des structures vides quand les entrées sont vides', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useProductionStats([], new Map(), new Map()), { wrapper })

    await waitFor(() => {
      expect(result.current.totalClients).toBe(0)
    })

    expect(mockCalculateEtablissementValue).not.toHaveBeenCalled()
    expect(result.current.totalRevenue).toBe(0)
    expect(result.current.averageHealthScore).toBe(0)
    expect(result.current.averageNPS).toBe(0)
    expect(result.current.byHealth.healthy.count).toBe(0)
    expect(result.current.byHealth.atRisk.revenue).toBe(0)
    expect(result.current.byHealth.churnRisk.nps).toBe(0)
    expect(result.current.byHealth.onboarding.count).toBe(0)
    expect(result.current.renewals.next30Days).toEqual([])
    expect(result.current.renewals.next90Days).toEqual([])
    expect(result.current.renewals.expired).toEqual([])
    expect(result.current.trends).toEqual({
      recentlyLaunched: 0,
      stable: 0,
    })
  })

  it('ignore le NPS absent et produit NaN pour averageHealthScore quand tous les scores sont onboarding', async () => {
    const now = new Date()
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString()

    const etablissements = [
      { id: 'e1', date_signature: oneMonthAgo },
      { id: 'e2', date_signature: oneMonthAgo },
    ]

    const healthScores = new Map([
      ['e1', { status: 'onboarding', score: 80 }],
      ['e2', { status: 'onboarding', score: 60 }],
    ])

    const healthMetrics = new Map([
      ['e1', { contract_end_date: undefined }],
      ['e2', {}],
    ])

    mockCalculateEtablissementValue.mockImplementation((etab: { id: string }) =>
      etab.id === 'e1' ? 300 : 700
    )

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useProductionStats(etablissements, healthScores, healthMetrics),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.totalRevenue).toBe(1000)
    })

    expect(result.current.averageNPS).toBe(0)
    expect(Number.isNaN(result.current.averageHealthScore)).toBe(true)
    expect(result.current.byHealth.onboarding).toEqual({
      count: 2,
      revenue: 1000,
      nps: 0,
      npsCount: 0,
    })
    expect(result.current.trends).toEqual({
      recentlyLaunched: 2,
      stable: 0,
    })
  })
})
