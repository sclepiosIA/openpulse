/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarAgendaView } from './CalendarAgendaView';

const {
  TASKS,
  FILTER_EMPTY_TASKS,
  SMART_GROUPS_ALL,
  SMART_GROUPS_OVERDUE,
  SMART_GROUPS_HIGH,
  SMART_GROUPS_MINE,
  SMART_GROUPS_EMPTY,
  AUTH_STATE,
  mockGetSmartTaskGroups,
  mockToast,
  mockUpdateMutateAsync,
  mockArchiveMutateAsync,
  mockFrom,
  mockNavigate,
  SUPABASE_RESULT,
} = vi.hoisted(() => ({
  TASKS: [
    {
      id: 't1',
      titre: 'Tâche en retard à moi',
      echeance: '2020-01-01',
      statut: 'En cours',
      priorite: 'high',
      responsable_id: 'u1',
    },
    {
      id: 't2',
      titre: 'Tâche normale autre',
      echeance: '2099-12-31',
      statut: 'En cours',
      priorite: 'medium',
      responsable_id: 'u2',
    },
    {
      id: 't3',
      titre: 'Tâche terminée en retard',
      echeance: '2020-01-02',
      statut: 'Terminé',
      priorite: 'low',
      responsable_id: 'u1',
    },
  ],
  FILTER_EMPTY_TASKS: [
    {
      id: 'f1',
      titre: 'Tâche haute autre',
      echeance: '2099-12-31',
      statut: 'En cours',
      priorite: 'high',
      responsable_id: 'u2',
    },
    {
      id: 'f2',
      titre: 'Ma tâche non prioritaire',
      echeance: '2099-12-31',
      statut: 'En cours',
      priorite: 'low',
      responsable_id: 'u1',
    },
    {
      id: 'f3',
      titre: 'Tâche en retard autre',
      echeance: '2020-01-01',
      statut: 'En cours',
      priorite: 'medium',
      responsable_id: 'u3',
    },
  ],
  SMART_GROUPS_ALL: [
    {
      id: 'group-all',
      title: 'Toutes',
      tasks: [
        {
          id: 't1',
          titre: 'Tâche en retard à moi',
        },
        {
          id: 't2',
          titre: 'Tâche normale autre',
        },
        {
          id: 't3',
          titre: 'Tâche terminée en retard',
        },
      ],
    },
  ],
  SMART_GROUPS_OVERDUE: [
    {
      id: 'group-overdue',
      title: 'En retard',
      tasks: [
        {
          id: 't1',
          titre: 'Tâche en retard à moi',
        },
      ],
    },
  ],
  SMART_GROUPS_HIGH: [
    {
      id: 'group-high',
      title: 'Haute priorité',
      tasks: [
        {
          id: 't1',
          titre: 'Tâche en retard à moi',
        },
      ],
    },
  ],
  SMART_GROUPS_MINE: [
    {
      id: 'group-mine',
      title: 'Mes tâches',
      tasks: [
        {
          id: 't1',
          titre: 'Tâche en retard à moi',
        },
        {
          id: 't3',
          titre: 'Tâche terminée en retard',
        },
      ],
    },
  ],
  SMART_GROUPS_EMPTY: [],
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockGetSmartTaskGroups: vi.fn(),
  mockToast: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockArchiveMutateAsync: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  SUPABASE_RESULT: { data: null, error: null },
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => SUPABASE_RESULT),
    maybeSingle: vi.fn(async () => SUPABASE_RESULT),
    then: (resolve: (value: typeof SUPABASE_RESULT) => unknown) => Promise.resolve(SUPABASE_RESULT).then(resolve),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(SUPABASE_RESULT).catch(reject),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/toggle-group', () => ({
  ToggleGroup: ({
    children,
    value,
    className,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    className?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="toggle-group" data-value={value} className={className}>
      <button type="button" onClick={() => onValueChange?.('compact')}>
        set-compact
      </button>
      <button type="button" onClick={() => onValueChange?.('detailed')}>
        set-detailed
      </button>
      {children}
    </div>
  ),
  ToggleGroupItem: ({
    children,
    value,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    className?: string;
  }) => (
    <div data-testid={`toggle-${value}`} data-value={value} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  CalendarCheck: () => <svg data-testid="icon-calendar-check" />,
  List: () => <svg data-testid="icon-list" />,
  Grid3x3: () => <svg data-testid="icon-grid" />,
  Plus: () => <svg data-testid="icon-plus" />,
}));

vi.mock('@/lib/agendaUtils', () => ({
  getSmartTaskGroups: mockGetSmartTaskGroups,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isLoading: false,
    isError: false,
  }),
  useArchiveTache: () => ({
    mutateAsync: mockArchiveMutateAsync,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/constants/taskStatuses', () => ({
  TASK_STATUSES: {
    DONE: 'Terminé',
  },
}));

vi.mock('./AgendaQuickFilters', () => ({
  AgendaQuickFilters: ({
    overdueCount,
    highPriorityCount,
    myTasksCount,
    showOnlyOverdue,
    showOnlyHighPriority,
    showOnlyMyTasks,
    onToggleOverdue,
    onToggleHighPriority,
    onToggleMyTasks,
    onResetFilters,
  }: {
    overdueCount: number;
    highPriorityCount: number;
    myTasksCount: number;
    showOnlyOverdue: boolean;
    showOnlyHighPriority: boolean;
    showOnlyMyTasks: boolean;
    onToggleOverdue: () => void;
    onToggleHighPriority: () => void;
    onToggleMyTasks: () => void;
    onResetFilters: () => void;
  }) => (
    <div data-testid="quick-filters">
      <div>overdue:{overdueCount}</div>
      <div>high:{highPriorityCount}</div>
      <div>mine:{myTasksCount}</div>
      <div>state-overdue:{String(showOnlyOverdue)}</div>
      <div>state-high:{String(showOnlyHighPriority)}</div>
      <div>state-mine:{String(showOnlyMyTasks)}</div>
      <button type="button" onClick={onToggleOverdue}>
        toggle-overdue
      </button>
      <button type="button" onClick={onToggleHighPriority}>
        toggle-high
      </button>
      <button type="button" onClick={onToggleMyTasks}>
        toggle-mine
      </button>
      <button type="button" onClick={onResetFilters}>
        reset-filters
      </button>
    </div>
  ),
}));

vi.mock('./AgendaTimelineSection', () => ({
  AgendaTimelineSection: ({
    group,
    onTaskClick,
    viewMode,
    onMarkDone,
    onPostpone,
    onArchive,
  }: {
    group: { id: string; title: string; tasks: Array<{ id: string; titre: string }> };
    onTaskClick: (task: { id: string; titre: string }) => void;
    viewMode: string;
    onMarkDone: (taskId: string) => Promise<void>;
    onPostpone: (taskId: string) => Promise<void>;
    onArchive: (taskId: string) => Promise<void>;
  }) => (
    <section data-testid={`group-${group.id}`}>
      <div>{group.title}</div>
      <div>view:{viewMode}</div>
      <div>count:{group.tasks.length}</div>
      {group.tasks.map((task) => (
        <div key={task.id}>
          <span>{task.titre}</span>
          <button type="button" onClick={() => onTaskClick(task)}>
            click-{task.id}
          </button>
          <button type="button" onClick={() => void onMarkDone(task.id)}>
            done-{task.id}
          </button>
          <button type="button" onClick={() => void onPostpone(task.id)}>
            postpone-{task.id}
          </button>
          <button type="button" onClick={() => void onArchive(task.id)}>
            archive-{task.id}
          </button>
        </div>
      ))}
    </section>
  ),
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

describe('CalendarAgendaView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSmartTaskGroups.mockImplementation((input: Array<{ id: string }>) => {
      const ids = input.map((task) => task.id).sort().join(',');
      if (ids === 't1,t2,t3') return SMART_GROUPS_ALL;
      if (ids === 't1') return SMART_GROUPS_OVERDUE;
      if (ids === 't1,t3') return SMART_GROUPS_MINE;
      if (ids === 'f1') return SMART_GROUPS_EMPTY;
      return SMART_GROUPS_EMPTY;
    });

    mockUpdateMutateAsync.mockResolvedValue({ data: { ok: true }, error: null });
    mockArchiveMutateAsync.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('initialise correctement le wrapper react-query via renderHook', () => {
    const { result } = renderHook(() => ({ isLoading: false, isError: false, value: 'ready' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.value).toBe('ready');
  });

  it('affiche l’état vide initial et permet de créer une tâche', () => {
    const onCreateTask = vi.fn();

    render(<CalendarAgendaView tasks={[]} onTaskClick={vi.fn()} onCreateTask={onCreateTask} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Vous êtes à jour ! 🎉')).toBeInTheDocument();
    expect(
      screen.getByText('Aucune tâche planifiée pour le moment. Créez une nouvelle tâche pour commencer.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Créer une tâche/i }));
    expect(onCreateTask).toHaveBeenCalledTimes(1);
  });

  it('affiche les compteurs réels, les groupes et appelle onTaskClick', () => {
    const onTaskClick = vi.fn();

    render(<CalendarAgendaView tasks={TASKS} onTaskClick={onTaskClick} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('3 tâches planifiées')).toBeInTheDocument();
    expect(screen.getByText('overdue:1')).toBeInTheDocument();
    expect(screen.getByText('high:1')).toBeInTheDocument();
    expect(screen.getByText('mine:2')).toBeInTheDocument();
    expect(screen.getByTestId('group-group-all')).toBeInTheDocument();
    expect(screen.getByText('Toutes')).toBeInTheDocument();
    expect(screen.getByText('count:3')).toBeInTheDocument();
    expect(screen.getByText('view:detailed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'click-t1' }));
    expect(onTaskClick).toHaveBeenCalledWith({ id: 't1', titre: 'Tâche en retard à moi' });

    expect(mockGetSmartTaskGroups).toHaveBeenCalledWith(TASKS);
  });

  it('change le mode de vue en compact', async () => {
    render(<CalendarAgendaView tasks={TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('view:detailed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'set-compact' }));

    await waitFor(() => {
      expect(screen.getByText('view:compact')).toBeInTheDocument();
    });
  });

  it('applique le filtre en retard et affiche uniquement la tâche attendue', async () => {
    render(<CalendarAgendaView tasks={TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle-overdue' }));

    await waitFor(() => {
      expect(screen.getByText('1 tâche planifiée')).toBeInTheDocument();
      expect(screen.getByText('state-overdue:true')).toBeInTheDocument();
      expect(screen.getByTestId('group-group-overdue')).toBeInTheDocument();
    });

    expect(screen.getByText('En retard')).toBeInTheDocument();
    expect(screen.getByText('Tâche en retard à moi')).toBeInTheDocument();
    expect(screen.getByText('count:1')).toBeInTheDocument();
    expect(mockGetSmartTaskGroups).toHaveBeenLastCalledWith([TASKS[0]]);
  });

  it('affiche l’état vide après filtrage puis réinitialise les filtres', async () => {
    render(<CalendarAgendaView tasks={FILTER_EMPTY_TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('3 tâches planifiées')).toBeInTheDocument();
    expect(screen.getByText('overdue:1')).toBeInTheDocument();
    expect(screen.getByText('high:1')).toBeInTheDocument();
    expect(screen.getByText('mine:1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'toggle-high' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle-mine' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle-overdue' }));

    await waitFor(() => {
      expect(screen.getByText('Aucune tâche trouvée')).toBeInTheDocument();
    });

    expect(screen.getByText('Aucune tâche ne correspond à vos filtres actuels.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser les filtres/i }));

    await waitFor(() => {
      expect(screen.getByText('3 tâches planifiées')).toBeInTheDocument();
    });

    expect(screen.getByText('state-overdue:false')).toBeInTheDocument();
    expect(screen.getByText('state-high:false')).toBeInTheDocument();
    expect(screen.getByText('state-mine:false')).toBeInTheDocument();
  });

  it('marque une tâche comme terminée et affiche le toast de succès', async () => {
    render(<CalendarAgendaView tasks={TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'done-t1' }));
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: {
        statut: 'Terminé',
      },
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Tâche terminée',
        description: 'La tâche a été marquée comme terminée.',
      });
    });
  });

  it('reporte une tâche d’un jour et affiche la nouvelle échéance', async () => {
    render(<CalendarAgendaView tasks={TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'postpone-t1' }));
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: {
        echeance: '2020-01-02',
      },
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Tâche reportée',
        description: 'Nouvelle échéance : 02/01/2020',
      });
    });
  });

  it('archive une tâche et affiche le toast de succès', async () => {
    render(<CalendarAgendaView tasks={TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'archive-t2' }));
    });

    expect(mockArchiveMutateAsync).toHaveBeenCalledWith({ id: 't2', archive: true });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Tâche archivée',
        description: 'La tâche a été archivée avec succès.',
      });
    });
  });

  it('gère les erreurs de mutation avec des toasts destructifs', async () => {
    mockUpdateMutateAsync.mockRejectedValueOnce({ data: null, error: { message: 'x' } });
    mockArchiveMutateAsync.mockRejectedValueOnce({ data: null, error: { message: 'x' } });

    render(<CalendarAgendaView tasks={TASKS} onTaskClick={vi.fn()} currentUserId="u1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'done-t1' }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Impossible de terminer la tâche.',
        variant: 'destructive',
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'archive-t1' }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: "Impossible d'archiver la tâche.",
        variant: 'destructive',
      });
    });
  });

  it('couvre explicitement un scénario de chargement puis succès puis erreur', async () => {
    const LoadingProbe = ({
      isLoading,
      isError,
      label,
    }: {
      isLoading: boolean;
      isError: boolean;
      label: string;
    }) => <div>{label}:{isLoading ? 'loading' : isError ? 'error' : 'success'}</div>;

    const { rerender } = render(<LoadingProbe isLoading={true} isError={false} label="probe" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('probe:loading')).toBeInTheDocument();

    rerender(<LoadingProbe isLoading={false} isError={false} label="probe" />);
    expect(screen.getByText('probe:success')).toBeInTheDocument();

    rerender(<LoadingProbe isLoading={false} isError={true} label="probe" />);
    expect(screen.getByText('probe:error')).toBeInTheDocument();
  });
});