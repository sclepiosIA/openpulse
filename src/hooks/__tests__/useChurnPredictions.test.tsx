import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ─── Mocks stables avec vi.hoisted (évite boucle re-render) ──────────────────
const mockChannel = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}))
const mockRemoveChannel = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockFunctionsInvoke = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    functions: { invoke: mockFunctionsInvoke },
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1', email: 'test@test.com' } } },
        error: null,
      }),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  useChurnPredictions,
  useRecomputeChurn,
  useChurnOverview,
  useChurnTrends,
  useChurnHistory,
  useAcknowledgeChurn,
  useGenerateRetentionEmail,
  type ChurnPrediction,
  type ChurnOverview,
  type ChurnTrendPoint,
} from '@/hooks/csm/useChurnPredictions'
import { supabase } from '@/integrations/supabase/client';

// ─── Données de test ──────────────────────────────────────────────────────────
const mockPredictions: ChurnPrediction[] = [
  {
    id: 'churn-1',
    etablissement_id: 'etab-1',
    score: 0.85,
    risk_level: 'critical',
    factors: { many_tickets: 0.4, no_emails: 0.3, many_unpaid: 0.15 },
    recommendations: ['Appeler le CSM', 'Revoir le contrat'],
    predicted_at: '2026-06-01T10:00:00Z',
    model_version: 'v2.1',
    acknowledged_until: null,
    acknowledged_by: null,
    acknowledged_note: null,
    etablissement: {
      id: 'etab-1',
      nom: 'CHU Bordeaux',
      statut: 'Production',
      csm_id: 'csm-1',
      type_offre: 'Premium',
    },
  },
  {
    id: 'churn-2',
    etablissement_id: 'etab-2',
    score: 0.72,
    risk_level: 'high',
    factors: { no_interaction: 0.5, many_tickets: 0.22 },
    recommendations: ['Planifier un point trimestriel'],
    predicted_at: '2026-06-01T10:00:00Z',
    model_version: 'v2.1',
    acknowledged_until: '2026-07-01T00:00:00Z',
    acknowledged_by: 'user-csm',
    acknowledged_note: 'Suivi en cours',
    etablissement: {
      id: 'etab-2',
      nom: 'Clinique Nantes',
      statut: 'Production',
      csm_id: 'csm-2',
      type_offre: 'Standard',
    },
  },
  {
    id: 'churn-3',
    etablissement_id: 'etab-3',
    score: 0.3,
    risk_level: 'low',
    factors: {},
    recommendations: [],
    predicted_at: '2026-06-01T10:00:00Z',
    model_version: 'v2.1',
    acknowledged_until: null,
    acknowledged_by: null,
    acknowledged_note: null,
    etablissement: { id: 'etab-3', nom: 'CH Rouen', statut: 'Production' },
  },
]

// ─── Helper wrapper ───────────────────────────────────────────────────────────
function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// ─── Helpers mock Supabase ────────────────────────────────────────────────────
type MockChainable = {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
}
function mockFromChurnPredictions(
  data: ChurnPrediction[],
  error: { message: string } | null = null
) {
  const chainable: MockChainable = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
    eq: vi.fn().mockReturnThis(),
  }
  mockFrom.mockReturnValue(chainable)
  return chainable
}

// ═════════════════════════════════════════════════════════════════════════════

