import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery } from '../shared/use-media-query';

describe('useMediaQuery (kebab-case wrapper)', () => {
  it('returns false by default (matchMedia mock returns matches:false)', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);
  });

  it('calls window.matchMedia with the provided query', () => {
    const spy = vi.spyOn(window, 'matchMedia');
    renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(spy).toHaveBeenCalledWith('(min-width: 1024px)');
    spy.mockRestore();
  });

  it('returns boolean for arbitrary query', () => {
    const { result } = renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'));
    expect(typeof result.current).toBe('boolean');
  });
});
