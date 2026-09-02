import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisibilityAwareInterval } from '../ui/useVisibilityAwareInterval';

describe('useVisibilityAwareInterval extended', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls callback immediately by default', () => {
    const callback = vi.fn();
    renderHook(() => useVisibilityAwareInterval(callback, 1000));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call immediately when runImmediately=false', () => {
    const callback = vi.fn();
    renderHook(() => useVisibilityAwareInterval(callback, 1000, { runImmediately: false }));
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('calls callback on interval', () => {
    const callback = vi.fn();
    renderHook(() => useVisibilityAwareInterval(callback, 1000, { runImmediately: false }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('stops when delay is null', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ delay }) => useVisibilityAwareInterval(callback, delay, { runImmediately: false }),
      { initialProps: { delay: 1000 as number | null } }
    );
    act(() => { vi.advanceTimersByTime(2000); });
    const count = callback.mock.calls.length;
    rerender({ delay: null });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(callback).toHaveBeenCalledTimes(count);
  });

  it('stops when enabled=false', () => {
    const callback = vi.fn();
    renderHook(() => useVisibilityAwareInterval(callback, 1000, {
      runImmediately: false,
      enabled: false,
    }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('returns control methods', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useVisibilityAwareInterval(callback, 1000));
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.isRunning).toBe('function');
  });

  it('isRunning returns true when active', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useVisibilityAwareInterval(callback, 1000));
    expect(result.current.isRunning()).toBe(true);
  });

  it('cleans up on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() =>
      useVisibilityAwareInterval(callback, 1000, { runImmediately: false })
    );
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(callback).toHaveBeenCalledTimes(0);
  });
});
