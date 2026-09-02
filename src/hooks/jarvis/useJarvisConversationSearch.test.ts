import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisConversationSearch } from './useJarvisConversationSearch';

const {
  USER,
  SEARCH_RESULTS,
  ERROR_MESSAGE,
  mockFrom,
  mockRpc,
  setRpcImpl,
  debugError,
  createDeferred,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' };

  const SEARCH_RESULTS = [
    {
      conversation_id: 'c1',
      conversation_title: 'Project Alpha',
      message_content: 'Hello world',
      message_created_at: '2024-01-01T00:00:00Z',
      message_role: 'user' as const,
      relevance_score: 0.9,
    },
    {
      conversation_id: 'c1',
      conversation_title: 'Project Alpha',
      message_content: 'Assistant reply about hello',
      message_created_at: '2024-01-01T00:01:00Z',
      message_role: 'assistant' as const,
      relevance_score: 0.7,
    },
    {
      conversation_id: 'c2',
      conversation_title: 'C++ tips',
      message_content: 'Discussing C++ (pro) patterns',
      message_created_at: '2024-01-02T12:00:00Z',
      message_role: 'assistant' as const,
      relevance_score: 0.8,
    },
  ];

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
    },
    catch: (onRejected?: (reason: unknown) => unknown) => {
      return Promise.resolve({ data: null, error: null }).catch(onRejected as (reason: unknown) => unknown);
    },
  };
  const mockFrom = vi.fn().mockReturnValue(builder);

  let currentRpcImpl: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }> = async () => ({
    data: SEARCH_RESULTS,
    error: null,
  });
  const mockRpc = vi.fn((name: string, args: unknown) => currentRpcImpl(name, args));
  const setRpcImpl = (fn: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>) => {
    currentRpcImpl = fn;
  };

  const createDeferred = <T,>() => {
    let resolve: (v: T) => void;
    let reject: (err: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // @ts-expect-error - resolve/reject are assigned in executor
    return { promise, resolve, reject };
  };

  const debugError = vi.fn();
  const ERROR_MESSAGE = 'search_failed';

  return {
    USER,
    SEARCH_RESULTS,
    ERROR_MESSAGE,
    mockFrom,
    mockRpc,
    setRpcImpl,
    debugError,
    createDeferred,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useJarvisConversationSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRpcImpl(async () => ({ data: SEARCH_RESULTS, error: null }));
  });

  it('does not search when term length is less than 2', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.hasSearched).toBe(false);
    expect(result.current.results).toEqual([]);

    act(() => {
      result.current.setSearchTerm('a');
    });

    expect(result.current.hasSearched).toBe(false);
    expect(result.current.isSearching).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sets isSearching true while fetching and returns results on success', async () => {
    const deferred = createDeferred<{ data: unknown; error: unknown }>();
    setRpcImpl(async () => deferred.promise);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });

    act(() => {
      result.current.setSearchTerm('hello');
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(true);
    });

    const rpcArgs = mockRpc.mock.calls[0];
    expect(rpcArgs[0]).toBe('search_jarvis_conversations');
    expect(rpcArgs[1]).toEqual(
      expect.objectContaining({
        p_user_id: USER.id,
        p_search_term: 'hello',
        p_limit: 20,
        p_offset: 0,
      })
    );

    act(() => {
      deferred.resolve({ data: SEARCH_RESULTS, error: null });
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.hasSearched).toBe(true);
      expect(result.current.results.length).toBe(SEARCH_RESULTS.length);
    });

    expect(result.current.results[0]).toEqual(SEARCH_RESULTS[0]);
  });

  it('handles error response by logging and returning empty results', async () => {
    setRpcImpl(async () => ({ data: null, error: { message: ERROR_MESSAGE } }));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });

    act(() => {
      result.current.setSearchTerm('hello');
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.hasSearched).toBe(true);
      expect(result.current.results).toEqual([]);
    });

    expect(debugError).toHaveBeenCalledWith(
      '[JarvisSearch] Error searching conversations:',
      expect.objectContaining({ message: ERROR_MESSAGE })
    );
  });

  it('clearSearch resets searchTerm and hasSearched', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });

    act(() => {
      result.current.setSearchTerm('hello');
    });

    await waitFor(() => {
      expect(result.current.results.length).toBe(SEARCH_RESULTS.length);
    });

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.hasSearched).toBe(false);
  });

  it('highlightMatch highlights multiple words and escapes regex characters', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch(), { wrapper });

    const parts1 = result.current.highlightMatch('Hello amazing world!', 'hello world');
    const highlighted1 = parts1.filter((p) => p.highlight).map((p) => p.text.toLowerCase());
    expect(highlighted1).toEqual(expect.arrayContaining(['hello', 'world']));

    const parts2 = result.current.highlightMatch('We love C++ (pro) developers', 'c++ (pro)');
    const highlighted2 = parts2.filter((p) => p.highlight).map((p) => p.text);
    expect(highlighted2).toEqual(expect.arrayContaining(['C++', '(pro)']));

    const parts3 = result.current.highlightMatch('Hello', 'h');
    expect(parts3).toEqual([{ text: 'Hello', highlight: false }]);
  });

  it('uses custom limit in RPC payload', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch({ limit: 5 }), { wrapper });

    act(() => {
      result.current.setSearchTerm('hello');
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'search_jarvis_conversations',
        expect.objectContaining({
          p_user_id: USER.id,
          p_search_term: 'hello',
          p_limit: 5,
          p_offset: 0,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.results.length).toBe(SEARCH_RESULTS.length);
    });
  });

  it('does not search when enabled is false even if term is long enough', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisConversationSearch({ enabled: false }), { wrapper });

    act(() => {
      result.current.setSearchTerm('hello');
    });

    expect(result.current.hasSearched).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([]);
  });
});