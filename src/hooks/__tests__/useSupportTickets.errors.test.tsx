import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { toastErrorSpy, toastSuccessSpy, useAuthSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
  toastSuccessSpy: vi.fn(),
  useAuthSpy: vi.fn(() => ({
    user: { id: 'u-test' },
    session: { user: { id: 'u-test' } },
    loading: false,
    isAuthenticated: true,
  })),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: useAuthSpy,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseModule } = await vi.importActual<typeof import('@/test-utils/supabaseMockFactory')>(
    '@/test-utils/supabaseMockFactory',
  );

  return mockSupabaseModule({
    fromResults: {
      support_tickets: { data: null, error: { message: 'RLS: support_tickets forbidden' } },
      support_ticket_comments: { data: null, error: { message: 'RLS: comments forbidden' } },
    },
  });
});

vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: toastSuccessSpy },
}));

import {
  useUpdateSupportTicket,
  useAssignTicket,
  useAddTicketComment,
} from '../support/useSupportTickets';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useSupportTickets (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthSpy.mockReturnValue({
      user: { id: 'u-test' },
      session: { user: { id: 'u-test' } },
      loading: false,
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('useUpdateSupportTicket — toast.error sur RLS deny', async () => {
    const { result } = renderHook(() => useUpdateSupportTicket(), { wrapper: createWrapper() });

    result.current.mutate({ ticketId: 't1', updates: { statut: 'ferme' } as any });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(result.current.isError).toBe(true);
    });
  });

  it('useAssignTicket — toast.error sur RLS deny', async () => {
    const { result } = renderHook(() => useAssignTicket(), { wrapper: createWrapper() });

    result.current.mutate({ ticketId: 't1', assignedTo: 'u1' } as any);

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(result.current.isError).toBe(true);
    });
  });

  it('useAddTicketComment — toast.error sur RLS deny', async () => {
    const { result } = renderHook(() => useAddTicketComment(), { wrapper: createWrapper() });

    result.current.mutate({ ticketId: 't1', content: 'hi' } as any);

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(result.current.isError).toBe(true);
    });
  });
});