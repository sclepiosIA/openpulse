// @vitest-environment jsdom

import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

const {
  AUTH_STATE,
  CONTEXT_LOADING,
  CONTEXT_SUCCESS,
  CONTEXT_ERROR,
  mockUseJarvisProactiveAlertsContext,
  mockUseAuth,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const CONTEXT_LOADING = {
    alerts: [],
    unreadCount: 0,
    isLoading: true,
    isError: false,
    error: null,
    refresh: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    dismissAlert: vi.fn(),
  };

  const CONTEXT_SUCCESS = {
    alerts: [
      {
        id: 'a1',
        title: 'Stock bas',
        message: 'Le stock du produit P1 est critique',
        severity: 'high',
        read: false,
        created_at: '2024-01-01T10:00:00.000Z',
      },
      {
        id: 'a2',
        title: 'Nouvelle commande',
        message: 'Une commande nécessite une validation',
        severity: 'medium',
        read: true,
        created_at: '2024-01-02T10:00:00.000Z',
      },
    ],
    unreadCount: 1,
    isLoading: false,
    isError: false,
    error: null,
    refresh: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    dismissAlert: vi.fn(),
  };

  const CONTEXT_ERROR = {
    alerts: [],
    unreadCount: 0,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
    refresh: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    dismissAlert: vi.fn(),
  };

  const mockUseJarvisProactiveAlertsContext = vi.fn();
  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockNavigate = vi.fn();

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
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.upsert.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled),
  );
  builder.catch.mockImplementation(
    (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  );

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    CONTEXT_LOADING,
    CONTEXT_SUCCESS,
    CONTEXT_ERROR,
    mockUseJarvisProactiveAlertsContext,
    mockUseAuth,
    mockToastSuccess,
    mockToastError,
    mockNavigate,
    builder,
    mockFrom,
  };
});

vi.mock('@/contexts/JarvisProactiveAlertsContext', () => ({
  useJarvisProactiveAlertsContext: mockUseJarvisProactiveAlertsContext,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: AUTH_STATE.session }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { useJarvisProactiveAlerts } from './useJarvisProactiveAlerts';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisProactiveAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
  });

  it('retourne l’état de chargement du contexte', () => {
    mockUseJarvisProactiveAlertsContext.mockReturnValue(CONTEXT_LOADING);

    const { result } = renderHook(() => useJarvisProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    expect(mockUseJarvisProactiveAlertsContext).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('retourne les alertes métier réelles en succès', () => {
    mockUseJarvisProactiveAlertsContext.mockReturnValue(CONTEXT_SUCCESS);

    const { result } = renderHook(() => useJarvisProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    expect(mockUseJarvisProactiveAlertsContext).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.alerts[0]).toMatchObject({
      id: 'a1',
      title: 'Stock bas',
      severity: 'high',
      read: false,
    });
    expect(result.current.alerts[1]).toMatchObject({
      id: 'a2',
      title: 'Nouvelle commande',
      severity: 'medium',
      read: true,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.refresh).toBe(CONTEXT_SUCCESS.refresh);
    expect(result.current.markAsRead).toBe(CONTEXT_SUCCESS.markAsRead);
    expect(result.current.markAllAsRead).toBe(CONTEXT_SUCCESS.markAllAsRead);
    expect(result.current.dismissAlert).toBe(CONTEXT_SUCCESS.dismissAlert);
  });

  it('retourne un état d’erreur quand le contexte échoue', () => {
    mockUseJarvisProactiveAlertsContext.mockReturnValue(CONTEXT_ERROR);

    const { result } = renderHook(() => useJarvisProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    expect(mockUseJarvisProactiveAlertsContext).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.error).toEqual({ message: 'x' });
  });
});