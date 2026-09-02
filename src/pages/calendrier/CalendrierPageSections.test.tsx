/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendrierHero, CalendrierControlBar, CalendrierTaskDetailsDialog } from './CalendrierPageSections';

const {
  stableUser,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  mockOnCreateEvent,
  mockOnCreateTask,
  mockOnOpenSync,
  mockOnExport,
  mockOnToggleFilters,
  mockOnTaskClick,
  mockOnCalendarToggle,
  mockOnSelectAllCalendars,
  mockOnDeselectAllCalendars,
  mockOnToggleEstablishmentTasks,
  mockOnOpenMobileDrawer,
  mockOnToggleSidebar,
  mockOnDateChange,
  mockOnActiveViewChange,
  mockOnContentFiltersChange,
  mockOnOpenChange,
  mockOnStatusChange,
} = vi.hoisted(() => {
  const makeBuilder = () => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
      catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return builder;
  };

  return {
    stableUser: { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(() => makeBuilder()),
    mockOnCreateEvent: vi.fn(),
    mockOnCreateTask: vi.fn(),
    mockOnOpenSync: vi.fn(),
    mockOnExport: vi.fn(),
    mockOnToggleFilters: vi.fn(),
    mockOnTaskClick: vi.fn(),
    mockOnCalendarToggle: vi.fn(),
    mockOnSelectAllCalendars: vi.fn(),
    mockOnDeselectAllCalendars: vi.fn(),
    mockOnToggleEstablishmentTasks: vi.fn(),
    mockOnOpenMobileDrawer: vi.fn(),
    mockOnToggleSidebar: vi.fn(),
    mockOnDateChange: vi.fn(),
    mockOnActiveViewChange: vi.fn(),
    mockOnContentFiltersChange: vi.fn(),
    mockOnOpenChange: vi.fn(),
    mockOnStatusChange: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: stableUser.user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: stableUser.session }, error: null })),
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ariaLabel,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ariaLabel?: string }) => (
    <button onClick={onClick} aria-label={ariaLabel ?? props['aria-label']} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/calendrier/CalendarHeaderActions', () => ({
  CalendarHeaderActions: (props: {
    onCreateEvent: () => void;
    onCreateTask: () => void;
    onOpenSync: () => void;
    onExport: () => void;
    onToggleFilters: () => void;
    hasActiveFilters: boolean;
    showFilters: boolean;
    establishmentTaskCount: number;
  }) => (
    <div data-testid="calendar-header-actions">
      <button onClick={props.onCreateEvent}>create-event</button>
      <button onClick={props.onCreateTask}>create-task</button>
      <button onClick={props.onOpenSync}>open-sync</button>
      <button onClick={props.onExport}>export</button>
      <button onClick={props.onToggleFilters}>toggle-filters</button>
      <span>{props.hasActiveFilters ? 'filters-on' : 'filters-off'}</span>
      <span>{props.showFilters ? 'shown' : 'hidden'}</span>
      <span>etab:{props.establishmentTaskCount}</span>
    </div>
  ),
}));

vi.mock('@/components/calendrier/CalendarMiniNav', () => ({
  CalendarMiniNav: (props: { currentDate: Date; onDateChange: (d: Date) => void; view: string }) => (
    <div data-testid="calendar-mini-nav">
      <span>{props.currentDate.toISOString().slice(0, 10)}</span>
      <span>{props.view}</span>
      <button onClick={() => props.onDateChange(new Date('2025-02-15T00:00:00.000Z'))}>change-date</button>
    </div>
  ),
}));

