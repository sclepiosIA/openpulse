// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInAppNotifications } from './useInAppNotifications';

const {
  USER,
  NOTIFICATIONS,
  QUERY_RESULT_SUCCESS,
  QUERY_RESULT_ERROR,
  builderState,
  channelState,
  mockUseAuth,
  mockFrom,
  mockChannel,
  mockRemoveChannel,
  mockToastInfo,
  mockToastSuccess,
} = vi.hoisted(() => {
  const USER = {
    id: 'u1',
    email: 'user@test.co',
  };

  const NOTIFICATIONS = [
    {
      id: 'n1',
      user_id: 'u1',
      title: 'Nouvelle tâche',
      message: 'Une tâche vous a été assignée',
      type: 'task_assignment' as const,
      related_id: 't1',
      related_type: 'tache' as const,
      is_read: false,
      created_at: '2024-01-02T10:00:00.000Z',
      read_at: null,
    },
    {
      id: 'n2',
      user_id: 'u1',
      title: 'Mise à jour',
      message: 'Établissement modifié',
      type: 'establishment_update' as const,
      related_id: 'e1',
      related_type: 'etablissement' as const,
      is_read: true,
      created_at: '2024-01-01T09:00:00.000Z',
      read_at: '2024-01-01T10:00:00.000Z',
    },
  ];

  const QUERY_RESULT_SUCCESS = { data: NOTIFICATIONS, error: null };
  const QUERY_RESULT_ERROR = { data: null, error: { message: 'x' } };

  const builderState = {
    result: QUERY_RESULT_SUCCESS as
      | { data: typeof NOTIFICATIONS | null; error: { message: string } | null }
      | { data: null; error: { message: string } | null },
    updatePayload: null as Record<string, unknown> | null,
    table: null as string | null,
    selectArg: null as string | null,
    eqCalls: [] as Array<[string, unknown]>,
    orderCalls: [] as Array<[string, unknown]>,
    limitCalls: [] as number[],
    deleteCalled: false,
  };

  const channelState = {
    name: null as string | null,
    handlers: [] as Array<{
      eventType: string;
      filter: Record<string, unknown>;
      callback: (payload: { new: (typeof NOTIFICATIONS)[number] }) => void;
    }>,
    subscribed: false,
  };

  const createBuilder = () => {
    const builder = {
      select: vi.fn((arg: string) => {
        builderState.selectArg = arg;
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        builderState.eqCalls.push([column, value]);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn((column: string, options?: unknown) => {
        builderState.orderCalls.push([column, options]);
        return builder;
      }),
      limit: vi.fn((value: number) => {
        builderState.limitCalls.push(value);
        return builder;
      }),
      insert: vi.fn(() => builder),
      update: vi.fn((payload: Record<string, unknown>) => {
        builderState.updatePayload = payload;
        return builder;
      }),
      delete: vi.fn(() => {
        builderState.deleteCalled = true;
        return builder;
      }),
      single: vi.fn(async () => builderState.result),
      maybeSingle: vi.fn(async () => builderState.result),
      then: (
        onFulfilled: (value: typeof builderState.result) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(builderState.result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.result).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table;
    return createBuilder();
  });

  const mockChannel = vi.fn((name: string) => {
    channelState.name = name;
    const channel = {
      on: vi.fn(
        (
          eventType: string,
          filter: Record<string, unknown>,
          callback: (payload: { new: (typeof NOTIFICATIONS)[number] }) => void
        ) => {
          channelState.handlers.push({ eventType, filter, callback });
          return channel;
        }
      ),
      subscribe: vi.fn(() => {
        channelState.subscribed = true;
        return channel;
      }),
    };
    return channel;
  });

  const mockRemoveChannel = vi.fn();

  const mockUseAuth = vi.fn(() => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }));

  const mockToastInfo = vi.fn();
  const mockToastSuccess = vi.fn();

  return {
    USER,
    NOTIFICATIONS,
    QUERY_RESULT_SUCCESS,
    QUERY_RESULT_ERROR,
    builderState,
    channelState,
    mockUseAuth,
    mockFrom,
    mockChannel,
    mockRemoveChannel,
    mockToastInfo,
    mockToastSuccess,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('sonner', () => ({
  toast: {
    info: mockToastInfo,
    success: mockToastSuccess,
    error: vi.fn(),
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

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    QueryClientProvider({ client: queryClient, children });

  return { wrapper, queryClient };
}

describe('useInAppNotifications', () => {
  beforeEach(() => {
    builderState.result = QUERY_RESULT_SUCCESS;
    builderState.updatePayload = null;
    builderState.table = null;
    builderState.selectArg = null;
    builderState.eqCalls = [];
    builderState.orderCalls = [];
    builderState.limitCalls = [];
    builderState.deleteCalled = false;

    channelState.name = null;
    channelState.handlers = [];
    channelState.subscribed = false;

    mockFrom.mockClear();
    mockChannel.mockClear();
    mockRemoveChannel.mockClear();
    mockToastInfo.mockClear();
    mockToastSuccess.mockClear();
    mockUseAuth.mockClear();
  });

  it('charge puis retourne les notifications, le compteur non lues et configure le realtime', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result, unmount } = renderHook(() => useInAppNotifications(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toEqual(NOTIFICATIONS);
    expect(result.current.unreadCount).toBe(1);

    expect(mockFrom).toHaveBeenCalledWith('in_app_notifications');
    expect(builderState.table).toBe('in_app_notifications');
    expect(builderState.selectArg).toBe(
      'id, user_id, title, message, type, related_id, related_type, is_read, created_at, read_at'
    );
    expect(builderState.eqCalls).toContainEqual(['user_id', USER.id]);
    expect(builderState.orderCalls).toContainEqual(['created_at', { ascending: false }]);
    expect(builderState.limitCalls).toContain(50);

    // Suffixe unique par instance (useId) : le badge, la cloche et la page
    // Centre de notifications montent ce hook en même temps et ne doivent pas
    // partager un canal Realtime déjà souscrit.
    expect(mockChannel).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^in_app_notifications_changes-${USER.id}-`))
    );
    expect(channelState.name).toMatch(new RegExp(`^in_app_notifications_changes-${USER.id}-`));
    expect(channelState.subscribed).toBe(true);
    expect(channelState.handlers).toHaveLength(2);
    expect(channelState.handlers[0].eventType).toBe('postgres_changes');
    expect(channelState.handlers[0].filter).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'in_app_notifications',
      filter: `user_id=eq.${USER.id}`,
    });
    expect(channelState.handlers[1].eventType).toBe('postgres_changes');
    expect(channelState.handlers[1].filter).toEqual({
      event: 'UPDATE',
      schema: 'public',
      table: 'in_app_notifications',
      filter: `user_id=eq.${USER.id}`,
    });

    act(() => {
      channelState.handlers[0].callback({ new: NOTIFICATIONS[0] });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['in-app-notifications', USER.id] });
    expect(mockToastInfo).toHaveBeenCalledWith('Nouvelle tâche', {
      description: 'Une tâche vous a été assignée',
    });

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it('déclenche les mutations markAsRead, markAllAsRead et deleteNotification avec les bons appels', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInAppNotifications(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    builderState.updatePayload = null;
    builderState.eqCalls = [];

    await act(async () => {
      result.current.markAsRead('n1');
    });

    await waitFor(() => {
      expect(builderState.updatePayload).not.toBeNull();
    });

    expect(builderState.table).toBe('in_app_notifications');
    expect(builderState.eqCalls).toContainEqual(['id', 'n1']);
    expect(builderState.updatePayload).toMatchObject({ is_read: true });
    expect(typeof builderState.updatePayload?.read_at).toBe('string');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['in-app-notifications', USER.id] });
    });

    builderState.updatePayload = null;
    builderState.eqCalls = [];

    await act(async () => {
      result.current.markAllAsRead();
    });

    await waitFor(() => {
      expect(builderState.updatePayload).not.toBeNull();
    });

    expect(builderState.eqCalls).toContainEqual(['user_id', USER.id]);
    expect(builderState.eqCalls).toContainEqual(['is_read', false]);
    expect(builderState.updatePayload).toMatchObject({ is_read: true });
    expect(typeof builderState.updatePayload?.read_at).toBe('string');
    expect(mockToastSuccess).toHaveBeenCalledWith('Toutes les notifications ont été marquées comme lues');

    builderState.eqCalls = [];
    builderState.deleteCalled = false;

    await act(async () => {
      result.current.deleteNotification('n2');
    });

    await waitFor(() => {
      expect(builderState.deleteCalled).toBe(true);
    });

    expect(builderState.eqCalls).toContainEqual(['id', 'n2']);
  });

  it('gère une erreur de requête en exposant des notifications vides et en arrêtant le chargement', async () => {
    builderState.result = QUERY_RESULT_ERROR;

    const { wrapper } = createWrapper();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useInAppNotifications(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith('in_app_notifications');
    expect(builderState.eqCalls).toContainEqual(['user_id', USER.id]);

    consoleErrorSpy.mockRestore();
  });
});