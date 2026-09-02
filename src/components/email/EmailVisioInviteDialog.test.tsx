/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailVisioInviteDialog } from './EmailVisioInviteDialog';

const {
  AUTH_STATE,
  EDGE_SUMMARY_SUCCESS,
  ICS_CONTENT,
  EVENT_RESULT,
  DEFAULT_CALENDAR_ID,
  mockToastSuccess,
  mockToastError,
  mockToastWarning,
  mockInvokeEdge,
  mockGenerateICS,
  mockGetOrCreateDefaultCalendar,
  mockCreateEvent,
  mockAddAttendees,
  mockInvalidateCalendar,
  mockOnInvitationGenerated,
  mockOnOpenChange,
  mockSanitizeSupabaseError,
  mockVideoConferenceSelectorProps,
  mockFrom,
} = vi.hoisted(() => {
  const result = { data: null, error: null };
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result))),
    catch: vi.fn(),
  };

  return {
    AUTH_STATE: {
      user: { id: 'user-1', email: 'organizer@example.com' },
      session: { user: { id: 'user-1' } },
      isLoading: false,
    },
    EDGE_SUMMARY_SUCCESS: {
      summary: 'Résumé IA de la conversation',
      suggestedTitle: 'Point projet final',
      suggestedDate: '2099-12-24T15:30:00.000Z',
      suggestedTime: '16:30',
    },
    ICS_CONTENT: 'BEGIN:VCALENDAR\nSUMMARY:Point projet final\nEND:VCALENDAR',
    EVENT_RESULT: { id: 'event-1' },
    DEFAULT_CALENDAR_ID: 'cal-1',
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastWarning: vi.fn(),
    mockInvokeEdge: vi.fn(),
    mockGenerateICS: vi.fn(),
    mockGetOrCreateDefaultCalendar: vi.fn(),
    mockCreateEvent: vi.fn(),
    mockAddAttendees: vi.fn(),
    mockInvalidateCalendar: vi.fn(),
    mockOnInvitationGenerated: vi.fn(),
    mockOnOpenChange: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    mockVideoConferenceSelectorProps: vi.fn(),
    mockFrom: vi.fn(() => builder),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('@/lib/calendarUtils', () => ({
  generateVisioInvitationICS: mockGenerateICS,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/hooks/calendar/useCalendarEventActions', () => ({
  useCreateCalendarEvent: () => ({
    getOrCreateDefaultCalendar: mockGetOrCreateDefaultCalendar,
    createEvent: mockCreateEvent,
    addAttendees: mockAddAttendees,
    invalidateCalendar: mockInvalidateCalendar,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/calendrier/VideoConferenceSelector', () => ({
  VideoConferenceSelector: ({ value, onChange, eventTitle }: { value: string; onChange: (value: string) => void; eventTitle: string }) => {
    mockVideoConferenceSelectorProps({ value, eventTitle });
    return (
      <div>
        <label htmlFor="visio-url">Lien visio</label>
        <input
          id="visio-url"
          aria-label="Lien visio"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" onClick={() => onChange('https://meet.example.com/room')}>
          Générer lien
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div>Calendar</div>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value?: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('lucide-react', () => {
  const Icon = () => <span />;
  return {
    Loader2: Icon,
    Video: Icon,
    CalendarIcon: Icon,
    Clock: Icon,
    Users: Icon,
    X: Icon,
    Sparkles: Icon,
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

function renderComponent(props?: Partial<React.ComponentProps<typeof EmailVisioInviteDialog>>) {
  const Wrapper = createWrapper();

  return render(
    <EmailVisioInviteDialog
      open={true}
      onOpenChange={mockOnOpenChange}
      threadParticipants={[
        { email: 'alice@example.com', name: 'Alice Martin' },
        { email: 'bob@example.com' },
      ]}
      threadSubject="Re: Sujet important"
      threadMessages={[
        {
          from_name: 'Alice Martin',
          from_address: 'alice@example.com',
          body_text: 'Pouvez-vous planifier une visio pour finaliser les détails ?',
          sent_date: '2024-01-01T10:00:00.000Z',
        },
      ]}
      onInvitationGenerated={mockOnInvitationGenerated}
      {...props}
    />,
    { wrapper: Wrapper }
  );
}

function getCreateButton() {
  return screen.getByRole('button', { name: /créer l'invitation/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvokeEdge.mockResolvedValue(EDGE_SUMMARY_SUCCESS);
  mockGenerateICS.mockReturnValue(ICS_CONTENT);
  mockGetOrCreateDefaultCalendar.mockResolvedValue(DEFAULT_CALENDAR_ID);
  mockCreateEvent.mockResolvedValue(EVENT_RESULT);
  mockAddAttendees.mockResolvedValue({ data: null, error: null });
  mockSanitizeSupabaseError.mockReturnValue('Erreur formatée');
});

describe('EmailVisioInviteDialog', () => {
  it('initialise le titre depuis le sujet et applique les suggestions IA au chargement', async () => {
    renderComponent();

    expect(screen.getByLabelText(/titre de la réunion/i)).toHaveValue('Visio: Sujet important');

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('generate-visio-summary', {
        subject: 'Re: Sujet important',
        messages: expect.stringContaining('De: Alice Martin'),
        participants: 'Alice Martin, bob@example.com',
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/titre de la réunion/i)).toHaveValue('Point projet final');
    });

    expect(screen.getAllByText('IA').length).toBeGreaterThan(0);
    expect(mockVideoConferenceSelectorProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventTitle: 'Point projet final',
      })
    );
  });

  it('crée une invitation complète, génère l’ICS, ajoute l’événement au calendrier et ferme la modale', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/titre de la réunion/i)).toHaveValue('Point projet final');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /générer lien/i }));
    });

    await act(async () => {
      fireEvent.click(getCreateButton());
    });

    await waitFor(() => {
      expect(mockGenerateICS).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Point projet final',
          durationMinutes: 60,
          visioUrl: 'https://meet.example.com/room',
          organizer: {
            name: 'organizer',
            email: 'organizer@example.com',
          },
          attendees: [
            { email: 'alice@example.com', name: 'Alice Martin' },
            { email: 'bob@example.com', name: undefined },
          ],
        })
      );
    });

    await waitFor(() => {
      expect(mockGetOrCreateDefaultCalendar).toHaveBeenCalledWith('user-1');
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: DEFAULT_CALENDAR_ID,
          title: 'Point projet final',
          videoConferenceUrl: 'https://meet.example.com/room',
          description: 'Résumé IA de la conversation',
          status: 'confirmed',
          visibility: 'private',
          createdBy: 'user-1',
        })
      );
      expect(mockAddAttendees).toHaveBeenCalledWith([
        {
          event_id: 'event-1',
          email: 'organizer@example.com',
          display_name: 'organizer',
          role: 'organizer',
          status: 'accepted',
        },
        {
          event_id: 'event-1',
          email: 'alice@example.com',
          display_name: 'Alice Martin',
          role: 'attendee',
          status: 'pending',
        },
        {
          event_id: 'event-1',
          email: 'bob@example.com',
          display_name: null,
          role: 'attendee',
          status: 'pending',
        },
      ]);
      expect(mockInvalidateCalendar).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockOnInvitationGenerated).toHaveBeenCalledTimes(1);
    });

    const invitationArgs = mockOnInvitationGenerated.mock.calls[0];
    expect(invitationArgs[0]).toContain('Invitation à une visioconférence');
    expect(invitationArgs[0]).toContain('Point projet final');
    expect(invitationArgs[0]).toContain('Alice Martin, bob');
    expect(invitationArgs[0]).toContain('Résumé IA de la conversation');
    expect(invitationArgs[0]).toContain('https://meet.example.com/room');
    expect(invitationArgs[1]).toBe(ICS_CONTENT);
    expect(invitationArgs[2]).toContain('🔗 Rejoindre la visioconférence');

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockToastSuccess).toHaveBeenCalledWith('Invitation créée et ajoutée à votre calendrier');
  });

  it('nessaie pas de créer et garde le bouton désactivé tant que le lien visio est absent', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/titre de la réunion/i)).toHaveValue('Point projet final');
    });

    const createButton = getCreateButton();
    expect(createButton).toBeDisabled();

    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(mockToastError).not.toHaveBeenCalledWith('Veuillez générer un lien de visioconférence');
    expect(mockGenerateICS).not.toHaveBeenCalled();
    expect(mockOnInvitationGenerated).not.toHaveBeenCalled();
  });

  it('gère l’erreur de création et affiche le message sanitizé', async () => {
    mockGenerateICS.mockImplementation(() => {
      throw { data: null, error: { message: 'x' } };
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/titre de la réunion/i)).toHaveValue('Point projet final');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /générer lien/i }));
    });

    await act(async () => {
      fireEvent.click(getCreateButton());
    });

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ data: null, error: { message: 'x' } });
      expect(mockToastError).toHaveBeenCalledWith('Erreur formatée');
    });

    expect(mockOnInvitationGenerated).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('affiche un warning si la création calendrier échoue mais génère quand même l’invitation', async () => {
    mockCreateEvent.mockRejectedValueOnce(new Error('calendar failed'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/titre de la réunion/i)).toHaveValue('Point projet final');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /générer lien/i }));
    });

    await act(async () => {
      fireEvent.click(getCreateButton());
    });

    await waitFor(() => {
      expect(mockOnInvitationGenerated).toHaveBeenCalledTimes(1);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      expect(mockToastWarning).toHaveBeenCalledWith("Invitation envoyée, mais l'ajout au calendrier a échoué");
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});