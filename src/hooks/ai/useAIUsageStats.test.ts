/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAIUsageStats,
  formatTokens,
  formatCost,
  formatDuration,
  getProcessingTypeLabel,
} from './useAIUsageStats';

const {
  RPC_SUCCESS_DATA,
  RPC_ERROR,
  QUERY_EMPTY_RESPONSE,
  mockRpc,
  mockFrom,
} = vi.hoisted(() => ({
  RPC_SUCCESS_DATA: {
    totalCalls: 20,
    totalTokens: 5000,
    promptTokens: 3000,
    completionTokens: 2000,
    estimatedCost: 1.25,
    successRate: 95,
    avgProcessingTime: 850,
    avgCostPerCall: 0.0625,

    callsToday: 2,
    callsThisWeek: 10,
    callsThisMonth: 20,
    tokensToday: 400,
    tokensThisWeek: 2200,
    tokensThisMonth: 5000,
    costToday: 0.11,
    costThisWeek: 0.6,
    costThisMonth: 1.25,

    callsByType: [
      {
        type: 'email_summary',
        count: 10,
        tokens: 2500,
        cost: 0.5,
        successRate: 90,
        avgDuration: 700,
      },
      {
        type: 'pulse_chat',
        count: 5,
        tokens: 1500,
        cost: 0.45,
        avgDuration: 1200,
      },
      {
        type: 'extraction',
        count: 0,
        tokens: 0,
        cost: 0,
        successRate: 100,
        avgDuration: 300,
      },
    ],
    callsByModel: [
      { model: 'gpt-4o-mini', count: 12, tokens: 3000, cost: 0.7 },
      { model: 'gpt-4.1', count: 8, tokens: 2000, cost: 0.55 },
    ],
    dailyStats: [
      {
        date: '2026-05-01',
        calls: 3,
        tokens: 700,
        promptTokens: 400,
        completionTokens: 300,
        cost: 0.12,
      },
      {
        date: '2026-05-02',
        calls: 4,
        tokens: 900,
        promptTokens: 500,
        completionTokens: 400,
        cost: 0.2,
      },
    ],
    recentLogs: [
      { id: 'l1', success: false, model_used: 'gpt-4o-mini', message: 'timeout', created_at: '2026-05-02T10:00:00Z' },
      { id: 'l2', success: false, model_used: 'gpt-4o-mini', message: 'bad input', created_at: '2026-05-02T11:00:00Z' },
      { id: 'l3', success: false, model_used: 'gpt-4.1', message: 'server error', created_at: '2026-05-02T12:00:00Z' },
      { id: 'l4', success: false, message: 'unknown model failure', created_at: '2026-05-02T13:00:00Z' },
      { id: 'l5', success: true, model_used: 'gpt-4o-mini', created_at: '2026-05-02T14:00:00Z' },
    ],
    topErrors: [
      { message: 'timeout', count: 2, lastSeen: '2026-05-02T10:00:00Z' },
      { message: 'server error', count: 1, lastSeen: '2026-05-02T12:00:00Z' },
    ],
    topThreadConsumers: [
      {
        threadId: 'th1',
        subject: 'Thread A',
        passages: 4,
        totalTokens: 1500,
        estimatedCost: 0.31,
        lastProcessed: '2026-05-02T15:00:00Z',
      },
    ],
  },
  RPC_ERROR: { message: 'rpc failed' },
  QUERY_EMPTY_RESPONSE: { data: null, error: null },
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
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
      single: vi.fn(() => Promise.resolve(QUERY_EMPTY_RESPONSE)),
      maybeSingle: vi.fn(() => Promise.resolve(QUERY_EMPTY_RESPONSE)),
      then: vi.fn(
        (
          onFulfilled?: (value: typeof QUERY_EMPTY_RESPONSE) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(QUERY_EMPTY_RESPONSE).then(onFulfilled, onRejected),
      ),
      catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(QUERY_EMPTY_RESPONSE).catch(onRejected),
      ),
    };

    builder.select.mockImplementation(() => builder);
    builder.eq.mockImplementation(() => builder);
    builder.gte.mockImplementation(() => builder);
    builder.lte.mockImplementation(() => builder);
    builder.in.mockImplementation(() => builder);
    builder.order.mockImplementation(() => builder);
    builder.limit.mockImplementation(() => builder);
    builder.insert.mockImplementation(() => builder);
    builder.update.mockImplementation(() => builder);
    builder.delete.mockImplementation(() => builder);

    return builder;
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
      rpc: mockRpc,
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, retryDelay: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAIUsageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les stats IA puis transforme les données métier correctement', async () => {
    mockRpc.mockResolvedValue({ data: RPC_SUCCESS_DATA, error: null });

    const { result } = renderHook(() => useAIUsageStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_ai_usage_stats', { p_days: 30 });

    const data = result.current.data;
    if (data === undefined) {
      throw new Error('Les statistiques IA devraient être définies après succès');
    }

    expect(data.totalCalls).toBe(20);
    expect(data.totalTokens).toBe(5000);
    expect(data.promptTokens).toBe(3000);
    expect(data.completionTokens).toBe(2000);
    expect(data.estimatedCost).toBe(1.25);
    expect(data.successRate).toBe(95);
    expect(data.avgProcessingTime).toBe(850);
    expect(data.avgCostPerCall).toBe(0.0625);

    expect(data.callsToday).toBe(2);
    expect(data.callsThisWeek).toBe(10);
    expect(data.callsThisMonth).toBe(20);
    expect(data.tokensToday).toBe(400);
    expect(data.tokensThisWeek).toBe(2200);
    expect(data.tokensThisMonth).toBe(5000);
    expect(data.costToday).toBe(0.11);
    expect(data.costThisWeek).toBe(0.6);
    expect(data.costThisMonth).toBe(1.25);

    expect(data.callsByType).toHaveLength(3);
    expect(data.callsByType[0]).toEqual({
      type: 'email_summary',
      count: 10,
      tokens: 2500,
      cost: 0.5,
      successRate: 90,
      avgDuration: 700,
      avgCostPerCall: 0.05,
    });
    expect(data.callsByType[1]).toEqual({
      type: 'pulse_chat',
      count: 5,
      tokens: 1500,
      cost: 0.45,
      avgDuration: 1200,
      avgCostPerCall: 0.09,
    });
    expect(data.callsByType[2]).toEqual({
      type: 'extraction',
      count: 0,
      tokens: 0,
      cost: 0,
      successRate: 100,
      avgDuration: 300,
      avgCostPerCall: 0,
    });

    expect(data.callsByProcessingType.get('email_summary')).toEqual({
      type: 'email_summary',
      count: 10,
      tokens: 2500,
      cost: 0.5,
      successRate: 90,
      avgDuration: 700,
    });
    expect(data.callsByProcessingType.get('pulse_chat')).toEqual({
      type: 'pulse_chat',
      count: 5,
      tokens: 1500,
      cost: 0.45,
      successRate: 100,
      avgDuration: 1200,
    });
    expect(data.callsByProcessingType.get('extraction')).toEqual({
      type: 'extraction',
      count: 0,
      tokens: 0,
      cost: 0,
      successRate: 100,
      avgDuration: 300,
    });

    expect(data.errorsByModel.get('gpt-4o-mini')?.count).toBe(2);
    expect(data.errorsByModel.get('gpt-4o-mini')?.recent).toEqual([
      { id: 'l1', success: false, model_used: 'gpt-4o-mini', message: 'timeout', created_at: '2026-05-02T10:00:00Z' },
      { id: 'l2', success: false, model_used: 'gpt-4o-mini', message: 'bad input', created_at: '2026-05-02T11:00:00Z' },
    ]);
    expect(data.errorsByModel.get('gpt-4.1')?.count).toBe(1);
    expect(data.errorsByModel.get('unknown')?.count).toBe(1);
    expect(data.errorsByModel.get('unknown')?.recent).toEqual([
      { id: 'l4', success: false, message: 'unknown model failure', created_at: '2026-05-02T13:00:00Z' },
    ]);

    expect(data.callsByModel).toEqual(RPC_SUCCESS_DATA.callsByModel);
    expect(data.dailyStats).toEqual(RPC_SUCCESS_DATA.dailyStats);
    expect(data.recentLogs).toEqual(RPC_SUCCESS_DATA.recentLogs);
    expect(data.topErrors).toEqual(RPC_SUCCESS_DATA.topErrors);
    expect(data.topThreadConsumers).toEqual(RPC_SUCCESS_DATA.topThreadConsumers);
  });

  it('remonte une erreur quand la rpc retourne un error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: RPC_ERROR });

    const { result } = renderHook(() => useAIUsageStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 3000 },
    );

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_ai_usage_stats', { p_days: 30 });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'get_ai_usage_stats', { p_days: 30 });
    expect(result.current.error).toEqual(RPC_ERROR);
    expect(result.current.data).toBeUndefined();
  });
});

