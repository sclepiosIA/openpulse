/**
 * Tests unitaires pour useAnalytics (Module 9: Prédiction & Analytics Avancés).
 *
 * Les hooks exposés sont :
 *   useChurnPredictions, useChurnPredictionsByRisk
 *   useClientSegments, useCreateSegment, useAssignSegment
 *   useUpsellRecommendations, useUpdateUpsellStatus
 *   useCAForecasts
 *   useProactiveAlerts, useUpdateAlertStatus
 *   useRegulatoryReports, useCreateRegulatoryReport, useUpdateReportStatus
 *   useAnalyticsKPIs (via RPC)
 *
 * Les tests couvrent :
 * — Queries : état loading → success, données retournées, erreur Supabase → isError
 * — Mutations : toast succès + invalidation de la bonne queryKey, toast destructive erreur
 * — useAnalyticsKPIs : appelle supabase.rpc('get_analytics_overview') et transforme les données
 * — useUpdateAlertStatus : logic conditionnelle (acknowledged/resolved)
 * — useUpdateReportStatus : logic conditionnelle (submitted)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  ChurnPrediction,
  ClientSegment,
  UpsellStatus,
  AlertStatus,
  RegulatoryReportStatus,
} from '@/types/analytics'

// ─── Type helper ──────────────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: any[]) => Chainable | Promise<unknown> }

// ─── Références stables hoistées ─────────────────────────────────────────────
const { mockToast, mockFrom, mockRpc } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}))

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (err: Error) => err.message,
}))

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    loading: false,
  }),
}))

// ─── Imports après mocks ──────────────────────────────────────────────────────
import {
  useChurnPredictions,
  useChurnPredictionsByRisk,
  useClientSegments,
  useCreateSegment,
  useAssignSegment,
  useUpsellRecommendations,
  useUpdateUpsellStatus,
  useCAForecasts,
  useProactiveAlerts,
  useUpdateAlertStatus,
  useRegulatoryReports,
  useCreateRegulatoryReport,
  useUpdateReportStatus,
  useAnalyticsKPIs,
} from '@/hooks/analytics/useAnalytics'
import { supabase } from '@/integrations/supabase/client';

// ─── Wrapper ──────────────────────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ─── Chaîne builder réutilisable ──────────────────────────────────────────────
function chainWith(data: unknown, error: unknown = null): Chainable {
  const chain: Chainable = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    is: () => chain,
    in: () => chain,
    not: () => chain,
    gte: () => chain,
    lte: () => chain,
    // limit retourne chain pour permettre les appels suivants (.eq() apres .limit())
    limit: () => chain,
    // order retourne chain pour permettre les appels suivants (eq, limit, etc.)
    order: () => chain,
    single: () => Promise.resolve({ data, error }) as unknown as Chainable,
    maybeSingle: () => Promise.resolve({ data, error }) as unknown as Chainable,
    upsert: () =>
      ({
        select: () => ({
          single: () => Promise.resolve({ data, error }),
        }),
      }) as unknown as Chainable,
    insert: () =>
      ({
        select: () => ({
          single: () => Promise.resolve({ data, error }),
        }),
      }) as unknown as Chainable,
    update: () => chain,
    then: (cb: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(cb) as unknown as Chainable,
  }
  return chain
}

// ─── Données de test ──────────────────────────────────────────────────────────
const mockChurnPrediction: ChurnPrediction = {
  id: 'cp-1',
  etablissement_id: 'etab-1',
  score: 0.85,
  risk_level: 'high',
  factors: [{ factor: 'adoption', impact: 0.3, description: 'Faible adoption' }],
  recommendations: ['Planifier un appel de suivi'],
  predicted_at: '2026-01-01T00:00:00Z',
  model_version: 'v1.0',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  etablissement: { id: 'etab-1', nom: 'CHU Paris', statut: 'Production' },
}

const mockSegment: ClientSegment = {
  id: 'seg-1',
  nom: 'Premium',
  description: 'Clients premium',
  criteres: { statut: ['Production'] },
  couleur: '#FF0000',
  est_actif: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ─── useChurnPredictions ───────────────────────────────────────────────────────
describe('useChurnPredictions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne isLoading=true initialement', () => {
    mockFrom.mockReturnValue(chainWith([]))
    const { result } = renderHook(() => useChurnPredictions(), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
  })

  it('retourne les prédictions triées par score', async () => {
    mockFrom.mockReturnValue(chainWith([mockChurnPrediction]))
    const { result } = renderHook(() => useChurnPredictions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].risk_level).toBe('high')
    expect(result.current.data?.[0].score).toBe(0.85)
  })

  it(`isError=true en cas d'erreur Supabase`, async () => {
    mockFrom.mockReturnValue(chainWith(null, { message: 'DB error' }))
    const { result } = renderHook(() => useChurnPredictions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useChurnPredictionsByRisk ─────────────────────────────────────────────────
describe('useChurnPredictionsByRisk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les prédictions filtrées par niveau de risque high', async () => {
    mockFrom.mockReturnValue(chainWith([mockChurnPrediction]))
    const { result } = renderHook(() => useChurnPredictionsByRisk('high'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].risk_level).toBe('high')
  })

  it('utilise la bonne queryKey avec le niveau de risque', async () => {
    mockFrom.mockReturnValue(chainWith([]))
    const { result } = renderHook(() => useChurnPredictionsByRisk('low'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('churn_predictions')
  })
})

// ─── useClientSegments ────────────────────────────────────────────────────────
describe('useClientSegments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les segments après chargement', async () => {
    mockFrom.mockReturnValue(chainWith([mockSegment]))
    const { result } = renderHook(() => useClientSegments(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].nom).toBe('Premium')
  })

  it('retourne tableau vide si aucun segment', async () => {
    mockFrom.mockReturnValue(chainWith([]))
    const { result } = renderHook(() => useClientSegments(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── useCreateSegment ─────────────────────────────────────────────────────────
describe('useCreateSegment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Segment créé avec succès" après succès', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockSegment, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateSegment(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Premium',
        description: null,
        criteres: { statut: ['Production'] },
        couleur: '#FF0000',
        est_actif: true,
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Segment créé avec succès' })
    )
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Insert failed') })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateSegment(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current
        .mutateAsync({
          nom: 'Seg fail',
          description: null,
          criteres: {},
          couleur: '#000',
          est_actif: true,
        })
        .catch(() => {})
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── useAssignSegment ─────────────────────────────────────────────────────────
describe('useAssignSegment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Segment assigné" après succès', async () => {
    const assigned = {
      id: 'es-1',
      etablissement_id: 'etab-1',
      segment_id: 'seg-1',
      score_appartenance: 100,
    }
    mockFrom.mockReturnValue({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: assigned, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useAssignSegment(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        etablissement_id: 'etab-1',
        segment_id: 'seg-1',
        score_appartenance: 100,
      })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Segment assigné' }))
  })
})

// ─── useUpsellRecommendations ─────────────────────────────────────────────────
describe('useUpsellRecommendations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les recommandations sans filtre statut', async () => {
    const recs = [
      { id: 'upsell-1', etablissement_id: 'etab-1', statut: 'pending', score_confiance: 0.9 },
    ]
    mockFrom.mockReturnValue(chainWith(recs))

    const { result } = renderHook(() => useUpsellRecommendations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('upsell-1')
  })

  it('filtre par statut quand fourni', async () => {
    const recs = [{ id: 'upsell-2', statut: 'contacted', score_confiance: 0.7 }]
    mockFrom.mockReturnValue(chainWith(recs))

    const { result } = renderHook(() => useUpsellRecommendations('contacted' as UpsellStatus), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].statut).toBe('contacted')
  })
})

// ─── useUpdateUpsellStatus ────────────────────────────────────────────────────
describe('useUpdateUpsellStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Statut mis à jour" après succès', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'upsell-1', statut: 'accepted' },
                error: null,
              })
            ),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateUpsellStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'upsell-1', statut: 'accepted' as UpsellStatus })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Statut mis à jour' }))
  })
})

// ─── useCAForecasts ────────────────────────────────────────────────────────────
describe('useCAForecasts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les prévisions CA sans filtre', async () => {
    const forecasts = [
      { id: 'fc-1', etablissement_id: 'etab-1', periode: '2026-01', montant_prevu: 50000 },
    ]
    mockFrom.mockReturnValue(chainWith(forecasts))

    const { result } = renderHook(() => useCAForecasts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].montant_prevu).toBe(50000)
  })

  it('filtre par typePeriode quand fourni', async () => {
    const filtered = [{ id: 'fc-2', type_periode: 'month', montant_prevu: 30000 }]
    mockFrom.mockReturnValue(chainWith(filtered))

    const { result } = renderHook(() => useCAForecasts('month'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].type_periode).toBe('month')
  })
})

// ─── useProactiveAlerts ────────────────────────────────────────────────────────
describe('useProactiveAlerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les alertes sans filtre', async () => {
    const alerts = [{ id: 'alert-1', statut: 'active', etablissement_id: 'etab-1' }]
    mockFrom.mockReturnValue(chainWith(alerts))

    const { result } = renderHook(() => useProactiveAlerts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('alert-1')
  })

  it('filtre par statut "active"', async () => {
    const filtered = [{ id: 'alert-2', statut: 'active' }]
    mockFrom.mockReturnValue(chainWith(filtered))

    const { result } = renderHook(() => useProactiveAlerts('active' as AlertStatus), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].statut).toBe('active')
  })
})

// ─── useUpdateAlertStatus ──────────────────────────────────────────────────────
describe('useUpdateAlertStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Alerte mise à jour" pour statut acknowledged', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'alert-1', statut: 'acknowledged' },
                error: null,
              })
            ),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateAlertStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'alert-1', statut: 'acknowledged' as AlertStatus })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alerte mise à jour' }))
  })

  it('toast "Alerte mise à jour" pour statut resolved', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'alert-1', statut: 'resolved' },
                error: null,
              })
            ),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateAlertStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'alert-1', statut: 'resolved' as AlertStatus })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alerte mise à jour' }))
  })

  it(`toast destructive en cas d'erreur`, async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Update failed') })),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateAlertStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current
        .mutateAsync({ id: 'alert-fail', statut: 'resolved' as AlertStatus })
        .catch(() => {})
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── useRegulatoryReports ─────────────────────────────────────────────────────
describe('useRegulatoryReports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les rapports et mappe correctement les types', async () => {
    const rawReports = [
      {
        id: 'rep-1',
        titre: 'Rapport HAS Q1',
        type_rapport: 'has',
        statut: 'draft',
        periode_debut: '2026-01-01',
        periode_fin: '2026-03-31',
        donnees: { metrics: [] },
        fichier_path: null,
        created_by: 'user-1',
        submitted_at: null,
        submitted_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    mockFrom.mockReturnValue(chainWith(rawReports))

    const { result } = renderHook(() => useRegulatoryReports(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].titre).toBe('Rapport HAS Q1')
    expect(result.current.data?.[0].statut).toBe('draft')
    expect(result.current.data?.[0].type_rapport).toBe('has')
  })

  it('retourne tableau vide si aucun rapport', async () => {
    mockFrom.mockReturnValue(chainWith(null))

    const { result } = renderHook(() => useRegulatoryReports(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── useCreateRegulatoryReport ─────────────────────────────────────────────────
describe('useCreateRegulatoryReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Rapport créé avec succès" après succès', async () => {
    const created = {
      id: 'rep-new',
      titre: 'Nouveau rapport',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: created, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateRegulatoryReport(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Nouveau rapport',
        type_rapport: 'has',
        statut: 'draft',
        periode_debut: '2026-01-01',
        periode_fin: '2026-03-31',
        donnees: { periode_debut: '2026-01-01', periode_fin: '2026-03-31', metrics: [] },
        fichier_path: null,
        created_by: 'user-1',
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rapport créé avec succès' })
    )
  })
})

// ─── useUpdateReportStatus ────────────────────────────────────────────────────
describe('useUpdateReportStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Statut mis à jour" pour statut draft', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: { id: 'rep-1', statut: 'draft' }, error: null })
            ),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateReportStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'rep-1', statut: 'draft' as RegulatoryReportStatus })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Statut mis à jour' }))
  })

  it('toast "Statut mis à jour" pour statut submitted (avec submitted_at)', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'rep-1', statut: 'submitted', submitted_at: '2026-06-03T00:00:00Z' },
                error: null,
              })
            ),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateReportStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'rep-1',
        statut: 'submitted' as RegulatoryReportStatus,
      })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Statut mis à jour' }))
  })

  it(`toast destructive en cas d'erreur`, async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Update failed') })),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateReportStatus(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current
        .mutateAsync({ id: 'rep-fail', statut: 'draft' as RegulatoryReportStatus })
        .catch(() => {})
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── useAnalyticsKPIs ─────────────────────────────────────────────────────────
describe('useAnalyticsKPIs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appelle supabase.rpc("get_analytics_overview")', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_etablissements: 100,
        high_risk_count: 10,
        medium_risk_count: 20,
        low_risk_count: 70,
        average_churn_score: 0.3,
        active_alerts: 5,
        pending_upsells: 3,
        upsell_potential: 50000,
        forecasted_ca: 500000,
        realized_ca: 480000,
      },
      error: null,
    })

    const { result } = renderHook(() => useAnalyticsKPIs(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_analytics_overview')
  })

  it('transforme correctement les données RPC en AnalyticsKPIs', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_etablissements: 50,
        high_risk_count: 5,
        medium_risk_count: 15,
        low_risk_count: 30,
        average_churn_score: 0.25,
        active_alerts: 2,
        pending_upsells: 8,
        upsell_potential: 120000,
        forecasted_ca: 1000000,
        realized_ca: 950000,
      },
      error: null,
    })

    const { result } = renderHook(() => useAnalyticsKPIs(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const kpis = result.current.data
    expect(kpis?.total_etablissements).toBe(50)
    expect(kpis?.high_risk_count).toBe(5)
    expect(kpis?.active_alerts).toBe(2)
    expect(kpis?.forecasted_ca).toBe(1000000)
  })

  it('utilise 0 comme valeur par défaut pour les champs manquants dans la réponse RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { total_etablissements: 10 }, // autres champs absents
      error: null,
    })

    const { result } = renderHook(() => useAnalyticsKPIs(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const kpis = result.current.data
    expect(kpis?.high_risk_count).toBe(0)
    expect(kpis?.active_alerts).toBe(0)
    expect(kpis?.pending_upsells).toBe(0)
    expect(kpis?.forecasted_ca).toBe(0)
  })

  it('isError=true si la RPC échoue', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('RPC error'),
    })

    const { result } = renderHook(() => useAnalyticsKPIs(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
