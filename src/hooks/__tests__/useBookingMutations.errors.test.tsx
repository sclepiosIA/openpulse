import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const toastErrorSpy = vi.hoisted(() => vi.fn());
const toastSuccessSpy = vi.hoisted(() => vi.fn());
const notifyBookingSpy = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseModule } = await import('@/test-utils/supabaseMockFactory');

  return mockSupabaseModule({
    fromResults: {
      bookings: { data: null, error: { message: 'RLS: bookings forbidden' } },
    },
  });
});

vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: toastSuccessSpy },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

vi.mock('../bookings/notifyBooking', () => ({
  notifyBooking: notifyBookingSpy,
}));

import { useRescheduleBooking, useCancelBooking } from '../bookings/useBookingMutations';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: Infinity },
      queries: { retry: false, gcTime: Infinity },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = React.useState(() => createQueryClient());

  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useBookingMutations (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('useRescheduleBooking — toast.error sur RLS deny', async () => {
    const { result, unmount } = renderHook(() => useRescheduleBooking(), { wrapper });

    try {
      await act(async () => {
        await result.current
          .mutateAsync({
            id: 'b1',
            start_time: '2026-06-10T10:00:00Z',
            end_time: '2026-06-10T11:00:00Z',
          })
          .catch(() => undefined);
      });

      await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled(), { timeout: 5000 });
    } finally {
      unmount();
    }
  });

  it('useCancelBooking — toast.error sur RLS deny', async () => {
    const { result, unmount } = renderHook(() => useCancelBooking(), { wrapper });

    try {
      await act(async () => {
        await result.current
          .mutateAsync({ id: 'b1', reason: 'client absent' })
          .catch(() => undefined);
      });

      await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled(), { timeout: 5000 });
    } finally {
      unmount();
    }
  });
});