import React from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { EventCreatorModal } from './EventCreatorModal';

const {
  AUTH_STATE,
  CURRENT_PROFILE,
  CALENDARS,
  CONVERSATION,
  TEAM_MEMBERS,
  CREATED_EVENT,
  PROFILES_RESULT,
  mockCreateEvent,
  mockAddReminder,
  mockAddAttendees,
  mockInvalidateCalendar,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockOnEventCreated,
  mockOnOpenChange,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'user@test.co' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const CURRENT_PROFILE = {
    id: 'profile-current',
    user_id: 'user-1',
    email: 'user@test.co',
    prenom: 'Jean',
    nom: 'Courant',
  };

  const CALENDARS = [
    { id: 'cal-default', is_default: true, name: 'Principal' },
    { id: 'cal-2', is_default: false, name: 'Secondaire' },
  ];

  const CONVERSATION = {
    id: 'conv-1',
    members: [
      { user_id: 'profile-current', user: { prenom: 'Jean', nom: 'Courant' } },
      { user_id: 'profile-conv-1', user: { prenom: 'Alice', nom: 'Martin' } },
      { user_id: 'profile-conv-2', user: { prenom: 'Bob', nom: 'Durand' } },
    ],
  };

  const TEAM_MEMBERS = [
    { id: 'profile-current', prenom: 'Jean', nom: 'Courant' },
    { id: 'profile-conv-1', prenom: 'Alice', nom: 'Martin' },
    { id: 'profile-conv-2', prenom: 'Bob', nom: 'Durand' },
    { id: 'profile-team-1', prenom: 'Chloé', nom: 'Bernard' },
  ];

  const CREATED_EVENT = { id: 'event-1', title: 'Point équipe' };

  const PROFILES_RESULT = [
    {
      id: 'profile-conv-1',
      user_id: 'user-conv-1',
      email: 'alice@test.co',
      prenom: 'Alice',
      nom: 'Martin',
    },
    {
      id: 'profile-team-1',
      user_id: 'user-team-1',
      email: 'chloe@test.co',
      prenom: 'Chloé',
      nom: 'Bernard',
    },
  ];

  const mockCreateEvent = vi.fn().mockResolvedValue(CREATED_EVENT);
  const mockAddReminder = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockAddAttendees = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInvalidateCalendar = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockDebugError = vi.fn();
  const mockOnEventCreated = vi.fn();
  const mockOnOpenChange = vi.fn();

  const makeBuilder = () => {
    const result = { data: PROFILES_RESULT, error: null as null | { message: string } };
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
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  return {
    AUTH_STATE,
    CURRENT_PROFILE,
    CALENDARS,
    CONVERSATION,
    TEAM_MEMBERS,
    CREATED_EVENT,
    PROFILES_RESULT,
    mockCreateEvent,
    mockAddReminder,
    mockAddAttendees,
    mockInvalidateCalendar,
    mockToastSuccess,
    mockToastError,
    mockDebugError,
    mockOnEventCreated,
    mockOnOpenChange,
    mockFrom,
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: CURRENT_PROFILE, isLoading: false, isError: false }),
}));

vi.mock('@/hooks/calendar/useCalendars', () => ({
  useCalendars: () => ({ data: CALENDARS, isLoading: false, isError: false }),
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversation: () => ({ data: CONVERSATION, isLoading: false, isError: false }),
}));

vi.mock('@/hooks/hr/useTeamCalendars', () => ({
  useTeamMembers: () => ({ data: TEAM_MEMBERS, isLoading: false, isError: false }),
}));

vi.mock('@/hooks/calendar/useCalendarEventActions', () => ({
  useCreateCalendarEvent: () => ({
    createEvent: mockCreateEvent,
    addReminder: mockAddReminder,
    addAttendees: mockAddAttendees,
    invalidateCalendar: mockInvalidateCalendar,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props);
  return {
    Calendar: Icon,
    Clock: Icon,
    MapPin: Icon,
    Loader2: Icon,
    Users: Icon,
    UserPlus: Icon,
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', null, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }) => React.createElement('button', { type: 'button', onClick, disabled, ...props }, children),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    id,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    id?: string;
  }) => React.createElement('input', { value, onChange, placeholder, id }),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => React.createElement('label', { htmlFor, className }, children),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    id,
    rows,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    id?: string;
    rows?: number;
  }) => React.createElement('textarea', { value, onChange, placeholder, id, rows }),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => React.createElement('div', { 'data-testid': 'calendar-component' }),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectValue: () => React.createElement('span', null, 'select'),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) =>
    React.createElement('input', {
      type: 'checkbox',
      checked,
      onChange: () => onCheckedChange?.(),
    }),
}));

