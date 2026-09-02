import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  ROWS,
  RESPONSE,
  SANITIZED_MESSAGE,
  mockFrom,
  mockFunctionsInvoke,
  toastMock,
  sanitizeMock,
  debugErrorMock,
  setInvokeImpl,
  makeDeferred,
} = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'm1',
      content: 'Bonjour le monde',
      content_highlighted: '<mark>Bonjour</mark> le monde',
      created_at: '2024-01-01T00:00:00.000Z',
      conversation_id: 'c1',
      user: { id: 'u1', nom: 'Dupont', prenom: 'Jean', avatar_url: null },
      conversation: { id: 'c1', name: 'Conv A' },
    },
    {
      id: 'm2',
      content: 'Salut tout le monde',
      content_highlighted: 'Salut tout le <mark>monde</mark>',
      created_at: '2024-01-02T00:00:00.000Z',
      conversation_id: 'c2',
      user: { id: 'u2', nom: 'Martin', prenom: 'Anne', avatar_url: 'http://ex.co/a.png' },
      conversation: { id: 'c2', name: 'Conv B' },
    },
  ];
  const RESPONSE = {
    results: ROWS,
    total: 2,
    query: 'hello',
    limit: 10,
    offset: 5,
  };
  const SANITIZED_MESSAGE = 'Une erreur est survenue';
  const toastMock = vi.fn();
  const sanitizeMock = vi.fn(() => SANITIZED_MESSAGE);
  const debugErrorMock = vi.fn();

  const createBuilder = () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      upsert: () => builder,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(null).catch(onRejected),
    };
    return builder;
  };
  const mockFrom = vi.fn(() => createBuilder());

  let invokeImpl: (...args: unknown[]) => Promise<unknown> = () =>
    Promise.resolve({ data: RESPONSE, error: null });
  const mockFunctionsInvoke = vi.fn((...args: unknown[]) => invokeImpl(...args));
  const setInvokeImpl = (fn: (...args: unknown[]) => Promise<unknown>) => {
    invokeImpl = fn;
  };

  const makeDeferred = () => {
    let resolveRef: (value: unknown) => void = () => {};
    let rejectRef: (reason?: unknown) => void = () => {};
    const promise = new Promise<unknown>((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
    });
    return { promise, resolve: resolveRef, reject: rejectRef };
  };

  return {
    ROWS,
    RESPONSE,
    SANITIZED_MESSAGE,
    mockFrom,
    mockFunctionsInvoke,
    toastMock,
    sanitizeMock,
    debugErrorMock,
    setInvokeImpl,
    makeDeferred,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeMock,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { usePulseSearch } from './usePulseSearch';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('usePulseSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInvokeImpl(() => Promise.resolve({ data: RESPONSE, error: null }));
  });

  it('exposes initial state', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseSearch(), { wrapper });
    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.hasSearched).toBe(false);
  });

  it('does not trigger search for short queries (<2 chars)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseSearch(), { wrapper });

    await act(async () => {
      await result.current.search('a');
    });

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.hasSearched).toBe(false);
  });

  it('performs search successfully and updates state, including loading flag', async () => {
    const wrapper = createWrapper();
    const deferred = makeDeferred();
    setInvokeImpl(() => deferred.promise as Promise<unknown>);

    const { result } = renderHook(() => usePulseSearch(), { wrapper });

    await act(async () => {
      result.current.search('  hello  ', 'c1', 10, 5);
    });

    expect(result.current.isSearching).toBe(true);
    expect(result.current.hasSearched).toBe(true);
    expect(mockFunctionsInvoke).toHaveBeenCalledTimes(1);
    const callArgs = mockFunctionsInvoke.mock.calls[0];
    expect(callArgs[0]).toBe('pulse-search');
    expect(callArgs[1]).toEqual({
      body: {
        query: 'hello',
        conversation_id: 'c1',
        limit: 10,
        offset: 5,
      },
    });

    await act(async () => {
      deferred.resolve({ data: RESPONSE, error: null });
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.results.length).toBe(ROWS.length);
    expect(result.current.results[0]?.id).toBe('m1');
    expect(result.current.results[1]?.id).toBe('m2');
    expect(result.current.total).toBe(RESPONSE.total);
  });

  it('handles error from supabase functions and shows toast', async () => {
    setInvokeImpl(() => Promise.resolve({ data: null, error: { message: 'x' } }));

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseSearch(), { wrapper });

    await act(async () => {
      await result.current.search('oops');
    });

    expect(toastMock).toHaveBeenCalledTimes(1);
    const toastArg = toastMock.mock.calls[0]?.[0];
    expect(toastArg).toMatchObject({
      title: 'Erreur de recherche',
      description: SANITIZED_MESSAGE,
      variant: 'destructive',
    });
    expect(debugErrorMock).toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.hasSearched).toBe(true);
  });

  it('clearSearch resets state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseSearch(), { wrapper });

    await act(async () => {
      await result.current.search('hello');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.total).toBe(RESPONSE.total);
    expect(result.current.hasSearched).toBe(true);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasSearched).toBe(false);
    expect(result.current.isSearching).toBe(false);
  });
});