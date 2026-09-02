// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMediaQuery } from './use-media-query';

const { createMatchMediaController } = vi.hoisted(() => {
  type Listener = (event: MediaQueryListEvent) => void;

  function createMatchMediaController(initialMatches = false) {
    let matches = initialMatches;
    const listeners = new Set<Listener>();

    const mql = {
      media: '',
      matches,
      onchange: null as ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null,
      addEventListener: vi.fn((event: string, listener: Listener) => {
        if (event === 'change') listeners.add(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: Listener) => {
        if (event === 'change') listeners.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    const matchMedia = vi.fn((query: string) => {
      mql.media = query;
      mql.matches = matches;
      return mql;
    });

    const setMatches = (next: boolean) => {
      matches = next;
      mql.matches = next;
      const event = { matches: next, media: mql.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    };

    return {
      matchMedia,
      mql,
      setMatches,
    };
  }

  return { createMatchMediaController };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useMediaQuery', () => {
  it('retourne la valeur initiale depuis matchMedia et écoute les changements', async () => {
    const controller = createMatchMediaController(true);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: controller.matchMedia,
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(true);
    expect(controller.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
    expect(controller.mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(controller.mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('met à jour la valeur métier réelle quand le media query change', async () => {
    const controller = createMatchMediaController(false);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: controller.matchMedia,
    });

    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);

    await act(async () => {
      controller.setMatches(true);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    await act(async () => {
      controller.setMatches(false);
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('retire le listener au démontage', () => {
    const controller = createMatchMediaController(true);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: controller.matchMedia,
    });

    const { unmount } = renderHook(() => useMediaQuery('(orientation: portrait)'), {
      wrapper: createWrapper(),
    });

    const addedHandler = controller.mql.addEventListener.mock.calls[0]?.[1];
    expect(typeof addedHandler).toBe('function');

    unmount();

    expect(controller.mql.removeEventListener).toHaveBeenCalledTimes(1);
    expect(controller.mql.removeEventListener).toHaveBeenCalledWith('change', addedHandler);
  });

  it('propage une erreur si matchMedia échoue', () => {
    const matchMediaError = vi.fn(() => {
      throw new Error('matchMedia unavailable');
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaError,
    });

    expect(() =>
      renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'), {
        wrapper: createWrapper(),
      }),
    ).toThrow('matchMedia unavailable');
  });
});