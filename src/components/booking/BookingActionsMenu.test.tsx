// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingActionsMenu } from './BookingActionsMenu';

const {
  BOOKING,
  SLOT_START,
  SLOT_END,
  invokeEdgeMock,
  updateStatusMutateMock,
  cancelMutateAsyncMock,
  rescheduleMutateAsyncMock,
  updateGuestMutateAsyncMock,
  useUpdateBookingStatusMock,
  useCancelBookingMock,
  useRescheduleBookingMock,
  useUpdateBookingGuestInfoMock,
  mockFrom,
  authValue,
  EMPTY_ARRAY,
} = vi.hoisted(() => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  future.setUTCHours(10, 0, 0, 0);

  const slotStart = new Date(future);
  slotStart.setUTCHours(14, 0, 0, 0);

  const slotEnd = new Date(future);
  slotEnd.setUTCHours(14, 30, 0, 0);

  return {
    BOOKING: {
      id: 'booking-1',
      host_user_id: 'host-1',
      booking_type_id: 'type-1',
      guest_name: 'Jean Dupont',
      guest_email: 'jean@example.test',
      guest_phone: '0601020304',
      guest_notes: 'Allergie légère',
      start_time: future.toISOString(),
      status: 'pending',
      booking_type: {
        id: 'type-1',
        name: 'Consultation',
        duration_minutes: 30,
      },
    },
    SLOT_START: slotStart.toISOString(),
    SLOT_END: slotEnd.toISOString(),
    invokeEdgeMock: vi.fn(),
    updateStatusMutateMock: vi.fn(),
    cancelMutateAsyncMock: vi.fn(),
    rescheduleMutateAsyncMock: vi.fn(),
    updateGuestMutateAsyncMock: vi.fn(),
    useUpdateBookingStatusMock: vi.fn(),
    useCancelBookingMock: vi.fn(),
    useRescheduleBookingMock: vi.fn(),
    useUpdateBookingGuestInfoMock: vi.fn(),
    mockFrom: vi.fn(),
    authValue: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    EMPTY_ARRAY: [],
  };
});

