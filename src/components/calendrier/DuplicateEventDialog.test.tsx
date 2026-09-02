// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { DuplicateEventDialog } from './DuplicateEventDialog';

const {
  AUTH_STATE,
  duplicateCalendarEventMock,
  toastSuccessMock,
  toastErrorMock,
  invalidateQueriesMock,
  parseOccurrenceIdMock,
  isOccurrenceIdMock,
  CALENDAR_DATES,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  duplicateCalendarEventMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  parseOccurrenceIdMock: vi.fn(),
  isOccurrenceIdMock: vi.fn(),
  CALENDAR_DATES: [new Date('2025-06-15T00:00:00.000Z'), new Date('2025-06-10T00:00:00.000Z')],
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/services/calendrier/duplicateCalendarEvent', () => ({
  duplicateCalendarEvent: duplicateCalendarEventMock,
}));

vi.mock('@/lib/recurrenceUtils', () => ({
  isOccurrenceId: isOccurrenceIdMock,
  parseOccurrenceId: parseOccurrenceIdMock,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    selected,
    onSelect,
  }: {
    selected: Date[];
    onSelect: (dates: Date[] | undefined) => void;
  }) => (
    <div>
      <div data-testid="calendar-selected-count">{selected.length}</div>
      <button type="button" onClick={() => onSelect(CALENDAR_DATES)}>
        sélectionner deux dates
      </button>
      <button type="button" onClick={() => onSelect([])}>
        vider calendrier
      </button>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Copy: () => <svg data-testid="icon-copy" />,
  X: () => <svg data-testid="icon-x" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

describe('DuplicateEventDialog', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
  );

  const event = {
    id: 'event-1',
    title: 'Cours de piano',
    start_time: '2025-05-01T09:30:00.000Z',
    end_time: '2025-05-01T11:00:00.000Z',
  };

  const renderComponent = (props?: Partial<React.ComponentProps<typeof DuplicateEventDialog>>) => {
    const queryClient = createQueryClient();
    const onOpenChange = vi.fn();

    const view = render(
      <QueryClientProvider client={queryClient}>
        <DuplicateEventDialog event={event} open onOpenChange={onOpenChange} {...props} />
      </QueryClientProvider>
    );

    return { ...view, onOpenChange };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isOccurrenceIdMock.mockReturnValue(false);
    parseOccurrenceIdMock.mockReturnValue(undefined);
  });

  it('monte correctement dans un QueryClientProvider via renderHook', () => {
    const { result } = renderHook(() => true, { wrapper });
    expect(result.current).toBe(true);
  });

  it('affiche l’état initial avec zéro date, le titre métier et le bouton de duplication désactivé', () => {
    renderComponent();

    expect(screen.getByText("Dupliquer vers d'autres dates")).toBeInTheDocument();
    expect(screen.getByText(/Cours de piano/)).toBeInTheDocument();
    const description = screen.getByText(/L'heure et la durée/);
    expect(description).toHaveTextContent(format(parseISO(event.start_time), 'HH:mm'));
    expect(description).toHaveTextContent(format(parseISO(event.end_time), 'HH:mm'));
    expect(screen.getByText('Aucune date sélectionnée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dupliquer \(0\)/ })).toBeDisabled();
  });

  it('sélectionne, trie et permet de retirer une date puis tout effacer', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'sélectionner deux dates' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dupliquer \(2\)/ })).toBeEnabled();
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Retirer cette date' });
    expect(removeButtons).toHaveLength(2);

    const badges = screen.getAllByTestId('badge');
    expect(badges.some((node) => node.textContent === '2')).toBe(true);

    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dupliquer \(1\)/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));

    await waitFor(() => {
      expect(screen.getByText('Aucune date sélectionnée')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dupliquer \(0\)/ })).toBeDisabled();
    });
  });

  it('ne lance pas la duplication tant qu’aucune date n’est sélectionnée', async () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /Dupliquer \(0\)/ })).toBeDisabled();
    expect(duplicateCalendarEventMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'sélectionner deux dates' }));
    fireEvent.click(screen.getByRole('button', { name: 'vider calendrier' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dupliquer \(0\)/ })).toBeDisabled();
    });

    expect(duplicateCalendarEventMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('duplique avec succès un événement simple et invalide le cache', async () => {
    duplicateCalendarEventMock.mockResolvedValue(2);

    const { onOpenChange } = renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'sélectionner deux dates' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dupliquer \(2\)/ }));
    });

    await waitFor(() => {
      expect(duplicateCalendarEventMock).toHaveBeenCalledWith({
        sourceId: 'event-1',
        selectedDates: CALENDAR_DATES,
        originalStart: new Date('2025-05-01T09:30:00.000Z'),
        durationMs: 90 * 60 * 1000,
        createdBy: 'u1',
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['calendar-events'] });
      expect(toastSuccessMock).toHaveBeenCalledWith('2 copies créées');
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.getByText('Aucune date sélectionnée')).toBeInTheDocument();
    });
  });

  it('utilise le parentId pour une occurrence récurrente', async () => {
    isOccurrenceIdMock.mockReturnValue(true);
    parseOccurrenceIdMock.mockReturnValue({ parentId: 'parent-42' });
    duplicateCalendarEventMock.mockResolvedValue(1);

    renderComponent({
      event: {
        ...event,
        id: 'parent-42__2025-05-01',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'sélectionner deux dates' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dupliquer \(2\)/ }));
    });

    await waitFor(() => {
      expect(duplicateCalendarEventMock).toHaveBeenCalledWith({
        sourceId: 'parent-42',
        selectedDates: CALENDAR_DATES,
        originalStart: new Date('2025-05-01T09:30:00.000Z'),
        durationMs: 90 * 60 * 1000,
        createdBy: 'u1',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('1 copie créée');
  });

  it('affiche l’état de chargement pendant la soumission puis gère une erreur métier', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;

    duplicateCalendarEventMock.mockImplementation(
      () =>
        new Promise<number>((_, reject) => {
          rejectRequest = reject;
        })
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'sélectionner deux dates' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dupliquer \(2\)/ }));
    });

    await waitFor(() => {
      expect(screen.getByText('Duplication…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Duplication…/ })).toBeDisabled();
    });

    await act(async () => {
      if (rejectRequest) {
        rejectRequest(new Error('x'));
      }
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('x');
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(invalidateQueriesMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Annuler/ })).toBeEnabled();
      expect(screen.getByRole('button', { name: /Dupliquer \(2\)/ })).toBeEnabled();
    });

    errorSpy.mockRestore();
  });
});