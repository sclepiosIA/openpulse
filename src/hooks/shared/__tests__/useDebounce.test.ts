import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('debounces value updates by default 300ms', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('respects custom delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 1000), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(2);
  });

  it('cancels previous timer on rapid updates', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: 'c' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('c');
  });

  it('supports object values', () => {
    const obj = { x: 1 };
    const { result } = renderHook(() => useDebounce(obj, 100));
    expect(result.current).toBe(obj);
  });
});
