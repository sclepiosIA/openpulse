// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent, renderHook, act, within } from '@testing-library/react';
import { WorkflowRunsList } from './WorkflowRunsList';

const {
  RUNS_SUCCESS,
  RUNS_EMPTY,
  AUTH_STATE,
  HOOK_LOADING,
  HOOK_SUCCESS,
  HOOK_ERROR,
  mockUseWorkflowRuns,
  mockUseWorkflowReplay,
  mockFrom,
  mockInvoke,
  mockToastSuccess,
  mockToastError,
  mockMutate,
} = vi.hoisted(() => {
  const RUNS_SUCCESS = [
    {
      id: 'run-1',
      workflow_id: 'wf-1',
      started_at: '2024-01-02T10:30:00.000Z',
      status: 'running' as const,
      trigger_payload: { source: 'manual' },
      duration_ms: 1200,
      error: null,
      steps_log: [
        { node_id: 'node-a', node_type: 'trigger', status: 'success' as const },
        { node_id: 'node-b', node_type: 'action', status: 'running' as const },
      ],
    },
    {
      id: 'run-2',
      workflow_id: 'wf-1',
      started_at: '2024-01-03T11:00:00.000Z',
      status: 'paused' as const,
      trigger_payload: { source: 'resume' },
      duration_ms: null,
      error: null,
      steps_log: [
        { node_id: 'node-c', node_type: 'condition', status: 'success' as const },
        { node_id: 'node-d', node_type: 'action', status: 'pending' as const },
      ],
    },
    {
      id: 'run-3',
      workflow_id: 'wf-1',
      started_at: '2024-01-04T12:00:00.000Z',
      status: 'failed' as const,
      trigger_payload: { source: 'cron' },
      duration_ms: 4500,
      error: 'Échec API',
      steps_log: [
        { node_id: 'node-e', node_type: 'http', status: 'failed' as const, error: '500' },
      ],
    },
    {
      id: 'run-4',
      workflow_id: 'wf-1',
      started_at: '2024-01-05T12:00:00.000Z',
      status: 'success' as const,
      trigger_payload: { source: 'cron' },
      duration_ms: 320,
      error: null,
      steps_log: [
        { node_id: 'node-f', node_type: 'email', status: 'success' as const },
      ],
    },
  ] as const;

  const RUNS_EMPTY: [] = [];

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  } as const;

  const HOOK_LOADING = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  } as const;

  const HOOK_SUCCESS = {
    data: RUNS_SUCCESS,
    isLoading: false,
    isError: false,
    error: null,
  } as const;

  const HOOK_ERROR = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  } as const;

  const mockUseWorkflowRuns = vi.fn();
  const mockUseWorkflowReplay = vi.fn();
  const mockFrom = vi.fn();
  const mockInvoke = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockMutate = vi.fn();

  return {
    RUNS_SUCCESS,
    RUNS_EMPTY,
    AUTH_STATE,
    HOOK_LOADING,
    HOOK_SUCCESS,
    HOOK_ERROR,
    mockUseWorkflowRuns,
    mockUseWorkflowReplay,
    mockFrom,
    mockInvoke,
    mockToastSuccess,
    mockToastError,
    mockMutate,
  };
});

vi.mock('@/hooks/workflows/useWorkflowRuns', () => ({
  useWorkflowRuns: mockUseWorkflowRuns,
}));

vi.mock('@/hooks/workflows/useWorkflowReplay', () => ({
  useWorkflowReplay: mockUseWorkflowReplay,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, title, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    CheckCircle2: Icon,
    XCircle: Icon,
    Loader2: Icon,
    Clock: Icon,
    ChevronRight: Icon,
    Pause: Icon,
    Play: Icon,
    RotateCcw: Icon,
  };
});

