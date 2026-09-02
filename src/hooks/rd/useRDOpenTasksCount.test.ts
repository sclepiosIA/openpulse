// @vitest-environment jsdom
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRDOpenTasksCount } from './useRDOpenTasksCount';

const {
  AUTH_STATE,
  QUERY_PRESETS,
  RESPONSE,
  CHANNEL_OBJ,
  SUBSCRIPTION_OBJ,
  mockUseAuth,
  mockDebugError,
  mockFrom,
  mockRemoveChannel,
  mockInvalidateQueries,
  mockChannel,
  mockOn,
  mockSubscribe,
  mockSelect,
  mockEq,
  mockNot,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE: {
    user: { id: string; email: string } | null;
    session: { user: { id: string } } | null;
    isLoading: boolean;
  } = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const QUERY_PRESETS = {
    standard: {
      staleTime: 1000,
    },
  };

  const RESPONSE: {
    count: number | null;
    error: { message: string } | null;
  } = {
    count: 0,
    error: null,
  };

  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockDebugError = vi.fn();
  const mockInvalidateQueries = vi.fn();

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.not.mockImplementation(() => builder);
  builder.then.mockImplementation(
    (onFulfilled?: (value: typeof RESPONSE) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(RESPONSE).then(onFulfilled, onRejected),
  );
  builder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(RESPONSE).catch(onRejected),
  );

  const mockFrom = vi.fn(() => builder);

  const CHANNEL_OBJ = { key: 'rd-channel' };
  const SUBSCRIPTION_OBJ = { subscription: 'active' };
  const mockSubscribe = vi.fn(() => SUBSCRIPTION_OBJ);
  const mockOn = vi.fn(() => ({
    subscribe: mockSubscribe,
  }));
  const mockChannel = vi.fn(() => ({
    on: mockOn,
  }));
  const mockRemoveChannel = vi.fn();

  return {
    AUTH_STATE,
    QUERY_PRESETS,
    RESPONSE,
    CHANNEL_OBJ,
    SUBSCRIPTION_OBJ,
    mockUseAuth,
    mockDebugError,
    mockFrom,
    mockRemoveChannel,
    mockInvalidateQueries,
    mockChannel,
    mockOn,
    mockSubscribe,
    mockSelect: builder.select,
    mockEq: builder.eq,
    mockNot: builder.not,
    builder,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: QUERY_PRESETS,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
    mockInvalidateQueries(filters);
    return originalInvalidateQueries(filters);
  });

  const wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

describe('useRDOpenTasksCount', () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
    AUTH_STATE.session = { user: { id: 'u1' } };
    AUTH_STATE.isLoading = false;

    RESPONSE.count = 0;
    RESPONSE.error = null;

    mockUseAuth.mockClear();
    mockDebugError.mockClear();
    mockFrom.mockClear();
    mockRemoveChannel.mockClear();
    mockInvalidateQueries.mockClear();
    mockChannel.mockClear();
    mockOn.mockClear();
    mockSubscribe.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockNot.mockClear();
  });

  it('retourne 0 au départ puis le nombre réel de tâches ouvertes et crée l abonnement realtime', async () => {
    RESPONSE.count = 3;
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRDOpenTasksCount(), { wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(3);
    });

    expect(mockFrom).toHaveBeenCalledWith('rd_tasks');
    expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(mockEq).toHaveBeenCalledWith('responsable_id', 'u1');
    expect(mockNot).toHaveBeenCalledWith('statut', 'in', '(termine,done,terminee,fini)');
    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^rd-tasks-badge-u1-/));
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rd_tasks',
        filter: 'responsable_id=eq.u1',
      },
      expect.any(Function),
    );
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('retourne 0 et loggue l erreur quand la requête supabase échoue', async () => {
    RESPONSE.count = null;
    RESPONSE.error = { message: 'x' };
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRDOpenTasksCount(), { wrapper });

    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith('[useRDOpenTasksCount]', { message: 'x' });
    });

    expect(result.current).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith('rd_tasks');
    expect(mockNot).toHaveBeenCalledWith('statut', 'in', '(termine,done,terminee,fini)');
  });

  it('ne lance pas la query ni le channel sans utilisateur, puis nettoie le channel au démontage', async () => {
    AUTH_STATE.user = null;
    AUTH_STATE.session = null;

    const { wrapper } = createWrapper();
    const { result, rerender, unmount } = renderHook(() => useRDOpenTasksCount(), { wrapper });

    expect(result.current).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockChannel).not.toHaveBeenCalled();

    AUTH_STATE.user = { id: 'u1', email: 't@t.co' };
    AUTH_STATE.session = { user: { id: 'u1' } };

    rerender();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('rd_tasks');
      expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^rd-tasks-badge-u1-/));
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockOn.mock.results[0].value);
  });

  it('invalide la query quand le callback realtime est déclenché', async () => {
    RESPONSE.count = 2;
    const { wrapper } = createWrapper();

    renderHook(() => useRDOpenTasksCount(), { wrapper });

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledTimes(1);
    });

    const realtimeCallback = mockOn.mock.calls[0][2] as () => void;
    realtimeCallback();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['rd-open-tasks-count', 'u1'],
    });
  });
});