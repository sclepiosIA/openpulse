/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useChurnPredictions,
  useRecomputeChurn,
  useChurnOverview,
  useChurnTrends,
  useChurnHistory,
  useAcknowledgeChurn,
  useGenerateRetentionEmail,
} from './useChurnPredictions';

const {
  PREDICTIONS_ROWS,
  OVERVIEW_DATA,
  TRENDS_DATA,
  HISTORY_DATA,
  RECOMPUTE_DATA,
  ACK_DATA,
  EMAIL_DATA,
  AUTH_STATE,
  mockFrom,
  mockRpc,
  mockInvoke,
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockRemoveChannel,
  mockChannelOn,
  mockChannelSubscribe,
  channelObject,
  builder,
} = vi.hoisted(() => {
  const PREDICTIONS_ROWS = [
    {
      id: 'cp-1',
      etablissement_id: 'etab-1',
      score: 92,
      risk_level: 'critical' as const,
      factors: { many_tickets: 4, no_emails: 2 },
      recommendations: ['Call client', 'Offer training'],
      predicted_at: '2024-05-10',
      model_version: 'v1',
      acknowledged_until: null,
      acknowledged_by: null,
      acknowledged_note: null,
      etablissement: {
        id: 'etab-1',
        nom: 'Alpha',
        statut: 'actif',
        csm_id: 'csm-1',
        type_offre: 'pro',
      },
    },
    {
      id: 'cp-2',
      etablissement_id: 'etab-2',
      score: 71,
      risk_level: 'high' as const,
      factors: { no_interaction: 3 },
      recommendations: ['Schedule QBR'],
      predicted_at: '2024-05-09',
      model_version: 'v1',
      acknowledged_until: '2024-06-01',
      acknowledged_by: 'user-1',
      acknowledged_note: 'Handled',
      etablissement: {
        id: 'etab-2',
        nom: 'Beta',
        statut: 'essai',
        csm_id: null,
        type_offre: 'basic',
      },
    },
  ];

  const OVERVIEW_DATA = {
    computed_at: '2024-05-10T10:00:00Z',
    kpis: { total: 12, critical: 2, high: 3, medium: 4, low: 3, avg_score: 58.4 },
    prev_kpis: { total: 11, critical: 1, avg_score: 54.1 },
    mrr_at_risk: 4200,
    factors_breakdown: {
      many_tickets: 5,
      no_emails: 3,
      many_unpaid: 2,
      no_interaction: 4,
    },
    worsened: [
      {
        etablissement_id: 'etab-1',
        nom: 'Alpha',
        score: 92,
        risk_level: 'critical' as const,
        prev_score: 81,
        delta: 11,
      },
    ],
    improved: [
      {
        etablissement_id: 'etab-3',
        nom: 'Gamma',
        score: 24,
        risk_level: 'low' as const,
        prev_score: 40,
        delta: -16,
      },
    ],
    snoozed_count: 2,
  };

  const TRENDS_DATA = [
    { day: '2024-05-01', total: 10, critical: 1, high: 2, medium: 3, low: 4, avg_score: 45.2 },
    { day: '2024-05-02', total: 11, critical: 2, high: 2, medium: 3, low: 4, avg_score: 48.9 },
  ];

  const HISTORY_DATA = [
    { day: '2024-05-01', score: 66, risk_level: 'medium' as const },
    { day: '2024-05-02', score: 79, risk_level: 'high' as const },
  ];

  const RECOMPUTE_DATA = [{ processed: 18, high_risk: 5, critical_risk: 2 }];
  const ACK_DATA = { ok: true };
  const EMAIL_DATA = { subject: 'We can help', body: 'Let us review your setup.' };
  const AUTH_STATE = {
    user: { id: 'u-1', email: 'test@example.co' },
    session: { user: { id: 'u-1' } },
    isLoading: false,
  };

  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockInvoke = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockInvalidateQueries = vi.fn();
  const mockRemoveChannel = vi.fn();

  const channelObject = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channelObject.on.mockReturnValue(channelObject);
  channelObject.subscribe.mockReturnValue(channelObject);

  const mockChannelOn = channelObject.on;
  const mockChannelSubscribe = channelObject.subscribe;

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
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.catch.mockReturnValue(builder);

  return {
    PREDICTIONS_ROWS,
    OVERVIEW_DATA,
    TRENDS_DATA,
    HISTORY_DATA,
    RECOMPUTE_DATA,
    ACK_DATA,
    EMAIL_DATA,
    AUTH_STATE,
    mockFrom,
    mockRpc,
    mockInvoke,
    mockToastSuccess,
    mockToastError,
    mockInvalidateQueries,
    mockRemoveChannel,
    mockChannelOn,
    mockChannelSubscribe,
    channelObject,
    builder,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
    channel: vi.fn(() => channelObject),
    removeChannel: mockRemoveChannel,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useChurnPredictions hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    builder.select.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    builder.then.mockImplementation((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: PREDICTIONS_ROWS, error: null }))
    );

    mockFrom.mockReturnValue(builder);
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'compute_churn_predictions') {
        return Promise.resolve({ data: RECOMPUTE_DATA, error: null });
      }
      if (fnName === 'get_churn_overview') {
        return Promise.resolve({ data: OVERVIEW_DATA, error: null });
      }
      if (fnName === 'get_churn_trends') {
        return Promise.resolve({ data: TRENDS_DATA, error: null });
      }
      if (fnName === 'get_etablissement_churn_history') {
        return Promise.resolve({ data: HISTORY_DATA, error: null });
      }
      if (fnName === 'acknowledge_churn') {
        return Promise.resolve({ data: ACK_DATA, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockInvoke.mockResolvedValue({ data: EMAIL_DATA, error: null });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('charge puis retourne les prédictions métier triées par score et configure le realtime', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChurnPredictions(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('churn_predictions');
    expect(builder.select).toHaveBeenCalledWith(`
          *,
          etablissement:etablissements!churn_predictions_etablissement_id_fkey(id, nom, statut, csm_id, type_offre)
        `);
    expect(builder.order).toHaveBeenCalledWith('score', { ascending: false });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({
      id: 'cp-1',
      etablissement_id: 'etab-1',
      score: 92,
      risk_level: 'critical',
      etablissement: { nom: 'Alpha', statut: 'actif', type_offre: 'pro' },
    });
    expect(result.current.data?.[1]).toMatchObject({
      id: 'cp-2',
      score: 71,
      risk_level: 'high',
      acknowledged_note: 'Handled',
    });

    expect(mockChannelOn).toHaveBeenCalledTimes(3);
    expect(mockChannelOn).toHaveBeenNthCalledWith(
      1,
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'churn_predictions' },
      expect.any(Function)
    );
    expect(mockChannelOn).toHaveBeenNthCalledWith(
      2,
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'churn_predictions' },
      expect.any(Function)
    );
    expect(mockChannelOn).toHaveBeenNthCalledWith(
      3,
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'churn_predictions' },
      expect.any(Function)
    );
    expect(mockChannelSubscribe).toHaveBeenCalled();
  });

  it('passe en erreur si la requête prédictions échoue', async () => {
    builder.then.mockImplementation((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: null, error: { message: 'fetch failed' } }))
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => useChurnPredictions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('fetch failed');
  });

  it('recompute appelle la rpc, invalide les clés et affiche un toast de succès', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecomputeChurn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockRpc).toHaveBeenCalledWith('compute_churn_predictions');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['churn-predictions'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['churn-overview'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['churn-trends'] });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Calcul terminé : 18 comptes analysés (2 critiques, 5 à risque élevé)'
    );
  });

  it('recompute remonte les erreurs en toast', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc broken' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecomputeChurn(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({ message: 'rpc broken' });
    });

    expect(mockToastError).toHaveBeenCalledWith('Erreur : rpc broken');
  });

  it('retourne l overview avec les KPI attendus', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChurnOverview(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_churn_overview');
    expect(result.current.data?.kpis).toEqual({
      total: 12,
      critical: 2,
      high: 3,
      medium: 4,
      low: 3,
      avg_score: 58.4,
    });
    expect(result.current.data?.mrr_at_risk).toBe(4200);
    expect(result.current.data?.worsened[0]).toMatchObject({
      etablissement_id: 'etab-1',
      nom: 'Alpha',
      delta: 11,
    });
    expect(result.current.data?.snoozed_count).toBe(2);
  });

  it('overview passe en erreur si la rpc échoue', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_churn_overview') {
        return Promise.resolve({ data: null, error: { message: 'overview down' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useChurnOverview(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('overview down');
  });

  it('retourne les tendances selon le nombre de jours demandé', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChurnTrends(30), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_churn_trends', { p_days: 30 });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toEqual({
      day: '2024-05-01',
      total: 10,
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
      avg_score: 45.2,
    });
  });

  it('history ne lance pas de requête sans etablissement puis charge les données avec un id', async () => {
    const wrapper = createWrapper();
    const disabled = renderHook(() => useChurnHistory(undefined, 15), { wrapper });

    expect(disabled.result.current.isPending).toBe(true);
    expect(mockRpc).not.toHaveBeenCalledWith('get_etablissement_churn_history', expect.anything());

    const enabled = renderHook(() => useChurnHistory('etab-9', 15), { wrapper });

    await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_etablissement_churn_history', {
      p_etab: 'etab-9',
      p_days: 15,
    });
    expect(enabled.result.current.data).toEqual(HISTORY_DATA);
  });

  it('history passe en erreur si la rpc échoue', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_etablissement_churn_history') {
        return Promise.resolve({ data: null, error: { message: 'history down' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useChurnHistory('etab-1', 90), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('history down');
  });

  it('acknowledge appelle la rpc avec les paramètres et invalide les requêtes', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAcknowledgeChurn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        etabId: 'etab-2',
        until: '2024-06-30',
        note: 'Customer contacted',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('acknowledge_churn', {
      p_etab: 'etab-2',
      p_until: '2024-06-30',
      p_note: 'Customer contacted',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['churn-predictions'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['churn-overview'] });
    expect(mockToastSuccess).toHaveBeenCalledWith('Compte marqué comme traité');
  });

  it('acknowledge remonte les erreurs en toast', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'acknowledge_churn') {
        return Promise.resolve({ data: null, error: { message: 'ack failed' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAcknowledgeChurn(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ etabId: 'etab-2', until: '2024-06-30' })
      ).rejects.toMatchObject({ message: 'ack failed' });
    });

    expect(mockToastError).toHaveBeenCalledWith('Erreur : ack failed');
  });

  it('generate retention email appelle la function edge avec le bon body', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGenerateRetentionEmail(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync('etab-3');
      expect(data).toEqual(EMAIL_DATA);
    });

    expect(mockInvoke).toHaveBeenCalledWith('generate-retention-email', {
      body: { etablissement_id: 'etab-3' },
    });
  });

  it('generate retention email remonte les erreurs IA', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'ai unavailable' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useGenerateRetentionEmail(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('etab-3')).rejects.toMatchObject({
        message: 'ai unavailable',
      });
    });

    expect(mockToastError).toHaveBeenCalledWith('Erreur IA : ai unavailable');
  });
});