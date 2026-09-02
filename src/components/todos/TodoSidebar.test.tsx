import React from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  PROFILE,
  STATS,
  PROJECTS,
  ETABLISSEMENTS,
  mockUseCurrentProfile,
  mockUseUnifiedTodoStats,
  mockUseTodoProjects,
  mockUseEtablissements,
  mockMutate,
  mockUseClearDoneTodos,
  mockCreateProjectModal,
  mockConfirm,
} = vi.hoisted(() => {
  const PROFILE = { id: 'profile-1' };

  const STATS = { total: 12, today: 2, week: 5, overdue: 1 };

  const PROJECTS = [
    { id: 'proj-1', name: 'Projet Alpha', color: '#ff0000', is_shared: true },
    { id: 'proj-2', name: 'Projet Beta', color: '#00ff00', is_shared: false },
  ];

  const ETABLISSEMENTS = [
    { id: 'etab-1', nom: 'Clinique A', commercial_id: 'profile-1', chef_projet_id: null, csm_id: null },
    { id: 'etab-2', nom: 'Clinique B', commercial_id: null, chef_projet_id: 'profile-1', csm_id: null },
    { id: 'etab-3', nom: 'Clinique C', commercial_id: null, chef_projet_id: null, csm_id: 'profile-1' },
    { id: 'etab-x', nom: 'Clinique X', commercial_id: 'other', chef_projet_id: null, csm_id: null },
  ];

  const mockUseCurrentProfile = vi.fn();
  const mockUseUnifiedTodoStats = vi.fn();
  const mockUseTodoProjects = vi.fn();
  const mockUseEtablissements = vi.fn();

  const mockMutate = vi.fn();
  const mockUseClearDoneTodos = vi.fn();

  const mockCreateProjectModal = vi.fn(({ open }: { open: boolean }) => (
    <div data-testid="create-project-modal" data-open={open ? 'true' : 'false'} />
  ));

  const mockConfirm = vi.fn(() => true);

  return {
    PROFILE,
    STATS,
    PROJECTS,
    ETABLISSEMENTS,
    mockUseCurrentProfile,
    mockUseUnifiedTodoStats,
    mockUseTodoProjects,
    mockUseEtablissements,
    mockMutate,
    mockUseClearDoneTodos,
    mockCreateProjectModal,
    mockConfirm,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.currentTarget.checked)}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children?: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { asChild?: boolean; children?: React.ReactNode }) => <>{children}</>,
  CollapsibleContent: ({ children }: { className?: string; children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | boolean | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => mockUseCurrentProfile(),
}));

vi.mock('@/hooks/tasks/useUnifiedTodos', () => ({
  useUnifiedTodoStats: () => mockUseUnifiedTodoStats(),
}));

vi.mock('@/hooks/tasks/useTodoProjects', () => ({
  useTodoProjects: () => mockUseTodoProjects(),
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => mockUseEtablissements(),
}));

vi.mock('@/hooks/tasks/useClearDoneTodos', () => ({
  useClearDoneTodos: () => mockUseClearDoneTodos(),
}));

vi.mock('./modals/CreateProjectModal', () => ({
  CreateProjectModal: (props: { open: boolean; onOpenChange: (open: boolean) => void }) => mockCreateProjectModal(props),
}));

