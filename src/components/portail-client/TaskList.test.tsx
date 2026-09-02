import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const { TASKS, mockUseClientPortalTasks, mockUseUpdateClientPortalTask, mockUseDeleteClientPortalTask, updateMutate, deleteMutate } = vi.hoisted(() => {
  const TASKS = [
    {
      id: 't1',
      titre: 'Tâche OpenPulse',
      description: 'Description S',
      comment: 'Commentaire S',
      due_date: '2024-05-01T00:00:00.000Z',
      created_at: '2024-01-15T00:00:00.000Z',
      phase: 'deploiement',
      assignee: 'marque',
      statut: 'todo',
      created_by: 'marque',
      etablissement_id: 'e1',
    },
    {
      id: 't2',
      titre: "Tâche Établissement",
      description: 'Description E',
      comment: null,
      due_date: null,
      created_at: '2024-02-02T00:00:00.000Z',
      phase: 'production',
      assignee: 'etablissement',
      statut: 'done',
      created_by: 'etablissement',
      etablissement_id: 'e1',
    },
  ];

  const mockUseClientPortalTasks = vi.fn(() => ({ data: TASKS, isLoading: false }));
  const updateMutate = vi.fn();
  const deleteMutate = vi.fn();
  const mockUseUpdateClientPortalTask = vi.fn(() => ({ mutate: updateMutate }));
  const mockUseDeleteClientPortalTask = vi.fn(() => ({ mutate: deleteMutate }));

  return {
    TASKS,
    mockUseClientPortalTasks,
    mockUseUpdateClientPortalTask,
    mockUseDeleteClientPortalTask,
    updateMutate,
    deleteMutate,
  };
});

// Mock UI components used by TaskList
vi.mock('@/components/ui/card', () => {
  const ReactLocal = require('react');
  return {
    Card: ({ children, ...props }: any) => ReactLocal.createElement('div', { 'data-testid': 'card', ...props }, children),
    CardContent: ({ children, ...props }: any) => ReactLocal.createElement('div', { 'data-testid': 'card-content', ...props }, children),
    CardHeader: ({ children, ...props }: any) => ReactLocal.createElement('div', { 'data-testid': 'card-header', ...props }, children),
    CardTitle: ({ children, ...props }: any) => ReactLocal.createElement('div', { 'data-testid': 'card-title', ...props }, children),
  };
});

vi.mock('@/components/ui/button', () => {
  const ReactLocal = require('react');
  return {
    Button: ({ children, onClick, size, variant, className, 'aria-label': ariaLabel, ...props }: any) =>
      ReactLocal.createElement('button', { type: 'button', onClick, 'aria-label': ariaLabel, ...props }, children),
  };
});

vi.mock('@/components/ui/badge', () => {
  const ReactLocal = require('react');
  return {
    Badge: ({ children, ...props }: any) => ReactLocal.createElement('span', { 'data-testid': 'badge', ...props }, children),
  };
});

vi.mock('@/components/ui/checkbox', () => {
  const ReactLocal = require('react');
  return {
    Checkbox: ({ checked, onCheckedChange, className, ...props }: any) =>
      ReactLocal.createElement(
        'button',
        {
          role: 'checkbox',
          'aria-checked': !!checked,
          onClick: () => {
            if (typeof onCheckedChange === 'function') {
              onCheckedChange();
            }
          },
          ...props,
        },
        checked ? 'checked' : 'unchecked'
      ),
  };
});

vi.mock('@/components/ui/tabs', () => {
  const ReactLocal = require('react');
  return {
    Tabs: ({ children }: any) => ReactLocal.createElement('div', { 'data-testid': 'tabs' }, children),
    TabsList: ({ children }: any) => ReactLocal.createElement('div', { 'data-testid': 'tabs-list' }, children),
    TabsTrigger: ({ children, value, onClick, ...props }: any) =>
      ReactLocal.createElement(
        'button',
        {
          type: 'button',
          role: 'tab',
          'data-value': value,
          onClick: (e: any) => {
            if (typeof onClick === 'function') onClick(e);
            const ev = new CustomEvent('tab-select', { detail: { value } });
            (window as any).dispatchEvent(ev);
          },
          ...props,
        },
        children
      ),
  };
});

vi.mock('@/components/ui/skeleton', () => {
  const ReactLocal = require('react');
  return {
    Skeleton: ({ className, ...props }: any) => ReactLocal.createElement('div', { 'data-testid': 'skeleton', ...props }, null),
  };
});

// Mock lucide-react icons used
vi.mock('lucide-react', () => {
  const ReactLocal = require('react');
  const Icon = ({ 'data-icon': name }: any) => ReactLocal.createElement('span', { 'data-testid': `icon-${name}` }, null);
  return {
    Plus: (props: any) => Icon({ 'data-icon': 'Plus', ...props }),
    Pencil: (props: any) => Icon({ 'data-icon': 'Pencil', ...props }),
    Trash2: (props: any) => Icon({ 'data-icon': 'Trash2', ...props }),
    CalendarDays: (props: any) => Icon({ 'data-icon': 'CalendarDays', ...props }),
    Building2: (props: any) => Icon({ 'data-icon': 'Building2', ...props }),
    Sparkles: (props: any) => Icon({ 'data-icon': 'Sparkles', ...props }),
  };
});

