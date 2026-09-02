/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGlobalPresenceHeartbeat } from './useGlobalPresenceHeartbeat';

const {
  PROFILE,
  SESSION_RESULT,
  AUTH_SUBSCRIPTION,
  CURRENT_PROFILE_RESULT,
  maybeSingleResult,
  upsertResult,
  mockUseCurrentProfile,
  mockUseVisibilityAwareInterval,
  mockFrom,
  mockSelect,
  mockEq,
  mockIs,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockUpsert,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  mockGetSession,
  mockOnAuthStateChange,
  fetchMock,
} = vi.hoisted(() => {
  const PROFILE = { id: 'user-1' };
  const CURRENT_PROFILE_RESULT = { data: PROFILE };
  const SESSION_RESULT = {
    data: {
      session: {
        access_token: 'tok-1',
        user: { id: 'user-1' },
      },
    },
  };
  const AUTH_SUBSCRIPTION = { unsubscribe: vi.fn() };

  const maybeSingleResult: { data: { status: string } | null; error: { message: string } | null } = {
    data: { status: 'active' },
    error: null,
  };
  const upsertResult: { data: null; error: { message: string } | null } = {
    data: null,
    error: null,
  };

  const mockUseCurrentProfile = vi.fn(() => CURRENT_PROFILE_RESULT);
  const mockUseVisibilityAwareInterval = vi.fn();

  type Builder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>;
    catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>;
  };

  const builder = {} as Builder;

  const mockSelect = vi.fn(() => builder);
  const mockEq = vi.fn(() => builder);
  const mockIs = vi.fn(() => builder);
  const mockGte = vi.fn(() => builder);
  const mockLte = vi.fn(() => builder);
  const mockIn = vi.fn(() => builder);
  const mockOrder = vi.fn(() => builder);
  const mockLimit = vi.fn(() => builder);
  const mockInsert = vi.fn(() => builder);
  const mockUpdate = vi.fn(() => builder);
  const mockDelete = vi.fn(() => builder);
  const mockUpsert = vi.fn(async () => upsertResult);
  const mockSingle = vi.fn(async () => ({ data: null, error: null }));
  const mockMaybeSingle = vi.fn(async () => maybeSingleResult);
  const mockThen = vi.fn((onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled ?? undefined, onRejected ?? undefined)
  );
  const mockCatch = vi.fn((onRejected?: ((reason: unknown) => unknown) | null) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected ?? undefined)
  );
  const mockFrom = vi.fn(() => builder);

  builder.select = mockSelect;
  builder.eq = mockEq;
  builder.is = mockIs;
  builder.gte = mockGte;
  builder.lte = mockLte;
  builder.in = mockIn;
  builder.order = mockOrder;
  builder.limit = mockLimit;
  builder.insert = mockInsert;
  builder.update = mockUpdate;
  builder.delete = mockDelete;
  builder.upsert = mockUpsert;
  builder.single = mockSingle;
  builder.maybeSingle = mockMaybeSingle;
  builder.then = mockThen;
  builder.catch = mockCatch;

  const mockGetSession = vi.fn(async () => SESSION_RESULT);
  const mockOnAuthStateChange = vi.fn(() => ({
    data: { subscription: AUTH_SUBSCRIPTION },
  }));

  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

  return {
    PROFILE,
    SESSION_RESULT,
    AUTH_SUBSCRIPTION,
    CURRENT_PROFILE_RESULT,
    maybeSingleResult,
    upsertResult,
    mockUseCurrentProfile,
    mockUseVisibilityAwareInterval,
    mockFrom,
    mockSelect,
    mockEq,
    mockIs,
    mockGte,
    mockLte,
    mockIn,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockUpsert,
    mockSingle,
    mockMaybeSingle,
    mockThen,
    mockCatch,
    mockGetSession,
    mockOnAuthStateChange,
    fetchMock,
  };
});

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/hooks/ui/useVisibilityAwareInterval', () => ({
  useVisibilityAwareInterval: mockUseVisibilityAwareInterval,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

