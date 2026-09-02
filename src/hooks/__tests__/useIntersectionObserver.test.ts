import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIntersectionObserver } from '../shared/useIntersectionObserver';

describe('useIntersectionObserver', () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    (window as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: observeMock,
      disconnect: disconnectMock,
      unobserve: vi.fn(),
    }));
  });

  it('returns ref, inView, and entry', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(result.current.ref).toBeDefined();
    expect(result.current.inView).toBe(false);
    expect(result.current.entry).toBeNull();
  });

  it('accepts threshold and rootMargin options', () => {
    renderHook(() => useIntersectionObserver({ threshold: 0.5, rootMargin: '10px' }));
    // Should not throw
  });

  it('accepts triggerOnce option', () => {
    renderHook(() => useIntersectionObserver({ triggerOnce: true }));
    // Should not throw
  });
});
