import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

const createChainableProxy = (resolvedValue: any) => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: any) => resolve(resolvedValue);
      return new Proxy(() => {}, handler);
    },
    apply: () => new Proxy({}, handler),
  };
  return new Proxy({}, handler);
};


// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => createChainableProxy({ data: [], error: null }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

describe('useCalendarSubscriptions', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('useCalendarSubscriptions should return data', async () => {
    const { useCalendarSubscriptions } = await import('@/hooks/calendar/useCalendarSubscriptions');
    const { result } = renderHook(() => useCalendarSubscriptions(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  it('useCreateCalendarSubscription should return a mutation', async () => {
    const { useCreateCalendarSubscription } = await import('@/hooks/calendar/useCalendarSubscriptions');
    const { result } = renderHook(() => useCreateCalendarSubscription(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useDeleteCalendarSubscription should return a mutation', async () => {
    const { useDeleteCalendarSubscription } = await import('@/hooks/calendar/useCalendarSubscriptions');
    const { result } = renderHook(() => useDeleteCalendarSubscription(), { wrapper });

    expect(result.current.mutate).toBeDefined();
  });

  it('useSyncCalendarSubscription should return a mutation', async () => {
    const { useSyncCalendarSubscription } = await import('@/hooks/calendar/useCalendarSubscriptions');
    const { result } = renderHook(() => useSyncCalendarSubscription(), { wrapper });

    expect(result.current.mutate).toBeDefined();
  });

  it('useToggleSubscriptionActive should return a mutation', async () => {
    const { useToggleSubscriptionActive } = await import('@/hooks/calendar/useCalendarSubscriptions');
    const { result } = renderHook(() => useToggleSubscriptionActive(), { wrapper });

    expect(result.current.mutate).toBeDefined();
  });
});