const SLOT_LABEL = new Date(SLOT_START).toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    selected,
    onSelect,
  }: {
    selected?: Date;
    onSelect: (date: Date | undefined) => void;
  }) => (
    <div>
      <div data-testid="calendar-selected">{selected ? selected.toISOString() : 'none'}</div>
      <button
        type="button"
        onClick={() => {
          const d = new Date(selected || BOOKING.start_time);
          d.setUTCDate(d.getUTCDate() + 1);
          onSelect(d);
        }}
      >
        Choisir date suivante
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/bookings/useBookings', () => ({
  useUpdateBookingStatus: () => useUpdateBookingStatusMock(),
  useCancelBooking: () => useCancelBookingMock(),
  useRescheduleBooking: () => useRescheduleBookingMock(),
  useUpdateBookingGuestInfo: () => useUpdateBookingGuestInfoMock(),
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: invokeEdgeMock,
}));

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Check: Icon,
    Edit: Icon,
    RotateCcw: Icon,
    X: Icon,
    MoreHorizontal: Icon,
    Loader2: Icon,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('BookingActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useUpdateBookingStatusMock.mockReturnValue({
      mutate: updateStatusMutateMock,
      isPending: false,
    });
    useCancelBookingMock.mockReturnValue({
      mutateAsync: cancelMutateAsyncMock.mockResolvedValue({ data: { ok: true }, error: null }),
      isPending: false,
    });
    useRescheduleBookingMock.mockReturnValue({
      mutateAsync: rescheduleMutateAsyncMock.mockResolvedValue({ data: { ok: true }, error: null }),
      isPending: false,
    });
    useUpdateBookingGuestInfoMock.mockReturnValue({
      mutateAsync: updateGuestMutateAsyncMock.mockResolvedValue({ data: { ok: true }, error: null }),
      isPending: false,
    });
    invokeEdgeMock.mockResolvedValue({
      slots: [{ start: SLOT_START, end: SLOT_END }],
    });
  });

  it('affiche les actions attendues et confirme une réservation pending', async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <BookingActionsMenu booking={BOOKING} />
      </Wrapper>
    );

    expect(screen.getByRole('button', { name: "Plus d'options" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reprogrammer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modifier infos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^annuler$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /confirmer/i }));

    expect(updateStatusMutateMock).toHaveBeenCalledTimes(1);
    expect(updateStatusMutateMock).toHaveBeenCalledWith({
      id: 'booking-1',
      status: 'confirmed',
    });
  });

  it('charge les créneaux, affiche le slot métier et reprogramme avec les vraies valeurs', async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <BookingActionsMenu booking={BOOKING} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole('button', { name: /reprogrammer/i }));

    expect(screen.getByText(/reprogrammer le rdv/i)).toBeInTheDocument();
    expect(screen.getByText(/créneau \(30 min\)/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(invokeEdgeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeEdgeMock).toHaveBeenCalledWith('public-booking-proxy', {
      action: 'get_slots_authenticated',
      host_user_id: 'host-1',
      booking_type_id: 'type-1',
      date: BOOKING.start_time.slice(0, 10),
      exclude_booking_id: 'booking-1',
    });

    const slotButton = await screen.findByRole('button', { name: SLOT_LABEL });
    await userEvent.click(slotButton);
    await userEvent.click(screen.getByRole('button', { name: /confirmer la nouvelle date/i }));

    await waitFor(() => {
      expect(rescheduleMutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(rescheduleMutateAsyncMock).toHaveBeenCalledWith({
      id: 'booking-1',
      start_time: SLOT_START,
      end_time: SLOT_END,
    });
  });

  it("annule le rendez-vous avec un motif saisi", async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <BookingActionsMenu booking={BOOKING} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole('button', { name: /^annuler$/i }));

    expect(screen.getByText(/annuler le rdv/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/empêchement de dernière minute/i);
    await userEvent.type(textarea, 'Client indisponible');

    await userEvent.click(screen.getByRole('button', { name: /confirmer l'annulation/i }));

    await waitFor(() => {
      expect(cancelMutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(cancelMutateAsyncMock).toHaveBeenCalledWith({
      id: 'booking-1',
      reason: 'Client indisponible',
    });
  });

  it('modifie les informations invité et envoie null pour téléphone et notes vides', async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <BookingActionsMenu booking={BOOKING} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole('button', { name: /modifier infos/i }));

    const nameInput = screen.getByDisplayValue('Jean Dupont');
    const emailInput = screen.getByDisplayValue('jean@example.test');
    const phoneInput = screen.getByDisplayValue('0601020304');
    const notesInput = screen.getByDisplayValue('Allergie légère');

    fireEvent.change(nameInput, { target: { value: 'Marie Martin' } });
    fireEvent.change(emailInput, { target: { value: 'marie@example.test' } });
    fireEvent.change(phoneInput, { target: { value: '' } });
    fireEvent.change(notesInput, { target: { value: '' } });

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(updateGuestMutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(updateGuestMutateAsyncMock).toHaveBeenCalledWith({
      id: 'booking-1',
      guest_name: 'Marie Martin',
      guest_email: 'marie@example.test',
      guest_phone: null,
      guest_notes: null,
    });
  });

  it('renderHook couvre chargement puis succès avec QueryClientProvider', async () => {
    const Wrapper = createWrapper();

    const deferred = new Promise<Array<{ start: string; end: string }>>((resolve) => {
      setTimeout(() => resolve([{ start: SLOT_START, end: SLOT_END }]), 0);
    });

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['slots-test', BOOKING.id],
          queryFn: async () => {
            return deferred;
          },
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([{ start: SLOT_START, end: SLOT_END }]);
  });

  it("renderHook couvre l'erreur query et expose isError avec le message réel", async () => {
    const Wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['error-query', BOOKING.id],
          queryFn: async () => {
            const response = { data: null, error: { message: 'x' } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data ?? EMPTY_ARRAY;
          },
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('x');
  });

  it('déclenche une mutation via renderHook dans act et vérifie les arguments métier', async () => {
    const Wrapper = createWrapper();

    const { result } = renderHook(() => ({
      mutation: useRescheduleBookingMock(),
    }), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutation.mutateAsync({
        id: BOOKING.id,
        start_time: SLOT_START,
        end_time: SLOT_END,
      });
    });

    expect(rescheduleMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(rescheduleMutateAsyncMock).toHaveBeenCalledWith({
      id: 'booking-1',
      start_time: SLOT_START,
      end_time: SLOT_END,
    });
  });
});