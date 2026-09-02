import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => {
  type QueryResult = {
    data: null;
    count: number | null;
    error: { message: string } | null;
  };

  type AuthUser = {
    id: string;
    email: string;
  };

  type AuthState = {
    user: AuthUser | null;
    session: { user: AuthUser } | null;
    isLoading: boolean;
  };

  type RealtimePayload = {
    new?: { guest_name?: string; status?: string } | null;
  };

  type RealtimeHandler = (payload: RealtimePayload) => void;

  type ChainableBuilder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    gt: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    throwOnError: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    catch: ReturnType<typeof vi.fn>;
  };

  type RealtimeChannel = {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const AUTH_USER: AuthUser = { id: 'u1', email: 't@t.co' };
  const AUTH_STATE: AuthState = {
    user: AUTH_USER,
    session: { user: AUTH_USER },
    isLoading: false,
  };
  const NO_AUTH_STATE: AuthState = {
    user: null,
    session: null,
    isLoading: false,
  };

  const SUCCESS_RESULT: QueryResult = { data: null, count: 7, error: null };
  const SECOND_SUCCESS_RESULT: QueryResult = { data: null, count: 2, error: null };
  const ERROR_OBJECT = { message: 'x' };
  const ERROR_RESULT: QueryResult = { data: null, count: null, error: ERROR_OBJECT };

  const STANDARD_PRESET = { staleTime: 0 };
  const QUERY_PRESETS = { standard: STANDARD_PRESET };

  let authState: AuthState = AUTH_STATE;
  let queryResult: QueryResult = SUCCESS_RESULT;
  let builder: ChainableBuilder = {} as ChainableBuilder;
  let realtimeChannel: RealtimeChannel = {} as RealtimeChannel;

  const insertHandlers: RealtimeHandler[] = [];
  const updateHandlers: RealtimeHandler[] = [];

  const isRealtimeConfig = (value: unknown): value is { event: string } => {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    return typeof record.event === 'string';
  };

  const setAuthUser = (user: AuthUser | null) => {
    authState = user === null ? NO_AUTH_STATE : AUTH_STATE;
  };

  const setQueryResult = (result: QueryResult) => {
    queryResult = result;
  };

  const resetRealtime = () => {
    insertHandlers.splice(0, insertHandlers.length);
    updateHandlers.splice(0, updateHandlers.length);
  };

  const mockUseAuth = vi.fn(() => authState);
  const mockDebugError = vi.fn();
  const mockToastInfo = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockGetQueryPreset = vi.fn((_preset: string) => STANDARD_PRESET);

  const mockFrom = vi.fn((_table: string) => builder);
  const mockChannel = vi.fn((_name: string) => realtimeChannel);
  const mockRemoveChannel = vi.fn((_channel: RealtimeChannel) => undefined);

  builder = {
    select: vi.fn((_columns?: string, _options?: Record<string, unknown>) => builder),
    eq: vi.fn((_column: string, _value: unknown) => builder),
    gte: vi.fn((_column: string, _value: unknown) => builder),
    lte: vi.fn((_column: string, _value: unknown) => builder),
    gt: vi.fn((_column: string, _value: unknown) => builder),
    lt: vi.fn((_column: string, _value: unknown) => builder),
    neq: vi.fn((_column: string, _value: unknown) => builder),
    is: vi.fn((_column: string, _value: unknown) => builder),
    in: vi.fn((_column: string, _values: readonly unknown[]) => builder),
    order: vi.fn((_column: string, _options?: Record<string, unknown>) => builder),
    limit: vi.fn((_count: number) => builder),
    range: vi.fn((_from: number, _to: number) => builder),
    insert: vi.fn((_values: unknown) => builder),
    update: vi.fn((_values: unknown) => builder),
    upsert: vi.fn((_values: unknown) => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(queryResult)),
    maybeSingle: vi.fn(() => Promise.resolve(queryResult)),
    throwOnError: vi.fn(() => builder),
    then: vi.fn(
      (
        onFulfilled?: ((value: QueryResult) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) =>
        Promise.resolve(queryResult).then(
          (value) => (typeof onFulfilled === 'function' ? onFulfilled(value) : value),
          (reason) => (typeof onRejected === 'function' ? onRejected(reason) : Promise.reject(reason)),
        ),
    ),
    catch: vi.fn((onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(queryResult).catch((reason) =>
        typeof onRejected === 'function' ? onRejected(reason) : Promise.reject(reason),
      ),
    ),
  };

  realtimeChannel = {
    on: vi.fn((_eventType: string, config: unknown, callback: RealtimeHandler) => {
      if (isRealtimeConfig(config) && config.event === 'INSERT') {
        insertHandlers.push(callback);
      }
      if (isRealtimeConfig(config) && config.event === 'UPDATE') {
        updateHandlers.push(callback);
      }
      return realtimeChannel;
    }),
    subscribe: vi.fn(() => realtimeChannel),
  };

  return {
    AUTH_USER,
    SUCCESS_RESULT,
    SECOND_SUCCESS_RESULT,
    ERROR_RESULT,
    ERROR_OBJECT,
    QUERY_PRESETS,
    builder,
    realtimeChannel,
    insertHandlers,
    updateHandlers,
    mockUseAuth,
    mockDebugError,
    mockToastInfo,
    mockToastSuccess,
    mockToastError,
    mockGetQueryPreset,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    setAuthUser,
    setQueryResult,
    resetRealtime,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.mockFrom,
    channel: mocks.mockChannel,
    removeChannel: mocks.mockRemoveChannel,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mocks.mockUseAuth,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: mocks.QUERY_PRESETS,
  getQueryPreset: mocks.mockGetQueryPreset,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mocks.mockDebugError,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: mocks.mockToastInfo,
    success: mocks.mockToastSuccess,
    error: mocks.mockToastError,
  },
}));

