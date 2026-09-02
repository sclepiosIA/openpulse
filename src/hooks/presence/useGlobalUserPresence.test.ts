import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGlobalUserPresence } from './useGlobalUserPresence';

const {
  PRESENCE_ROWS,
  queryState,
  intervalState,
  realtimeState,
  mockFrom,
  mockChannel,
  mockRemoveChannel,
  CURRENT_PROFILE,
} = vi.hoisted(() => {
  const PRESENCE_ROWS = [
    {
      user_id: 'u2',
      status: 'active',
      last_seen_at: '2024-01-01T10:00:00.000Z',
      custom_status: 'En réunion',
      custom_status_emoji: '📅',
      calendar_event_id: null,
    },
    {
      user_id: 'u3',
      status: 'busy',
      last_seen_at: '2024-01-01T10:01:00.000Z',
      custom_status: null,
      custom_status_emoji: null,
      calendar_event_id: 'ev-1',
    },
  ];

  const queryState: { result: { data: unknown; error: unknown } } = {
    result: { data: PRESENCE_ROWS, error: null },
  };

  const intervalState: {
    cb: (() => void | Promise<void>) | null;
    intervalMs: number | null;
    opts: { runImmediately?: boolean; enabled?: boolean } | null;
  } = { cb: null, intervalMs: null, opts: null };

  const realtimeState: {
    handler: ((payload: Record<string, unknown>) => void) | null;
  } = { handler: null };

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
    ];
    chainMethods.forEach((m) => {
      builder[m] = vi.fn(() => builder);
    });
    builder.single = vi.fn(() => Promise.resolve(queryState.result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(queryState.result));
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(queryState.result).then(resolve, reject);
    builder.catch = (reject: (e: unknown) => unknown) =>
      Promise.resolve(queryState.result).catch(reject);
    return builder;
  };

  const channelObj: Record<string, unknown> = {};
  channelObj.on = vi.fn(
    (
      _event: string,
      _filter: Record<string, unknown>,
      cb: (payload: Record<string, unknown>) => void
    ) => {
      realtimeState.handler = cb;
      return channelObj;
    }
  );
  channelObj.subscribe = vi.fn(() => channelObj);

  const mockFrom = vi.fn(() => makeBuilder());
  const mockChannel = vi.fn(() => channelObj);
  const mockRemoveChannel = vi.fn();

  const CURRENT_PROFILE = { data: { id: 'u1', email: 'me@test.co' } };

  return {
    PRESENCE_ROWS,
    queryState,
    intervalState,
    realtimeState,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    CURRENT_PROFILE,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => CURRENT_PROFILE,
}));

vi.mock('@/hooks/ui/useVisibilityAwareInterval', () => ({
  useVisibilityAwareInterval: (
    cb: () => void,
    intervalMs: number,
    opts: { runImmediately?: boolean; enabled?: boolean }
  ) => {
    intervalState.cb = cb;
    intervalState.intervalMs = intervalMs;
    intervalState.opts = opts;
  },
}));

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

describe('useGlobalUserPresence', () => {
  beforeEach(() => {
    queryState.result = { data: PRESENCE_ROWS, error: null };
    intervalState.cb = null;
    intervalState.intervalMs = null;
    intervalState.opts = null;
    realtimeState.handler = null;
    mockFrom.mockClear();
    mockChannel.mockClear();
    mockRemoveChannel.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('démarre avec aucun utilisateur en ligne et configure le polling à 30s', () => {
    const { result } = renderHook(() => useGlobalUserPresence(), {
      wrapper: createWrapper(),
    });

    expect(result.current.onlineUserIds.size).toBe(0);
    expect(result.current.isUserOnline('u2')).toBe(false);
    expect(result.current.getUserStatus('u2')).toBeUndefined();
    expect(intervalState.intervalMs).toBe(30000);
    expect(intervalState.opts).toEqual({ runImmediately: true, enabled: true });
    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^global-presence-tracking-u1-/));
  });

  it('charge les utilisateurs actifs via pulse_presence et expose leurs statuts', async () => {
    const { result } = renderHook(() => useGlobalUserPresence(), {
      wrapper: createWrapper(),
    });

    expect(intervalState.cb).toBeTypeOf('function');

    await act(async () => {
      await intervalState.cb?.();
    });

    await waitFor(() => {
      expect(result.current.onlineUserIds.size).toBe(2);
    });

    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(result.current.isUserOnline('u2')).toBe(true);
    expect(result.current.isUserOnline('u3')).toBe(true);
    expect(result.current.isUserOnline('u1')).toBe(false);

    const statusU2 = result.current.getUserStatus('u2');
    expect(statusU2?.status).toBe('active');
    expect(statusU2?.custom_status).toBe('En réunion');
    expect(statusU2?.custom_status_emoji).toBe('📅');

    const statusU3 = result.current.getUserStatus('u3');
    expect(statusU3?.status).toBe('busy');
    expect(statusU3?.calendar_event_id).toBe('ev-1');
  });

  it("n'altère pas l'état quand la requête échoue", async () => {
    queryState.result = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useGlobalUserPresence(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await intervalState.cb?.();
    });

    expect(result.current.onlineUserIds.size).toBe(0);
    expect(result.current.userStatuses.size).toBe(0);
    expect(result.current.isUserOnline('u2')).toBe(false);
  });

  it("applique les INSERT realtime après debounce et ignore les DELETE d'utilisateurs absents", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useGlobalUserPresence(), {
      wrapper: createWrapper(),
    });

    expect(realtimeState.handler).toBeTypeOf('function');

    const newPresence = {
      user_id: 'u9',
      status: 'active',
      last_seen_at: '2024-01-01T11:00:00.000Z',
      custom_status: null,
      custom_status_emoji: null,
      calendar_event_id: null,
    };

    await act(async () => {
      realtimeState.handler?.({
        eventType: 'INSERT',
        new: newPresence,
        old: null,
      });
    });

    // Pas encore appliqué avant la fin du debounce de 500ms
    expect(result.current.isUserOnline('u9')).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isUserOnline('u9')).toBe(true);
    expect(result.current.onlineUserIds.has('u9')).toBe(true);

    // DELETE d'un utilisateur jamais en ligne : pas d'erreur, ne perturbe pas u9
    await act(async () => {
      realtimeState.handler?.({
        eventType: 'DELETE',
        new: null,
        old: {
          user_id: 'ghost-user',
          status: 'active',
          last_seen_at: '2024-01-01T11:00:00.000Z',
        },
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isUserOnline('ghost-user')).toBe(false);
    expect(result.current.isUserOnline('u9')).toBe(true);
  });

  it("ignore les mises à jour realtime concernant l'utilisateur courant", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useGlobalUserPresence(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      realtimeState.handler?.({
        eventType: 'UPDATE',
        new: {
          user_id: 'u1',
          status: 'active',
          last_seen_at: '2024-01-01T11:00:00.000Z',
        },
        old: null,
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isUserOnline('u1')).toBe(false);
    expect(result.current.onlineUserIds.size).toBe(0);
  });

  it('nettoie le channel realtime au démontage', () => {
    const { unmount } = renderHook(() => useGlobalUserPresence(), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});