describe('useGlobalPresenceHeartbeat', () => {
  function createWrapper(): React.ComponentType<{ children: React.ReactNode }> {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentProfile.mockReturnValue(CURRENT_PROFILE_RESULT);
    mockUseVisibilityAwareInterval.mockImplementation(() => {});
    maybeSingleResult.data = { status: 'active' };
    maybeSingleResult.error = null;
    upsertResult.error = null;
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  it('charge le statut courant au mount et configure le heartbeat avec le bon intervalle', async () => {
    const wrapper = createWrapper();

    renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');
    expect(mockSelect).toHaveBeenCalledWith('status');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockIs).toHaveBeenCalledWith('conversation_id', null);

    expect(mockUseVisibilityAwareInterval).toHaveBeenCalledTimes(1);
    expect(mockUseVisibilityAwareInterval).toHaveBeenCalledWith(
      expect.any(Function),
      60000,
      { runImmediately: true, enabled: true }
    );

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('le heartbeat upsert active avec le vrai user_id et conversation_id null', async () => {
    const wrapper = createWrapper();
    let capturedHeartbeat: (() => Promise<void>) | undefined;

    mockUseVisibilityAwareInterval.mockImplementation((callback: () => Promise<void>) => {
      capturedHeartbeat = callback;
    });

    renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(capturedHeartbeat).toBeTypeOf('function');
    });

    await act(async () => {
      if (capturedHeartbeat) {
        await capturedHeartbeat();
      }
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          conversation_id: null,
          status: 'active',
          last_seen_at: expect.any(String),
        }),
        { onConflict: 'user_id,conversation_id', ignoreDuplicates: false }
      );
    });
  });

  it('n écrase pas un statut custom et met seulement à jour last_seen_at pendant le heartbeat', async () => {
    const wrapper = createWrapper();
    let capturedHeartbeat: (() => Promise<void>) | undefined;
    maybeSingleResult.data = { status: 'dnd' };

    mockUseVisibilityAwareInterval.mockImplementation((callback: () => Promise<void>) => {
      capturedHeartbeat = callback;
    });

    renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      if (capturedHeartbeat) {
        await capturedHeartbeat();
      }
    });

    const lastCall = mockUpsert.mock.calls[mockUpsert.mock.calls.length - 1] as [
      { user_id: string; conversation_id: null; last_seen_at: string; status?: string },
      { onConflict: string; ignoreDuplicates: boolean },
    ];

    expect(lastCall[0].user_id).toBe('user-1');
    expect(lastCall[0].conversation_id).toBe(null);
    expect(typeof lastCall[0].last_seen_at).toBe('string');
    expect('status' in lastCall[0]).toBe(false);
    expect(lastCall[1]).toEqual({
      onConflict: 'user_id,conversation_id',
      ignoreDuplicates: false,
    });
  });

  it('passe en away quand le document devient hidden', async () => {
    const wrapper = createWrapper();

    renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          conversation_id: null,
          status: 'away',
          last_seen_at: expect.any(String),
        }),
        { onConflict: 'user_id,conversation_id', ignoreDuplicates: false }
      );
    });
  });

  it('au beforeunload envoie un PATCH keepalive authentifié pour offline', async () => {
    const wrapper = createWrapper();

    renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      {
        method: string;
        headers: Record<string, string>;
        body: string;
        keepalive: boolean;
      },
    ];

    expect(url).toContain('/rest/v1/pulse_presence?user_id=eq.user-1&conversation_id=is.null');
    expect(options.method).toBe('PATCH');
    expect(options.keepalive).toBe(true);
    expect(options.headers.Authorization).toBe('Bearer tok-1');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Prefer).toBe('return=minimal');
    expect(JSON.parse(options.body)).toEqual({
      status: 'offline',
      last_seen_at: expect.any(String),
    });
  });

  it('au unmount unsubscribe auth et marque offline via upsert', async () => {
    const wrapper = createWrapper();

    const { unmount } = renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      unmount();
    });

    expect(AUTH_SUBSCRIPTION.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        conversation_id: null,
        status: 'offline',
        last_seen_at: expect.any(String),
      }),
      { onConflict: 'user_id,conversation_id', ignoreDuplicates: false }
    );
  });

  it('si la lecture initiale échoue, le hook reste montable et le heartbeat est quand même configuré', async () => {
    const wrapper = createWrapper();
    maybeSingleResult.data = null;
    maybeSingleResult.error = { message: 'x' };

    renderHook(() => useGlobalPresenceHeartbeat(), { wrapper });

    await waitFor(() => {
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    expect(mockUseVisibilityAwareInterval).toHaveBeenCalledWith(
      expect.any(Function),
      60000,
      { runImmediately: true, enabled: true }
    );
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });
});