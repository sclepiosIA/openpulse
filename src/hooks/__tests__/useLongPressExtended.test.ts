import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../shared/useLongPress';

vi.mock('@/lib/haptics', () => ({
  vibrate: vi.fn(),
}));

describe('useLongPress extended', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns handlers and isLongPress', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    expect(result.current.handlers.onTouchStart).toBeDefined();
    expect(result.current.handlers.onTouchEnd).toBeDefined();
    expect(result.current.handlers.onTouchMove).toBeDefined();
    expect(result.current.handlers.onMouseDown).toBeDefined();
    expect(result.current.handlers.onMouseUp).toBeDefined();
    expect(result.current.handlers.onMouseLeave).toBeDefined();
    expect(typeof result.current.isLongPress).toBe('function');
  });

  it('isLongPress initially false', () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    expect(result.current.isLongPress()).toBe(false);
  });

  it('triggers after default delay (500ms)', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(499); });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('triggers after custom delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 200 }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not trigger if cleared before delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { result.current.handlers.onMouseUp(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('clears on mouse leave', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { result.current.handlers.onMouseLeave(); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('clears on touch move', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onTouchStart(); });
    act(() => { result.current.handlers.onTouchMove(); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('sets isLongPress to true after trigger', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.isLongPress()).toBe(true);
  });

  it('calls vibrate when haptic=true (default)', async () => {
    const { vibrate } = await import('@/lib/haptics');
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(vibrate).toHaveBeenCalledWith(50);
  });
});
