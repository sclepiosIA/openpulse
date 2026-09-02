import React, { type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { debugErrorMock } = vi.hoisted(() => ({
  debugErrorMock: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

import { usePullToRefresh } from './usePullToRefresh';

function createWrapper(): React.FC<{ children: ReactNode }> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function setScrollTop(v: number) {
  Object.defineProperty(window, 'pageYOffset', { value: v, configurable: true });
  (document.documentElement as HTMLElement).scrollTop = v;
}

function makeTouchEvent(y: number) {
  const preventDefault = vi.fn();
  const ev = { touches: [{ clientY: y }], preventDefault } as unknown as React.TouchEvent;
  return { ev, preventDefault };
}

function createDeferred() {
  let res: (() => void) | undefined;
  const promise = new Promise<void>((r) => {
    res = r;
  });
  const resolve = () => {
    if (!res) throw new Error('resolver not set');
    res();
  };
  return { promise, resolve };
}

describe('usePullToRefresh', () => {
  it('expose initial state', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), {
      wrapper: createWrapper(),
    });

    expect(result.current.pullDistance).toBe(0);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.shouldRefresh).toBe(false);
    expect(typeof result.current.handlers.onTouchStart).toBe('function');
    expect(typeof result.current.handlers.onTouchMove).toBe('function');
    expect(typeof result.current.handlers.onTouchEnd).toBe('function');
  });

  it('does not enable pull when not at top of scroll', async () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), {
      wrapper: createWrapper(),
    });

    setScrollTop(10);
    const start = makeTouchEvent(100);
    const move = makeTouchEvent(140);

    act(() => {
      result.current.handlers.onTouchStart(start.ev);
    });
    act(() => {
      result.current.handlers.onTouchMove(move.ev);
    });

    expect(start.preventDefault).not.toHaveBeenCalled();
    expect(move.preventDefault).not.toHaveBeenCalled();
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.progress).toBe(0);
    expect(result.current.shouldRefresh).toBe(false);

    await act(async () => {
      await result.current.handlers.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('updates pullDistance with resistance and does not refresh when below threshold', async () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), {
      wrapper: createWrapper(),
    });

    setScrollTop(0);
    const start = makeTouchEvent(0);
    const move = makeTouchEvent(60); // diff = 60 -> resistance = 30

    act(() => {
      result.current.handlers.onTouchStart(start.ev);
    });

    act(() => {
      result.current.handlers.onTouchMove(move.ev);
    });

    expect(move.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.pullDistance).toBe(30);
    expect(result.current.progress).toBeCloseTo(30 / 80);
    expect(result.current.shouldRefresh).toBe(false);

    await act(async () => {
      await result.current.handlers.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.shouldRefresh).toBe(false);
  });

  it('caps resistance at maxPull', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(
      () => usePullToRefresh({ onRefresh, maxPull: 50 }),
      { wrapper: createWrapper() }
    );

    setScrollTop(0);
    const start = makeTouchEvent(0);
    const move = makeTouchEvent(200); // diff = 200 -> diff/2 = 100, capped at maxPull 50

    act(() => {
      result.current.handlers.onTouchStart(start.ev);
    });
    act(() => {
      result.current.handlers.onTouchMove(move.ev);
    });

    expect(move.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.pullDistance).toBe(50);
    expect(result.current.progress).toBeCloseTo(50 / 80);
    expect(result.current.shouldRefresh).toBe(false);
  });

  it('triggers refresh when over threshold and locks distance to threshold during refresh', async () => {
    const { promise, resolve } = createDeferred();
    const onRefresh = vi.fn(() => promise);

    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), {
      wrapper: createWrapper(),
    });

    setScrollTop(0);
    const start = makeTouchEvent(0);
    const move = makeTouchEvent(200); // diff = 200 -> resistance = 100 (min of diff/2 and maxPull 150)

    act(() => {
      result.current.handlers.onTouchStart(start.ev);
    });
    act(() => {
      result.current.handlers.onTouchMove(move.ev);
    });

    expect(move.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.pullDistance).toBe(100);
    expect(result.current.progress).toBe(1);
    expect(result.current.shouldRefresh).toBe(true);

    await act(async () => {
      const p = result.current.handlers.onTouchEnd();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      void p;
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.pullDistance).toBe(80); // locked at threshold during refresh
    expect(result.current.progress).toBe(1);
    expect(result.current.shouldRefresh).toBe(true);

    await act(async () => {
      resolve();
      await promise;
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.progress).toBe(0);
    expect(result.current.shouldRefresh).toBe(false);
  });

  it('handles refresh errors and resets state', async () => {
    const error = new Error('x');
    const onRefresh = vi.fn(async () => {
      throw error;
    });

    const { result } = renderHook(() => usePullToRefresh({ onRefresh }), {
      wrapper: createWrapper(),
    });

    setScrollTop(0);
    const start = makeTouchEvent(0);
    const move = makeTouchEvent(200);

    act(() => {
      result.current.handlers.onTouchStart(start.ev);
    });
    act(() => {
      result.current.handlers.onTouchMove(move.ev);
    });

    await act(async () => {
      await result.current.handlers.onTouchEnd();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(debugErrorMock).toHaveBeenCalledTimes(1);
    const [msg, errArg] = debugErrorMock.mock.calls[0];
    expect(String(msg)).toContain('Pull to refresh error:');
    expect(errArg).toBeInstanceOf(Error);
    expect((errArg as Error).message).toBe('x');

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.progress).toBe(0);
    expect(result.current.shouldRefresh).toBe(false);
  });
});