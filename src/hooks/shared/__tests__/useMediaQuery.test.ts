import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Array<(e: { matches: boolean }) => void> = [];
  let currentMatches = false;

  beforeEach(() => {
    listeners = [];
    currentMatches = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: currentMatches,
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: any) => listeners.push(cb),
        removeEventListener: (_: string, cb: any) => {
          listeners = listeners.filter((l) => l !== cb);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns false initially when no match', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);
  });

  it('returns true when query matches initially', () => {
    currentMatches = true;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);
    act(() => { listeners.forEach((l) => l({ matches: true } as any)); });
    expect(result.current).toBe(true);
  });

  it('registers and unregisters listener', () => {
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
