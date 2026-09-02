/**
 * Tests for useJarvisCircuitState hook
 * 
 * Tests circuit breaker states, health checks, and degradation modes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { supabase } from '@/integrations/supabase/client';

// Mock the debug module
vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Supabase client
const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('useJarvisCircuitState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with UNKNOWN status', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Not loaded') });
    
    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    expect(result.current.status).toBe('UNKNOWN');
    expect(result.current.circuits).toEqual([]);
    expect(result.current.degradationMode).toBe('full');
  });

  it('should return HEALTHY status when health check succeeds', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        status: 'HEALTHY',
        checks: {
          azureGpt52: { status: 'ok', latencyMs: 150 },
          azureGpt5: { status: 'ok', latencyMs: 200 },
          database: { status: 'ok', latencyMs: 50 },
        },
        recommendations: [],
        responseTimeMs: 100,
      },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    expect(result.current.status).toBe('HEALTHY');
    expect(result.current.degradationMode).toBe('full');
    expect(result.current.circuits).toHaveLength(3);
    expect(result.current.circuits[0].status).toBe('CLOSED');
  }, 10000);

  it('should return DEGRADED status with reduced mode', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        status: 'DEGRADED',
        checks: {
          azureGpt52: { status: 'degraded', latencyMs: 5000, message: 'High latency' },
          azureGpt5: { status: 'ok', latencyMs: 200 },
          database: { status: 'ok', latencyMs: 50 },
        },
        recommendations: ['Consider using fallback model'],
        responseTimeMs: 5100,
      },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    expect(result.current.status).toBe('DEGRADED');
    expect(result.current.degradationMode).toBe('reduced');
    expect(result.current.circuits[0].status).toBe('HALF-OPEN');
  }, 10000);

  it('should return UNHEALTHY status with minimal mode', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        status: 'UNHEALTHY',
        checks: {
          azureGpt52: { status: 'error', message: 'Connection refused' },
          azureGpt5: { status: 'error', message: 'Timeout' },
          database: { status: 'ok', latencyMs: 50 },
        },
        recommendations: ['Check Azure credentials', 'Fallback to cache'],
        responseTimeMs: 10000,
      },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    expect(result.current.status).toBe('UNHEALTHY');
    expect(result.current.degradationMode).toBe('minimal');
    expect(result.current.circuits[0].status).toBe('OPEN');
    expect(result.current.recommendations).toContain('Check Azure credentials');
  }, 10000);

  it('should return OFFLINE with cache-only mode on network error', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    expect(result.current.status).toBe('OFFLINE');
    expect(result.current.degradationMode).toBe('cache-only');
  }, 10000);

  it('should calculate correct context budget based on degradation mode', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'HEALTHY', checks: {}, recommendations: [] },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    // HEALTHY = full mode = 2500 tokens (V11 optimized)
    expect(result.current.getContextBudget()).toBe(2500);
  }, 10000);

  it('should correctly identify circuit availability', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        status: 'DEGRADED',
        checks: {
          azureGpt52: { status: 'error' },
          azureGpt5: { status: 'ok' },
          database: { status: 'ok' },
        },
        recommendations: [],
      },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    // GPT-5.2 circuit should be OPEN (unavailable)
    expect(result.current.isCircuitAvailable('azure-gpt52')).toBe(false);
    // GPT-5 circuit should be available
    expect(result.current.isCircuitAvailable('azure-gpt5')).toBe(true);
    // Unknown circuit should default to available
    expect(result.current.isCircuitAvailable('unknown-circuit')).toBe(true);
  }, 10000);

  it('should disable streaming in minimal/cache-only modes', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'UNHEALTHY', checks: {}, recommendations: [] },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    expect(result.current.shouldEnableStreaming()).toBe(false);
  }, 10000);

  it('should enable streaming in full/reduced modes', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'DEGRADED', checks: {}, recommendations: [] },
      error: null,
    });

    const { useJarvisCircuitState } = await import('@/hooks/jarvis/useJarvisCircuitState');
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));

    await act(async () => {
      await result.current.forceCheck();
    });

    expect(result.current.shouldEnableStreaming()).toBe(true);
  }, 10000);
});
