import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { FAIL_FLAG, ERROR_OBJ, mockFrom } = vi.hoisted(() => {
  const CURRENT_LOGS = [
    {
      processing_type: 'query_database',
      processing_duration_ms: 1200,
      success: true,
      error_message: null,
      total_tokens: 100,
      prompt_tokens: 40,
      completion_tokens: 60,
      processed_at: '2026-06-10T12:00:00.000Z',
    },
    {
      processing_type: 'query_database',
      processing_duration_ms: 800,
      success: false,
      error_message: 'db timeout',
      total_tokens: 50,
      prompt_tokens: 20,
      completion_tokens: 30,
      processed_at: '2026-06-09T12:00:00.000Z',
    },
    {
      processing_type: 'create_task',
      processing_duration_ms: 200,
      success: true,
      error_message: null,
      total_tokens: 10,
      prompt_tokens: 5,
      completion_tokens: 5,
      processed_at: '2026-06-10T11:00:00.000Z',
    },
  ];

  const PREV_LOGS = [
    {
      processing_type: 'query_database',
      processing_duration_ms: 1000,
      success: false,
      error_message: 'prev error',
      total_tokens: 80,
      prompt_tokens: 30,
      completion_tokens: 50,
      processed_at: '2026-05-25T12:00:00.000Z',
    },
  ];

  const FAIL_FLAG = { value: false };
  const ERROR_OBJ = { message: 'simulated supabase error' };

  const mockFrom = vi.fn((tableName: string) => {
    const builderState: {
      table?: string;
      selected?: string;
      gteValue?: string;
      ltValue?: string;
      orderArgs?: any;
    } = { table: tableName };

    const builder: any = {
      select(selectStr: string) {
        builderState.selected = selectStr;
        return builder;
      },
      gte(column: string, value: string) {
        builderState.gteValue = value;
        return builder;
      },
      lt(column: string, value: string) {
        builderState.ltValue = value;
        return builder;
      },
      order(column: string, opts: any) {
        builderState.orderArgs = { column, opts };
        return builder;
      },
      then(resolve: (v: any) => void, reject?: (e: any) => void) {
        return Promise.resolve().then(() => {
          if (FAIL_FLAG.value) {
            resolve({ data: null, error: ERROR_OBJ });
            return;
          }
          if (builderState.ltValue) {
            resolve({ data: PREV_LOGS, error: null });
            return;
          }
          resolve({ data: CURRENT_LOGS, error: null });
        }).catch(err => {
          if (reject) reject(err);
        });
      },
      catch(onRejected: (e: any) => any) {
        return this.then((v: any) => v).catch(onRejected);
      },
    };

    return builder;
  });

  return { FAIL_FLAG, ERROR_OBJ, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

import { useJarvisToolsMonitoring, formatLatency, formatCost, getHealthStatus } from './useJarvisToolsMonitoring';

describe('useJarvisToolsMonitoring', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    FAIL_FLAG.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createWrapper() {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children);
    };
  }

  it('loads and returns computed monitoring data correctly', async () => {
    FAIL_FLAG.value = false;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisToolsMonitoring(30), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('ai_processing_log');
    expect(mockFrom).toHaveBeenCalledTimes(2);

    const data = result.current.data;
    expect(data).toBeTruthy();

    const tools = data!.tools;
    const queryTool = tools.find(t => t.toolName === 'query_database');
    const createTool = tools.find(t => t.toolName === 'create_task');

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(2);

    expect(queryTool).toBeDefined();
    if (queryTool) {
      expect(queryTool.callCount).toBe(2);
      expect(queryTool.successCount).toBe(1);
      expect(queryTool.failureCount).toBe(1);
      expect(queryTool.successRate).toBeCloseTo(50, 5);
      expect(queryTool.avgLatencyMs).toBeCloseTo(1000, 5);
      expect(queryTool.p50LatencyMs).toBe(800);
      expect(queryTool.p90LatencyMs).toBe(1200);
      expect(queryTool.p99LatencyMs).toBe(1200);
      expect(queryTool.minLatencyMs).toBe(800);
      expect(queryTool.maxLatencyMs).toBe(1200);
      expect(queryTool.totalTokens).toBe(150);
      expect(queryTool.avgTokensPerCall).toBeCloseTo(75, 5);
      const expectedPrompt = 40 + 20;
      const expectedCompletion = 60 + 30;
      const expectedCost = (expectedPrompt / 1000) * 0.01 + (expectedCompletion / 1000) * 0.03;
      expect(queryTool.estimatedCost).toBeCloseTo(expectedCost, 6);
      expect(queryTool.lastUsed).toBe('2026-06-10T12:00:00.000Z');
      expect(typeof queryTool.trend.latencyChange).toBe('number');
      expect(typeof queryTool.trend.successRateChange).toBe('number');
      expect(typeof queryTool.trend.callCountChange).toBe('number');
    }

    expect(createTool).toBeDefined();
    if (createTool) {
      expect(createTool.toolName).toBe('create_task');
      expect(createTool.callCount).toBe(1);
      expect(createTool.successCount).toBe(1);
    }

    const totals = data!.totals;
    expect(totals.totalCalls).toBe(3);
    expect(totals.totalSuccess).toBe(2);
    expect(totals.overallSuccessRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(totals.avgLatency).toBeCloseTo((1200 + 800 + 200) / 3, 5);
    expect(totals.p90Latency).toBe(1200);
    expect(totals.totalTokens).toBe(160);
    const expectedTotalsCost = (65 / 1000) * 0.01 + (95 / 1000) * 0.03;
    expect(totals.estimatedCost).toBeCloseTo(expectedTotalsCost, 6);

    expect(data!.dailyMetrics).toEqual([
      {
        date: '2026-06-09',
        toolName: 'query_database',
        calls: 1,
        successRate: 0,
        avgLatency: 800,
        tokens: 50,
      },
      {
        date: '2026-06-10',
        toolName: 'query_database',
        calls: 1,
        successRate: 100,
        avgLatency: 1200,
        tokens: 100,
      },
      {
        date: '2026-06-10',
        toolName: 'create_task',
        calls: 1,
        successRate: 100,
        avgLatency: 200,
        tokens: 10,
      },
    ]);

    const dist = data!.latencyDistribution;
    const bucketMap = new Map(dist.map(b => [b.bucket, b.count]));
    expect(bucketMap.get('<500ms')).toBe(1);
    expect(bucketMap.get('500-1s')).toBe(1);
    expect(bucketMap.get('1-2s')).toBe(1);

    const topErrors = data!.topErrorTools;
    expect(topErrors.length).toBeGreaterThanOrEqual(1);
    expect(topErrors.some(e => e.toolName === 'Requête base de données')).toBe(true);
    const qError = topErrors.find(e => e.toolName === 'Requête base de données');
    expect(qError).toBeDefined();
    if (qError) {
      expect(qError.errorCount).toBe(1);
      expect(qError.errorRate).toBeCloseTo(50, 5);
    }

    expect(data!.recentErrors.some(e => e.errorMessage === 'db timeout')).toBe(true);
    const recentDbError = data!.recentErrors.find(e => e.errorMessage === 'db timeout');
    expect(recentDbError).toBeDefined();
    if (recentDbError) {
      expect(recentDbError.toolName).toBe('Requête base de données');
      expect(recentDbError.timestamp).toBe('2026-06-09T12:00:00.000Z');
    }
  });

  it('transitions to error state when supabase returns an error', async () => {
    FAIL_FLAG.value = true;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisToolsMonitoring(30), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(ERROR_OBJ);

    FAIL_FLAG.value = false;
  });

  it('utility functions behave as expected', () => {
    expect(formatLatency(1500)).toBe('1.5s');
    expect(formatLatency(200)).toBe('200ms');

    expect(formatCost(0.0033)).toBe('$0.0033');
    expect(formatCost(0.1234)).toBe('$0.12');

    expect(getHealthStatus(99, 1000)).toBe('excellent');
    expect(getHealthStatus(96, 4000)).toBe('good');
    expect(getHealthStatus(92, 9000)).toBe('degraded');
    expect(getHealthStatus(80, 15000)).toBe('critical');
  });
});