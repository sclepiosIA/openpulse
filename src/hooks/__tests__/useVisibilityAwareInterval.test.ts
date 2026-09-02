import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibilityAwareInterval } from '../ui/useVisibilityAwareInterval';

describe('useVisibilityAwareInterval', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls callback immediately when runImmediately is true', () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityAwareInterval(cb, 1000, { runImmediately: true }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not call immediately when runImmediately is false', () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityAwareInterval(cb, 1000, { runImmediately: false }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not run when enabled is false', () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityAwareInterval(cb, 100, { runImmediately: true, enabled: false }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not run when delay is null', () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityAwareInterval(cb, null, { runImmediately: true }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns control methods', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useVisibilityAwareInterval(cb, 1000));
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.isRunning).toBe('function');
  });
});