describe('format helpers', () => {
  it('formatTokens formate les unités correctement', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1000)).toBe('1.0K');
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(1000000)).toBe('1.0M');
    expect(formatTokens(2500000)).toBe('2.5M');
  });

  it('formatCost formate selon les seuils', () => {
    expect(formatCost(1)).toBe('$1.00');
    expect(formatCost(1.25)).toBe('$1.25');
    expect(formatCost(0.125)).toBe('$0.125');
    expect(formatCost(0.01)).toBe('$0.010');
    expect(formatCost(0.0094)).toBe('$0.0094');
  });

  it('formatDuration formate millisecondes et secondes', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(849.5)).toBe('850ms');
    expect(formatDuration(999)).toBe('999ms');
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1499)).toBe('1.5s');
  });

  it('getProcessingTypeLabel retourne le libellé connu ou la clé brute', () => {
    expect(getProcessingTypeLabel('extraction')).toBe('Classification Email');
    expect(getProcessingTypeLabel('email_summary')).toBe('Résumé thread');
    expect(getProcessingTypeLabel('jarvis-chat')).toBe('Jarvis Chat');
    expect(getProcessingTypeLabel('medical_economic_study_analysis')).toBe('Étude médico-éco');
    expect(getProcessingTypeLabel('type_inconnu')).toBe('type_inconnu');
  });
});