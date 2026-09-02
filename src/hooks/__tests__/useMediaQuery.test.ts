import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery } from '../shared/useMediaQuery';

describe('useMediaQuery', () => {
  it('returns false by default (matchMedia mock)', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);
  });

  it('calls window.matchMedia with the query', () => {
    const spy = vi.spyOn(window, 'matchMedia');
    renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(spy).toHaveBeenCalledWith('(min-width: 1024px)');
    spy.mockRestore();
  });
});
