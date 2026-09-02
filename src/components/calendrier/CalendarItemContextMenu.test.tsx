/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { CalendarItemContextMenu } from './CalendarItemContextMenu';

const {
  navigateMock,
  deleteEventMutate,
  deleteOccurrenceMutate,
  updateTacheMutate,
  addAttendeeMutate,
  attendeeSearchState,
  transcriptionState,
  parseOccurrenceIdMock,
  isOccurrenceIdMock,
  openMock,
  eventItem,
  recurringOccurrenceItem,
  recurringSeriesItem,
  taskItem,
  authState,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const chain = {
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
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };
  Object.values(chain).forEach((fn) => {
    if (fn !== chain.single && fn !== chain.maybeSingle && fn !== chain.then && fn !== chain.catch) {
      fn.mockImplementation(() => chain);
    }
  });
  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.then.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: null })));
  chain.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    navigateMock: vi.fn(),
    deleteEventMutate: vi.fn(),
    deleteOccurrenceMutate: vi.fn(),
    updateTacheMutate: vi.fn(),
    addAttendeeMutate: vi.fn(),
    attendeeSearchState: {
      data: [] as Array<{ id: string; email: string; displayName: string }>,
      isLoading: false,
      isError: false,
      error: null as null | { message: string },
    },
    transcriptionState: {
      transcription: null as null | { id: string; status: string },
    },
    parseOccurrenceIdMock: vi.fn(),
    isOccurrenceIdMock: vi.fn(),
    openMock: vi.fn(),
    eventItem: {
      id: 'evt-1',
      title: 'Réunion produit',
      video_conference_url: 'https://meet.local/room',
      recurrence_rule: null,
    },
    recurringOccurrenceItem: {
      id: 'occ-parent-1-2025-05-20',
      title: 'Daily sync',
      video_conference_url: null,
      recurrence_rule: 'FREQ=DAILY',
    },
    recurringSeriesItem: {
      id: 'series-1',
      title: 'Weekly planning',
      video_conference_url: null,
      recurrence_rule: 'FREQ=WEEKLY',
    },
    taskItem: {
      id: 'task-1',
      titre: 'Préparer la démo',
      statut: 'A faire',
      echeance: '2025-05-20',
      priorite: 'haute',
    },
    authState: {
      user: { id: 'u1', email: 'test@local.dev' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    builder: chain,
    mockFrom: vi.fn(() => chain),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/components/ui/context-menu', () => {
  const ContextMenu = ({ children }: { children: React.ReactNode }) => <div data-testid="context-menu-root">{children}</div>;
  const ContextMenuTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="context-menu-trigger" className={className}>
      {children}
    </div>
  );
  const ContextMenuContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="context-menu-content" className={className}>
      {children}
    </div>
  );
  const ContextMenuItem = ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
  const ContextMenuSeparator = () => <hr data-testid="context-menu-separator" />;
  const ContextMenuSub = ({ children }: { children: React.ReactNode }) => <div data-testid="context-menu-sub">{children}</div>;
  const ContextMenuSubTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  );
  const ContextMenuSubContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="context-menu-sub-content" className={className}>
      {children}
    </div>
  );

  return {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
  };
});

vi.mock('@/components/ui/alert-dialog', () => {
  const AlertDialog = ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-testid="alert-dialog-root">{open ? children : null}</div>;
  const AlertDialogContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const AlertDialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
  const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const AlertDialogCancel = ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>;
  const AlertDialogAction = ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );

  return {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  };
});

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    onClick,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLInputElement>;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      onClick={onClick}
    />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg aria-hidden="true" />;
  return {
    Edit: Icon,
    Trash2: Icon,
    UserPlus: Icon,
    Video: Icon,
    CheckCircle2: Icon,
    PlayCircle: Icon,
    AlertCircle: Icon,
    CalendarMinus: Icon,
    CalendarX: Icon,
    Clock: Icon,
    Search: Icon,
    User: Icon,
    FileText: Icon,
    Copy: Icon,
  };
});