function createBuilder(result: { data: unknown; error: { message: string } | null }) {
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
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

function createWrapper() {
  const queryClient = createQueryClient();
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const view = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { queryClient, invalidateSpy, ...view };
}

describe('WorkflowRunsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseWorkflowReplay.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);
    mockFrom.mockImplementation(() => createBuilder({ data: null, error: null }));
    mockInvoke.mockResolvedValue({ data: null, error: null });
  });

  it('affiche l’état de chargement et un hook React Query passe de isLoading à succès', async () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_LOADING);

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['workflow-runs-test'],
          queryFn: async () => RUNS_SUCCESS,
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBe(RUNS_SUCCESS);
    });

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('affiche les runs avec leurs données métier réelles sans ambiguïté de sélection', () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('paused')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();

    expect(screen.getByText('Échec API')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Durée : 1200 ms')).toBeInTheDocument();
    expect(screen.getByText('Durée : 4500 ms')).toBeInTheDocument();
    expect(screen.getByText('Durée : 320 ms')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reprendre/i })).toBeInTheDocument();

    const replayButtons = screen.getAllByRole('button', { name: /Rejouer/i });
    expect(replayButtons).toHaveLength(2);

    const triggerNode = screen.getByText('trigger');
    expect(triggerNode.closest('div')?.textContent).toContain('node-a');

    const conditionNode = screen.getByText('condition');
    expect(conditionNode.closest('div')?.textContent).toContain('node-c');

    const httpNode = screen.getByText('http');
    expect(httpNode.closest('div')?.textContent).toContain('node-e');

    const emailNode = screen.getByText('email');
    expect(emailNode.closest('div')?.textContent).toContain('node-f');
  });

  it('affiche un état vide quand il n’y a aucune exécution', () => {
    mockUseWorkflowRuns.mockReturnValue({
      data: RUNS_EMPTY,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    expect(screen.getByText('Aucune exécution pour le moment.')).toBeInTheDocument();
  });

  it('met en pause un run en cours, appelle Supabase et invalide le cache', async () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);

    const updateBuilder = createBuilder({ data: null, error: null });
    const fromBuilder = {
      ...updateBuilder,
      update: vi.fn(() => updateBuilder),
    };
    mockFrom.mockImplementation(() => fromBuilder);

    const { invalidateSpy } = renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pause/i }));
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('workflow_runs');
      expect(fromBuilder.update).toHaveBeenCalledWith({ status: 'paused' });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'run-1');
      expect(mockToastSuccess).toHaveBeenCalledWith('Run mis en pause');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow_runs'] });
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('reprend un run pausé, invoque le moteur avec le dernier nœud non failed et invalide le cache deux fois', async () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);

    const updateBuilder = createBuilder({ data: null, error: null });
    const fromBuilder = {
      ...updateBuilder,
      update: vi.fn(() => updateBuilder),
    };
    mockFrom.mockImplementation(() => fromBuilder);

    const { invalidateSpy } = renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reprendre/i }));
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('workflow_runs');
      expect(fromBuilder.update).toHaveBeenCalledWith({ status: 'running' });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'run-2');
      expect(mockToastSuccess).toHaveBeenCalledWith('Run repris');
      expect(mockInvoke).toHaveBeenCalledWith('workflow-engine', {
        body: {
          workflow_id: 'wf-1',
          run_id: 'run-2',
          resume_from_node: 'node-d',
          trigger_payload: { source: 'resume' },
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ['workflow_runs'] });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: ['workflow_runs'] });
  });

  it('déclenche le replay pour un run terminé', async () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    const replayButtons = screen.getAllByRole('button', { name: /Rejouer/i });

    await act(async () => {
      fireEvent.click(replayButtons[0]);
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith('run-3');
  });

  it('désactive les boutons rejouer quand la mutation est pending', () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);
    mockUseWorkflowReplay.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    const replayButtons = screen.getAllByRole('button', { name: /Rejouer/i });
    expect(replayButtons).toHaveLength(2);
    expect(replayButtons[0]).toBeDisabled();
    expect(replayButtons[1]).toBeDisabled();
  });

  it('gère une erreur Supabase lors du changement de statut', async () => {
    mockUseWorkflowRuns.mockReturnValue(HOOK_SUCCESS);

    const failingBuilder = createBuilder({ data: null, error: { message: 'x' } });
    const fromBuilder = {
      ...failingBuilder,
      update: vi.fn(() => failingBuilder),
    };
    mockFrom.mockImplementation(() => fromBuilder);

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pause/i }));
    });

    await waitFor(() => {
      expect(fromBuilder.update).toHaveBeenCalledWith({ status: 'paused' });
      expect(failingBuilder.eq).toHaveBeenCalledWith('id', 'run-1');
      expect(mockToastError).toHaveBeenCalledWith('x');
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('couvre explicitement un hook en erreur avec data null et isError true', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['workflow-runs-error-test'],
          queryFn: async () => {
            throw new Error('x');
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error?.message).toBe('x');
    });

    mockUseWorkflowRuns.mockReturnValue(HOOK_ERROR);

    renderWithClient(<WorkflowRunsList workflow_id="wf-1" />);

    expect(screen.getByText('Aucune exécution pour le moment.')).toBeInTheDocument();
  });
});