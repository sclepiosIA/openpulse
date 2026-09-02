import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { METRICS_ROWS, AUTH, debugMock, setScenario, mockFrom } = vi.hoisted(() => {
  const NOW_ISO = new Date().toISOString();
  const METRICS_ROWS = [
    {
      id: '1',
      metric_type: 'latency',
      value: 100,
      breakdown: { tool_name: 'search', success_rate: 1 },
      date: NOW_ISO,
      created_at: NOW_ISO,
    },
    {
      id: '2',
      metric_type: 'latency',
      value: 200,
      breakdown: { tool_name: 'search', success_rate: 0.4 },
      date: NOW_ISO,
      created_at: NOW_ISO,
    },
    {
      id: '3',
      metric_type: 'latency',
      value: 300,
      breakdown: { tool_name: 'summarize', success_rate: 0.9 },
      date: NOW_ISO,
      created_at: NOW_ISO,
    },
    {
      id: '4',
      metric_type: 'routing',
      value: 400,
      breakdown: { success_rate: 0.6 },
      date: NOW_ISO,
      created_at: NOW_ISO,
    },
    {
      id: '5',
      metric_type: 'latency',
      value: 50,
      breakdown: { tool_name: 'search', success_rate: 0.51 },
      date: NOW_ISO,
      created_at: NOW_ISO,
    },
  ];

  const STATE = { scenario: 'success' as 'success' | 'empty' | 'error' };

  const builderFactory = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: vi.fn().mockImplementation(chain),
      eq: vi.fn().mockImplementation(chain),
      gte: vi.fn().mockImplementation(chain),
      lte: vi.fn().mockImplementation(chain),
      in: vi.fn().mockImplementation(chain),
      order: vi.fn().mockImplementation(chain),
      limit: vi.fn().mockImplementation(chain),
      insert: vi.fn().mockImplementation(chain),
      update: vi.fn().mockImplementation(chain),
      delete: vi.fn().mockImplementation(chain),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        if (STATE.scenario === 'success') {
          return Promise.resolve({ data: METRICS_ROWS, error: null }).then(resolve, reject);
        }
        if (STATE.scenario === 'empty') {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        return Promise.reject(new Error('boom')).then(resolve, reject);
      },
      catch: (reject: (e: unknown) => void) => {
        return Promise.resolve().catch(reject);
      },
    });
    return builder;
  };

  const mockFrom = vi.fn(() => builderFactory());

  return {
    METRICS_ROWS,
    AUTH: { user: { id: 'u1', email: 't@t.co' }, isLoading: false },
    debugMock: { error: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn() },
    setScenario: (s: 'success' | 'empty' | 'error') => {
      STATE.scenario = s;
    },
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH,
}));

vi.mock('@/lib/debug', () => ({
  debug: debugMock,
}));

import { useJarvisMetricsHistory } from './useJarvisMetricsHistory';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useJarvisMetricsHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setScenario('success');
  });

  it('loads and computes metrics from history successfully', async () => {
    const { result } = renderHook(() => useJarvisMetricsHistory(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalInteractions).toBe(METRICS_ROWS.length);

    expect(result.current.p50).toBe(200);
    expect(result.current.p95).toBe(400);
    expect(result.current.p99).toBe(400);

    const searchStats = result.current.toolStats.find(t => t.name === 'search');
    expect(searchStats).toBeDefined();
    expect(searchStats?.totalCalls).toBe(3);
    expect(searchStats?.successCount).toBe(2);
    expect(searchStats?.successRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(searchStats?.avgLatencyMs).toBeCloseTo(350 / 3, 5);
    expect(searchStats?.p95LatencyMs).toBe(200);

    const summarizeStats = result.current.toolStats.find(t => t.name === 'summarize');
    expect(summarizeStats).toBeDefined();
    expect(summarizeStats?.totalCalls).toBe(1);
    expect(summarizeStats?.successRate).toBe(100);

    const routingStats = result.current.toolStats.find(t => t.name === 'routing');
    expect(routingStats).toBeDefined();
    expect(routingStats?.totalCalls).toBe(1);
    expect(routingStats?.successRate).toBe(100);

    expect(result.current.overallSuccessRate).toBeCloseTo(((2 / 3) * 100 + 100 + 100) / 3, 5);

    expect(result.current.hourlyUsage).toHaveLength(24);
    const totalCount = result.current.hourlyUsage.reduce((sum, h) => sum + h.count, 0);
    expect(totalCount).toBe(METRICS_ROWS.length);
    const nonZeroHours = result.current.hourlyUsage.filter(h => h.count > 0);
    expect(nonZeroHours).toHaveLength(1);
    expect(nonZeroHours[0].count).toBe(METRICS_ROWS.length);
    expect(nonZeroHours[0].avgLatency).toBeCloseTo(1050 / 5, 5);
  });

  it('records local metric points and updates percentiles', async () => {
    setScenario('empty');
    const { result } = renderHook(() => useJarvisMetricsHistory(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalInteractions).toBe(0);
    expect(result.current.latencyHistory).toHaveLength(0);

    await act(async () => {
      result.current.recordMetric(1000, 'search', true);
    });

    expect(result.current.latencyHistory).toHaveLength(1);
    expect(result.current.p50).toBe(1000);
    expect(result.current.p95).toBe(1000);
    expect(result.current.p99).toBe(1000);
    expect(result.current.totalInteractions).toBe(1);

    await act(async () => {
      result.current.recordMetric(10, 'search', true);
    });

    expect(result.current.latencyHistory).toHaveLength(2);
    expect(result.current.p50).toBe(1000);
    expect(result.current.p95).toBe(1000);
    expect(result.current.p99).toBe(1000);
    expect(result.current.totalInteractions).toBe(2);
  });

  it('handles fetch errors gracefully and logs debug error', async () => {
    setScenario('error');

    const { result } = renderHook(() => useJarvisMetricsHistory(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(debugMock.error).toHaveBeenCalledTimes(1);
    const call = (debugMock.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(String(call[0])).toContain('[MetricsHistory] Error fetching metrics:');
    expect(call[1]).toBeInstanceOf(Error);
    expect((call[1] as Error).message).toBe('boom');

    expect(result.current.totalInteractions).toBe(0);
    expect(result.current.toolStats).toEqual([]);
    expect(result.current.hourlyUsage).toEqual([]);
  });
})