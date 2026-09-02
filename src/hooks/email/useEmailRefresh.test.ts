/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailRefresh } from './useEmailRefresh';

const {
  mockFrom,
  mockDebugLog,
  mockGetItem,
  stableAuth,
} = vi.hoisted(() => {
  const thenableResult = { data: null, error: null };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => thenableResult),
    maybeSingle: vi.fn(async () => thenableResult),
    then: (onFulfilled: (value: typeof thenableResult) => unknown) =>
      Promise.resolve(thenableResult).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(thenableResult).catch(onRejected),
  };

  return {
    mockFrom: vi.fn(() => builder),
    mockDebugLog: vi.fn(),
    mockGetItem: vi.fn(() => null),
    stableAuth: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockDebugLog,
  },
}));

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    getItem: mockGetItem,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuth,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEmailRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItem.mockReturnValue(null);
  });

  it('exposes triggerRefresh and performs incremental refresh after throttle window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const fetchThreads = vi.fn(async (_reset: boolean | 'incremental') => {});
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailRefresh(fetchThreads), { wrapper });

    expect(typeof result.current.triggerRefresh).toBe('function');

    vi.setSystemTime(new Date('2024-01-01T00:00:11.000Z'));

    await act(async () => {
      await result.current.triggerRefresh('poll');
    });

    expect(mockGetItem).toHaveBeenCalledWith('email-compose-dirty');
    expect(fetchThreads).toHaveBeenCalledTimes(1);
    expect(fetchThreads).toHaveBeenCalledWith('incremental');
    expect(mockDebugLog).toHaveBeenCalledWith('🔄 Triggering incremental refresh from poll');

    vi.useRealTimers();
  });

  it('blocks automatic refresh when composition is in progress', async () => {
    const fetchThreads = vi.fn(async (_reset: boolean | 'incremental') => {});
    const wrapper = createWrapper();
    mockGetItem.mockReturnValue('1');

    const { result } = renderHook(() => useEmailRefresh(fetchThreads), { wrapper });

    await act(async () => {
      await result.current.triggerRefresh('poll');
    });

    expect(mockGetItem).toHaveBeenCalledWith('email-compose-dirty');
    expect(fetchThreads).not.toHaveBeenCalled();
    expect(mockDebugLog).toHaveBeenCalledWith('✋ Blocking refresh from poll (composition in progress)');
  });

  it('throttles automatic refreshes within 10 seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const fetchThreads = vi.fn(async (_reset: boolean | 'incremental') => {});
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailRefresh(fetchThreads), { wrapper });

    await act(async () => {
      await result.current.triggerRefresh('poll');
    });

    expect(mockGetItem).toHaveBeenCalledWith('email-compose-dirty');
    expect(fetchThreads).not.toHaveBeenCalled();
    expect(mockDebugLog).toHaveBeenCalledWith('⏭️ Skipping refresh from poll (throttled)');

    vi.useRealTimers();
  });

  it('allows manual refresh even during composition and uses incremental mode', async () => {
    const fetchThreads = vi.fn(async (_reset: boolean | 'incremental') => {});
    const wrapper = createWrapper();
    mockGetItem.mockReturnValue('1');

    const { result } = renderHook(() => useEmailRefresh(fetchThreads), { wrapper });

    await act(async () => {
      await result.current.triggerRefresh('manual');
    });

    expect(fetchThreads).toHaveBeenCalledTimes(1);
    expect(fetchThreads).toHaveBeenCalledWith('incremental');
    expect(mockDebugLog).toHaveBeenCalledWith('🔄 Triggering full refresh from manual');
  });

  it('uses full reset for manual-full refresh', async () => {
    const fetchThreads = vi.fn(async (_reset: boolean | 'incremental') => {});
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailRefresh(fetchThreads), { wrapper });

    await act(async () => {
      await result.current.triggerRefresh('manual-full');
    });

    expect(fetchThreads).toHaveBeenCalledTimes(1);
    expect(fetchThreads).toHaveBeenCalledWith(true);
    expect(mockDebugLog).toHaveBeenCalledWith('🔄 Triggering full refresh from manual-full');
  });

  it('surfaces fetch errors to the caller', async () => {
    const fetchThreads = vi.fn(async (_reset: boolean | 'incremental') => {
      throw new Error('x');
    });
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailRefresh(fetchThreads), { wrapper });

    let caught: Error | null = null;

    await act(async () => {
      try {
        await result.current.triggerRefresh('manual-full');
      } catch (error) {
        if (error instanceof Error) {
          caught = error;
        }
      }
    });

    expect(fetchThreads).toHaveBeenCalledTimes(1);
    expect(fetchThreads).toHaveBeenCalledWith(true);
    expect(caught).toBeInstanceOf(Error);
    expect(caught?.message).toBe('x');
  });
});