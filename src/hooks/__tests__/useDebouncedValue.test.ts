import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '../shared/useDebouncedValue';

describe('useDebouncedValue', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('debounces value updates', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    expect(result.current).toBe('a'); // not yet updated

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('b');

    vi.useRealTimers();
  });

  it('resets timer on rapid changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'x' } }
    );

    rerender({ value: 'y' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'z' });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('x'); // still initial

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('z');

    vi.useRealTimers();
  });
});
