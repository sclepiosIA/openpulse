import { notifyBooking } from './notifyBooking';

const { mockInvoke, mockDebugError } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

describe('notifyBooking', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockDebugError.mockReset();
  });

  it('appelle la edge function booking-notify avec bookingId et action', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await notifyBooking('booking-1', 'confirmed');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('booking-notify', {
      body: {
        bookingId: 'booking-1',
        action: 'confirmed',
      },
    });
    expect(mockDebugError).not.toHaveBeenCalled();
  });

  it('inclut les champs extra dans le body pour une replanification', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await notifyBooking('booking-2', 'rescheduled', {
      oldStartTime: '2025-02-10T09:00:00Z',
      oldEndTime: '2025-02-10T10:00:00Z',
      reason: 'client request',
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('booking-notify', {
      body: {
        bookingId: 'booking-2',
        action: 'rescheduled',
        oldStartTime: '2025-02-10T09:00:00Z',
        oldEndTime: '2025-02-10T10:00:00Z',
        reason: 'client request',
      },
    });
    expect(mockDebugError).not.toHaveBeenCalled();
  });

  it('n’échoue pas et loggue une erreur si invoke rejette', async () => {
    const error = new Error('invoke failed');
    mockInvoke.mockRejectedValue(error);

    await expect(notifyBooking('booking-3', 'cancelled', { reason: 'no-show' })).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('booking-notify', {
      body: {
        bookingId: 'booking-3',
        action: 'cancelled',
        reason: 'no-show',
      },
    });
    expect(mockDebugError).toHaveBeenCalledTimes(1);
    expect(mockDebugError).toHaveBeenCalledWith('[booking-notify] invoke failed', error);
  });

  it('transmet correctement une mise à jour simple avec extra partiel', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await notifyBooking('booking-4', 'updated', {
      reason: 'time window adjusted',
    });

    expect(mockInvoke).toHaveBeenCalledWith('booking-notify', {
      body: {
        bookingId: 'booking-4',
        action: 'updated',
        reason: 'time window adjusted',
      },
    });
    expect(mockDebugError).not.toHaveBeenCalled();
  });
});