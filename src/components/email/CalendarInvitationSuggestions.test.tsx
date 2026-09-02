/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarInvitationSuggestions } from './CalendarInvitationSuggestions';

const {
  SUGGESTIONS,
  ETABLISSEMENTS,
  AUTH_STATE,
  acceptSuggestionMock,
  acceptToCalendarMock,
  rejectSuggestionMock,
  useCalendarSuggestionsMock,
  mockFrom,
  mockNavigate,
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
} = vi.hoisted(() => ({
  SUGGESTIONS: [
    {
      id: 's1',
      event_summary: 'Réunion de coordination',
      event_dtstart: '2025-01-15T09:00:00.000Z',
      event_dtend: '2025-01-15T09:45:00.000Z',
      event_meeting_link: 'https://meet.google.com/abc-defg-hij',
      event_location: 'Paris',
      event_organizer: 'alice@example.test',
      event_attendees: [
        { name: 'Alice', email: 'alice@example.test' },
        { name: 'Bob', email: 'bob@example.test' },
        { name: 'Chloé', email: 'chloe@example.test' },
        { name: 'David', email: 'david@example.test' },
        { name: 'Emma', email: 'emma@example.test' },
        { name: 'Félix', email: 'felix@example.test' },
      ],
      thread: { subject: 'Organisation réunion janvier' },
      thread_summary: 'Discussion autour du point hebdomadaire et des prochaines étapes.',
      event_description: 'Description complète',
    },
  ],
  ETABLISSEMENTS: [
    { id: 'e1', nom: 'Clinique du Centre', ville: 'Lyon' },
    { id: 'e2', nom: 'Hôpital Nord', ville: 'Lille' },
  ],
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.test' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  acceptSuggestionMock: vi.fn(),
  acceptToCalendarMock: vi.fn(),
  rejectSuggestionMock: vi.fn(),
  useCalendarSuggestionsMock: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  SUCCESS_RESPONSE: {
    data: [
      { id: 'e1', nom: 'Clinique du Centre', ville: 'Lyon' },
      { id: 'e2', nom: 'Hôpital Nord', ville: 'Lille' },
    ],
    error: null,
  },
  ERROR_RESPONSE: {
    data: null,
    error: { message: 'x' },
  },
}));

vi.mock('@/hooks/calendar/useCalendarSuggestions', () => ({
  useCalendarSuggestions: useCalendarSuggestionsMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-open={open ? 'true' : 'false'} data-onopenchange={Boolean(onOpenChange)}>{children}</div>,
  CollapsibleTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactElement;
    asChild?: boolean;
  }) => (asChild ? children : <button type="button">{children}</button>),
  CollapsibleContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => onValueChange?.('e1')}>
        mock-select-{value ?? ''}
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return {
    Calendar: Icon,
    MapPin: Icon,
    Clock: Icon,
    User: Icon,
    Check: Icon,
    X: Icon,
    AlertCircle: Icon,
    Video: Icon,
    CalendarPlus: Icon,
    ListTodo: Icon,
    Users: Icon,
  };
});

