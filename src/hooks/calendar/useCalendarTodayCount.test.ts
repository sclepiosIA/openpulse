import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendarTodayCount } from './useCalendarTodayCount';

const {
  AUTH_STATE,
  QUERY_RESULT,
  mockFrom,
  mockDebugError,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE: {
    user: { id: string; email: string } | null;
    session: { user: { id: string } } | null;
    isLoading: boolean;
  } = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const QUERY_RESULT: {
    count: number | null;
    error: { message: string } | null;
  } = {
    count: 3,
    error: null,
  };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (value: { count: number | null; error: { message: string } | null }) => unknown) => {
    return Promise.resolve(onFulfilled({ count: QUERY_RESULT.count, error: QUERY_RESULT.error }));
  });
  builder.catch.mockImplementation(() => Promise.resolve({ count: QUERY_RESULT.count, error: QUERY_RESULT.error }));

  const mockFrom = vi.fn(() => builder);
  const mockDebugError = vi.fn();

  return {
    AUTH_STATE,
    QUERY_RESULT,
    mockFrom,
    mockDebugError,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
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

describe('useCalendarTodayCount', () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: 'u1', email: 'user@test.local' };
    AUTH_STATE.session = { user: { id: 'u1' } };
    AUTH_STATE.isLoading = false;

    QUERY_RESULT.count = 3;
    QUERY_RESULT.error = null;

    mockFrom.mockClear();
    mockDebugError.mockClear();

    builder.select.mockClear();
    builder.eq.mockClear();
    builder.gte.mockClear();
    builder.lte.mockClear();
    builder.in.mockClear();
    builder.order.mockClear();
    builder.limit.mockClear();
    builder.insert.mockClear();
    builder.update.mockClear();
    builder.delete.mockClear();
    builder.single.mockClear();
    builder.maybeSingle.mockClear();
    builder.then.mockClear();
    builder.catch.mockClear();
  });

  it('retourne 0 au chargement puis le nombre réel d’événements du jour à venir après succès', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useCalendarTodayCount(), { wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(3);
    });

    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    expect(builder.select).toHaveBeenCalledWith(
      'id, calendars!inner(owner_id)',
      { count: 'exact', head: true }
    );
    expect(builder.eq).toHaveBeenCalledWith('calendars.owner_id', 'u1');
    expect(builder.eq).toHaveBeenCalledWith('status', 'confirmed');

    const gteCall = builder.gte.mock.calls.find((call) => call[0] === 'end_time');
    expect(gteCall).toBeDefined();
    expect(typeof gteCall?.[1]).toBe('string');

    const lteCall = builder.lte.mock.calls.find((call) => call[0] === 'start_time');
    expect(lteCall).toBeDefined();
    expect(typeof lteCall?.[1]).toBe('string');

    expect(mockDebugError).not.toHaveBeenCalled();
  });

  it('retourne 0 et ne lance aucune requête quand il n’y a pas d’utilisateur authentifié', async () => {
    AUTH_STATE.user = null;
    AUTH_STATE.session = null;

    const wrapper = createWrapper();

    const { result } = renderHook(() => useCalendarTodayCount(), { wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(0);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(builder.select).not.toHaveBeenCalled();
  });

  it('retourne 0 et loggue l’erreur quand la requête Supabase échoue', async () => {
    QUERY_RESULT.count = null;
    QUERY_RESULT.error = { message: 'x' };

    const wrapper = createWrapper();

    const { result } = renderHook(() => useCalendarTodayCount(), { wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    });

    await waitFor(() => {
      expect(result.current).toBe(0);
    });

    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith(
      '[CalendarTodayCount] Error:',
      { message: 'x' }
    );
  });
});