vi.mock('@/components/calendrier/VideoConferenceSelector', () => ({
  VideoConferenceSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) =>
    React.createElement('input', {
      'data-testid': 'video-selector',
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    }),
}));

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

describe('EventCreatorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEvent.mockResolvedValue(CREATED_EVENT);
    mockFrom.mockImplementation(() => {
      const result = { data: PROFILES_RESULT, error: null as null | { message: string } };
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
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(onFulfilled, onRejected),
        catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
      };
      return builder;
    });
  });

  it('renders modal content with conversation and team participants', () => {
    render(
      <EventCreatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationId="conv-1"
        onEventCreated={mockOnEventCreated}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Nouvelle réunion')).toBeInTheDocument();
    expect(screen.getByText('Créer un événement dans votre calendrier')).toBeInTheDocument();
    expect(screen.getByLabelText('Titre *')).toBeInTheDocument();
    expect(screen.getByText('Participants de la conversation')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Durand')).toBeInTheDocument();
    expect(screen.getByText("Autres membres de l'équipe")).toBeInTheDocument();
    expect(screen.getByText('Chloé Bernard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer la réunion' })).toBeDisabled();
  });

  it('creates an event successfully with reminder and attendees', async () => {
    render(
      <EventCreatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationId="conv-1"
        onEventCreated={mockOnEventCreated}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText('Titre *'), {
      target: { value: '  Point équipe  ' },
    });

    fireEvent.change(screen.getByLabelText('Lieu (optionnel)'), {
      target: { value: 'Salle 2' },
    });

    fireEvent.change(screen.getByLabelText('Description (optionnel)'), {
      target: { value: 'Ordre du jour' },
    });

    fireEvent.change(screen.getByTestId('video-selector'), {
      target: { value: 'https://meet.local/room' },
    });

    fireEvent.click(screen.getByText('Alice Martin'));
    fireEvent.click(screen.getByText('Chloé Bernard'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer la réunion' }));
    });

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'cal-default',
        title: 'Point équipe',
        description: 'Ordre du jour',
        location: 'Salle 2',
        videoConferenceUrl: 'https://meet.local/room',
        createdBy: 'profile-current',
      })
    );

    const createEventPayload = mockCreateEvent.mock.calls[0][0] as {
      startTime: string;
      endTime: string;
    };
    expect(typeof createEventPayload.startTime).toBe('string');
    expect(typeof createEventPayload.endTime).toBe('string');
    expect(new Date(createEventPayload.endTime).getTime()).toBeGreaterThan(new Date(createEventPayload.startTime).getTime());

    expect(mockAddReminder).toHaveBeenCalledWith({
      event_id: 'event-1',
      user_id: 'user-1',
      minutes_before: 15,
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    expect(mockAddAttendees).toHaveBeenCalledWith([
      {
        event_id: 'event-1',
        user_id: 'user-conv-1',
        email: 'alice@test.co',
        display_name: 'Alice Martin',
        status: 'pending',
        role: 'required',
      },
      {
        event_id: 'event-1',
        user_id: 'user-team-1',
        email: 'chloe@test.co',
        display_name: 'Chloé Bernard',
        status: 'pending',
        role: 'optional',
      },
    ]);

    expect(mockInvalidateCalendar).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Réunion créée');
    expect(mockOnEventCreated).toHaveBeenCalledWith({ id: 'event-1', title: 'Point équipe' });
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles mutation error and shows error toast', async () => {
    mockCreateEvent.mockRejectedValueOnce(new Error('x'));

    render(
      <EventCreatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationId="conv-1"
        onEventCreated={mockOnEventCreated}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText('Titre *'), {
      target: { value: 'Réunion erreur' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer la réunion' }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la création de la réunion');
    });

    expect(mockDebugError).toHaveBeenCalled();
    expect(mockOnEventCreated).not.toHaveBeenCalled();
    expect(mockInvalidateCalendar).not.toHaveBeenCalled();
  });

  it('provides a QueryClientProvider wrapper for hooks with the expected defaults', () => {
    const { result } = renderHook(() => useQueryClient().getDefaultOptions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.queries?.retry).toBe(0);
    expect(result.current.queries?.gcTime).toBe(0);
    expect(result.current.mutations?.retry).toBe(0);
  });
});