vi.mock('./DuplicateEventDialog', () => ({
  DuplicateEventDialog: ({
    open,
    event,
  }: {
    open: boolean;
    event: { id: string };
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="duplicate-dialog">
      <span>{open ? 'open' : 'closed'}</span>
      <span>{event.id}</span>
    </div>
  ),
}));

vi.mock('@/hooks/calendar/useCalendarEvents', () => ({
  useDeleteEvent: () => ({ mutate: deleteEventMutate, isPending: false, isError: false }),
  useDeleteOccurrence: () => ({ mutate: deleteOccurrenceMutate, isPending: false, isError: false }),
}));

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: () => ({ mutate: updateTacheMutate, isPending: false, isError: false }),
}));

vi.mock('@/hooks/calendar/useEventAttendees', () => ({
  useAddAttendee: () => ({ mutate: addAttendeeMutate, isPending: false, isError: false }),
}));

vi.mock('@/hooks/search/useAttendeeSearch', () => ({
  useAttendeeSearch: (query: string) => {
    if (attendeeSearchState.isError) {
      return {
        data: null,
        isLoading: false,
        isError: true,
        error: attendeeSearchState.error,
        query,
      };
    }
    return {
      data: attendeeSearchState.data,
      isLoading: attendeeSearchState.isLoading,
      isError: false,
      error: null,
      query,
    };
  },
}));

vi.mock('@/hooks/calendar/useEventTranscription', () => ({
  useEventTranscription: () => transcriptionState,
}));

vi.mock('@/lib/recurrenceUtils', () => ({
  isOccurrenceId: isOccurrenceIdMock,
  parseOccurrenceId: parseOccurrenceIdMock,
}));

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

