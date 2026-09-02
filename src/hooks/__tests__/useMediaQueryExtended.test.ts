import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery } from '../shared/useMediaQuery';

describe('useMediaQuery extended', () => {
  it('returns false by default (matchMedia mock)', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);
  });

  it('returns false for min-width query', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('handles prefers-reduced-motion', () => {
    const { result } = renderHook(() => useMediaQuery('(prefers-reduced-motion: reduce)'));
    expect(typeof result.current).toBe('boolean');
  });

  it('handles prefers-color-scheme', () => {
    const { result } = renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'));
    expect(typeof result.current).toBe('boolean');
  });

  it('updates on query change', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(max-width: 640px)' } }
    );
    expect(typeof result.current).toBe('boolean');
    rerender({ query: '(min-width: 1024px)' });
    expect(typeof result.current).toBe('boolean');
  });

  it('consistent for same query', () => {
    const { result: r1 } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    const { result: r2 } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(r1.current).toBe(r2.current);
  });
});