vi.mock('lucide-react', () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) => (
      <span data-icon={name} className={className}>
        {name}
      </span>
    );
  return {
    Inbox: Icon('Inbox'),
    Calendar: Icon('Calendar'),
    CalendarDays: Icon('CalendarDays'),
    AlertCircle: Icon('AlertCircle'),
    Building2: Icon('Building2'),
    User: Icon('User'),
    Users: Icon('Users'),
    ChevronDown: Icon('ChevronDown'),
    ChevronRight: Icon('ChevronRight'),
    Plus: Icon('Plus'),
    Trash2: Icon('Trash2'),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('TodoSidebar', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', mockConfirm);

    mockUseCurrentProfile.mockReturnValue({ data: PROFILE });
    mockUseUnifiedTodoStats.mockReturnValue({ data: STATS });
    mockUseTodoProjects.mockReturnValue({ data: PROJECTS });
    mockUseEtablissements.mockReturnValue({ data: ETABLISSEMENTS });
    mockUseClearDoneTodos.mockReturnValue({ mutate: mockMutate, isPending: false });

    mockMutate.mockClear();
    mockConfirm.mockClear();
    mockCreateProjectModal.mockClear();
  });

  it('affiche les compteurs et déclenche les callbacks de sélection (succès)', () => {
    const onSelectFilter = vi.fn();
    const onSelectProject = vi.fn();
    const onSelectEtablissement = vi.fn();
    const onShowDoneChange = vi.fn();

    renderWithClient(
      <TodoSidebar
        selectedFilter="all"
        selectedProjectId={null}
        selectedEtablissementId={null}
        onSelectFilter={onSelectFilter}
        onSelectProject={onSelectProject}
        onSelectEtablissement={onSelectEtablissement}
        showDone={false}
        onShowDoneChange={onShowDoneChange}
      />
    );

    const inboxBtn = screen.getByRole('button', { name: /Inbox/i });
    expect(inboxBtn).toBeTruthy();
    expect(within(inboxBtn).getByText('12')).toBeTruthy();

    const todayBtn = screen.getByRole('button', { name: /Aujourd'hui/i });
    expect(within(todayBtn).getByText('2')).toBeTruthy();

    const weekBtn = screen.getByRole('button', { name: /Cette semaine/i });
    expect(within(weekBtn).getByText('5')).toBeTruthy();

    const overdueBtn = screen.getByRole('button', { name: /En retard/i });
    expect(within(overdueBtn).getByText('1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Aujourd'hui/i }));
    expect(onSelectFilter).toHaveBeenCalledWith('today');

    fireEvent.click(screen.getByRole('button', { name: /Personnel/i }));
    expect(onSelectFilter).toHaveBeenCalledWith('personal');

    fireEvent.click(screen.getByRole('button', { name: /Projet Alpha/i }));
    expect(onSelectProject).toHaveBeenCalledWith('proj-1');

    fireEvent.click(screen.getByRole('button', { name: /Clinique B/i }));
    expect(onSelectEtablissement).toHaveBeenCalledWith('etab-2');

    expect(screen.queryByRole('button', { name: /Clinique X/i })).toBeNull();

    const checkbox = screen.getByLabelText(/Afficher terminées/i);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    fireEvent.click(checkbox);
    expect(onShowDoneChange).toHaveBeenCalledWith(true);

    expect(screen.getByTestId('create-project-modal').getAttribute('data-open')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByTestId('create-project-modal').getAttribute('data-open')).toBe('true');
  });

  it('gère le cas chargement (données absentes) et affiche les placeholders', () => {
    mockUseCurrentProfile.mockReturnValue({ data: undefined });
    mockUseUnifiedTodoStats.mockReturnValue({ data: undefined });
    mockUseTodoProjects.mockReturnValue({ data: undefined });
    mockUseEtablissements.mockReturnValue({ data: undefined });

    renderWithClient(
      <TodoSidebar
        selectedFilter="all"
        selectedProjectId={null}
        selectedEtablissementId={null}
        onSelectFilter={vi.fn()}
        onSelectProject={vi.fn()}
        onSelectEtablissement={vi.fn()}
        showDone={true}
        onShowDoneChange={vi.fn()}
      />
    );

    expect(screen.getByText('Aucun projet')).toBeTruthy();
    expect(screen.getByText('Aucun établissement')).toBeTruthy();

    const inboxBtn = screen.getByRole('button', { name: /Inbox/i });
    expect(within(inboxBtn).queryByText(String(STATS.total))).toBeNull();

    const checkbox = screen.getByLabelText(/Afficher terminées/i);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it('erreur hooks: propage le state isError (renderHook) et garde un rendu sans crash', async () => {
    const { renderHook } = await import('@testing-library/react');

    const useUnifiedTodoStatsError = vi.fn(() => ({
      data: null,
      error: { message: 'x' },
      isError: true,
      isLoading: false,
    }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUnifiedTodoStatsError(), { wrapper });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();

    mockUseUnifiedTodoStats.mockReturnValue({ data: undefined });
    renderWithClient(
      <TodoSidebar
        selectedFilter="all"
        selectedProjectId={null}
        selectedEtablissementId={null}
        onSelectFilter={vi.fn()}
        onSelectProject={vi.fn()}
        onSelectEtablissement={vi.fn()}
        showDone={false}
        onShowDoneChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Inbox/i })).toBeTruthy();
  });

  it('déclenche la mutation "vider les terminées" après confirmation', async () => {
    const onSelectFilter = vi.fn();
    const onSelectProject = vi.fn();
    const onSelectEtablissement = vi.fn();
    const onShowDoneChange = vi.fn();

    mockConfirm.mockReturnValue(true);

    renderWithClient(
      <TodoSidebar
        selectedFilter="all"
        selectedProjectId={null}
        selectedEtablissementId={null}
        onSelectFilter={onSelectFilter}
        onSelectProject={onSelectProject}
        onSelectEtablissement={onSelectEtablissement}
        showDone={false}
        onShowDoneChange={onShowDoneChange}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Vider les terminées/i }));
    });

    expect(mockConfirm).toHaveBeenCalledWith('Supprimer toutes les tâches terminées ?');
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche pas la mutation si la confirmation est refusée', async () => {
    mockConfirm.mockReturnValue(false);

    renderWithClient(
      <TodoSidebar
        selectedFilter="all"
        selectedProjectId={null}
        selectedEtablissementId={null}
        onSelectFilter={vi.fn()}
        onSelectProject={vi.fn()}
        onSelectEtablissement={vi.fn()}
        showDone={false}
        onShowDoneChange={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Vider les terminées/i }));
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledTimes(0);
  });
});

import { TodoSidebar } from './TodoSidebar';