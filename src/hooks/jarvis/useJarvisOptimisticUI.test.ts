import React, { PropsWithChildren } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { toastMock, useToastImpl } = vi.hoisted(() => {
  const toastMock = vi.fn();
  const useToastImpl = () => ({ toast: toastMock });
  return { toastMock, useToastImpl };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: useToastImpl,
}));

import { useJarvisOptimisticUI } from './useJarvisOptimisticUI';

describe('useJarvisOptimisticUI', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const Wrapper = ({ children }: PropsWithChildren<{}>) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    return Wrapper;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    toastMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes with empty actions and helper methods work on empty state', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    expect(result.current.optimisticActions).toEqual([]);
    expect(result.current.getActionStatus('unknown')).toBeUndefined();
    expect(result.current.isActionPending('unknown')).toBe(false);
    expect(typeof result.current.startOptimisticAction).toBe('function');
    expect(typeof result.current.confirmAction).toBe('function');
    expect(typeof result.current.failAction).toBe('function');
    expect(typeof result.current.rollbackAction).toBe('function');
    expect(typeof result.current.clearCompletedActions).toBe('function');
  });

  it('startOptimisticAction adds action with optimistic status and shows start toast', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    const now = Date.now();
    await act(async () => {
      result.current.startOptimisticAction('a1', 'toolX', 'Do something');
    });

    expect(result.current.optimisticActions.length).toBe(1);
    const action = result.current.optimisticActions[0];
    expect(action.id).toBe('a1');
    expect(action.toolName).toBe('toolX');
    expect(action.displayText).toBe('Do something');
    expect(action.status).toBe('optimistic');
    expect(action.startedAt).toBe(now);

    expect(result.current.isActionPending('a1')).toBe(true);
    expect(result.current.getActionStatus('a1')).toBe('optimistic');

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenLastCalledWith({
      title: '⚡ Do something',
      description: 'En cours...',
      duration: 3000,
    });
  });

  it('confirmAction marks action as confirmed, sets confirmedAt, and shows confirmation toast with latency', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    vi.setSystemTime(1_000);
    await act(async () => {
      result.current.startOptimisticAction('a2', 'toolY', 'Perform task');
    });

    vi.setSystemTime(2_500);
    await act(async () => {
      result.current.confirmAction('a2');
    });

    const action = result.current.optimisticActions.find(a => a.id === 'a2');
    expect(action?.status).toBe('confirmed');
    expect(typeof action?.confirmedAt).toBe('number');
    expect((action?.confirmedAt ?? 0)).toBe(2_500);

    expect(toastMock).toHaveBeenCalledTimes(2);
    const lastCallArg = toastMock.mock.calls[1][0];
    expect(lastCallArg.title).toBe('✅ Perform task');
    expect(String(lastCallArg.description)).toContain('Confirmé en 1.5s');
    expect(lastCallArg.duration).toBe(2000);
  });

  it('failAction marks action as failed with error message and shows error toast', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    await act(async () => {
      result.current.startOptimisticAction('a3', 'toolZ', 'Upload file');
    });

    await act(async () => {
      result.current.failAction('a3', 'Network error');
    });

    const action = result.current.optimisticActions.find(a => a.id === 'a3');
    expect(action?.status).toBe('failed');
    expect(action?.errorMessage).toBe('Network error');

    expect(toastMock).toHaveBeenCalledTimes(2);
    const failToast = toastMock.mock.calls[1][0];
    expect(failToast.title).toBe('❌ Échec: Upload file');
    expect(failToast.description).toBe('Network error');
    expect(failToast.variant).toBe('destructive');
    expect(failToast.duration).toBe(5000);
  });

  it('rollbackAction sets status to rolled_back and shows cancellation error toast', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    await act(async () => {
      result.current.startOptimisticAction('a4', 'toolR', 'Delete item');
    });

    await act(async () => {
      result.current.rollbackAction('a4');
    });

    const action = result.current.optimisticActions.find(a => a.id === 'a4');
    expect(action?.status).toBe('rolled_back');

    expect(toastMock).toHaveBeenCalledTimes(2);
    const rollbackToast = toastMock.mock.calls[1][0];
    expect(rollbackToast.title).toBe('❌ Échec: Delete item');
    expect(rollbackToast.description).toBe('Action annulée');
    expect(rollbackToast.variant).toBe('destructive');
  });

  it('clearCompletedActions removes non-pending actions and keeps pending/optimistic ones', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    await act(async () => {
      result.current.startOptimisticAction('keep', 'toolK', 'Keep me');
      result.current.startOptimisticAction('confirmMe', 'toolC', 'Confirm me');
      result.current.startOptimisticAction('failMe', 'toolF', 'Fail me');
    });

    await act(async () => {
      result.current.confirmAction('confirmMe');
      result.current.failAction('failMe', 'oops');
    });

    await act(async () => {
      result.current.clearCompletedActions();
    });

    const ids = result.current.optimisticActions.map(a => a.id);
    expect(ids).toEqual(['keep']);
    expect(result.current.getActionStatus('keep')).toBe('optimistic');
  });

  it('automatically fails action after 30s timeout when not confirmed', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisOptimisticUI(), { wrapper });

    await act(async () => {
      result.current.startOptimisticAction('timeout1', 'toolT', 'Do timeout');
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    const status = result.current.getActionStatus('timeout1');
    expect(status).toBe('failed');

    expect(toastMock).toHaveBeenCalledTimes(2);
    const timeoutToast = toastMock.mock.calls[1][0];
    expect(timeoutToast.title.startsWith('❌ Échec: ')).toBe(true);
    expect(timeoutToast.description).toBe('Timeout - action non confirmée');
    expect(timeoutToast.variant).toBe('destructive');
  });
});