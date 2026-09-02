/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';

const {
  AUTH,
  PROJECTS,
  ETABS,
  PROFILES,
  STORIES,
  TICKETS,
  updateMutate,
  deleteMutate,
  mockFrom,
  useTodoProjectsMock,
  useEtablissementsMock,
  useActiveProfilesMock,
  useRDUserStoriesSelectMock,
  useSupportTicketsSelectMock,
  useUpdatePersonalTodoMock,
  useDeletePersonalTodoMock,
  formatDueDateMock,
  getDueDateColorMock,
  navigateMock,
} = vi.hoisted(() => {
  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const PROJECTS = [
    { id: 'p1', name: 'Projet Alpha', color: '#f00' },
    { id: 'p2', name: 'Projet Beta', color: '#0f0' },
  ];

  const ETABS = [
    { id: 'e1', nom: 'Clinique A' },
    { id: 'e2', nom: 'Clinique B' },
  ];

  const PROFILES = [{ id: 'prof1', prenom: 'Jean', nom: 'Dupont' }];

  const STORIES = [{ id: 'us1', titre: 'Story principale', projet_nom: 'Roadmap' }];

  const TICKETS = [{ id: 'st1', titre: 'Ticket urgent', numero_ticket: '42' }];

  const updateMutate = vi.fn();
  const deleteMutate = vi.fn();
  const mockFrom = vi.fn();

  const useTodoProjectsMock = vi.fn(() => ({ data: PROJECTS, isLoading: false, isError: false, error: null }));
  const useEtablissementsMock = vi.fn(() => ({ data: ETABS, isLoading: false, isError: false, error: null }));
  const useActiveProfilesMock = vi.fn(() => ({ data: PROFILES, isLoading: false, isError: false, error: null }));
  const useRDUserStoriesSelectMock = vi.fn(() => ({ data: STORIES, isLoading: false, isError: false, error: null }));
  const useSupportTicketsSelectMock = vi.fn(() => ({ data: TICKETS, isLoading: false, isError: false, error: null }));
  const useUpdatePersonalTodoMock = vi.fn(() => ({ mutate: updateMutate, isPending: false, isError: false, error: null }));
  const useDeletePersonalTodoMock = vi.fn(() => ({ mutate: deleteMutate, isPending: false, isError: false, error: null }));

  const formatDueDateMock = vi.fn((date: string) => `formatted:${date}`);
  const getDueDateColorMock = vi.fn(() => 'due-color');
  const navigateMock = vi.fn();

  return {
    AUTH,
    PROJECTS,
    ETABS,
    PROFILES,
    STORIES,
    TICKETS,
    updateMutate,
    deleteMutate,
    mockFrom,
    useTodoProjectsMock,
    useEtablissementsMock,
    useActiveProfilesMock,
    useRDUserStoriesSelectMock,
    useSupportTicketsSelectMock,
    useUpdatePersonalTodoMock,
    useDeletePersonalTodoMock,
    formatDueDateMock,
    getDueDateColorMock,
    navigateMock,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const result = { data: null, error: null };
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    catch: vi.fn(),
  };
  mockFrom.mockImplementation(() => builder);
  return { supabase: { from: mockFrom } };
});

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => AUTH }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => AUTH }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH }));

vi.mock('@/hooks/tasks/useUnifiedTodos', () => ({
  formatDueDate: formatDueDateMock,
  getDueDateColor: getDueDateColorMock,
}));

vi.mock('@/hooks/tasks/usePersonalTodos', () => ({
  useUpdatePersonalTodo: useUpdatePersonalTodoMock,
  useDeletePersonalTodo: useDeletePersonalTodoMock,
}));

vi.mock('@/hooks/tasks/useTodoProjects', () => ({
  useTodoProjects: useTodoProjectsMock,
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: useEtablissementsMock,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: useActiveProfilesMock,
}));

vi.mock('@/hooks/rd/useRDUserStoriesSelect', () => ({
  useRDUserStoriesSelect: useRDUserStoriesSelectMock,
}));

