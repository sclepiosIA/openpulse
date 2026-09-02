/* @vitest-environment jsdom */
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAIInsights } from './useAIInsights'

const {
  USER,
  SESSION_RESPONSE,
  SAVED_INSIGHTS_ROW,
  SAVED_INSIGHTS_RESULT,
  NO_ROW_RESULT,
  DB_ERROR_RESULT,
  FUNCTION_SUCCESS_RESULT,
  FUNCTION_RATE_LIMIT_RESULT,
  FUNCTION_ERROR_RESULT,
  mockToast,
  mockDebugError,
  mockGetSession,
  mockInvoke,
  mockFrom,
  createBuilder,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' }
  const SESSION_RESPONSE = { data: { session: { user: USER } } }

  const SAVED_INSIGHTS_ROW = {
    insights_data: {
      trends: [
        {
          title: 'Hausse des admissions',
          description: 'Les admissions progressent sur la semaine',
          impact: 'positive' as const,
          recommendation: 'Maintenir la capacité actuelle',
        },
      ],
      anomalies: [
        {
          etablissement: 'Clinique A',
          type: 'Temps d attente',
          severity: 'high' as const,
          explanation: 'Pic inhabituel sur 2 jours',
          action: 'Renforcer l équipe d accueil',
        },
      ],
      recommendations: [
        {
          title: 'Réallouer le personnel',
          description: 'Couvrir les pics du matin',
          priority: 'high' as const,
          estimatedImpact: 'Réduction des délais',
          actions: ['Ajuster le planning', 'Suivre les flux'],
        },
      ],
      alerts: [
        {
          title: 'Tension capacitaire',
          severity: 'warning' as const,
          description: 'Capacité proche du seuil',
          businessImpact: 'Risque de saturation',
          actions: ['Prévoir un renfort'],
        },
      ],
    },
    created_at: '2024-06-01T08:00:00.000Z',
    insights_count: 4,
  }

  const SAVED_INSIGHTS_RESULT = { data: SAVED_INSIGHTS_ROW, error: null }
  const NO_ROW_RESULT = { data: null, error: null }
  const DB_ERROR_RESULT = { data: null, error: { message: 'db failed' } }

  const FUNCTION_SUCCESS_RESULT = {
    data: { success: true, is_rate_limited: false },
    error: null,
  }

  const FUNCTION_RATE_LIMIT_RESULT = {
    data: { success: true, is_rate_limited: true, message: 'Analyse récente déjà disponible' },
    error: null,
  }

  const FUNCTION_ERROR_RESULT = {
    data: null,
    error: { message: 'invoke failed' },
  }

  const mockToast = vi.fn()
  const mockDebugError = vi.fn()
  const mockGetSession = vi.fn()
  const mockInvoke = vi.fn()
  const mockFrom = vi.fn()

  const createBuilder = (result: { data: unknown; error: unknown }) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      not: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    }
    return builder
  }

  return {
    USER,
    SESSION_RESPONSE,
    SAVED_INSIGHTS_ROW,
    SAVED_INSIGHTS_RESULT,
    NO_ROW_RESULT,
    DB_ERROR_RESULT,
    FUNCTION_SUCCESS_RESULT,
    FUNCTION_RATE_LIMIT_RESULT,
    FUNCTION_ERROR_RESULT,
    mockToast,
    mockDebugError,
    mockGetSession,
    mockInvoke,
    mockFrom,
    createBuilder,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAIInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION_RESPONSE)
    mockInvoke.mockResolvedValue(FUNCTION_SUCCESS_RESULT)
    mockFrom.mockImplementation(() => createBuilder(SAVED_INSIGHTS_RESULT))
  })

  it('charge puis retourne les insights sauvegardés avec leurs métadonnées', async () => {
    const builder = createBuilder(SAVED_INSIGHTS_RESULT)
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(
      () =>
        useAIInsights({
          stats: { total: 12 },
          etablissements: [{ id: 'e1', nom: 'Clinique A' }],
          filters: { period: '7d' },
          analysisType: 'all',
        }),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('ai_analysis_log')
    expect(builder.select).toHaveBeenCalledWith('insights_data, created_at, insights_count')
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', USER.id)
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'analysis_type', 'all')
    expect(builder.not).toHaveBeenCalledWith('insights_data', 'is', null)
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(1)

    expect(result.current.data).toEqual({
      ...SAVED_INSIGHTS_ROW.insights_data,
      _metadata: {
        created_at: SAVED_INSIGHTS_ROW.created_at,
        insights_count: SAVED_INSIGHTS_ROW.insights_count,
      },
    })

    expect(result.current.data?.trends?.[0]).toEqual({
      title: 'Hausse des admissions',
      description: 'Les admissions progressent sur la semaine',
      impact: 'positive',
      recommendation: 'Maintenir la capacité actuelle',
    })
    expect(result.current.data?.anomalies?.[0]).toEqual({
      etablissement: 'Clinique A',
      type: 'Temps d attente',
      severity: 'high',
      explanation: 'Pic inhabituel sur 2 jours',
      action: 'Renforcer l équipe d accueil',
    })
    expect(result.current.data?.recommendations?.[0]?.actions).toEqual(['Ajuster le planning', 'Suivre les flux'])
    expect(result.current.data?.alerts?.[0]?.businessImpact).toBe('Risque de saturation')
    expect(result.current.data?._metadata).toEqual({
      created_at: '2024-06-01T08:00:00.000Z',
      insights_count: 4,
    })

    expect(result.current.nextScheduledAnalysis).toBeInstanceOf(Date)
  })

  it('retourne un message métier quand aucun insight sauvegardé n’existe', async () => {
    const builder = createBuilder(NO_ROW_RESULT)
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(
      () =>
        useAIInsights({
          stats: { total: 1 },
          etablissements: [{ id: 'e1' }],
          filters: {},
          analysisType: 'trends',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({
      no_insights_yet: true,
      message: 'Aucune analyse disponible. La prochaine analyse automatique aura lieu demain à 9h.',
    })
  })

  it('passe en erreur si la requête DB échoue', async () => {
    const builder = createBuilder(DB_ERROR_RESULT)
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(
      () =>
        useAIInsights({
          stats: { total: 7 },
          etablissements: [{ id: 'e1' }],
          filters: {},
          analysisType: 'alerts',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(mockDebugError).toHaveBeenCalledWith('Error fetching saved insights:', DB_ERROR_RESULT.error))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual(DB_ERROR_RESULT.error)
  })

  it('manualRefetch lance la function edge, affiche un toast de succès et relance la lecture DB', async () => {
    const builder = createBuilder(SAVED_INSIGHTS_RESULT)
    mockFrom.mockReturnValue(builder)
    mockInvoke.mockResolvedValue(FUNCTION_SUCCESS_RESULT)

    const params = {
      stats: { total: 10, moyenne: 4 },
      etablissements: [{ id: 'e1', nom: 'Clinique A' }],
      filters: { region: 'sud' },
      analysisType: 'recommendations' as const,
    }

    const { result } = renderHook(() => useAIInsights(params), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.manualRefetch()
    })

    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(2))

    expect(mockInvoke).toHaveBeenCalledWith('analyze-rapports-insights', {
      body: {
        stats: params.stats,
        etablissements: params.etablissements,
        filters: params.filters,
        analysis_type: 'recommendations',
        force: true,
      },
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: '✅ Analyse mise à jour',
      description: 'Nouvelle analyse générée avec succès',
    })
  })

  it('manualRefetch affiche le toast de rate-limit sans relancer la lecture DB', async () => {
    const builder = createBuilder(SAVED_INSIGHTS_RESULT)
    mockFrom.mockReturnValue(builder)
    mockInvoke.mockResolvedValue(FUNCTION_RATE_LIMIT_RESULT)

    const { result } = renderHook(
      () =>
        useAIInsights({
          stats: { total: 3 },
          etablissements: [{ id: 'e1' }],
          filters: { period: '30d' },
          analysisType: 'anomalies',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.manualRefetch()
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: '⏰ Analyse déjà effectuée',
      description: 'Analyse récente déjà disponible',
      variant: 'default',
    })
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('manualRefetch gère une erreur function avec toast destructif et log debug', async () => {
    const builder = createBuilder(SAVED_INSIGHTS_RESULT)
    mockFrom.mockReturnValue(builder)
    mockInvoke.mockResolvedValue(FUNCTION_ERROR_RESULT)

    const { result } = renderHook(
      () =>
        useAIInsights({
          stats: { total: 5 },
          etablissements: [{ id: 'e1' }],
          filters: {},
          analysisType: 'all',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      await result.current.manualRefetch()
    })

    expect(mockDebugError).toHaveBeenCalledWith('Manual refetch error:', FUNCTION_ERROR_RESULT.error)
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible de lancer l'analyse",
      variant: 'destructive',
    })
  })

  it('ne lance pas la query si aucun établissement n’est fourni', async () => {
    const { result } = renderHook(
      () =>
        useAIInsights({
          stats: { total: 0 },
          etablissements: [],
          filters: {},
          analysisType: 'trends',
        }),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockGetSession).not.toHaveBeenCalled()
  })
})