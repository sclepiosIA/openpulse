import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activityRpc: vi.fn(),
  phaseRpc: vi.fn(),
  invoke: vi.fn(),
  debugError: vi.fn(),
  authState: { loading: false, user: { id: 'user-1' } as null | { id: string } },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.activityRpc,
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { rpc: mocks.phaseRpc },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: mocks.debugError },
}));

import { useActivityFeedStats } from '../activity/useActivityFeedStats';
import { usePhaseCounts } from '../analytics/usePhaseCounts';
import { notifyBooking } from '../bookings/notifyBooking';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('analytics/activity query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.loading = false;
    mocks.authState.user = { id: 'user-1' };
  });

  it('useActivityFeedStats transmet les filtres sérialisés au RPC et retourne les statistiques', async () => {
    const stats = { today: 2, week: 7, month: 20, by_type: { email: 4 }, by_user: [] };
    mocks.activityRpc.mockResolvedValueOnce({ data: stats, error: null });
    const filters = { types: ['email'], pinned: true, ignored: undefined } as any;

    const { result } = renderHook(() => useActivityFeedStats(filters), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.activityRpc).toHaveBeenCalledWith('get_activity_feed_stats', {
      p_filters: { types: ['email'], pinned: true },
    });
    expect(result.current.data).toEqual(stats);
  });

  it('useActivityFeedStats fournit un objet vide stable quand le RPC ne renvoie rien', async () => {
    mocks.activityRpc.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useActivityFeedStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ today: 0, week: 0, month: 0, by_type: {}, by_user: [] });
  });

  it('usePhaseCounts agrège les statuts retournés par le RPC dans les trois phases', async () => {
    mocks.phaseRpc.mockResolvedValueOnce({
      data: [
        { statut: 'Prospect', count: '2' },
        { statut: 'Déploiement', count: 3 },
        { statut: 'Production', count: '4' },
        { statut: 'Inconnu', count: 99 },
        { statut: null, count: 12 },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePhaseCounts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.phaseRpc).toHaveBeenCalledWith('get_phase_counts');
    expect(result.current.data).toEqual({ commercial: 2, deploiement: 3, production: 4 });
  });
});

describe('notifyBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('déclenche la fonction booking-notify avec les informations de réservation', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: null });

    await notifyBooking('booking-1', 'rescheduled', {
      oldStartTime: '2026-06-07T09:00:00Z',
      oldEndTime: '2026-06-07T10:00:00Z',
      reason: 'patient indisponible',
    });

    expect(mocks.invoke).toHaveBeenCalledWith('booking-notify', {
      body: {
        bookingId: 'booking-1',
        action: 'rescheduled',
        oldStartTime: '2026-06-07T09:00:00Z',
        oldEndTime: '2026-06-07T10:00:00Z',
        reason: 'patient indisponible',
      },
    });
  });

  it('journalise sans propager quand la notification booking échoue', async () => {
    const error = new Error('edge function unavailable');
    mocks.invoke.mockRejectedValueOnce(error);

    await expect(notifyBooking('booking-2', 'cancelled')).resolves.toBeUndefined();
    expect(mocks.debugError).toHaveBeenCalledWith('[booking-notify] invoke failed', error);
  });
});