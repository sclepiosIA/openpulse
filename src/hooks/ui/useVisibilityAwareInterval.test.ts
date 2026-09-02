import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVisibilityAwareInterval } from './useVisibilityAwareInterval';

let hiddenState = false;
Object.defineProperty(document, 'hidden', {
  configurable: true,
  get() {
    return hiddenState;
  },
});

function setDocumentHidden(value: boolean, dispatch = true) {
  hiddenState = value;
  if (dispatch) {
    document.dispatchEvent(new Event('visibilitychange'));
  }
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  setDocumentHidden(false, false);
});

describe('useVisibilityAwareInterval', () => {
  it('runs immediately when visible and continues at the given interval', () => {
    vi.useFakeTimers();
    setDocumentHidden(false, false);
    const callback = vi.fn();

    const { result, unmount } = renderHook(() =>
      useVisibilityAwareInterval(callback, 1000, { runImmediately: true, enabled: true }),
      { wrapper: createWrapper() }
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(callback).toHaveBeenCalledTimes(4);

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(callback).toHaveBeenCalledTimes(4);
  });

  it('pauses when document becomes hidden and resumes when visible again', () => {
    vi.useFakeTimers();
    setDocumentHidden(true, false);
    const callback = vi.fn();

    const { result } = renderHook(
      () => useVisibilityAwareInterval(callback, 1000, { runImmediately: true, enabled: true }),
      { wrapper: createWrapper() }
    );

    expect(callback).not.toHaveBeenCalled();
    expect(result.current.isRunning()).toBe(false);

    setDocumentHidden(false, true);
    expect(result.current.isRunning()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    setDocumentHidden(true, true);
    expect(result.current.isRunning()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    setDocumentHidden(false, true);
    expect(result.current.isRunning()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('supports manual stop and start, reflecting isRunning state', () => {
    vi.useFakeTimers();
    setDocumentHidden(false, false);
    const callback = vi.fn();

    const { result } = renderHook(
      () => useVisibilityAwareInterval(callback, 1000, { runImmediately: true, enabled: true }),
      { wrapper: createWrapper() }
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning()).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isRunning()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.start();
    });
    expect(result.current.isRunning()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not run when disabled, then runs immediately and starts interval when enabled toggles to true', () => {
    vi.useFakeTimers();
    setDocumentHidden(false, false);
    const callback = vi.fn();

    type HookProps = {
      callback: () => void | Promise<void>;
      delay: number | null;
      options?: { runImmediately?: boolean; enabled?: boolean };
    };

    const { rerender } = renderHook(
      ({ callback, delay, options }: HookProps) => useVisibilityAwareInterval(callback, delay, options),
      {
        initialProps: { callback, delay: 1000, options: { enabled: false, runImmediately: true } },
        wrapper: createWrapper(),
      }
    );

    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(0);

    rerender({ callback, delay: 1000, options: { enabled: true, runImmediately: true } });

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not run when delay is null; runs when delay becomes a number', () => {
    vi.useFakeTimers();
    setDocumentHidden(false, false);
    const callback = vi.fn();

    type HookProps = {
      callback: () => void | Promise<void>;
      delay: number | null;
      options?: { runImmediately?: boolean; enabled?: boolean };
    };

    const { rerender } = renderHook(
      ({ callback, delay, options }: HookProps) => useVisibilityAwareInterval(callback, delay, options),
      {
        initialProps: { callback, delay: null, options: { enabled: true, runImmediately: true } },
        wrapper: createWrapper(),
      }
    );

    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(callback).toHaveBeenCalledTimes(0);

    rerender({ callback, delay: 500, options: { enabled: true, runImmediately: true } });

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it('uses the latest callback reference after rerender', () => {
    vi.useFakeTimers();
    setDocumentHidden(false, false);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    type HookProps = {
      callback: () => void | Promise<void>;
      delay: number | null;
      options?: { runImmediately?: boolean; enabled?: boolean };
    };

    const { rerender } = renderHook(
      ({ callback, delay, options }: HookProps) => useVisibilityAwareInterval(callback, delay, options),
      {
        initialProps: { callback: cb1, delay: 1000, options: { enabled: true, runImmediately: true } },
        wrapper: createWrapper(),
      }
    );

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cb1).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenCalledTimes(0);

    rerender({ callback: cb2, delay: 1000, options: { enabled: true, runImmediately: true } });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cb1).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('respects runImmediately: false (no immediate call, only interval ticks)', () => {
    vi.useFakeTimers();
    setDocumentHidden(false, false);
    const callback = vi.fn();

    renderHook(
      () => useVisibilityAwareInterval(callback, 700, { enabled: true, runImmediately: false }),
      { wrapper: createWrapper() }
    );

    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });
});