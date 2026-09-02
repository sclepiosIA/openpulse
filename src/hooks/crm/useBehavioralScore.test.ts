import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  BEHAVIORAL_SCORE,
  EVENTS,
  HISTORY,
  PROSPECTS_ROWS,
  OVERVIEW,
  TRENDS,
  RECOMPUTE,
  OWNERS,
  rpcMock,
  mockFrom,
  mockChannel,
  mockRemoveChannel,
} = vi.hoisted(() => {
  const BEHAVIORAL_SCORE = {
    behavioral_score: 42,
    engagement_velocity: 3.14,
    last_event_at: '2024-01-01T00:00:00Z',
    raw_score: 100,
  } as const;

  const EVENTS = [
    { id: 'ev1', etablissement_id: 'e1', occurred_at: '2024-01-01T00:00:00Z', type: 'email' },
    { id: 'ev2', etablissement_id: 'e1', occurred_at: '2024-01-02T00:00:00Z', type: 'call' },
  ] as const;

  const HISTORY = [
    { computed_at: '2024-01-01T00:00:00Z', total: 1, hot: 1, warm: 0, working: 0, cold: 0, avg_score: 10 },
  ] as const;

  const PROSPECTS_ROWS = [
    {
      id: 'p1',
      nom: 'Prospect 1',
      score_conversion: 5,
      behavioral_score: 10,
      engagement_velocity: 1.2,
      last_engagement_at: '2024-01-01T00:00:00Z',
      statut: 'Prospect',
      commercial_id: 'c1',
      scoring_snoozed_until: null,
    },
  ] as const;

  const OVERVIEW = {
    computed_at: '2024-01-02T00:00:00Z',
    kpis: { total: 1, hot: 1, warm: 0, working: 0, cold: 0, weighted_mrr_potential: 100, avg_score: 10 },
    prev_kpis: {},
    by_phase: [],
    by_status: [],
    channels: [],
    top_score: [],
    hot_streaks: [],
    to_relaunch: [],
    dormant: [],
    orphans: [],
  } as const;

  const TRENDS = [
    { day: '2024-01-01', total: 1, hot: 1, warm: 0, working: 0, cold: 0, avg_score: 10 },
  ] as const;

  const RECOMPUTE = { processed: 10, updated: 2, at: '2024-01-03T00:00:00Z' } as const;

  const OWNERS = [
    { id: 'c1', prenom: 'John', nom: 'Doe', email: 'john@example.com', avatar_url: null },
  ] as const;

  const rpcMock = vi.fn(async (name: string, params?: unknown) => {
    switch (name) {
      case 'compute_behavioral_score':
        return { data: BEHAVIORAL_SCORE, error: null };
      case 'get_scoring_overview':
        return { data: OVERVIEW, error: null };
      case 'get_scoring_trends':
        return { data: TRENDS, error: null };
      case 'recompute_all_prospect_scores':
        return { data: RECOMPUTE, error: null };
      case 'acknowledge_prospect':
        return { data: { ok: true }, error: null };
      default:
        return { data: null, error: null };
    }
  });

  const createBuilderFor = (table: string) => {
    let responseData: unknown = null;
    if (table === 'prospect_behavioral_events') responseData = EVENTS;
    if (table === 'prospect_score_history') responseData = HISTORY;
    if (table === 'etablissements') responseData = PROSPECTS_ROWS;
    if (table === 'profiles') responseData = OWNERS;

    const builder: Record<string, unknown> = {};

    const fn = vi.fn(() => builder);
    builder.select = fn;
    builder.eq = fn;
    builder.gte = fn;
    builder.lte = fn;
    builder.order = fn;
    builder.limit = fn;
    builder.insert = fn;
    builder.update = fn;
    builder.delete = fn;

    builder.single = vi.fn(async () => ({ data: Array.isArray(responseData) ? (responseData as any)[0] ?? null : responseData, error: null }));
    builder.maybeSingle = vi.fn(async () => ({ data: Array.isArray(responseData) ? (responseData as any)[0] ?? null : responseData, error: null }));

    // thenable to support await query patterns
    (builder as any).then = (onResolve: (v: unknown) => unknown, onReject?: (e: unknown) => unknown) => {
      return Promise.resolve({ data: responseData, error: null }).then(onResolve, onReject);
    };
    (builder as any).catch = vi.fn((fnCatch: (e: unknown) => unknown) => {
      return Promise.resolve({ data: responseData, error: null }).catch(fnCatch);
    });

    Object.defineProperty(builder, 'in', {
      value: vi.fn(() => builder),
      writable: false,
    });

    return builder;
  };

  const mockFrom = vi.fn((table: string) => createBuilderFor(table));

  const mockChannel = {
    on: vi.fn(() => mockChannel),
    subscribe: vi.fn(() => mockChannel),
  };

  const mockRemoveChannel = vi.fn();

  return {
    BEHAVIORAL_SCORE,
    EVENTS,
    HISTORY,
    PROSPECTS_ROWS,
    OVERVIEW,
    TRENDS,
    RECOMPUTE,
    OWNERS,
    rpcMock,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      rpc: (name: string, params?: unknown) => rpcMock(name, params),
      from: (table: string) => mockFrom(table),
      channel: (name: string) => mockChannel,
      removeChannel: (ch: unknown) => mockRemoveChannel(ch),
    },
  };
});