import { usePendingBookingsCount } from './usePendingBookingsCount';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('usePendingBookingsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetRealtime();
    mocks.setAuthUser(mocks.AUTH_USER);
    mocks.setQueryResult(mocks.SUCCESS_RESULT);
  });

  it('retourne 0 au chargement puis le nombre réel de RDV pending à venir pour l’hôte courant', async () => {
    const { result, unmount } = renderHook(() => usePendingBookingsCount(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(7);
    });

    expect(mocks.mockFrom).toHaveBeenCalledWith('bookings');
    expect(mocks.builder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(mocks.builder.eq).toHaveBeenCalledWith('host_user_id', 'u1');
    expect(mocks.builder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(mocks.builder.gte).toHaveBeenCalledWith(
      'start_time',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    );

    expect(mocks.mockChannel).toHaveBeenCalledWith(
      expect.stringMatching(/^pending-bookings-badge-u1-[a-z0-9]+-\d+-[a-z0-9]+$/),
    );
    expect(mocks.realtimeChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'bookings', filter: 'host_user_id=eq.u1' },
      expect.any(Function),
    );
    expect(mocks.realtimeChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'bookings', filter: 'host_user_id=eq.u1' },
      expect.any(Function),
    );
    expect(mocks.realtimeChannel.subscribe).toHaveBeenCalledTimes(1);

    unmount();

    expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(mocks.realtimeChannel);
  });

  it('invalide la requête et affiche un toast lors d’un INSERT pending realtime', async () => {
    const { result, unmount } = renderHook(() => usePendingBookingsCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBe(7);
    });
    await waitFor(() => {
      expect(mocks.insertHandlers.length).toBe(1);
    });

    mocks.setQueryResult(mocks.SECOND_SUCCESS_RESULT);

    const handler = mocks.insertHandlers.at(0);
    expect(handler).toBeTypeOf('function');
    if (typeof handler !== 'function') {
      throw new Error('insert handler missing');
    }

    await act(async () => {
      handler({ new: { guest_name: 'Ada', status: 'pending' } });
    });

    expect(mocks.mockToastInfo).toHaveBeenCalledWith('Nouveau RDV à confirmer', {
      description: 'Ada',
    });

    await waitFor(() => {
      expect(result.current).toBe(2);
    });

    expect(mocks.mockFrom).toHaveBeenCalledWith('bookings');

    unmount();
  });

  it('invalide la requête sans toast lors d’un UPDATE realtime', async () => {
    const { result, unmount } = renderHook(() => usePendingBookingsCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBe(7);
    });
    await waitFor(() => {
      expect(mocks.updateHandlers.length).toBe(1);
    });

    mocks.setQueryResult(mocks.SECOND_SUCCESS_RESULT);

    const handler = mocks.updateHandlers.at(0);
    expect(handler).toBeTypeOf('function');
    if (typeof handler !== 'function') {
      throw new Error('update handler missing');
    }

    await act(async () => {
      handler({ new: { guest_name: 'Ada', status: 'confirmed' } });
    });

    expect(mocks.mockToastInfo).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current).toBe(2);
    });

    unmount();
  });

  it('retourne 0 et journalise l’erreur Supabase quand la requête count échoue', async () => {
    mocks.setQueryResult(mocks.ERROR_RESULT);

    const { result, unmount } = renderHook(() => usePendingBookingsCount(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(mocks.mockDebugError).toHaveBeenCalledWith('[usePendingBookingsCount]', mocks.ERROR_OBJECT);
    });

    expect(result.current).toBe(0);
    expect(mocks.mockFrom).toHaveBeenCalledWith('bookings');
    expect(mocks.builder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });

    unmount();
  });

  it('ne lance aucune requête Supabase et ne souscrit pas au realtime sans utilisateur authentifié', async () => {
    mocks.setAuthUser(null);

    const { result, unmount } = renderHook(() => usePendingBookingsCount(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(mocks.mockUseAuth).toHaveBeenCalled();
    });

    expect(mocks.mockFrom).not.toHaveBeenCalled();
    expect(mocks.mockChannel).not.toHaveBeenCalled();
    expect(mocks.realtimeChannel.subscribe).not.toHaveBeenCalled();

    unmount();

    expect(mocks.mockRemoveChannel).not.toHaveBeenCalled();
  });
});