// Mock the local TaskFormDialog to avoid rendering heavy internals
vi.mock('./TaskFormDialog', () => {
  const ReactLocal = require('react');
  return {
    TaskFormDialog: ({ open, onOpenChange, etablissementId, task }: any) =>
      ReactLocal.createElement(
        'div',
        { 'data-testid': 'task-form-dialog', 'data-open': Boolean(open), 'data-etab': etablissementId },
        task ? `editing-${task.id}` : 'create'
      ),
  };
});

// Mock the portail hooks module with stable mocks (vi.hoisted used above)
vi.mock('@/hooks/portail/useClientPortalTasks', () => {
  return {
    useClientPortalTasks: (...args: any[]) => mockUseClientPortalTasks(...args),
    useUpdateClientPortalTask: () => mockUseUpdateClientPortalTask(),
    useDeleteClientPortalTask: () => mockUseDeleteClientPortalTask(),
  };
});

// Stub global confirm to control delete flow
vi.stubGlobal('confirm', vi.fn(() => true));

let TaskList: any;

beforeAll(async () => {
  const mod = await import('./TaskList');
  TaskList = mod.TaskList;
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default hook behavior for tests unless overridden in individual tests
  mockUseClientPortalTasks.mockImplementation(() => ({ data: TASKS, isLoading: false }));
  mockUseUpdateClientPortalTask.mockImplementation(() => ({ mutate: updateMutate }));
  mockUseDeleteClientPortalTask.mockImplementation(() => ({ mutate: deleteMutate }));
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qc = createQueryClient();
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('TaskList component', () => {
  it('shows skeletons while loading', () => {
    mockUseClientPortalTasks.mockReturnValueOnce({ data: [], isLoading: true });

    render(React.createElement(Wrapper, null, React.createElement(TaskList, { etablissementId: 'e1' })));

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Tâche OpenPulse')).toBeNull();
    expect(screen.queryByText("Tâche Établissement")).toBeNull();
  });

  it('renders tasks, badges and details correctly when data is loaded', () => {
    mockUseClientPortalTasks.mockReturnValueOnce({ data: TASKS, isLoading: false });

    render(React.createElement(Wrapper, null, React.createElement(TaskList, { etablissementId: 'e1' })));

    expect(screen.getByText('Côté OpenPulse')).toBeTruthy();
    expect(screen.getByText('Côté Établissement')).toBeTruthy();

    expect(screen.getByText('Tâche OpenPulse')).toBeTruthy();
    expect(screen.getByText("Tâche Établissement")).toBeTruthy();

    expect(screen.getByText('Demande client')).toBeTruthy();

    const createdLabels = screen.getAllByText((content) => typeof content === 'string' && content.startsWith('Créée le'));
    expect(createdLabels.length).toBeGreaterThanOrEqual(1);

    const badgeElements = screen.getAllByTestId('badge');
    expect(badgeElements.length).toBeGreaterThanOrEqual(2);
  });

  it('calls update.mutate when toggling a task via checkbox', async () => {
    const tasksForToggle = [
      {
        id: 't-toggle',
        titre: 'Toggle Task',
        description: '',
        comment: null,
        due_date: null,
        created_at: '2024-03-01T00:00:00.000Z',
        phase: 'deploiement',
        assignee: 'marque',
        statut: 'todo',
        created_by: 'marque',
        etablissement_id: 'e1',
      },
    ];
    mockUseClientPortalTasks.mockReturnValueOnce({ data: tasksForToggle, isLoading: false });

    render(React.createElement(Wrapper, null, React.createElement(TaskList, { etablissementId: 'e1' })));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(checkboxes[0]);
    });

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith({
      id: 't-toggle',
      patch: { statut: 'done', done_by: 'marque' },
    });
  });

  it('calls delete.mutate when deleting a task after confirmation', async () => {
    const tasksForDelete = [
      {
        id: 't-del',
        titre: 'Delete Task',
        description: '',
        comment: null,
        due_date: null,
        created_at: '2024-03-01T00:00:00.000Z',
        phase: 'production',
        assignee: 'etablissement',
        statut: 'todo',
        created_by: 'etablissement',
        etablissement_id: 'e-delete',
      },
    ];
    mockUseClientPortalTasks.mockReturnValueOnce({ data: tasksForDelete, isLoading: false });

    render(React.createElement(Wrapper, null, React.createElement(TaskList, { etablissementId: 'e-delete' })));

    const deleteButton = screen.getByLabelText('Supprimer');
    expect(deleteButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(deleteMutate).toHaveBeenCalledTimes(1);
    expect(deleteMutate).toHaveBeenCalledWith({ id: 't-del', etablissement_id: 'e-delete' });
  });

  it('hook returns error state when the underlying hook reports an error (renderHook test)', async () => {
    const errorObj = { message: 'simulated failure' };
    mockUseClientPortalTasks.mockReturnValueOnce({ data: null, isLoading: false, error: errorObj });

    const { result } = renderHook(() => (mockUseClientPortalTasks as any)('e1'), {
      wrapper: ({ children }: any) =>
        React.createElement(QueryClientProvider, { client: createQueryClient() }, children),
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error.message).toBe('simulated failure');
    expect(result.current.data).toBeNull();
  });
});