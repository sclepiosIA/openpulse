// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarUnifiedAgendaView } from './CalendarUnifiedAgendaView';

const {
  deleteMutate,
  onTaskClick,
  onEventClick,
  TASKS,
  EVENTS,
  ABSENCES,
  FILTERS_ALL,
  FILTERS_NONE,
} = vi.hoisted(() => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toIsoLocal = (date: Date, hour = 0, minute = 0) => {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00`;
  };

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return {
    deleteMutate: vi.fn(),
    onTaskClick: vi.fn(),
    onEventClick: vi.fn(),
    TASKS: [
      {
        id: 'task-1',
        titre: 'Préparer dossier',
        echeance: toIsoLocal(today, 9, 0),
        statut: 'En cours',
        etablissements: { nom: 'Clinique A' },
      },
      {
        id: 'task-2',
        titre: 'Tâche passée',
        echeance: toIsoLocal(yesterday, 14, 0),
        statut: 'Bloqué',
        etablissements: { nom: 'Centre B' },
      },
    ],
    EVENTS: [
      {
        id: 'event-1',
        title: 'Réunion équipe',
        start_time: toIsoLocal(today, 10, 30),
        end_time: toIsoLocal(today, 11, 30),
        all_day: false,
        location: 'Salle 3',
        color: '#ff9900',
        calendar: { color: '#00aa00' },
      },
      {
        id: 'event-2',
        title: 'Point demain',
        start_time: toIsoLocal(tomorrow, 8, 0),
        end_time: toIsoLocal(tomorrow, 9, 0),
        all_day: true,
        color: '#3366ff',
        calendar: { color: '#3366ff' },
      },
    ],
    ABSENCES: [
      {
        id: 'abs-1',
        title: 'Congé',
        profile_name: 'Marie Dupont',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        end: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()),
        type: 'vacation',
        color: '#aa22cc',
      },
    ],
    FILTERS_ALL: {
      showTasks: true,
      showEvents: true,
      showAbsences: true,
    },
    FILTERS_NONE: {
      showTasks: false,
      showEvents: false,
      showAbsences: false,
    },
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
    <div>{children}</div>
  ),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Calendar: Icon,
    CalendarIcon: Icon,
    MapPin: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Video: Icon,
    UserMinus: Icon,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('./CalendarItemTooltip', () => ({
  CalendarItemTooltip: ({ item, type }: { item: { id?: string }; type: string }) => (
    <div data-testid={`tooltip-${type}-${item.id ?? 'x'}`}>tooltip</div>
  ),
}));

vi.mock('./CalendarItemContextMenu', () => ({
  CalendarItemContextMenu: ({
    children,
  }: {
    children: React.ReactNode;
    item: unknown;
    type: string;
    onEdit?: () => void;
    onDelete?: () => void;
  }) => <div>{children}</div>,
}));

vi.mock('@/hooks/tasks/useTaches', () => ({
  useDeleteTache: () => ({
    mutate: deleteMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('CalendarUnifiedAgendaView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un état vide quand aucun filtre n’est actif', () => {
    renderWithClient(
      <CalendarUnifiedAgendaView
        tasks={TASKS}
        events={EVENTS}
        absences={ABSENCES}
        onTaskClick={onTaskClick}
        onEventClick={onEventClick}
        contentFilters={FILTERS_NONE}
      />,
    );

    expect(screen.getByText('Aucun élément')).toBeInTheDocument();
    expect(screen.getByText(/Activez les filtres/)).toBeInTheDocument();
    expect(screen.getByText('0 éléments')).toBeInTheDocument();
  });

  it('affiche les tâches, événements et absences à venir et déclenche les callbacks métier', () => {
    renderWithClient(
      <CalendarUnifiedAgendaView
        tasks={TASKS}
        events={EVENTS}
        absences={ABSENCES}
        onTaskClick={onTaskClick}
        onEventClick={onEventClick}
        contentFilters={FILTERS_ALL}
      />,
    );

    expect(screen.getByText('Préparer dossier')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Clinique A')).toBeInTheDocument();

    expect(screen.getByText('Réunion équipe')).toBeInTheDocument();
    expect(screen.getByText('Salle 3')).toBeInTheDocument();
    expect(screen.getByText('Journée')).toBeInTheDocument();

    expect(screen.getAllByText('Absence').length).toBeGreaterThan(0);
    expect(screen.getByText('Aujourd\'hui')).toBeInTheDocument();
    expect(screen.getByText('Demain')).toBeInTheDocument();

    expect(screen.getByText('5 éléments')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Préparer dossier'));
    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick).toHaveBeenCalledWith(TASKS[0]);

    fireEvent.click(screen.getByText('Réunion équipe'));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(EVENTS[0]);
  });

  it('inclut les éléments passés quand on active le bouton Passé', () => {
    renderWithClient(
      <CalendarUnifiedAgendaView
        tasks={TASKS}
        events={EVENTS}
        absences={ABSENCES}
        onTaskClick={onTaskClick}
        onEventClick={onEventClick}
        contentFilters={FILTERS_ALL}
      />,
    );

    expect(screen.queryByText('Tâche passée')).not.toBeInTheDocument();
    expect(screen.getByText('5 éléments')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Passé/i }));

    expect(screen.getByText('Tâche passée')).toBeInTheDocument();
    expect(screen.getByText('Bloqué')).toBeInTheDocument();
    expect(screen.getByText('6 éléments')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tâche passée'));
    expect(onTaskClick).toHaveBeenCalledWith(TASKS[1]);
  });

  it('étend la fenêtre à 90 jours via le contrôle dédié', () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 60);
    const iso = `${farFuture.getFullYear()}-${String(farFuture.getMonth() + 1).padStart(2, '0')}-${String(farFuture.getDate()).padStart(2, '0')}T12:00:00`;

    const futureEvent = {
      id: 'event-60',
      title: 'Événement lointain',
      start_time: iso,
      end_time: iso,
      all_day: false,
      location: 'Visio',
      color: '#123456',
      calendar: { color: '#654321' },
    };

    renderWithClient(
      <CalendarUnifiedAgendaView
        tasks={TASKS}
        events={[...EVENTS, futureEvent]}
        absences={ABSENCES}
        onTaskClick={onTaskClick}
        onEventClick={onEventClick}
        contentFilters={FILTERS_ALL}
      />,
    );

    expect(screen.queryByText('Événement lointain')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '30 jours' }));

    expect(screen.getByRole('button', { name: '90 jours' })).toBeInTheDocument();
    expect(screen.getByText('Événement lointain')).toBeInTheDocument();
    expect(screen.getByText('6 éléments')).toBeInTheDocument();
  });
});