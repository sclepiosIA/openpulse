import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisPerformanceMetrics } from './useJarvisPerformanceMetrics';

const { TOOL_A, TOOL_B, AUTH_USER, builder, mockFrom, debugError } = vi.hoisted(() => {
  const TOOL_A = 'ToolA';
  const TOOL_B = 'ToolB';
  const AUTH_USER = { id: 'u1', email: 'test@example.com' };

  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(undefined),
    maybeSingle: vi.fn().mockResolvedValue(undefined),
    then: vi.fn((onFulfilled, _onRejected) => Promise.resolve(onFulfilled ? onFulfilled(undefined) : undefined)),
    catch: vi.fn((onRejected) => Promise.resolve(onRejected ? onRejected(undefined) : undefined)),
  };

  const mockFrom = vi.fn(() => builder);
  const debugError = vi.fn();

  return { TOOL_A, TOOL_B, AUTH_USER, builder, mockFrom, debugError };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: debugError, log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: AUTH_USER }),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useJarvisPerformanceMetrics', () => {
  const wrapper = createWrapper();

  beforeEach(() => {
    mockFrom.mockClear();
    builder.insert.mockClear();
    builder.select.mockClear();
    builder.eq.mockClear();
    builder.gte.mockClear();
    builder.lte.mockClear();
    builder.in.mockClear();
    builder.order.mockClear();
    builder.limit.mockClear();
    builder.update.mockClear();
    builder.delete.mockClear();
    builder.single.mockClear();
    builder.maybeSingle.mockClear();
    builder.then.mockClear();
    builder.catch.mockClear();
    debugError.mockClear();
  });

  it('initial state: no metrics and excellent health', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    const allMetrics = result.current.getAllMetrics();
    expect(allMetrics.size).toBe(0);

    const toolMetrics = result.current.getToolMetrics(TOOL_A);
    expect(toolMetrics).toBeUndefined();

    const health = result.current.getOverallHealth();
    expect(health).toBe('excellent');

    expect(result.current.shouldReduceContext()).toBe(false);
    expect(result.current.shouldIncreaseConfirmationThreshold(TOOL_A)).toBe(false);
  });

  it('records a single metric and computes aggregates', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    act(() => {
      result.current.recordMetric(TOOL_A, 120, true);
    });

    const m = result.current.getToolMetrics(TOOL_A);
    expect(m).toBeDefined();
    expect(m?.avgLatency).toBeCloseTo(120);
    expect(m?.callCount).toBe(1);
    expect(m?.successRate).toBeCloseTo(1);

    expect(result.current.getAllMetrics().size).toBe(1);
    expect(result.current.getOverallHealth()).toBe('excellent');
    expect(result.current.shouldReduceContext()).toBe(false);
    expect(result.current.shouldIncreaseConfirmationThreshold(TOOL_A)).toBe(false);
  });

  it('computes percentile metrics across multiple samples', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    const latencies = [100, 200, 300, 400, 500, 600, 50, 850, 900, 1200];
    latencies.forEach((lat) => {
      act(() => {
        result.current.recordMetric(TOOL_A, lat, true);
      });
    });

    const m = result.current.getToolMetrics(TOOL_A);
    expect(m).toBeDefined();
    expect(m?.callCount).toBe(10);
    expect(m?.avgLatency).toBeCloseTo(510);
    expect(m?.p95Latency).toBeCloseTo(1200);
    expect(m?.successRate).toBeCloseTo(1);
  });

  it('updates health to good when latency increases and a failure occurs', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    const base = [100, 200, 300, 400, 500, 600, 50, 850, 900, 1200];
    base.forEach((lat) => {
      act(() => {
        result.current.recordMetric(TOOL_A, lat, true);
      });
    });

    act(() => {
      result.current.recordMetric(TOOL_A, 5000, false);
    });

    const health = result.current.getOverallHealth();
    expect(health).toBe('good');

    // Not enough failures to increase confirmation threshold yet
    expect(result.current.shouldIncreaseConfirmationThreshold(TOOL_A)).toBe(false);
  });

  it('increases confirmation threshold when success rate drops below 0.9 with enough calls', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    // 10 calls with 7 successes and 3 failures -> successRate = 0.7
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    latencies.forEach((lat, idx) => {
      act(() => {
        result.current.recordMetric(TOOL_A, lat, idx < 7);
      });
    });

    const m = result.current.getToolMetrics(TOOL_A);
    expect(m?.callCount).toBe(10);
    expect(m?.successRate).toBeCloseTo(0.7);

    const shouldIncrease = result.current.shouldIncreaseConfirmationThreshold(TOOL_A);
    expect(shouldIncrease).toBe(true);
  });

  it('reduces context when average latency across tools exceeds threshold', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    // Tool A: moderate avg (~1000)
    [500, 1000, 1500].forEach((lat) => {
      act(() => {
        result.current.recordMetric(TOOL_A, lat, true);
      });
    });

    // Tool B: high avg (~6000)
    Array.from({ length: 10 }).forEach(() => {
      act(() => {
        result.current.recordMetric(TOOL_B, 6000, true);
      });
    });

    expect(result.current.shouldReduceContext()).toBe(true);
  });

  it('trims metrics to window size (100)', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    // Record 105 metrics; callCount should cap at 100
    Array.from({ length: 105 }).forEach((_, i) => {
      act(() => {
        result.current.recordMetric(TOOL_A, 10 + (i % 5), true);
      });
    });

    const m = result.current.getToolMetrics(TOOL_A);
    expect(m?.callCount).toBe(100);
  });

  it('persists metrics using the mock supabase client', async () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    act(() => {
      result.current.recordMetric(TOOL_A, 150, true);
      result.current.recordMetric(TOOL_A, 250, true);
      result.current.recordMetric(TOOL_B, 500, false);
    });

    await act(async () => {
      await result.current.persistMetrics();
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_performance_metrics');
    expect(builder.insert).toHaveBeenCalled();

    const args = builder.insert.mock.calls[0]?.[0];
    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);

    const payloadItem = args[0];
    expect(payloadItem).toHaveProperty('user_id', AUTH_USER.id);
    expect(payloadItem).toHaveProperty('metric_type', 'tool_performance');
    expect(payloadItem).toHaveProperty('tool_name');
    expect(payloadItem).toHaveProperty('value');
    expect(payloadItem).toHaveProperty('breakdown');
    expect(payloadItem.breakdown).toHaveProperty('success_rate');
    expect(payloadItem.breakdown).toHaveProperty('p95_latency');
    expect(payloadItem.breakdown).toHaveProperty('call_count');
    expect(typeof payloadItem.date).toBe('string');
  });

  it('handles persist error and logs via debug.error', async () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics(), { wrapper });

    act(() => {
      result.current.recordMetric(TOOL_A, 200, true);
    });

    builder.insert.mockImplementationOnce(() => {
      throw new Error('x');
    });

    await act(async () => {
      await result.current.persistMetrics();
    });

    expect(debugError).toHaveBeenCalled();
    const call = debugError.mock.calls[0];
    expect(call[0]).toBe('[PerformanceMetrics] Failed to persist:');
    expect(call[1]).toBeInstanceOf(Error);
  });
});