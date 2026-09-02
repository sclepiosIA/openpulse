import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailThreads } from './useEmailThreads';
import type { EmailFilters } from './useEmailFilters';

const {
  THREADS,
  ACCOUNT_IDS,
  responses,
  mockFrom,
} = vi.hoisted(() => {
  const THREADS = [
    {
      id: 't1',
      thread_id: 'th-1',
      subject: 'Réservation groupe scolaire',
      participants: ['alice@ok.com'],
      unread_count: 2,
      last_message_date: '2024-05-01T10:00:00Z',
    },
    {
      id: 't2',
      thread_id: 'th-2',
      subject: 'Newsletter promo',
      participants: ['bob@excluded.com'],
      unread_count: 0,
      last_message_date: '2024-04-30T09:00:00Z',
    },
  ];
  const ACCOUNT_IDS = ['acc-1'];
  const responses: Record<string, { data: unknown; error: { message: string } | null }> = {};
  const mockFrom = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    const methods = [
      'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'or',
      'order', 'range', 'limit', 'insert', 'update', 'delete', 'ilike',
    ];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(responses[table]));
    builder.maybeSingle = vi.fn(() => Promise.resolve(responses[table]));
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (r: unknown) => unknown,
    ) => Promise.resolve(responses[table]).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(responses[table]).catch(onRejected);
    return builder;
  });
  return { THREADS, ACCOUNT_IDS, responses, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('../shared/useUserEmailAccountIds', () => ({
  useUserEmailAccountIds: () => ({ accountIds: ACCOUNT_IDS, isLoading: false }),
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: { standard: {} },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: (v: string) => v,
}));

const FILTERS = {} as EmailFilters;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('useEmailThreads', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    responses['email_domain_mappings'] = {
      data: [{ domain: 'excluded.com' }],
      error: null,
    };
    responses['email_threads'] = { data: THREADS, error: null };
  });

  it('charge puis retourne les threads en excluant les domaines exclus', async () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 25, filters: FILTERS }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.threads).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0].id).toBe('t1');
    expect(result.current.threads[0].subject).toBe('Réservation groupe scolaire');
    expect(result.current.total).toBe(1);
    expect(result.current.hasMore).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
  });

  it('ne déclenche pas la requête quand accountIds est vide (enabled=false)', async () => {
    const { result } = renderHook(
      () =>
        useEmailThreads({
          page: 1,
          itemsPerPage: 25,
          filters: FILTERS,
          accountIds: [],
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.threads).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasMore).toBe(false);
    expect(mockFrom).not.toHaveBeenCalledWith('email_threads');
  });

  it('prefetchNextPage déclenche une requête pour la page suivante', async () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 25, filters: FILTERS }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callsBefore = mockFrom.mock.calls.filter(
      (c) => c[0] === 'email_threads',
    ).length;

    await act(async () => {
      result.current.prefetchNextPage();
    });

    await waitFor(() => {
      const callsAfter = mockFrom.mock.calls.filter(
        (c) => c[0] === 'email_threads',
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it('invalidateThreads ne lève pas et retourne les fonctions utilitaires', async () => {
    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 25, filters: FILTERS }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.invalidateThreads).toBe('function');
    expect(typeof result.current.prefetchNextPage).toBe('function');
    expect(() => result.current.invalidateThreads()).not.toThrow();
  });

  it('expose une erreur quand supabase retourne une erreur', async () => {
    responses['email_threads'] = { data: null, error: { message: 'x' } };

    const { result } = renderHook(
      () => useEmailThreads({ page: 1, itemsPerPage: 25, filters: FILTERS }),
      { wrapper: createWrapper() },
    );

    await waitFor(
      () => {
        expect(result.current.error).not.toBeNull();
      },
      { timeout: 9000 },
    );

    expect(result.current.threads).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasMore).toBe(false);
  }, 12000);
});