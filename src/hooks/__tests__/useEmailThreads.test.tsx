import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EmailFilters } from '@/hooks/email/useEmailFilters';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';

const mockFromImpl = vi.fn();


// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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
    from: (table: string) => mockFromImpl(table),
  },
}));

// useEmailThreads transitively pulls in useUserEmailAccountIds -> useCurrentProfile.
// Mock the chain so account IDs are immediately available.
vi.mock('@/hooks/shared/useUserEmailAccountIds', () => ({
  useUserEmailAccountIds: () => ({ accountIds: ['account-1'], isLoading: false }),
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    staleWhileRevalidate: { staleTime: 0 },
  },
}));

import { useEmailThreads } from '@/hooks/email/useEmailThreads';

const defaultFilters: EmailFilters = {
  search: '',
  category: null,
  priority: null,
  unreadOnly: false,
  unprocessedOnly: false,
  dateFrom: null,
  dateTo: null,
  etablissementId: null,
  mailbox: 'inbox',
  groupeId: null,
  partenaireId: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useEmailThreads', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: email_domain_mappings returns empty excluded domains, email_threads returns empty
    mockFromImpl.mockImplementation((table: string) => {
      if (table === 'email_domain_mappings') {
        return createChainableProxy({ data: [], error: null });
      }
      // email_threads
      return createChainableProxy({ data: [], count: 0, error: null });
    });
  });

  it('should return initial structure', async () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    expect(result.current).toHaveProperty('threads');
    expect(result.current).toHaveProperty('total');
    expect(result.current).toHaveProperty('hasMore');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('prefetchNextPage');
    expect(result.current).toHaveProperty('invalidateThreads');
  });

  it('should start with loading state', () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.threads).toEqual([]);
  });

  it('should fetch threads and excluded domains', async () => {
    const mockThreads = [
      { id: '1', subject: 'Thread 1', messages: [] },
      { id: '2', subject: 'Thread 2', messages: [] },
    ];

    mockFromImpl.mockImplementation((table: string) => {
      if (table === 'email_domain_mappings') {
        return createChainableProxy({ data: [], error: null });
      }
      return createChainableProxy({ data: mockThreads, count: 2, error: null });
    });

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Both tables should have been queried
    expect(mockFromImpl).toHaveBeenCalledWith('email_threads');
  });

  it('should apply search filter', async () => {
    const filtersWithSearch: EmailFilters = { ...defaultFilters, search: 'test query' };

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: filtersWithSearch }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should apply category filter', async () => {
    const filtersWithCategory: EmailFilters = { ...defaultFilters, category: 'commercial' };

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: filtersWithCategory }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should apply priority filter', async () => {
    const filtersWithPriority: EmailFilters = { ...defaultFilters, priority: 'high' };

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: filtersWithPriority }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should apply unread filter', async () => {
    const filtersWithUnread: EmailFilters = { ...defaultFilters, unreadOnly: true };

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: filtersWithUnread }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should calculate hasMore correctly', async () => {
    mockFromImpl.mockImplementation((table: string) => {
      if (table === 'email_domain_mappings') {
        return createChainableProxy({ data: [], error: null });
      }
      return createChainableProxy({
        data: Array(20).fill({ id: '1', subject: 'Test', messages: [] }),
        count: 50,
        error: null,
      });
    });

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('should expose the exact query error when fetching threads fails', async () => {
    const queryError = { message: 'email_threads request failed' };

    mockFromImpl.mockImplementation((table: string) => {
      if (table === 'email_domain_mappings') {
        return createChainableProxy({ data: [], error: null });
      }
      return createChainableProxy({ data: null, count: 0, error: queryError });
    });

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    await waitFor(
      () => {
        expect(result.current.error).toBe(queryError);
      },
      { timeout: 9000 }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.threads).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasMore).toBe(false);
    expect(mockFromImpl).toHaveBeenCalledWith('email_threads');
  }, 12000);

  it('should provide prefetchNextPage function', () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    expect(typeof result.current.prefetchNextPage).toBe('function');
  });

  it('should provide invalidateThreads function', () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 20, filters: defaultFilters }),
      { wrapper: createWrapper() }
    );

    expect(typeof result.current.invalidateThreads).toBe('function');
  });
});
