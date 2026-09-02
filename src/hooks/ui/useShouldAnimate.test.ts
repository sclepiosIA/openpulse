import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShouldAnimate, useShouldAnimateLight } from './useShouldAnimate';

const { mockUseMediaQuery } = vi.hoisted(() => {
  const mockUseMediaQuery = vi.fn<boolean, [string]>();
  return { mockUseMediaQuery };
});

vi.mock('../shared/useMediaQuery', () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };

  return Wrapper;
}

describe('useShouldAnimate', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('returns true when all conditions allow animations (no reduced motion, visible, desktop)', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      if (query === '(max-width: 768px)') return false;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(true);
  });

  it('returns false when user prefers reduced motion', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return true;
      if (query === '(max-width: 768px)') return false;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });

  it('returns false when document is initially hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      if (query === '(max-width: 768px)') return false;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });

  it('updates to false when document becomes hidden after being visible', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      if (query === '(max-width: 768px)') return false;
      return false;
    });

    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });

    const { result } = renderHook(() => useShouldAnimate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(true);

    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(false);
  });

  it('returns false when device is mobile (max-width: 768px)', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      if (query === '(max-width: 768px)') return true;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimate(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });

  it('cleans up visibilitychange listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      if (query === '(max-width: 768px)') return false;
      return false;
    });

    const { unmount } = renderHook(() => useShouldAnimate(), {
      wrapper: createWrapper(),
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });
});

describe('useShouldAnimateLight', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('returns true when reduced motion is false and document is visible', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimateLight(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(true);
  });

  it('returns false when user prefers reduced motion', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return true;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimateLight(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });

  it('returns false when document is initially hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      return false;
    });

    const { result } = renderHook(() => useShouldAnimateLight(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });

  it('updates to false when document becomes hidden', () => {
    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      return false;
    });

    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });

    const { result } = renderHook(() => useShouldAnimateLight(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(true);

    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(false);
  });

  it('cleans up visibilitychange listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    mockUseMediaQuery.mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return false;
      return false;
    });

    const { unmount } = renderHook(() => useShouldAnimateLight(), {
      wrapper: createWrapper(),
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });
});