/// <reference types="vitest" />
import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const { LOG_ROW, builderState, mockFrom } = vi.hoisted(() => {
  const LOG_ROW = {
    id: 'log1',
    status: 'success',
    execution_start: '2025-01-01T10:00:00Z',
    execution_end: '2025-01-01T10:05:00Z',
    emails_fetched: 12,
  };

  type BuilderState = {
    data: unknown;
    error: { message: string } | null;
  };

  const builderState: BuilderState = {
    data: LOG_ROW,
    error: null,
  };

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};

    const chain = () => builder;

    const methods = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'contains',
      'overlaps',
      'is',
      'like',
      'ilike',
      'order',
      'limit',
      'range',
      'insert',
      'upsert',
      'update',
      'delete',
      'match',
    ] as const;

    for (const m of methods) builder[m] = vi.fn(chain);

    const resolveResult = () => Promise.resolve({ data: builderState.data, error: builderState.error });

    builder.single = vi.fn(resolveResult);
    builder.maybeSingle = vi.fn(resolveResult);

    builder.then = (
      onFulfilled?: ((v: unknown) => unknown) | null,
      onRejected?: ((e: unknown) => unknown) | null
    ) =>
      resolveResult().then(
        onFulfilled as ((v: unknown) => unknown) | undefined,
        onRejected as ((e: unknown) => unknown) | undefined
      );
    builder.catch = (onRejected?: ((e: unknown) => unknown) | null) =>
      resolveResult().catch(onRejected as ((e: unknown) => unknown) | undefined);

    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  return { LOG_ROW, builderState, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { Wrapper, queryClient };
}

describe('emailSyncStatus.ts', () => {
  it('fetchRecentEmailSyncLog: succès -> retourne le log récent et construit la requête attendue', async () => {
    builderState.data = LOG_ROW;
    builderState.error = null;

    const { fetchRecentEmailSyncLog } = await import('./emailSyncStatus');

    const value = await fetchRecentEmailSyncLog();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('email_sync_logs');

    const builder = mockFrom.mock.results[0]?.value as unknown as {
      select: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };

    expect(builder.select).toHaveBeenCalledWith('id, status, execution_start, execution_end, emails_fetched');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);

    expect(value).toEqual(LOG_ROW);
  });

  it('fetchRecentEmailSyncLog: error supabase -> retourne null', async () => {
    builderState.data = null;
    builderState.error = { message: 'x' };

    const { fetchRecentEmailSyncLog } = await import('./emailSyncStatus');

    const value = await fetchRecentEmailSyncLog();

    expect(mockFrom).toHaveBeenCalledWith('email_sync_logs');
    expect(value).toBeNull();
  });

  it('fetchRecentEmailSyncLog: data null sans error -> retourne null', async () => {
    builderState.data = null;
    builderState.error = null;

    const { fetchRecentEmailSyncLog } = await import('./emailSyncStatus');

    const value = await fetchRecentEmailSyncLog();

    expect(mockFrom).toHaveBeenCalledWith('email_sync_logs');
    expect(value).toBeNull();
  });

  it('react-query: isLoading -> succès (données métier)', async () => {
    builderState.data = LOG_ROW;
    builderState.error = null;

    const { fetchRecentEmailSyncLog } = await import('./emailSyncStatus');
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['recent-email-sync-log'],
          queryFn: fetchRecentEmailSyncLog,
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(LOG_ROW);
    expect(result.current.data?.emails_fetched).toBe(12);
    expect(result.current.data?.status).toBe('success');
  });

  it('react-query: isLoading -> erreur (queryFn rejette) -> isError', async () => {
    builderState.data = null;
    builderState.error = { message: 'x' };

    const { fetchRecentEmailSyncLog } = await import('./emailSyncStatus');
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['recent-email-sync-log-error'],
          queryFn: async () => {
            const v = await fetchRecentEmailSyncLog();
            if (v === null) throw new Error('x');
            return v;
          },
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('x');
  });
});