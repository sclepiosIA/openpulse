import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { STATE, EMAILS, UNREAD_BY_ACCOUNT, onNewEmailSpy, UNSUB, RES, mockFrom } = vi.hoisted(() => {
  const EMAILS = [
    { id: 'em1', accountId: 'a1', subject: 'Subject A', unread: true },
    { id: 'em2', accountId: 'a2', subject: 'Subject B', unread: false },
  ];
  const UNREAD_BY_ACCOUNT = { a1: 3, a2: 0 };
  const STATE = { phase: 'loading' as 'loading' | 'success' | 'error', called: false };
  const onNewEmailSpy = vi.fn();
  const UNSUB = vi.fn();
  const RES = { data: {}, error: null } as const;

  type Builder = {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    gte: (...args: unknown[]) => Builder;
    lte: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    order: (...args: unknown[]) => Builder;
    limit: (...args: unknown[]) => Builder;
    insert: (...args: unknown[]) => Promise<typeof RES>;
    update: (...args: unknown[]) => Promise<typeof RES>;
    delete: (...args: unknown[]) => Promise<typeof RES>;
    single: () => Promise<typeof RES>;
    maybeSingle: () => Promise<typeof RES>;
    then: (
      res: (value: typeof RES) => unknown,
      rej?: (reason: unknown) => unknown
    ) => Promise<unknown>;
    catch: (rej: (reason: unknown) => unknown) => Promise<unknown>;
  };

  const builder: Builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(async () => RES),
    update: vi.fn(async () => RES),
    delete: vi.fn(async () => RES),
    single: vi.fn(async () => RES),
    maybeSingle: vi.fn(async () => RES),
    then: (res, rej) => Promise.resolve(RES).then(res, rej),
    catch: (rej) => Promise.resolve(RES).catch(rej),
  };

  const mockFrom = vi.fn((): Builder => builder);

  return { STATE, EMAILS, UNREAD_BY_ACCOUNT, onNewEmailSpy, UNSUB, RES, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/contexts/RealtimeEmailContext', () => {
  return {
    useRealtimeEmailCompat: (onNewEmail?: () => void) => {
      if (STATE.phase === 'success' && onNewEmail && !STATE.called) {
        STATE.called = true;
        onNewEmail();
      }
      if (STATE.phase === 'loading') {
        return { isLoading: true, isError: false, data: null, error: null, unsubscribe: UNSUB };
      }
      if (STATE.phase === 'error') {
        return { isLoading: false, isError: true, data: null, error: { message: 'x' }, unsubscribe: UNSUB };
      }
      return {
        isLoading: false,
        isError: false,
        data: { emails: EMAILS, unreadByAccount: UNREAD_BY_ACCOUNT },
        error: null,
        unsubscribe: UNSUB,
      };
    },
  };
});

import { useRealtimeEmailNotifications } from './useRealtimeEmailNotifications';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRealtimeEmailNotifications', () => {
  beforeEach(() => {
    STATE.phase = 'loading';
    STATE.called = false;
    onNewEmailSpy.mockReset();
    UNSUB.mockReset();
  });

  it('returns loading state initially', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRealtimeEmailNotifications(onNewEmailSpy), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeNull();
    expect(onNewEmailSpy).not.toHaveBeenCalled();
  });

  it('returns success data and triggers onNewEmail callback on new email', async () => {
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(() => useRealtimeEmailNotifications(onNewEmailSpy), { wrapper });

    await act(async () => {
      STATE.phase = 'success';
      rerender();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).not.toBeNull();
    expect(result.current.data.emails).toEqual(EMAILS);
    expect(result.current.data.unreadByAccount).toEqual(UNREAD_BY_ACCOUNT);
    expect(onNewEmailSpy).toHaveBeenCalledTimes(1);
  });

  it('returns error state when context reports an error', async () => {
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(() => useRealtimeEmailNotifications(onNewEmailSpy), { wrapper });

    await act(async () => {
      STATE.phase = 'error';
      rerender();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe('x');
    expect(onNewEmailSpy).not.toHaveBeenCalled();
  });
});