import {
  useBehavioralScore,
  useBehavioralEvents,
  useScoreHistory,
  useProspectsScoringList,
  useScoringOverview,
  useScoringTrends,
  useRecomputeAllScores,
  useAcknowledgeProspect,
  useScoringOwners,
  COMMERCIAL_STATUTS,
} from './useBehavioralScore';

describe('useBehavioralScore suite', () => {
  beforeEach(() => {
    rpcMock.mockClear();
    mockFrom.mockClear();
    mockChannel.on.mockClear();
    mockChannel.subscribe.mockClear();
    mockRemoveChannel.mockClear();
  });

  function makeWrapper(queryClient?: QueryClient) {
    const qc = queryClient ?? new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    return ({ children }: { children: React.ReactNode }) => {
      // avoid JSX in .ts test files — use createElement
      return React.createElement(QueryClientProvider, { client: qc }, children);
    };
  }

  it('COMMERCIAL_STATUTS contains expected label and is non-empty', () => {
    expect(Array.isArray(COMMERCIAL_STATUTS)).toBe(true);
    expect(COMMERCIAL_STATUTS.length).toBeGreaterThan(0);
    expect(COMMERCIAL_STATUTS).toContain('Prospect');
  });

  it('useBehavioralScore: loading then success with computed data', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useBehavioralScore('e1'), { wrapper });

    expect(result.current.isLoading || result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data.behavioral_score).toBe(BEHAVIORAL_SCORE.behavioral_score);
    expect(result.current.data.engagement_velocity).toBeCloseTo(BEHAVIORAL_SCORE.engagement_velocity as number, 2);
    expect(rpcMock.mock.calls.some((c) => c[0] === 'compute_behavioral_score')).toBe(true);
  });

  it('useBehavioralScore: rpc error surfaces as isError', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useBehavioralScore('e-error'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    const err: unknown = result.current.error;
    // check message property existence
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((err as any).message).toBe('x');
  });

  it('useBehavioralEvents: fetches events via supabase.from and returns array', async () => {
    mockFrom.mockClear();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useBehavioralEvents('e1', 2), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data.length).toBe(EVENTS.length);
    expect(result.current.data[0].id).toBe(EVENTS[0].id);
    expect(mockFrom.mock.calls.some((c) => c[0] === 'prospect_behavioral_events')).toBe(true);
  });

  it('useScoreHistory: returns history entries filtered by days', async () => {
    mockFrom.mockClear();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useScoreHistory('e1', 30), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data[0].computed_at).toBe(HISTORY[0].computed_at);
    expect(mockFrom.mock.calls.some((c) => c[0] === 'prospect_score_history')).toBe(true);
  });

  it('useProspectsScoringList: subscribes to realtime channel and cleans up on unmount; returns rows', async () => {
    mockFrom.mockClear();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const wrapper = makeWrapper(queryClient);
    const { result, unmount } = renderHook(() => useProspectsScoringList(), { wrapper });

    expect(mockChannel.subscribe).toHaveBeenCalled();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data.length).toBe(PROSPECTS_ROWS.length);
    expect(mockFrom.mock.calls.some((c) => c[0] === 'etablissements')).toBe(true);

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('useScoringOverview and useScoringTrends return overview and trends', async () => {
    const wrapper = makeWrapper();
    const hookOverview = renderHook(() => useScoringOverview(), { wrapper });
    const hookTrends = renderHook(() => useScoringTrends(90), { wrapper });

    await waitFor(() => expect(hookOverview.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(hookTrends.result.current.isSuccess).toBe(true));

    expect(hookOverview.result.current.data.computed_at).toBe(OVERVIEW.computed_at);
    expect(hookOverview.result.current.data.kpis.total).toBe(OVERVIEW.kpis.total);
    expect(Array.isArray(hookTrends.result.current.data)).toBe(true);
    expect(hookTrends.result.current.data[0].day).toBe(TRENDS[0].day);
    expect(rpcMock.mock.calls.some((c) => c[0] === 'get_scoring_overview')).toBe(true);
    expect(rpcMock.mock.calls.some((c) => c[0] === 'get_scoring_trends')).toBe(true);
  });

  it('useRecomputeAllScores: mutation calls rpc and invalidates queries', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = makeWrapper(queryClient);

    const { result } = renderHook(() => useRecomputeAllScores(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(rpcMock.mock.calls.some((c) => c[0] === 'recompute_all_prospect_scores')).toBe(true);
    expect(invalidateSpy).toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });

  it('useAcknowledgeProspect: mutation calls acknowledge rpc with given params and invalidates', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useAcknowledgeProspect(), { wrapper });

    const payload = { id: 'p1', until: '2024-02-01T00:00:00Z', note: 'test-note' };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(rpcMock.mock.calls.some((c) => c[0] === 'acknowledge_prospect')).toBe(true);

    const ackCall = rpcMock.mock.calls.find((c) => c[0] === 'acknowledge_prospect');
    expect(ackCall).toBeDefined();
    const ackParams = ackCall ? (ackCall[1] as Record<string, unknown>) : {};
    expect(ackParams.p_etab).toBe(payload.id);
    expect(ackParams.p_until).toBe(payload.until);
    expect(ackParams.p_note).toBe(payload.note);

    expect(invalidateSpy).toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });

  it('useScoringOwners: returns owners list from profiles table', async () => {
    mockFrom.mockClear();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useScoringOwners(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data[0].id).toBe(OWNERS[0].id);
    expect(mockFrom.mock.calls.some((c) => c[0] === 'profiles')).toBe(true);
  });
});