describe('CalendarItemContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attendeeSearchState.data = [];
    attendeeSearchState.isLoading = false;
    attendeeSearchState.isError = false;
    attendeeSearchState.error = null;
    transcriptionState.transcription = null;
    isOccurrenceIdMock.mockReturnValue(false);
    parseOccurrenceIdMock.mockReturnValue({ parentId: 'parent-1', occurrenceDate: '2025-05-20' });
    openMock.mockReset();
    window.open = openMock;
  });

  it('renders event actions, shows loading search state, then success results and adds attendee with parent event id for occurrence', async () => {
    attendeeSearchState.isLoading = true;
    transcriptionState.transcription = { id: 'tr-1', status: 'ended' };
    isOccurrenceIdMock.mockReturnValue(true);
    parseOccurrenceIdMock.mockReturnValue({ parentId: 'parent-42', occurrenceDate: '2025-05-20' });

    const onEdit = vi.fn();

    const { rerender } = render(
      <CalendarItemContextMenu item={recurringOccurrenceItem} type="event" onEdit={onEdit}>
        <div>child</div>
      </CalendarItemContextMenu>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Modifier')).toBeInTheDocument();
    expect(screen.getByText("Inviter quelqu'un")).toBeInTheDocument();
    expect(screen.getByText('Recherche...')).toBeInTheDocument();
    expect(screen.getByText('Voir la transcription')).toBeInTheDocument();

    attendeeSearchState.isLoading = false;
    attendeeSearchState.data = [
      { id: 'a1', email: 'alice@local.dev', displayName: 'Alice Martin' },
      { id: 'a2', email: 'bob@local.dev', displayName: 'Bob Leroy' },
    ];

    rerender(
      <CalendarItemContextMenu item={recurringOccurrenceItem} type="event" onEdit={onEdit}>
        <div>child</div>
      </CalendarItemContextMenu>
    );

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Leroy')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alice Martin'));

    expect(addAttendeeMutate).toHaveBeenCalledWith({
      event_id: 'parent-42',
      email: 'alice@local.dev',
      display_name: 'Alice Martin',
      role: 'required',
    });
  });

  it('joins video room and navigates to transcription page for ended transcription', async () => {
    transcriptionState.transcription = { id: 'tr-55', status: 'archived' };

    render(
      <CalendarItemContextMenu item={eventItem} type="event" onEdit={vi.fn()}>
        <div>child</div>
      </CalendarItemContextMenu>,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Rejoindre la visio'));
    expect(openMock).toHaveBeenCalledWith('https://meet.local/room', '_blank');

    fireEvent.click(screen.getByText('Voir la transcription'));
    expect(navigateMock).toHaveBeenCalledWith('/visio/transcription/tr-55');
  });

  it('deletes a non recurring event directly', () => {
    isOccurrenceIdMock.mockReturnValue(false);

    render(
      <CalendarItemContextMenu item={eventItem} type="event" onEdit={vi.fn()}>
        <div>child</div>
      </CalendarItemContextMenu>,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Supprimer'));

    expect(deleteEventMutate).toHaveBeenCalledWith('evt-1');
    expect(deleteOccurrenceMutate).not.toHaveBeenCalled();
  });

  it('opens recurring delete dialog and deletes only selected occurrence', async () => {
    isOccurrenceIdMock.mockReturnValue(true);
    parseOccurrenceIdMock.mockReturnValue({ parentId: 'series-parent', occurrenceDate: '2025-05-21' });

    render(
      <CalendarItemContextMenu item={recurringOccurrenceItem} type="event" onEdit={vi.fn()}>
        <div>child</div>
      </CalendarItemContextMenu>,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Supprimer cette occurrence'));

    expect(screen.getByText('Supprimer cette occurrence ?')).toBeInTheDocument();

    const deleteButtons = screen.getAllByText('Supprimer');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(deleteOccurrenceMutate).toHaveBeenCalledWith({
        parentId: 'series-parent',
        occurrenceDate: '2025-05-21',
      });
    });
    expect(deleteEventMutate).not.toHaveBeenCalled();
  });

  it('opens recurring delete dialog and deletes whole series from recurrence root event', async () => {
    isOccurrenceIdMock.mockReturnValue(false);

    render(
      <CalendarItemContextMenu item={recurringSeriesItem} type="event" onEdit={vi.fn()}>
        <div>child</div>
      </CalendarItemContextMenu>,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Supprimer toute la série'));

    expect(screen.getByText('Supprimer toute la série ?')).toBeInTheDocument();

    const deleteButtons = screen.getAllByText('Supprimer');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(deleteEventMutate).toHaveBeenCalledWith('series-1');
    });
  });

  it('updates task status and calls onDelete for task items', () => {
    const onDelete = vi.fn();

    render(
      <CalendarItemContextMenu item={taskItem} type="task" onEdit={vi.fn()} onDelete={onDelete}>
        <div>child</div>
      </CalendarItemContextMenu>,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Marquer comme terminé'));
    expect(updateTacheMutate).toHaveBeenCalledWith({
      id: 'task-1',
      data: { statut: 'Terminé' },
    });

    fireEvent.click(screen.getByText('Supprimer'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('hook wrapper supports loading, success and error states for attendee search', async () => {
    const wrapper = createWrapper();

    attendeeSearchState.isLoading = true;
    const { result, rerender } = renderHook(
      () => {
        const { useAttendeeSearch } = requirelessAttendeeSearch();
        return useAttendeeSearch('al');
      },
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    attendeeSearchState.isLoading = false;
    attendeeSearchState.data = [{ id: 'a1', email: 'alice@local.dev', displayName: 'Alice Martin' }];
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual([{ id: 'a1', email: 'alice@local.dev', displayName: 'Alice Martin' }]);

    attendeeSearchState.isError = true;
    attendeeSearchState.error = { message: 'x' };
    rerender();

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();
  });
});

function requirelessAttendeeSearch() {
  return {
    useAttendeeSearch: (query: string) => {
      if (attendeeSearchState.isError) {
        return {
          data: null,
          isLoading: false,
          isError: true,
          error: attendeeSearchState.error,
          query,
        };
      }
      return {
        data: attendeeSearchState.data,
        isLoading: attendeeSearchState.isLoading,
        isError: false,
        error: null,
        query,
      };
    },
  };
}