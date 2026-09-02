import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarUnifiedTimelineView } from './CalendarUnifiedTimelineView';

const {
  MOCK_DELETE_TACHE,
  MOCK_BUILD_CONTINUOUS_BANNERS,
  MOCK_SPLIT_EVENTS_BY_DAY,
} = vi.hoisted(() => ({
  MOCK_DELETE_TACHE: vi.fn(),
  MOCK_BUILD_CONTINUOUS_BANNERS: vi.fn(),
  MOCK_SPLIT_EVENTS_BY_DAY: vi.fn(),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ref }: { children: React.ReactNode; ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} data-testid="scroll-area">
      <div data-radix-scroll-area-viewport="" />
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  CheckSquare: () => <svg data-testid="check-square" />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('./ClickableLocation', () => ({
  ClickableLocation: () => null,
}));

vi.mock('./CalendarItemTooltip', () => ({
  CalendarItemTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./CalendarItemContextMenu', () => ({
  CalendarItemContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/tasks/useTaches', () => ({
  useDeleteTache: () => MOCK_DELETE_TACHE,
}));

vi.mock('./calendarTimelineHelpers', () => ({
  buildContinuousBanners: MOCK_BUILD_CONTINUOUS_BANNERS,
  splitEventsByDay: MOCK_SPLIT_EVENTS_BY_DAY,
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

describe('CalendarUnifiedTimelineView', () => {
  const baseDate = new Date('2024-04-17T10:00:00');

  const defaultProps = {
    tasks: [],
    events: [],
    absences: [],
    currentDate: baseDate,
    onDateChange: vi.fn(),
    onTaskClick: vi.fn(),
    onEventClick: vi.fn(),
    onCreateEvent: vi.fn(),
    contentFilters: {
      showTasks: true,
      showAbsences: true,
      showEvents: true,
    },
    startHour: 7,
    endHour: 19,
    currentAuthUserId: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_SPLIT_EVENTS_BY_DAY.mockReturnValue({
      allDayEventsByDay: {},
      timedEventsByDay: {},
    });
    MOCK_BUILD_CONTINUOUS_BANNERS.mockReturnValue([]);
  });

  it('affiche les entêtes de la semaine et les jours en français', () => {
    render(<CalendarUnifiedTimelineView {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('lun.')).toBeInTheDocument();
    expect(screen.getByText('mar.')).toBeInTheDocument();
    expect(screen.getByText('mer.')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it('affiche la section Journée et le titre de bannière continue pour une tâche', () => {
    MOCK_BUILD_CONTINUOUS_BANNERS.mockReturnValue([
      {
        type: 'task',
        id: 'task-1',
        title: 'Tâche continue',
        startColumn: 1,
        endColumn: 2,
        row: 0,
        color: '#123456',
        originalItem: {
          id: 'task-1',
          title: 'Tâche continue',
          echeance: '2024-04-16T00:00:00',
        },
      },
    ]);

    render(<CalendarUnifiedTimelineView {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('Journée')).toBeInTheDocument();
    expect(screen.getByText('Tâche continue')).toBeInTheDocument();
    expect(screen.getByTestId('check-square')).toBeInTheDocument();
  });

  it('n affiche pas la section Journée quand il n y a aucune bannière continue', () => {
    render(<CalendarUnifiedTimelineView {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Journée')).not.toBeInTheDocument();
  });

  it('passe les bons paramètres aux helpers de timeline', () => {
    const tasks = [{ id: 't1', title: 'Relance', echeance: '2024-04-17T09:00:00' }];
    const events = [{ id: 'e1', title: 'Réunion' }];
    const absences = [
      {
        id: 'a1',
        start: new Date('2024-04-17T00:00:00'),
        end: new Date('2024-04-18T00:00:00'),
      },
    ];

    render(
      <CalendarUnifiedTimelineView
        {...defaultProps}
        tasks={tasks}
        events={events}
        absences={absences}
      />,
      { wrapper: createWrapper() },
    );

    expect(MOCK_SPLIT_EVENTS_BY_DAY).toHaveBeenCalledTimes(1);
    expect(MOCK_SPLIT_EVENTS_BY_DAY).toHaveBeenCalledWith(
      expect.objectContaining({
        events,
        contentFilters: defaultProps.contentFilters,
        startHour: 7,
        endHour: 19,
      }),
    );

    expect(MOCK_BUILD_CONTINUOUS_BANNERS).toHaveBeenCalledTimes(1);
    expect(MOCK_BUILD_CONTINUOUS_BANNERS).toHaveBeenCalledWith(
      expect.objectContaining({
        events,
        absences,
        tasks,
        contentFilters: defaultProps.contentFilters,
      }),
    );
  });
});