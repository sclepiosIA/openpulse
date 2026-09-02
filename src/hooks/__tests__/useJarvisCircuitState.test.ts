import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn() } }));

import { useJarvisCircuitState, type HealthStatus } from '../jarvis/useJarvisCircuitState';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisCircuitState - helpers', () => {
  it('initializes with UNKNOWN status', () => {
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));
    expect(result.current.status).toBe('UNKNOWN');
    expect(result.current.isChecking).toBe(false);
    expect(result.current.degradationMode).toBe('full');
  });

  it('getContextBudget returns values by mode', () => {
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));
    // Default is 'full' mode
    expect(result.current.getContextBudget()).toBe(2500);
  });

  it('shouldEnableStreaming returns true in full mode', () => {
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));
    expect(result.current.shouldEnableStreaming()).toBe(true);
  });

  it('isCircuitAvailable returns true for unknown circuit', () => {
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));
    expect(result.current.isCircuitAvailable('unknown-circuit')).toBe(true);
  });

  it('circuits is empty initially', () => {
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));
    expect(result.current.circuits).toEqual([]);
  });

  it('recommendations is empty initially', () => {
    const { result } = renderHook(() => useJarvisCircuitState({ autoCheck: false }));
    expect(result.current.recommendations).toEqual([]);
  });
});