vi.mock('@/components/calendrier/CalendarContentToggle', () => ({
  CalendarContentToggle: (props: {
    filters: { showEstablishmentTasks: boolean; showTasks?: boolean; showEvents?: boolean; showAbsences?: boolean };
    onChange: (f: { showEstablishmentTasks: boolean; showTasks?: boolean; showEvents?: boolean; showAbsences?: boolean }) => void;
    taskCount: number;
    eventCount: number;
    absenceCount: number;
    establishmentTaskCount: number;
  }) => (
    <div data-testid="calendar-content-toggle">
      <span>tasks:{props.taskCount}</span>
      <span>events:{props.eventCount}</span>
      <span>absences:{props.absenceCount}</span>
      <span>etab:{props.establishmentTaskCount}</span>
      <button
        onClick={() =>
          props.onChange({
            ...props.filters,
            showEstablishmentTasks: !props.filters.showEstablishmentTasks,
          })
        }
      >
        toggle-content
      </button>
    </div>
  ),
}));

vi.mock('@/components/tasks/TacheDocuments', () => ({
  TacheDocuments: ({ tacheId, tacheTitre }: { tacheId: string; tacheTitre: string }) => (
    <div data-testid="tache-documents">
      docs:{tacheId}:{tacheTitre}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Menu: ({ className }: { className?: string }) => <svg data-testid="icon-menu" className={className} />,
  Calendar: ({ className }: { className?: string }) => <svg data-testid="icon-calendar" className={className} />,
  PanelLeftClose: ({ className }: { className?: string }) => <svg data-testid="icon-panel-left-close" className={className} />,
  PanelLeft: ({ className }: { className?: string }) => <svg data-testid="icon-panel-left" className={className} />,
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

describe('CalendrierPageSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend CalendrierHero desktop avec les compteurs métier et relaie les actions', () => {
    const Wrapper = createWrapper();

    render(
      <CalendrierHero
        isMobile={false}
        isStandaloneMobileApp={false}
        taskCount={12}
        eventCount={3}
        absenceCount={1}
        hasActiveFilters={true}
        showFilters={false}
        displayedTasks={[{ id: 't1', titre: 'Alpha' }]}
        currentUserId="u1"
        selectedCalendarIds={['c1', 'c2']}
        contentFilters={{ showEstablishmentTasks: true, showTasks: true, showEvents: true, showAbsences: true }}
        establishmentTaskCount={5}
        calendars={[{ id: 'c1' }, { id: 'c2' }]}
        onOpenMobileDrawer={mockOnOpenMobileDrawer}
        onCreateEvent={mockOnCreateEvent}
        onCreateTask={mockOnCreateTask}
        onOpenSync={mockOnOpenSync}
        onExport={mockOnExport}
        onToggleFilters={mockOnToggleFilters}
        onTaskClick={mockOnTaskClick}
        onCalendarToggle={mockOnCalendarToggle}
        onSelectAllCalendars={mockOnSelectAllCalendars}
        onDeselectAllCalendars={mockOnDeselectAllCalendars}
        onToggleEstablishmentTasks={mockOnToggleEstablishmentTasks}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole('heading', { name: 'Calendrier' })).toBeInTheDocument();
    expect(screen.getByText('12 tâches')).toBeInTheDocument();
    expect(screen.getByText('3 évén.')).toBeInTheDocument();
    expect(screen.getByText('1 abs.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-calendar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Menu')).not.toBeInTheDocument();
    expect(screen.getByText('filters-on')).toBeInTheDocument();
    expect(screen.getByText('hidden')).toBeInTheDocument();
    expect(screen.getByText('etab:5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'create-event' }));
    fireEvent.click(screen.getByRole('button', { name: 'create-task' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-sync' }));
    fireEvent.click(screen.getByRole('button', { name: 'export' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle-filters' }));

    expect(mockOnCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockOnCreateTask).toHaveBeenCalledTimes(1);
    expect(mockOnOpenSync).toHaveBeenCalledTimes(1);
    expect(mockOnExport).toHaveBeenCalledTimes(1);
    expect(mockOnToggleFilters).toHaveBeenCalledTimes(1);
  });

  it('rend CalendrierHero mobile avec bouton menu et titre mobile', () => {
    const Wrapper = createWrapper();

    render(
      <CalendrierHero
        isMobile={true}
        isStandaloneMobileApp={false}
        taskCount={7}
        eventCount={2}
        absenceCount={4}
        hasActiveFilters={false}
        showFilters={true}
        displayedTasks={[]}
        currentUserId="u1"
        selectedCalendarIds={[]}
        contentFilters={{ showEstablishmentTasks: false, showTasks: true, showEvents: true, showAbsences: true }}
        establishmentTaskCount={0}
        calendars={[]}
        onOpenMobileDrawer={mockOnOpenMobileDrawer}
        onCreateEvent={mockOnCreateEvent}
        onCreateTask={mockOnCreateTask}
        onOpenSync={mockOnOpenSync}
        onExport={mockOnExport}
        onToggleFilters={mockOnToggleFilters}
        onTaskClick={mockOnTaskClick}
        onCalendarToggle={mockOnCalendarToggle}
        onSelectAllCalendars={mockOnSelectAllCalendars}
        onDeselectAllCalendars={mockOnDeselectAllCalendars}
        onToggleEstablishmentTasks={mockOnToggleEstablishmentTasks}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole('heading', { name: '📅 Calendrier' })).toBeInTheDocument();
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Menu'));
    expect(mockOnOpenMobileDrawer).toHaveBeenCalledTimes(1);
  });

  it('rend CalendrierControlBar desktop et déclenche navigation, sidebar et changement de vue', () => {
    const Wrapper = createWrapper();
    const currentDate = new Date('2025-01-10T00:00:00.000Z');
    const viewsDesktop = [
      { value: 'timeline', label: 'Frise', icon: ({ className }: { className?: string }) => <svg data-testid="timeline-icon" className={className} /> },
      { value: 'month', label: 'Mois', icon: ({ className }: { className?: string }) => <svg data-testid="month-icon" className={className} /> },
    ];
    const viewsMobile = [
      { value: 'day', label: 'Jour', icon: ({ className }: { className?: string }) => <svg data-testid="day-icon" className={className} /> },
    ];

    render(
      <CalendrierControlBar
        isMobile={false}
        showCalendarSidebar={true}
        onToggleSidebar={mockOnToggleSidebar}
        currentDate={currentDate}
        onDateChange={mockOnDateChange}
        activeView="timeline"
        onActiveViewChange={mockOnActiveViewChange}
        contentFilters={{ showEstablishmentTasks: false, showTasks: true, showEvents: true, showAbsences: true }}
        onContentFiltersChange={mockOnContentFiltersChange}
        taskCount={9}
        eventCount={4}
        absenceCount={2}
        establishmentTaskCount={6}
        viewsDesktop={viewsDesktop}
        viewsMobile={viewsMobile}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTitle('Masquer le panneau latéral')).toBeInTheDocument();
    expect(screen.getByTestId('icon-panel-left-close')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-mini-nav')).toHaveTextContent('2025-01-10');
    expect(screen.getByTestId('calendar-mini-nav')).toHaveTextContent('timeline');
    expect(screen.getByTestId('calendar-content-toggle')).toHaveTextContent('tasks:9');
    expect(screen.getByTestId('calendar-content-toggle')).toHaveTextContent('events:4');
    expect(screen.getByTestId('calendar-content-toggle')).toHaveTextContent('absences:2');
    expect(screen.getByTestId('calendar-content-toggle')).toHaveTextContent('etab:6');
    expect(screen.getByRole('button', { name: 'Vue Frise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vue Mois' })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Masquer le panneau latéral'));
    fireEvent.click(screen.getByRole('button', { name: 'change-date' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle-content' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vue Mois' }));

    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
    expect(mockOnDateChange).toHaveBeenCalledWith(new Date('2025-02-15T00:00:00.000Z'));
    expect(mockOnContentFiltersChange).toHaveBeenCalledWith({
      showEstablishmentTasks: true,
      showTasks: true,
      showEvents: true,
      showAbsences: true,
    });
    expect(mockOnActiveViewChange).toHaveBeenCalledWith('month');
  });

  it('rend CalendrierControlBar mobile avec boutons iconiques et état aria', () => {
    const Wrapper = createWrapper();
    const viewsDesktop: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [];
    const viewsMobile = [
      { value: 'day', label: 'Jour', icon: ({ className }: { className?: string }) => <svg data-testid="day-icon" className={className} /> },
      { value: 'agenda', label: 'Agenda', icon: ({ className }: { className?: string }) => <svg data-testid="agenda-icon" className={className} /> },
    ];

    render(
      <CalendrierControlBar
        isMobile={true}
        showCalendarSidebar={false}
        onToggleSidebar={mockOnToggleSidebar}
        currentDate={new Date('2025-03-01T00:00:00.000Z')}
        onDateChange={mockOnDateChange}
        activeView="agenda"
        onActiveViewChange={mockOnActiveViewChange}
        contentFilters={{ showEstablishmentTasks: true, showTasks: true, showEvents: false, showAbsences: true }}
        onContentFiltersChange={mockOnContentFiltersChange}
        taskCount={1}
        eventCount={8}
        absenceCount={0}
        establishmentTaskCount={2}
        viewsDesktop={viewsDesktop}
        viewsMobile={viewsMobile}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByLabelText('Vue Jour')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Vue Agenda')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByLabelText('Vue Jour'));
    expect(mockOnActiveViewChange).toHaveBeenCalledWith('day');
  });

  it('rend CalendrierTaskDetailsDialog avec les vraies données métier formatées et permet le changement de statut', () => {
    const Wrapper = createWrapper();
    const selectedTache = {
      id: 't1',
      titre: 'Inspection sécurité',
      statut: 'En cours',
      priorite: 'Haute',
      echeance: '2025-01-15',
      description: 'Vérifier les extincteurs et sorties.',
      etablissements: { nom: 'Lycée Horizon' },
    };

    render(
      <CalendrierTaskDetailsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedTache={selectedTache}
        onStatusChange={mockOnStatusChange}
        isPending={false}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Inspection sécurité/ })).toBeInTheDocument();

    const dialogRoot = screen.getByTestId('dialog-root');
    expect(within(dialogRoot).getByText('Statut:')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Priorité:')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Haute')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Échéance:')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('15 janvier 2025')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Établissement:')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Lycée Horizon')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Description:')).toBeInTheDocument();
    expect(within(dialogRoot).getByText('Vérifier les extincteurs et sorties.')).toBeInTheDocument();
    expect(screen.getByTestId('tache-documents')).toHaveTextContent('docs:t1:Inspection sécurité');

    const statusButtons = within(dialogRoot).getAllByRole('button', { name: 'En cours' });
    expect(statusButtons).toHaveLength(1);
    expect(statusButtons[0]).toHaveAttribute('variant', 'default');

    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(mockOnStatusChange).toHaveBeenCalledWith('t1', 'Terminé');
  });

  it('rend l’état vide du dialog sans tâche sélectionnée', () => {
    const Wrapper = createWrapper();

    render(
      <CalendrierTaskDetailsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedTache={null}
        onStatusChange={mockOnStatusChange}
        isPending={false}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole('heading', { name: 'Détails de la tâche' })).toBeInTheDocument();
    expect(screen.queryByTestId('tache-documents')).not.toBeInTheDocument();
    expect(screen.queryByText('Changer le statut:')).not.toBeInTheDocument();
  });

  it('désactive les boutons de statut quand isPending est vrai', () => {
    const Wrapper = createWrapper();
    const selectedTache = {
      id: 't2',
      titre: 'Maintenance ascenseur',
      statut: 'Bloqué',
      priorite: 'Moyenne',
    };

    render(
      <CalendrierTaskDetailsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedTache={selectedTache}
        onStatusChange={mockOnStatusChange}
        isPending={true}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole('button', { name: 'A faire' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'En cours' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bloqué' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeDisabled();
  });
});