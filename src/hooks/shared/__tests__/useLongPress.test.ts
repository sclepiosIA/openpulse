import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

vi.mock('@/lib/haptics', () => ({ vibrate: vi.fn() }));

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('returns handlers and isLongPress getter', () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    expect(result.current.handlers).toBeDefined();
    expect(typeof result.current.isLongPress).toBe('function');
    expect(result.current.isLongPress()).toBe(false);
  });

  it('fires onLongPress after default 500ms', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(499); });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.isLongPress()).toBe(true);
  });

  it('respects custom delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, delay: 200 }));
    act(() => { result.current.handlers.onTouchStart(); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('clear cancels the long-press', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { result.current.handlers.onMouseUp(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('calls vibrate when haptic is enabled', async () => {
    const { vibrate } = await import('@/lib/haptics');
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(vibrate).toHaveBeenCalledWith(50);
  });

  it('does not vibrate when haptic is disabled', async () => {
    const { vibrate } = await import('@/lib/haptics');
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn(), haptic: false }));
    act(() => { result.current.handlers.onMouseDown(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(vibrate).not.toHaveBeenCalled();
  });
});
