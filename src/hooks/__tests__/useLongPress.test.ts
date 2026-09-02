import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/haptics', () => ({
  vibrate: vi.fn(),
}));

import { useLongPress } from '../shared/useLongPress';

describe('useLongPress', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns handlers', () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    expect(result.current.handlers).toHaveProperty('onTouchStart');
    expect(result.current.handlers).toHaveProperty('onTouchEnd');
    expect(result.current.handlers).toHaveProperty('onMouseDown');
    expect(result.current.handlers).toHaveProperty('onMouseUp');
  });

  it('fires onLongPress after delay', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress: cb, delay: 300 }));

    act(() => {
      (result.current.handlers.onMouseDown as any)({});
    });

    expect(cb).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(result.current.isLongPress()).toBe(true);
  });

  it('does not fire if cleared before delay', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress: cb, delay: 500 }));

    act(() => { (result.current.handlers.onMouseDown as any)({}); });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { (result.current.handlers.onMouseUp as any)({}); });
    act(() => { vi.advanceTimersByTime(500); });

    expect(cb).not.toHaveBeenCalled();
  });
});
