import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/types/calls', () => ({}));

const { TARGET_A, TARGET_B } = vi.hoisted(() => ({
  TARGET_A: { id: 't1', kind: 'number', value: '+331234567' },
  TARGET_B: { id: 't2', kind: 'contact', value: 'Alice' },
}));

import { CallProvider, useCallContext } from './CallContext';

function createWrapper(withProvider = true) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const content = withProvider ? <CallProvider>{children}</CallProvider> : children;
    return <QueryClientProvider client={client}>{content}</QueryClientProvider>;
  };
}

describe('useCallContext - fallback outside provider', () => {
  it('returns safe defaults and warns on startCall', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useCallContext(), { wrapper: createWrapper(false) });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingTarget).toBeNull();

    act(() => {
      result.current.startCall(TARGET_A);
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[CallContext] startCall called outside provider — ignored');

    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingTarget).toBeNull();

    let consumed: unknown = 'init';
    act(() => {
      consumed = result.current.consumeTarget();
    });
    expect(consumed).toBeNull();

    warnSpy.mockRestore();
  });
});

describe('CallProvider + useCallContext - state flow', () => {
  it('initial state, startCall opens widget and sets target, consumeTarget clears target, closeWidget closes', () => {
    const { result } = renderHook(() => useCallContext(), { wrapper: createWrapper(true) });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingTarget).toBeNull();
    expect(typeof result.current.startCall).toBe('function');
    expect(typeof result.current.closeWidget).toBe('function');
    expect(typeof result.current.consumeTarget).toBe('function');

    act(() => {
      result.current.startCall(TARGET_A);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.pendingTarget).toBe(TARGET_A);

    let consumed: unknown;
    act(() => {
      consumed = result.current.consumeTarget();
    });

    expect(consumed).toBe(TARGET_A);
    expect(result.current.pendingTarget).toBeNull();
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeWidget();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingTarget).toBeNull();
  });

  it('consumeTarget returns null when no pending target and startCall can be called multiple times', () => {
    const { result } = renderHook(() => useCallContext(), { wrapper: createWrapper(true) });

    let consumed: unknown;
    act(() => {
      consumed = result.current.consumeTarget();
    });
    expect(consumed).toBeNull();

    act(() => {
      result.current.startCall(TARGET_A);
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.pendingTarget).toBe(TARGET_A);

    act(() => {
      result.current.startCall(TARGET_B);
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.pendingTarget).toBe(TARGET_B);

    act(() => {
      result.current.closeWidget();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingTarget).toBeNull();
  });
});