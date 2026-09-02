// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailCounts } from './useEmailCounts';

const {
  ACCOUNT_IDS_STATE,
  AUTH_STATE,
  debugError,
  mockFrom,
  unreadSuccessResult,
  unprocessedSuccessResult,
  unreadErrorResult,
  unprocessedErrorResult,
  builder,
} = vi.hoisted(() => {
  const ACCOUNT_IDS_STATE: { accountIds: string[]; hasAccounts: boolean } = {
    accountIds: ['acc-1', 'acc-2'],
    hasAccounts: true,
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const debugError = vi.fn();
  const mockFrom = vi.fn();

  const unreadSuccessResult = { data: null, error: null, count: 4 };
  const unprocessedSuccessResult = { data: null, error: null, count: 7 };
  const unreadErrorResult = { data: null, error: { message: 'unread failed' }, count: 0 };
  const unprocessedErrorResult = { data: null, error: { message: 'unprocessed failed' }, count: 0 };

  const state: {
    queue: Array<{ data: null; error: null | { message: string }; count: number }>;
  } = {
    queue: [],
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    or: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(state.queue.shift() ?? unreadSuccessResult)),
    maybeSingle: vi.fn(() => Promise.resolve(state.queue.shift() ?? unreadSuccessResult)),
    then: vi.fn((onFulfilled?: (value: { data: null; error: null | { message: string }; count: number }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.queue.shift() ?? unreadSuccessResult).then(onFulfilled, onRejected),
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.queue.shift() ?? unreadSuccessResult).catch(onRejected),
    ),
    __setQueue(values: Array<{ data: null; error: null | { message: string }; count: number }>) {
      state.queue = [...values];
    },
    __reset() {
      state.queue = [];
      builder.select.mockClear();
      builder.eq.mockClear();
      builder.gt.mockClear();
      builder.gte.mockClear();
      builder.lte.mockClear();
      builder.in.mockClear();
      builder.order.mockClear();
      builder.limit.mockClear();
      builder.insert.mockClear();
      builder.update.mockClear();
      builder.delete.mockClear();
      builder.or.mockClear();
      builder.single.mockClear();
      builder.maybeSingle.mockClear();
      builder.then.mockClear();
      builder.catch.mockClear();
    },
  };

  return {
    ACCOUNT_IDS_STATE,
    AUTH_STATE,
    debugError,
    mockFrom,
    unreadSuccessResult,
    unprocessedSuccessResult,
    unreadErrorResult,
    unprocessedErrorResult,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('../shared/useUserEmailAccountIds', () => ({
  useUserEmailAccountIds: () => ACCOUNT_IDS_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    QueryClientProvider({ client, children });
}

describe('useEmailCounts', () => {
  beforeEach(() => {
    builder.__reset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue(builder);
    debugError.mockReset();
    ACCOUNT_IDS_STATE.accountIds = ['acc-1', 'acc-2'];
    ACCOUNT_IDS_STATE.hasAccounts = true;
  });

  it('retourne les compteurs métier après chargement et construit les requêtes attendues', async () => {
    builder.__setQueue([unreadSuccessResult, unprocessedSuccessResult]);
    const client = createQueryClient();

    const { result } = renderHook(() => useEmailCounts(), {
      wrapper: createWrapper(client),
    });

    expect(result.current).toEqual({ unreadCount: 0, unprocessedCount: 0 });

    await waitFor(() => {
      expect(result.current).toEqual({ unreadCount: 4, unprocessedCount: 7 });
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_threads');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_threads');

    expect(builder.select).toHaveBeenCalledTimes(2);
    expect(builder.select).toHaveBeenNthCalledWith(1, 'id', { count: 'exact', head: true });
    expect(builder.select).toHaveBeenNthCalledWith(2, 'id', { count: 'exact', head: true });

    expect(builder.gt).toHaveBeenCalledTimes(1);
    expect(builder.gt).toHaveBeenCalledWith('unread_count', 0);

    expect(builder.eq).toHaveBeenCalledWith('is_archived', false);
    expect(builder.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(builder.eq).toHaveBeenCalledWith('is_spam', false);

    expect(builder.or).toHaveBeenCalledWith('is_processed.eq.false,is_processed.is.null');

    const cutoffCalls = builder.or.mock.calls
      .map((call) => call[0])
      .filter((value): value is string => typeof value === 'string' && value.startsWith('last_message_date.gte.'));
    expect(cutoffCalls).toHaveLength(2);
    expect(cutoffCalls[0]).toContain(',updated_at.gte.');
    expect(cutoffCalls[1]).toContain(',updated_at.gte.');

    expect(builder.in).toHaveBeenCalledTimes(2);
    expect(builder.in).toHaveBeenNthCalledWith(1, 'user_email_account_id', ['acc-1', 'acc-2']);
    expect(builder.in).toHaveBeenNthCalledWith(2, 'user_email_account_id', ['acc-1', 'acc-2']);
  });

  it('retourne zéro sans interroger supabase quand accountIds est vide', async () => {
    ACCOUNT_IDS_STATE.accountIds = [];
    ACCOUNT_IDS_STATE.hasAccounts = true;
    const client = createQueryClient();

    const { result } = renderHook(() => useEmailCounts(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current).toEqual({ unreadCount: 0, unprocessedCount: 0 });
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retourne zéro sans lancer la query quand hasAccounts est false', async () => {
    ACCOUNT_IDS_STATE.accountIds = ['acc-1'];
    ACCOUNT_IDS_STATE.hasAccounts = false;
    const client = createQueryClient();

    const { result } = renderHook(() => useEmailCounts(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current).toEqual({ unreadCount: 0, unprocessedCount: 0 });
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('log les erreurs et retourne des compteurs à zéro quand supabase renvoie des erreurs', async () => {
    builder.__setQueue([unreadErrorResult, unprocessedErrorResult]);
    const client = createQueryClient();

    const { result } = renderHook(() => useEmailCounts(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current).toEqual({ unreadCount: 0, unprocessedCount: 0 });
    });

    expect(debugError).toHaveBeenCalledTimes(2);
    expect(debugError).toHaveBeenNthCalledWith(1, '[useEmailCounts] Unread error:', { message: 'unread failed' });
    expect(debugError).toHaveBeenNthCalledWith(2, '[useEmailCounts] Unprocessed error:', { message: 'unprocessed failed' });
  });

  it('invalide la query email-counts après un événement realtime avec debounce de 3 secondes', async () => {
    vi.useFakeTimers();
    builder.__setQueue([unreadSuccessResult, unprocessedSuccessResult]);
    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    renderHook(() => useEmailCounts(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      window.dispatchEvent(new Event('email-realtime-update'));
      window.dispatchEvent(new Event('email-realtime-update'));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-counts'] });

    vi.useRealTimers();
  });
});