describe('useChurnPredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChannel.on.mockReturnThis()
    mockChannel.subscribe.mockReturnThis()
  })

  describe('useChurnPredictions — chargement', () => {
    it('retourne isLoading=true au montage', () => {
      mockFromChurnPredictions(mockPredictions)
      const { result } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })
      expect(result.current.isLoading).toBe(true)
    })

    it('retourne les prédictions triées par score décroissant', async () => {
      mockFromChurnPredictions(mockPredictions)
      const { result } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toHaveLength(3)
      expect(result.current.data![0].score).toBe(0.85)
      expect(result.current.data![0].risk_level).toBe('critical')
      expect(result.current.data![1].risk_level).toBe('high')
      expect(result.current.data![2].risk_level).toBe('low')
    })

    it('retourne les données etablissement imbriquées', async () => {
      mockFromChurnPredictions(mockPredictions)
      const { result } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const first = result.current.data![0]
      expect(first.etablissement?.nom).toBe('CHU Bordeaux')
      expect(first.etablissement?.statut).toBe('Production')
      expect(first.etablissement?.type_offre).toBe('Premium')
    })

    it('retourne les acknowledged_until correctement', async () => {
      mockFromChurnPredictions(mockPredictions)
      const { result } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const snoozed = result.current.data!.find((p) => p.acknowledged_until !== null)
      expect(snoozed).toBeDefined()
      expect(snoozed!.acknowledged_until).toBe('2026-07-01T00:00:00Z')
      expect(snoozed!.acknowledged_note).toBe('Suivi en cours')
    })

    it('retourne tableau vide quand data est null', async () => {
      const chainable: MockChainable = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
        eq: vi.fn().mockReturnThis(),
      }
      mockFrom.mockReturnValue(chainable)

      const { result } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('lève une erreur Supabase', async () => {
      const chainable: MockChainable = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        eq: vi.fn().mockReturnThis(),
      }
      mockFrom.mockReturnValue(chainable)

      const { result } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeDefined()
    })

    it('configure le canal realtime avec les bons paramètres', async () => {
      mockFromChurnPredictions(mockPredictions)
      renderHook(() => useChurnPredictions(), { wrapper: createWrapper() })

      // Le préfixe stable est enrichi d’un suffixe d’isolation par safeRealtimeChannel.
      const { supabase } = await import('@/integrations/supabase/client')
      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringMatching(/^churn-predictions-realtime-/)
      )
    })

    it('nettoie le canal realtime au démontage', async () => {
      mockFromChurnPredictions(mockPredictions)
      const { unmount } = renderHook(() => useChurnPredictions(), {
        wrapper: createWrapper(),
      })

      unmount()
      expect(mockRemoveChannel).toHaveBeenCalled()
    })
  })

  describe('useRecomputeChurn — mutation', () => {
    it('appelle rpc compute_churn_predictions et retourne les stats', async () => {
      const rpcResult = { processed: 42, high_risk: 8, critical_risk: 3 }
      mockRpc.mockResolvedValue({ data: [rpcResult], error: null })
      // Also setup from for invalidation
      mockFromChurnPredictions(mockPredictions)

      const { result } = renderHook(() => useRecomputeChurn(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        const data = await result.current.mutateAsync()
        expect(data).toEqual(rpcResult)
      })

      expect(mockRpc).toHaveBeenCalledWith('compute_churn_predictions')
    })

    it('lève une erreur quand rpc échoue', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

      const { result } = renderHook(() => useRecomputeChurn(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow()
      })
    })
  })

  describe('useChurnOverview — KPIs', () => {
    it("retourne les KPIs de la vue d'ensemble", async () => {
      const overview: ChurnOverview = {
        computed_at: '2026-06-03T08:00:00Z',
        kpis: { total: 50, critical: 5, high: 10, medium: 20, low: 15, avg_score: 0.48 },
        prev_kpis: { total: 48, critical: 4 },
        mrr_at_risk: 25000,
        factors_breakdown: {
          many_tickets: 12,
          no_emails: 8,
          many_unpaid: 5,
          no_interaction: 15,
        },
        worsened: [],
        improved: [],
        snoozed_count: 3,
      }
      mockRpc.mockResolvedValue({ data: overview, error: null })

      const { result } = renderHook(() => useChurnOverview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data!.kpis.total).toBe(50)
      expect(result.current.data!.kpis.critical).toBe(5)
      expect(result.current.data!.mrr_at_risk).toBe(25000)
      expect(result.current.data!.snoozed_count).toBe(3)
      expect(mockRpc).toHaveBeenCalledWith('get_churn_overview')
    })

    it('lève une erreur Supabase', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc error' } })

      const { result } = renderHook(() => useChurnOverview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useChurnTrends — tendances', () => {
    it('retourne les points de tendance sur 90 jours par défaut', async () => {
      const trends: ChurnTrendPoint[] = [
        {
          day: '2026-03-01',
          total: 45,
          critical: 3,
          high: 8,
          medium: 18,
          low: 16,
          avg_score: 0.45,
        },
        {
          day: '2026-04-01',
          total: 48,
          critical: 5,
          high: 10,
          medium: 20,
          low: 13,
          avg_score: 0.52,
        },
      ]
      mockRpc.mockResolvedValue({ data: trends, error: null })

      const { result } = renderHook(() => useChurnTrends(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data![0].avg_score).toBe(0.45)
      expect(result.current.data![1].critical).toBe(5)
      expect(mockRpc).toHaveBeenCalledWith('get_churn_trends', { p_days: 90 })
    })

    it('utilise le nombre de jours passé en paramètre', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null })

      const { result } = renderHook(() => useChurnTrends(30), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(mockRpc).toHaveBeenCalledWith('get_churn_trends', { p_days: 30 })
    })
  })

  describe('useChurnHistory — historique par établissement', () => {
    it('est désactivé quand etabId est undefined', () => {
      const { result } = renderHook(() => useChurnHistory(undefined), {
        wrapper: createWrapper(),
      })
      expect(result.current.fetchStatus).toBe('idle')
    })

    it("charge l'historique quand etabId est fourni", async () => {
      const history = [
        { day: '2026-05-01', score: 0.6, risk_level: 'medium' as const },
        { day: '2026-06-01', score: 0.82, risk_level: 'high' as const },
      ]
      mockRpc.mockResolvedValue({ data: history, error: null })

      const { result } = renderHook(() => useChurnHistory('etab-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data![1].score).toBe(0.82)
      expect(result.current.data![1].risk_level).toBe('high')
      expect(mockRpc).toHaveBeenCalledWith('get_etablissement_churn_history', {
        p_etab: 'etab-1',
        p_days: 90,
      })
    })
  })

  describe('useAcknowledgeChurn — mutation acknowledge', () => {
    it('appelle rpc acknowledge_churn avec les bons paramètres', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })
      mockFromChurnPredictions(mockPredictions)

      const { result } = renderHook(() => useAcknowledgeChurn(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          etabId: 'etab-1',
          until: '2026-07-01',
          note: 'Action planifiée',
        })
      })

      expect(mockRpc).toHaveBeenCalledWith('acknowledge_churn', {
        p_etab: 'etab-1',
        p_until: '2026-07-01',
        p_note: 'Action planifiée',
      })
    })

    it('fonctionne sans note optionnelle', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const { result } = renderHook(() => useAcknowledgeChurn(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({ etabId: 'etab-2', until: '2026-08-01' })
      })

      expect(mockRpc).toHaveBeenCalledWith('acknowledge_churn', {
        p_etab: 'etab-2',
        p_until: '2026-08-01',
        p_note: undefined,
      })
    })

    it('lève une erreur si rpc échoue', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'ACK failed' } })

      const { result } = renderHook(() => useAcknowledgeChurn(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(
          result.current.mutateAsync({ etabId: 'etab-1', until: '2026-07-01' })
        ).rejects.toThrow()
      })
    })
  })

  describe('useGenerateRetentionEmail — IA email', () => {
    it("appelle functions.invoke avec l'etabId correct", async () => {
      const emailResult = {
        subject: 'Votre satisfaction chez CHU Bordeaux',
        body: 'Bonjour, nous souhaitons vous accompagner...',
      }
      mockFunctionsInvoke.mockResolvedValue({ data: emailResult, error: null })

      const { result } = renderHook(() => useGenerateRetentionEmail(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        const data = await result.current.mutateAsync('etab-1')
        expect(data.subject).toBe('Votre satisfaction chez CHU Bordeaux')
        expect(data.body).toContain('Bonjour')
      })

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('generate-retention-email', {
        body: { etablissement_id: 'etab-1' },
      })
    })

    it('lève une erreur si la fonction Edge échoue', async () => {
      mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'AI error' } })

      const { result } = renderHook(() => useGenerateRetentionEmail(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(result.current.mutateAsync('etab-bad')).rejects.toThrow()
      })
    })
  })
})
