import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import { useJarvisPerformanceMetrics } from '../jarvis/useJarvisPerformanceMetrics';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisPerformanceMetrics', () => {
  it('provides expected API', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics());
    expect(typeof result.current.recordMetric).toBe('function');
    expect(typeof result.current.getToolMetrics).toBe('function');
    expect(typeof result.current.getAllMetrics).toBe('function');
    expect(typeof result.current.getOverallHealth).toBe('function');
    expect(typeof result.current.shouldReduceContext).toBe('function');
    expect(typeof result.current.persistMetrics).toBe('function');
  });

  it('records and retrieves metrics', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics());

    act(() => {
      result.current.recordMetric('search', 200, true);
      result.current.recordMetric('search', 300, true);
      result.current.recordMetric('search', 500, false);
    });

    const metrics = result.current.getToolMetrics('search');
    expect(metrics).toBeDefined();
    expect(metrics!.callCount).toBe(3);
    expect(metrics!.successRate).toBeCloseTo(2 / 3);
    expect(metrics!.avgLatency).toBeCloseTo((200 + 300 + 500) / 3);
  });

  it('returns excellent health with no metrics', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics());
    expect(result.current.getOverallHealth()).toBe('excellent');
  });

  it('detects degraded health with high latency', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics());

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.recordMetric('slow_tool', 5000, true);
      }
    });

    const health = result.current.getOverallHealth();
    expect(['degraded', 'critical']).toContain(health);
  });

  it('shouldReduceContext returns false initially', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics());
    expect(result.current.shouldReduceContext()).toBe(false);
  });

  it('returns undefined for unknown tool', () => {
    const { result } = renderHook(() => useJarvisPerformanceMetrics());
    expect(result.current.getToolMetrics('unknown')).toBeUndefined();
  });
});