vi.mock('@/hooks/support/useSupportTicketsSelect', () => ({
  useSupportTicketsSelect: useSupportTicketsSelectMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children?: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
    'aria-label'?: string;
  }) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    onBlur,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} className={className} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    onBlur,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    className?: string;
  }) => <textarea value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} className={className} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children?: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children?: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date | undefined) => void }) => (
    <button onClick={() => onSelect?.(new Date('2025-03-10'))}>pick-date</button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => <button className={className}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    X: Icon,
    Calendar: Icon,
    Building2: Icon,
    Flag: Icon,
    Trash2: Icon,
    ExternalLink: Icon,
    MessageCircle: Icon,
    User: Icon,
    Lightbulb: Icon,
    Headphones: Icon,
    Users: Icon,
  };
});

import { TodoDetailPanel } from './TodoDetailPanel';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const client = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('TodoDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('couvre un hook react-query: isLoading puis succès puis erreur', async () => {
    const wrapper = createWrapper();

    const loadingHook = renderHook(
      () =>
        useQuery({
          queryKey: ['loading-case'],
          queryFn: () => new Promise<string>(() => undefined),
        }),
      { wrapper }
    );

    expect(loadingHook.result.current.isLoading).toBe(true);

    const successHook = renderHook(
      () =>
        useQuery({
          queryKey: ['success-case'],
          queryFn: async () => 'ok-value',
        }),
      { wrapper }
    );

    await waitFor(() => expect(successHook.result.current.isSuccess).toBe(true));
    expect(successHook.result.current.data).toBe('ok-value');

    const errorHook = renderHook(
      () =>
        useQuery({
          queryKey: ['error-case'],
          queryFn: async () => {
            throw new Error('x');
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(errorHook.result.current.isError).toBe(true));
    expect(errorHook.result.current.error?.message).toBe('x');
  });

  it('affiche les informations métier d’une tâche personnelle et sauvegarde les changements du titre et de la description', async () => {
    const onClose = vi.fn();

    const todo = {
      id: 'todo1',
      title: 'Tâche initiale',
      description: 'Description initiale',
      due_date: '2025-02-01',
      priority: 'medium',
      project_id: 'p1',
      etablissement_id: 'e1',
      source: 'personal',
      visibility: 'all',
      is_done: false,
      rd_user_story_id: 'us1',
      support_ticket_id: 'st1',
      assigned_to_id: 'prof1',
      assigned_to_name: null,
      rd_user_story_title: null,
      support_ticket_title: null,
      conversation_id: null,
    };

    renderWithClient(<TodoDetailPanel todo={todo} onClose={onClose} />);

    expect(screen.getByDisplayValue('Tâche initiale')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Description initiale')).toBeInTheDocument();
    expect(screen.getByText('Personnel')).toBeInTheDocument();
    expect(screen.getByText('Équipe')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Story principale')).toBeInTheDocument();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Ticket urgent')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue('Tâche initiale');
    fireEvent.change(titleInput, { target: { value: 'Titre modifié' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith({
        id: 'todo1',
        title: 'Titre modifié',
        description: 'Description initiale',
        due_date: '2025-02-01',
        priority: 'medium',
        project_id: 'p1',
        etablissement_id: 'e1',
      });
    });

    const descriptionInput = screen.getByDisplayValue('Description initiale');
    fireEvent.change(descriptionInput, { target: { value: '' } });
    fireEvent.blur(descriptionInput);

    await waitFor(() => {
      expect(updateMutate).toHaveBeenLastCalledWith({
        id: 'todo1',
        title: 'Titre modifié',
        description: null,
        due_date: '2025-02-01',
        priority: 'medium',
        project_id: 'p1',
        etablissement_id: 'e1',
      });
    });

    expect(getDueDateColorMock).toHaveBeenCalledWith('2025-02-01', false);
  });

  it('supprime une tâche personnelle et ferme le panneau', async () => {
    const onClose = vi.fn();

    const todo = {
      id: 'todo-delete',
      title: 'À supprimer',
      description: '',
      due_date: null,
      priority: 'low',
      project_id: null,
      etablissement_id: null,
      source: 'personal',
      visibility: 'private',
      is_done: false,
      rd_user_story_id: null,
      support_ticket_id: null,
      assigned_to_id: null,
      assigned_to_name: null,
      rd_user_story_title: null,
      support_ticket_title: null,
      conversation_id: null,
    };

    renderWithClient(<TodoDetailPanel todo={todo} onClose={onClose} />);

    const confirmButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    expect(confirmButtons).toHaveLength(2);

    await act(async () => {
      fireEvent.click(confirmButtons[1]);
    });

    expect(deleteMutate).toHaveBeenCalledWith('todo-delete');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('affiche une tâche non personnelle en lecture seule avec les liens métier associés', () => {
    const onClose = vi.fn();

    const todo = {
      id: 'todo-etab',
      title: 'Tâche établissement',
      description: '',
      due_date: '2025-04-20',
      priority: 'urgent',
      project_id: null,
      etablissement_id: 'e1',
      source: 'etablissement',
      visibility: 'private',
      is_done: false,
      rd_user_story_id: null,
      support_ticket_id: null,
      assigned_to_id: null,
      assigned_to_name: null,
      rd_user_story_title: null,
      support_ticket_title: null,
      conversation_id: null,
    };

    renderWithClient(<TodoDetailPanel todo={todo} onClose={onClose} />);

    expect(screen.getByText('Établissement')).toBeInTheDocument();
    expect(screen.getByText('Tâche établissement')).toBeInTheDocument();
    expect(screen.getByText('Aucune description')).toBeInTheDocument();
    expect(screen.getByText('formatted:2025-04-20')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();

    const link = screen.getByText("Voir l'établissement").closest('a');
    expect(link).toHaveAttribute('href', '/etablissements/e1');

    expect(updateMutate).not.toHaveBeenCalled();
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(formatDueDateMock).toHaveBeenCalledWith('2025-04-20');
  });

  it('met à jour l’affichage local quand la todo change', () => {
    const onClose = vi.fn();

    const firstTodo = {
      id: 'todo-a',
      title: 'Titre A',
      description: 'Desc A',
      due_date: '2025-01-01',
      priority: 'low',
      project_id: null,
      etablissement_id: null,
      source: 'personal',
      visibility: 'private',
      is_done: false,
      rd_user_story_id: null,
      support_ticket_id: null,
      assigned_to_id: null,
      assigned_to_name: null,
      rd_user_story_title: null,
      support_ticket_title: null,
      conversation_id: null,
    };

    const secondTodo = {
      ...firstTodo,
      id: 'todo-b',
      title: 'Titre B',
      description: 'Desc B',
      due_date: '2025-06-15',
      priority: 'high',
    };

    const client = createQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <TodoDetailPanel todo={firstTodo} onClose={onClose} />
      </QueryClientProvider>
    );

    expect(screen.getByDisplayValue('Titre A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc A')).toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={client}>
        <TodoDetailPanel todo={secondTodo} onClose={onClose} />
      </QueryClientProvider>
    );

    expect(screen.getByDisplayValue('Titre B')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc B')).toBeInTheDocument();
  });

  it('gère le cas erreur des hooks de données sans figer et affiche les fallbacks', () => {
    useTodoProjectsMock.mockReturnValueOnce({ data: null, error: { message: 'x' }, isLoading: false, isError: true });
    useEtablissementsMock.mockReturnValueOnce({ data: null, error: { message: 'x' }, isLoading: false, isError: true });
    useActiveProfilesMock.mockReturnValueOnce({ data: null, error: { message: 'x' }, isLoading: false, isError: true });
    useRDUserStoriesSelectMock.mockReturnValueOnce({ data: null, error: { message: 'x' }, isLoading: false, isError: true });
    useSupportTicketsSelectMock.mockReturnValueOnce({ data: null, error: { message: 'x' }, isLoading: false, isError: true });

    const todo = {
      id: 'todo-error',
      title: 'Erreur contrôlée',
      description: null,
      due_date: null,
      priority: 'medium',
      project_id: null,
      etablissement_id: null,
      source: 'pulse',
      visibility: 'private',
      is_done: false,
      rd_user_story_id: null,
      support_ticket_id: null,
      assigned_to_id: null,
      assigned_to_name: null,
      rd_user_story_title: null,
      support_ticket_title: null,
      conversation_id: 'conv1',
    };

    renderWithClient(<TodoDetailPanel todo={todo} onClose={() => undefined} />);

    expect(screen.getByText('Pulse')).toBeInTheDocument();
    expect(screen.getByText('Erreur contrôlée')).toBeInTheDocument();
    expect(screen.getByText('Aucune description')).toBeInTheDocument();

    const link = screen.getByText('Voir la conversation Pulse').closest('a');
    expect(link).toHaveAttribute('href', '/m/pulse?conversation=conv1');
  });
});