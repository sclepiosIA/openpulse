// @vitest-environment jsdom

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  AUTH_STATE,
  BOOKING_ROWS,
  mockFrom,
  mockUseAuth,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  BOOKING_ROWS: [
    {
      id: 'b1',
      booking_type_id: 'bt1',
      host_user_id: 'u1',
      start_time: '2025-06-20T09:00:00.000Z',
      end_time: '2025-06-20T09:30:00.000Z',
      guest_name: 'Alice Martin',
      guest_email: 'alice@example.test',
      guest_phone: '0102030405',
      guest_company: 'Acme',
      guest_notes: 'Premier échange',
      status: 'confirmed',
      booking_page_id: 'bp1',
      etablissement_id: 'e1',
      calendar_event_id: null,
      tache_id: null,
      location: 'Visio',
      video_conference_url: null,
      custom_answers: [],
      timezone: 'Europe/Paris',
      source: 'public_page',
      referrer: null,
      confirmation_token: null,
      confirmed_at: '2025-06-19T10:00:00.000Z',
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      reminder_sent_24h: false,
      reminder_sent_1h: false,
      created_at: '2025-06-19T09:00:00.000Z',
      updated_at: '2025-06-19T09:00:00.000Z',
      booking_type: {
        id: 'bt1',
        name: 'Consultation',
        duration_minutes: 30,
        category: 'Santé',
        color: '#00aaee',
        location_type: 'video',
      },
      etablissements: {
        id: 'e1',
        nom: 'Cabinet Central',
      },
    },
  ],
  mockFrom: vi.fn(),
  mockUseAuth: vi.fn(() => ({
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  })),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { useBookings } from './useBookings';

type SupabaseResponse = { data: unknown; error: { message: string } | null };

function createThenableBuilder(response: SupabaseResponse) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (onFulfilled: (value: SupabaseResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  };
  return builder;
}

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

describe('useBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
  });

  it('charge puis retourne les réservations filtrées avec les données métier attendues', async () => {
    const builder = createThenableBuilder({ data: BOOKING_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useBookings('confirmed'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('bookings');
    expect(builder.select).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'host_user_id', 'u1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'confirmed');
    expect(builder.order).toHaveBeenCalledWith('start_time', { ascending: true });

    const bookings = result.current.data;
    expect(bookings).toHaveLength(1);
    expect(bookings[0].guest_name).toBe('Alice Martin');
    expect(bookings[0].status).toBe('confirmed');
    expect(bookings[0].booking_type.name).toBe('Consultation');
    expect(bookings[0].etablissements.nom).toBe('Cabinet Central');
    expect(bookings[0].start_time).toBe('2025-06-20T09:00:00.000Z');
  });

  it('passe en erreur si la requête supabase échoue', async () => {
    const builder = createThenableBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useBookings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
    expect(builder.eq).toHaveBeenCalledWith('host_user_id', 'u1');
  });
});