function createBuilder(response: { data: unknown; error: { message: string } | null }) {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (
      onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
    finally: (onFinally?: () => void) => Promise.resolve(response).finally(onFinally),
  };
  return builder;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderWithClient(queryClient?: QueryClient) {
  const client = queryClient ?? createQueryClient();
  return {
    queryClient: client,
    ...render(
      <QueryClientProvider client={client}>
        <CalendarInvitationSuggestions />
      </QueryClientProvider>,
    ),
  };
}

describe('CalendarInvitationSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche l’état de chargement', () => {
    useCalendarSuggestionsMock.mockReturnValue({
      suggestions: [],
      isLoading: true,
      acceptSuggestion: acceptSuggestionMock,
      acceptToCalendar: acceptToCalendarMock,
      rejectSuggestion: rejectSuggestionMock,
      isAccepting: false,
      isAcceptingToCalendar: false,
      isRejecting: false,
    });

    mockFrom.mockReturnValue(createBuilder(SUCCESS_RESPONSE));

    renderWithClient();

    expect(screen.getByText('Invitations visio en attente')).toBeInTheDocument();
    expect(screen.getByText('Chargement des invitations...')).toBeInTheDocument();
  });

  it('affiche les données métier et permet les actions accepter calendrier, créer tâche et ignorer', async () => {
    const user = userEvent.setup();

    useCalendarSuggestionsMock.mockReturnValue({
      suggestions: SUGGESTIONS,
      isLoading: false,
      acceptSuggestion: acceptSuggestionMock,
      acceptToCalendar: acceptToCalendarMock,
      rejectSuggestion: rejectSuggestionMock,
      isAccepting: false,
      isAcceptingToCalendar: false,
      isRejecting: false,
    });

    const etabBuilder = createBuilder(SUCCESS_RESPONSE);
    mockFrom.mockReturnValue(etabBuilder);

    renderWithClient();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    expect(screen.getByText('1 invitation en attente de traitement')).toBeInTheDocument();
    expect(screen.getByText('Réunion de coordination')).toBeInTheDocument();
    expect(screen.getByText('📧 Organisation réunion janvier')).toBeInTheDocument();
    expect(screen.getByText(/Google Meet/)).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('alice@example.test')).toBeInTheDocument();
    expect(screen.getByText('6 participants')).toBeInTheDocument();
    expect(screen.getByText('+1 autres')).toBeInTheDocument();
    expect(screen.getByText('Discussion autour du point hebdomadaire et des prochaines étapes.')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('BO')).toBeInTheDocument();

    const meetingLink = screen.getByRole('link', { name: /ouvrir le lien de la réunion/i });
    expect(meetingLink).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /ajouter à mon agenda/i }));
    });
    expect(acceptToCalendarMock).toHaveBeenCalledWith({ suggestionId: 's1' });

    expect(screen.getByText('Clinique du Centre - Lyon')).toBeInTheDocument();
    expect(screen.getByText('Hôpital Nord - Lille')).toBeInTheDocument();

    const createTaskButton = screen.getByRole('button', { name: /créer la tâche/i });
    expect(createTaskButton).toBeDisabled();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /mock-select-/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /créer la tâche/i })).toBeEnabled();
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /créer la tâche/i }));
    });
    expect(acceptSuggestionMock).toHaveBeenCalledWith({
      suggestionId: 's1',
      etablissementId: 'e1',
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /ignorer cette invitation/i }));
    });
    expect(rejectSuggestionMock).toHaveBeenCalledWith('s1');

    expect(etabBuilder.select).toHaveBeenCalledWith('id, nom, ville');
    expect(etabBuilder.order).toHaveBeenCalledWith('nom');
  });

  it('met la query établissements en erreur quand la requête échoue', async () => {
    useCalendarSuggestionsMock.mockReturnValue({
      suggestions: SUGGESTIONS,
      isLoading: false,
      acceptSuggestion: acceptSuggestionMock,
      acceptToCalendar: acceptToCalendarMock,
      rejectSuggestion: rejectSuggestionMock,
      isAccepting: false,
      isAcceptingToCalendar: false,
      isRejecting: false,
    });

    const errorBuilder = createBuilder(ERROR_RESPONSE);
    mockFrom.mockReturnValue(errorBuilder);

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['etablissements-list'],
          queryFn: async () => {
            const { data, error } = await mockFrom('etablissements')
              .select('id, nom, ville')
              .order('nom');

            if (error) {
              throw error;
            }

            return data;
          },
        }),
      { wrapper },
    );

    renderWithClient(queryClient);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });

    await waitFor(() => {
      const state = queryClient.getQueryState(['etablissements-list']);
      expect(state?.status).toBe('error');
    });

    const state = queryClient.getQueryState(['etablissements-list']);
    expect(state?.error).toEqual({ message: 'x' });
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(errorBuilder.select).toHaveBeenCalledWith('id, nom, ville');
    expect(errorBuilder.order).toHaveBeenCalledWith('nom');
  });
});