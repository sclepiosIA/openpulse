const { mockInvoke, toast, debug, stringResult, objectResult, errorResult } = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const toast = {
    success: vi.fn(),
    error: vi.fn()
  };
  const debug = {
    error: vi.fn()
  };
  const stringResult = { data: { result: 'Ce texte est un résumé généré' }, error: null };
  const objectResult = { data: { result: { summary: 'Résumé depuis objet' } }, error: null };
  const errorResult = { data: null, error: { message: 'erreur-ai' } };
  return { mockInvoke, toast, debug, stringResult, objectResult, errorResult };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      functions: {
        invoke: mockInvoke
      }
    }
  };
});

vi.mock('sonner', () => {
  return { toast };
});

vi.mock('@/lib/debug', () => {
  return { debug };
});

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePulseWidgetSummaries } from './usePulseWidgetSummaries';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  });
}

function createWrapper() {
  const client = createQueryClient();
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function deferred<T = unknown>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('usePulseWidgetSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  it('initial state: empty summaries and not loading', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseWidgetSummaries(), { wrapper });

    expect(result.current.summaries instanceof Map).toBe(true);
    expect(result.current.summaries.size).toBe(0);
    expect(result.current.loadingIds instanceof Set).toBe(true);
    expect(result.current.loadingIds.size).toBe(0);
    expect(result.current.getSummary('unknown')).toBeUndefined();
    expect(result.current.isLoading('unknown')).toBe(false);
  });

  it('generates summary when supabase.functions.invoke returns a string result', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseWidgetSummaries(), { wrapper });

    const d = deferred<typeof stringResult>();
    mockInvoke.mockImplementationOnce(() => d.promise);

    let promise: Promise<void>;
    act(() => {
      promise = result.current.generateSummary('conv-1') as Promise<void>;
    });

    expect(result.current.isLoading('conv-1')).toBe(true);
    expect(result.current.loadingIds.has('conv-1')).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-summarize', {
      body: { conversation_id: 'conv-1', action: 'summarize' }
    });

    await act(async () => {
      d.resolve(stringResult);
      await promise;
    });

    expect(result.current.isLoading('conv-1')).toBe(false);
    expect(result.current.getSummary('conv-1')).toBe('Ce texte est un résumé généré');
    expect(result.current.summaries.has('conv-1')).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Résumé généré');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('generates summary when supabase.functions.invoke returns an object result with summary field', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseWidgetSummaries(), { wrapper });

    const d = deferred<typeof objectResult>();
    mockInvoke.mockImplementationOnce(() => d.promise);

    let promise: Promise<void>;
    act(() => {
      promise = result.current.generateSummary('conv-2') as Promise<void>;
    });

    expect(result.current.isLoading('conv-2')).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      d.resolve(objectResult);
      await promise;
    });

    expect(result.current.isLoading('conv-2')).toBe(false);
    expect(result.current.getSummary('conv-2')).toBe('Résumé depuis objet');
    expect(toast.success).toHaveBeenCalledWith('Résumé généré');
  });

  it('handles supabase.functions.invoke returning an error object', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseWidgetSummaries(), { wrapper });

    mockInvoke.mockResolvedValueOnce(errorResult);

    await act(async () => {
      await result.current.generateSummary('conv-err');
    });

    expect(result.current.getSummary('conv-err')).toBeUndefined();
    expect(result.current.isLoading('conv-err')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Erreur lors de la génération du résumé');
    expect(debug.error).toHaveBeenCalledWith('[PulseWidget] Summary error:', errorResult.error);
  });

  it('handles supabase.functions.invoke throwing/rejecting (network or exception)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseWidgetSummaries(), { wrapper });

    const thrown = new Error('network-failure');
    mockInvoke.mockRejectedValueOnce(thrown);

    await act(async () => {
      await result.current.generateSummary('conv-ex');
    });

    expect(result.current.getSummary('conv-ex')).toBeUndefined();
    expect(result.current.isLoading('conv-ex')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Erreur lors de la génération du résumé');
    expect(debug.error).toHaveBeenCalledWith('[PulseWidget] Summary failed:', thrown);
  });

  it('prevents duplicate concurrent requests for the same conversation id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseWidgetSummaries(), { wrapper });

    const d = deferred<typeof stringResult>();
    mockInvoke.mockImplementationOnce(() => d.promise);

    let p1: Promise<void>;
    act(() => {
      p1 = result.current.generateSummary('dup-id') as Promise<void>;
    });

    act(() => {
      result.current.generateSummary('dup-id');
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      d.resolve(stringResult);
      await p1;
    });

    expect(result.current.getSummary('dup-id')).toBe('Ce texte est un résumé généré');
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});