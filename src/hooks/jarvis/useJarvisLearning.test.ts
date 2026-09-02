/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useJarvisLearning } from './useJarvisLearning';

const {
  AUTH_STATE,
  HISTORY_SUCCESS,
  EMPTY_ROWS,
  mockFrom,
  mockUseAuth,
  mockInvalidateQueries,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const HISTORY_SUCCESS = [
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `email-exec-${i}`,
      user_id: 'u1',
      trigger_type: 'manual',
      proposed_action: { type: 'send_email', confidence_score: 0.92 },
      status: 'executed',
      user_modification: i < 2 ? JSON.stringify({ subject: 'edited' }) : null,
      kb_sources: [
        { article_id: 'kb-1', titre: 'Guide email' },
        ...(i < 10 ? [{ article_id: 'kb-2', titre: 'Bonnes pratiques' }] : []),
      ],
      created_at: i < 12 ? '2024-01-01T09:00:00.000Z' : '2024-01-01T10:00:00.000Z',
      executed_at: '2024-01-01T10:05:00.000Z',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `email-rej-${i}`,
      user_id: 'u1',
      trigger_type: 'manual',
      proposed_action: { type: 'send_email', confidence_score: 0.52 },
      status: 'rejected',
      user_modification: null,
      kb_sources: [],
      created_at: i < 7 ? '2024-01-02T09:30:00.000Z' : '2024-01-02T11:00:00.000Z',
      executed_at: null,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `summ-exec-${i}`,
      user_id: 'u1',
      trigger_type: 'schedule',
      proposed_action: { type: 'summarize', confidence_score: 0.88 },
      status: 'executed',
      user_modification: i < 3 ? JSON.stringify({ length: 'short' }) : null,
      kb_sources: [{ article_id: 'kb-3', titre: 'Résumé' }],
      created_at: i < 6 ? '2024-01-03T14:00:00.000Z' : '2024-01-03T15:00:00.000Z',
      executed_at: '2024-01-03T15:10:00.000Z',
    })),
  ];

  return {
    AUTH_STATE,
    HISTORY_SUCCESS,
    EMPTY_ROWS: [],
    mockFrom: vi.fn(),
    mockUseAuth: vi.fn(() => AUTH_STATE),
    mockInvalidateQueries: vi.fn(),
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createSupabaseBuilder(result: { data: unknown; error: { message: string } | null }) {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient, children });

  return { wrapper, queryClient };
}

describe('useJarvisLearning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
  });

  it('charge puis retourne des insights calculés à partir de l’historique réel', async () => {
    const builder = createSupabaseBuilder({ data: HISTORY_SUCCESS, error: null });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useJarvisLearning(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.insights).toBeDefined();
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');
    expect(builder.select).toHaveBeenCalledWith(
      'id, user_id, trigger_type, proposed_action, status, user_modification, kb_sources, created_at, executed_at'
    );
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.in).toHaveBeenCalledWith('status', ['executed', 'rejected', 'modified']);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(500);

    const insights = result.current.insights;
    expect(insights).toBeDefined();
    expect(insights?.patterns).toHaveLength(2);

    expect(insights?.optimal_threshold).toBeCloseTo(0.7633, 2);
    expect(insights?.peak_usage_hours).toEqual([
      new Date('2024-01-01T09:00:00.000Z').getHours(),
      new Date('2024-01-01T10:00:00.000Z').getHours(),
      new Date('2024-01-03T14:00:00.000Z').getHours(),
    ]);

    expect(insights?.most_useful_sources[0]).toEqual({
      article_id: 'kb-1',
      title: 'Guide email',
      usage_count: 20,
    });
    expect(insights?.most_useful_sources[1]).toEqual({
      article_id: 'kb-2',
      title: 'Bonnes pratiques',
      usage_count: 10,
    });
    expect(insights?.most_useful_sources[2]).toEqual({
      article_id: 'kb-3',
      title: 'Résumé',
      usage_count: 10,
    });

    const wrongSplitPattern = insights?.patterns.find(
      (p) => p.action_type === 'send' && p.trigger_type === 'email'
    );
    expect(wrongSplitPattern).toBeDefined();
    expect(wrongSplitPattern?.total_count).toBe(30);
    expect(wrongSplitPattern?.approval_rate).toBeCloseTo(20 / 30, 5);
    expect(wrongSplitPattern?.modification_rate).toBeCloseTo(2 / 30, 5);
    expect(wrongSplitPattern?.avg_confidence_approved).toBeCloseTo(0.92, 5);
    expect(wrongSplitPattern?.avg_confidence_rejected).toBeCloseTo(0.52, 5);
    expect(wrongSplitPattern?.preferred_times).toEqual([
      `${new Date('2024-01-01T09:00:00.000Z').getHours()}h`,
      `${new Date('2024-01-01T10:00:00.000Z').getHours()}h`,
    ]);
    expect(wrongSplitPattern?.common_modifications).toEqual([{ subject: 'edited' }, { subject: 'edited' }]);

    const summarizePattern = insights?.patterns.find(
      (p) => p.action_type === 'summarize' && p.trigger_type === 'schedule'
    );
    expect(summarizePattern?.preferred_times).toEqual([
      `${new Date('2024-01-03T14:00:00.000Z').getHours()}h`,
      `${new Date('2024-01-03T15:00:00.000Z').getHours()}h`,
    ]);

    expect(insights?.suggestions).toContain(
      `Vous utilisez surtout Jarvis vers ${insights?.peak_usage_hours.slice(0, 2).map(hour => `${hour}h`).join(', ')}. Ajustez vos heures de silence.`
    );
    expect(insights?.suggestions).not.toContain(
      `Vous utilisez surtout Jarvis vers ${summarizePattern?.preferred_times.join(', ')}. Ajustez vos heures de silence.`
    );

    expect(result.current.getRecommendedThreshold('send_email')).toBe(0.85);
    expect(result.current.getRecommendedThreshold('summarize')).toBeCloseTo(0.7, 2);
    expect(result.current.shouldAutoApprove('send_email', 'manual', 0.9)).toBe(false);
    expect(result.current.shouldAutoApprove('summarize', 'schedule', 0.9)).toBe(false);
  });

  it('retourne des insights vides quand supabase renvoie une erreur', async () => {
    const builder = createSupabaseBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useJarvisLearning(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.insights).toBeDefined();
    });

    expect(result.current.insights).toEqual({
      patterns: [],
      suggestions: [],
      optimal_threshold: 0.85,
      peak_usage_hours: [],
      most_useful_sources: [],
    });
    expect(result.current.getRecommendedThreshold('send_email')).toBe(0.85);
    expect(result.current.shouldAutoApprove('send_email', 'manual', 0.99)).toBe(false);
  });

  it('retourne des insights vides quand l’historique est vide', async () => {
    const builder = createSupabaseBuilder({ data: EMPTY_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useJarvisLearning(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.insights).toEqual({
      patterns: [],
      suggestions: [],
      optimal_threshold: 0.85,
      peak_usage_hours: [],
      most_useful_sources: [],
    });
  });

  it('enregistre une action via la mutation et invalide le cache', async () => {
    const builder = createSupabaseBuilder({ data: HISTORY_SUCCESS, error: null });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useJarvisLearning(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const payload = {
      action_type: 'send_email',
      trigger_type: 'manual',
      was_approved: true,
      was_modified: false,
      confidence_score: 0.91,
      modifications: { tone: 'formal' } as Record<string, unknown>,
    };

    await act(async () => {
      result.current.recordAction(payload);
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['jarvis-learning'] });
    });
  });
});