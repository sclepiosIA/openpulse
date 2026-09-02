import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';

const {
  AUTH_STATE,
  TOAST_FN,
  SANITIZED_ERROR,
  CHURN_ROWS,
  CHURN_HIGH_ROWS,
  SEGMENT_ROWS,
  CREATED_SEGMENT_ROW,
  UPSERTED_ASSIGNMENT_ROW,
  UPSELL_ROWS,
  UPDATED_UPSELL_ROW,
  FORECAST_ROWS,
  ALERT_ROWS,
  UPDATED_ALERT_ROW,
  REPORT_ROWS,
  CREATED_REPORT_ROW,
  UPDATED_REPORT_ROW,
  KPI_RPC_DATA,
  mockFrom,
  mockRpc,
  mockToastHook,
  mockSanitizeSupabaseError,
  builderState,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const TOAST_FN = vi.fn();
  const SANITIZED_ERROR = 'sanitized-x';

  const CHURN_ROWS = [
    {
      id: 'cp1',
      score: 92,
      risk_level: 'high',
      etablissement: { id: 'e1', nom: 'Alpha', statut: 'actif' },
    },
  ];

  const CHURN_HIGH_ROWS = [
    {
      id: 'cp2',
      score: 88,
      risk_level: 'high',
      etablissement: { id: 'e2', nom: 'Beta', statut: 'actif' },
    },
  ];

  const SEGMENT_ROWS = [
    {
      id: 's1',
      nom: 'VIP',
      description: 'Clients premium',
      criteres: { min_ca: 1000 },
      couleur: '#fff',
      est_actif: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
  ];

  const CREATED_SEGMENT_ROW = {
    id: 's2',
    nom: 'Nouveau',
    description: 'Segment créé',
    criteres: { max_ca: 500 },
    couleur: '#000',
    est_actif: true,
  };

  const UPSERTED_ASSIGNMENT_ROW = {
    id: 'as1',
    etablissement_id: 'e1',
    segment_id: 's1',
    score_appartenance: 77,
    assigned_by: 'u1',
  };

  const UPSELL_ROWS = [
    {
      id: 'u1',
      statut: 'pending',
      score_confiance: 81,
      etablissement: { id: 'e1', nom: 'Alpha' },
    },
  ];

  const UPDATED_UPSELL_ROW = {
    id: 'u1',
    statut: 'accepted',
    processed_by: 'u1',
  };

  const FORECAST_ROWS = [
    {
      id: 'f1',
      etablissement_id: 'e1',
      commercial_id: 'c1',
      periode: '2024-06',
      type_periode: 'monthly',
      montant_prevu: 1200,
      montant_realise: 1000,
      ecart_pourcentage: 20,
      facteurs_influence: {},
      model_version: 'v1',
      created_at: '2024-06-01',
      updated_at: '2024-06-02',
    },
  ];

  const ALERT_ROWS = [
    {
      id: 'a1',
      statut: 'open',
      etablissement: { id: 'e1', nom: 'Alpha' },
      created_at: '2024-06-01',
    },
  ];

  const UPDATED_ALERT_ROW = {
    id: 'a1',
    statut: 'acknowledged',
    acknowledged_by: 'u1',
  };

  const REPORT_ROWS = [
    {
      id: 'r1',
      titre: 'Rapport mensuel',
      type_rapport: 'tracfin',
      statut: 'draft',
      periode_debut: '2024-01-01',
      periode_fin: '2024-01-31',
      donnees: { total: 3 },
      fichier_path: '/r1.pdf',
      created_by: 'u1',
      submitted_at: null,
      submitted_by: null,
      created_at: '2024-01-31',
      updated_at: '2024-02-01',
    },
  ];

  const CREATED_REPORT_ROW = {
    id: 'r2',
    titre: 'Nouveau rapport',
    type_rapport: 'acpr',
    statut: 'draft',
  };

  const UPDATED_REPORT_ROW = {
    id: 'r1',
    statut: 'submitted',
    submitted_by: 'u1',
  };

  const KPI_RPC_DATA = {
    total_etablissements: 25,
    high_risk_count: 3,
    medium_risk_count: 7,
    low_risk_count: 15,
    average_churn_score: 42,
    active_alerts: 4,
    pending_upsells: 6,
    upsell_potential: 15000,
    forecasted_ca: 90000,
    realized_ca: 87000,
  };

  const builderState = {
    table: '',
    selectArg: undefined as string | undefined,
    insertArg: undefined as unknown,
    updateArg: undefined as unknown,
    upsertArg: undefined as unknown,
    eqArgs: [] as Array<[string, unknown]>,
    orderArgs: [] as Array<[string, unknown]>,
    limitArg: undefined as number | undefined,
    response: { data: null as unknown, error: null as { message: string } | null },
  };

  const createBuilder = () => {
    const builder = {
      select: vi.fn((arg?: string) => {
        builderState.selectArg = arg;
        return builder;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        builderState.eqArgs.push([col, val]);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn((col: string, opts?: unknown) => {
        builderState.orderArgs.push([col, opts]);
        return builder;
      }),
      limit: vi.fn((n: number) => {
        builderState.limitArg = n;
        return builder;
      }),
      insert: vi.fn((arg: unknown) => {
        builderState.insertArg = arg;
        return builder;
      }),
      update: vi.fn((arg: unknown) => {
        builderState.updateArg = arg;
        return builder;
      }),
      upsert: vi.fn((arg: unknown) => {
        builderState.upsertArg = arg;
        return builder;
      }),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => builderState.response),
      maybeSingle: vi.fn(async () => builderState.response),
      then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.response).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.response).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table;
    builderState.selectArg = undefined;
    builderState.insertArg = undefined;
    builderState.updateArg = undefined;
    builderState.upsertArg = undefined;
    builderState.eqArgs = [];
    builderState.orderArgs = [];
    builderState.limitArg = undefined;
    return createBuilder();
  });

  const mockRpc = vi.fn(async () => ({ data: KPI_RPC_DATA, error: null }));
  const mockToastHook = vi.fn(() => ({ toast: TOAST_FN }));
  const mockSanitizeSupabaseError = vi.fn(() => SANITIZED_ERROR);

  return {
    AUTH_STATE,
    TOAST_FN,
    SANITIZED_ERROR,
    CHURN_ROWS,
    CHURN_HIGH_ROWS,
    SEGMENT_ROWS,
    CREATED_SEGMENT_ROW,
    UPSERTED_ASSIGNMENT_ROW,
    UPSELL_ROWS,
    UPDATED_UPSELL_ROW,
    FORECAST_ROWS,
    ALERT_ROWS,
    UPDATED_ALERT_ROW,
    REPORT_ROWS,
    CREATED_REPORT_ROW,
    UPDATED_REPORT_ROW,
    KPI_RPC_DATA,
    mockFrom,
    mockRpc,
    mockToastHook,
    mockSanitizeSupabaseError,
    builderState,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockToastHook,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

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
} from './useAnalytics';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builderState.response = { data: null, error: null };
  });

  it('useChurnPredictions gère loading puis succès avec les données triées attendues', async () => {
    builderState.response = { data: CHURN_ROWS, error: null };

    const { result } = renderHook(() => useChurnPredictions(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('churn_predictions');
    expect(builderState.orderArgs).toEqual([['score', { ascending: false }]]);
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data?.[0]?.id).toBe('cp1');
    expect(result.current.data?.[0]?.etablissement.nom).toBe('Alpha');
    expect(result.current.data?.[0]?.score).toBe(92);
  });

  it('useChurnPredictionsByRisk applique le filtre de risque et remonte une erreur', async () => {
    builderState.response = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useChurnPredictionsByRisk('high' as never), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('churn_predictions');
    expect(builderState.eqArgs).toContainEqual(['risk_level', 'high']);
    expect(result.current.error?.message).toBe('x');
  });

  it('useClientSegments retourne les segments avec limite et ordre', async () => {
    builderState.response = { data: SEGMENT_ROWS, error: null };

    const { result } = renderHook(() => useClientSegments(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('client_segments');
    expect(builderState.limitArg).toBe(200);
    expect(builderState.orderArgs).toEqual([['nom', undefined]]);
    expect(result.current.data?.[0]?.nom).toBe('VIP');
    expect(result.current.data?.[0]?.criteres).toEqual({ min_ca: 1000 });
  });

  it('useCreateSegment insère le segment et déclenche le toast de succès', async () => {
    builderState.response = { data: CREATED_SEGMENT_ROW, error: null };

    const { result } = renderHook(() => useCreateSegment(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Nouveau',
        description: 'Segment créé',
        criteres: { max_ca: 500 } as never,
        couleur: '#000',
        est_actif: true,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('client_segments');
    expect(builderState.insertArg).toEqual({
      nom: 'Nouveau',
      description: 'Segment créé',
      criteres: { max_ca: 500 },
      couleur: '#000',
      est_actif: true,
    });
    expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Segment créé avec succès' });
  });

  it('useAssignSegment utilise le user authentifié dans l’upsert', async () => {
    builderState.response = { data: UPSERTED_ASSIGNMENT_ROW, error: null };

    const { result } = renderHook(() => useAssignSegment(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        etablissement_id: 'e1',
        segment_id: 's1',
        score_appartenance: 77,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissement_segments');
    expect(builderState.upsertArg).toEqual({
      etablissement_id: 'e1',
      segment_id: 's1',
      score_appartenance: 77,
      assigned_by: 'u1',
    });
    expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Segment assigné' });
  });

  it('useUpsellRecommendations filtre par statut et retourne les recommandations', async () => {
    builderState.response = { data: UPSELL_ROWS, error: null };

    const { result } = renderHook(() => useUpsellRecommendations('pending' as never), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('upsell_recommendations');
    expect(builderState.eqArgs).toContainEqual(['statut', 'pending']);
    expect(result.current.data?.[0]?.score_confiance).toBe(81);
    expect(result.current.data?.[0]?.etablissement.nom).toBe('Alpha');
  });

  it('useUpdateUpsellStatus met à jour le statut et processed_by', async () => {
    builderState.response = { data: UPDATED_UPSELL_ROW, error: null };

    const { result } = renderHook(() => useUpdateUpsellStatus(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: 'u1', statut: 'accepted' as never });
    });

    expect(mockFrom).toHaveBeenCalledWith('upsell_recommendations');
    expect(builderState.eqArgs).toContainEqual(['id', 'u1']);
    expect(builderState.updateArg).toMatchObject({
      statut: 'accepted',
      processed_by: 'u1',
    });
    expect(typeof (builderState.updateArg as { processed_at?: unknown }).processed_at).toBe('string');
    expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Statut mis à jour' });
  });

  it('useCAForecasts applique le filtre de période et retourne les montants attendus', async () => {
    builderState.response = { data: FORECAST_ROWS, error: null };

    const { result } = renderHook(() => useCAForecasts('monthly'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('ca_forecasts');
    expect(builderState.eqArgs).toContainEqual(['type_periode', 'monthly']);
    expect(builderState.limitArg).toBe(500);
    expect(result.current.data?.[0]?.montant_prevu).toBe(1200);
    expect(result.current.data?.[0]?.ecart_pourcentage).toBe(20);
  });

  it('useProactiveAlerts retourne une erreur si la requête échoue', async () => {
    builderState.response = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useProactiveAlerts('open' as never), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('proactive_alerts');
    expect(builderState.eqArgs).toContainEqual(['statut', 'open']);
    expect(result.current.error?.message).toBe('x');
  });

  it('useUpdateAlertStatus ajoute acknowledged_by pour le statut acknowledged', async () => {
    builderState.response = { data: UPDATED_ALERT_ROW, error: null };

    const { result } = renderHook(() => useUpdateAlertStatus(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: 'a1', statut: 'acknowledged' as never });
    });

    expect(mockFrom).toHaveBeenCalledWith('proactive_alerts');
    expect(builderState.eqArgs).toContainEqual(['id', 'a1']);
    expect(builderState.updateArg).toMatchObject({
      statut: 'acknowledged',
      acknowledged_by: 'u1',
    });
    expect(typeof (builderState.updateArg as { acknowledged_at?: unknown }).acknowledged_at).toBe('string');
    expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Alerte mise à jour' });
  });

  it('useRegulatoryReports mappe correctement les champs typés', async () => {
    builderState.response = { data: REPORT_ROWS, error: null };

    const { result } = renderHook(() => useRegulatoryReports(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('regulatory_reports');
    expect(builderState.limitArg).toBe(200);
    expect(result.current.data?.[0]).toMatchObject({
      id: 'r1',
      titre: 'Rapport mensuel',
      type_rapport: 'tracfin',
      statut: 'draft',
      donnees: { total: 3 },
      created_at: '2024-01-31',
      updated_at: '2024-02-01',
    });
  });

  it('useCreateRegulatoryReport insère le rapport et notifie le succès', async () => {
    builderState.response = { data: CREATED_REPORT_ROW, error: null };

    const { result } = renderHook(() => useCreateRegulatoryReport(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Nouveau rapport',
        type_rapport: 'acpr' as never,
        statut: 'draft' as never,
        periode_debut: '2024-02-01',
        periode_fin: '2024-02-29',
        donnees: { entries: 1 } as never,
        fichier_path: '/new.pdf',
        created_by: 'u1',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('regulatory_reports');
    expect(builderState.insertArg).toEqual({
      type_rapport: 'acpr',
      titre: 'Nouveau rapport',
      periode_debut: '2024-02-01',
      periode_fin: '2024-02-29',
      donnees: { entries: 1 },
      statut: 'draft',
      fichier_path: '/new.pdf',
      created_by: 'u1',
    });
    expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Rapport créé avec succès' });
  });

  it('useUpdateReportStatus ajoute submitted_by quand le statut devient submitted', async () => {
    builderState.response = { data: UPDATED_REPORT_ROW, error: null };

    const { result } = renderHook(() => useUpdateReportStatus(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: 'r1', statut: 'submitted' as never });
    });

    expect(mockFrom).toHaveBeenCalledWith('regulatory_reports');
    expect(builderState.eqArgs).toContainEqual(['id', 'r1']);
    expect(builderState.updateArg).toMatchObject({
      statut: 'submitted',
      submitted_by: 'u1',
    });
    expect(typeof (builderState.updateArg as { submitted_at?: unknown }).submitted_at).toBe('string');
    expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Statut mis à jour' });
  });

  it('useAnalyticsKPIs appelle la RPC et retourne les KPI métier réels', async () => {
    const { result } = renderHook(() => useAnalyticsKPIs(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_analytics_overview');
    expect(result.current.data).toEqual({
      total_etablissements: 25,
      high_risk_count: 3,
      medium_risk_count: 7,
      low_risk_count: 15,
      average_churn_score: 42,
      active_alerts: 4,
      pending_upsells: 6,
      upsell_potential: 15000,
      forecasted_ca: 90000,
      realized_ca: 87000,
    });
  });

  it('les mutations déclenchent le toast d’erreur avec message sanitizé', async () => {
    builderState.response = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useCreateSegment(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          nom: 'Erreur',
          description: 'Ko',
          criteres: { bad: true } as never,
          couleur: '#123',
          est_actif: false,
        });
      } catch {}
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: SANITIZED_ERROR,
      variant: 'destructive',
    });
  });
});