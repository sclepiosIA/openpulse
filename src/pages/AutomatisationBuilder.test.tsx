// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import AutomatisationBuilder from './AutomatisationBuilder';

const {
  WORKFLOW,
  WORKFLOW_NO_TRIGGER,
  VALIDATION_ISSUES,
  PARAMS,
  mockNavigate,
  mockToast,
  mockUseWorkflow,
  mockUpdateMutateAsync,
  mockTriggerMutate,
  mockDryRunMutateAsync,
  mockValidateWorkflowGraph,
  executionStore,
  mockFrom,
  mockRefetch,
} = vi.hoisted(() => {
  const WORKFLOW = {
    id: 'wf-1',
    nom: 'Workflow de test',
    description: 'Description',
    trigger_type: 'manual',
    trigger_config: { mode: 'manual' },
    graph: {
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Déclencheur', config: {} } },
        { id: 'action-1', type: 'action', position: { x: 120, y: 0 }, data: { label: 'Action A', config: {} } },
      ],
      edges: [{ id: 'edge-1', source: 'trigger-1', target: 'action-1' }],
    },
  };

  const WORKFLOW_NO_TRIGGER = {
    ...WORKFLOW,
    graph: {
      nodes: [{ id: 'action-1', type: 'action', position: { x: 120, y: 0 }, data: { label: 'Action A', config: {} } }],
      edges: [],
    },
  };

  const VALIDATION_ISSUES = [] as Array<{ code: string; message: string }>;
  const PARAMS = { id: 'wf-1' };
  const mockNavigate = vi.fn();
  const mockToast = vi.fn();
  const mockUseWorkflow = vi.fn();
  const mockUpdateMutateAsync = vi.fn();
  const mockTriggerMutate = vi.fn();
  const mockDryRunMutateAsync = vi.fn();
  const mockValidateWorkflowGraph = vi.fn();
  const mockRefetch = vi.fn();

  const executionStore = {
    nodeStatuses: {} as Record<string, { status: string; error?: string; output?: Record<string, unknown>; branch?: string }>,
    executedEdgeIds: new Set<string>(),
    validationIssues: [] as unknown[],
    lastRunMeta: null as null | { run_id: string; is_dry_run: boolean; at: string },
    setNodeStatuses: vi.fn((v: Record<string, { status: string; error?: string; output?: Record<string, unknown>; branch?: string }>) => {
      executionStore.nodeStatuses = v;
    }),
    setExecutedEdgeIds: vi.fn((v: Set<string>) => {
      executionStore.executedEdgeIds = v;
    }),
    setValidationIssues: vi.fn((v: unknown[]) => {
      executionStore.validationIssues = v;
    }),
    clearStatuses: vi.fn(() => {
      executionStore.nodeStatuses = {};
      executionStore.executedEdgeIds = new Set<string>();
      executionStore.lastRunMeta = null;
    }),
    setLastRunMeta: vi.fn((v: { run_id: string; is_dry_run: boolean; at: string }) => {
      executionStore.lastRunMeta = v;
    }),
  };

  const createBuilder = () => {
    const result = { data: null, error: null };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    WORKFLOW,
    WORKFLOW_NO_TRIGGER,
    VALIDATION_ISSUES,
    PARAMS,
    mockNavigate,
    mockToast,
    mockUseWorkflow,
    mockUpdateMutateAsync,
    mockTriggerMutate,
    mockDryRunMutateAsync,
    mockValidateWorkflowGraph,
    executionStore,
    mockFrom,
    mockRefetch,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => PARAMS,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span>ArrowLeft</span>,
  Save: () => <span>Save</span>,
  Play: () => <span>Play</span>,
  History: () => <span>History</span>,
  Loader2: () => <span>Loader2</span>,
  FlaskConical: () => <span>FlaskConical</span>,
  X: () => <span>X</span>,
  Eye: () => <span>Eye</span>,
}));

vi.mock('date-fns', () => ({
  format: () => 'date-formattee',
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/workflows/useWorkflows', () => ({
  useWorkflow: (...args: unknown[]) => mockUseWorkflow(...args),
  useUpdateWorkflow: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useTriggerWorkflowManual: () => ({
    mutate: mockTriggerMutate,
    isPending: false,
  }),
}));

vi.mock('@/hooks/workflows/useWorkflowDryRun', () => ({
  useWorkflowDryRun: () => ({
    mutateAsync: mockDryRunMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/lib/workflow/validateGraph', () => ({
  validateWorkflowGraph: (...args: unknown[]) => mockValidateWorkflowGraph(...args),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => {
    const ariaLabel = props['aria-label'];
    return (
      <button {...props} aria-label={ariaLabel}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} />
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/automatisations/WorkflowCanvas', () => ({
  WorkflowCanvas: ({ nodes, edges }: { nodes: Array<{ id: string }>; edges: Array<{ id: string }> }) => (
    <div data-testid="workflow-canvas">
      <span>{`nodes:${nodes.length}`}</span>
      <span>{`edges:${edges.length}`}</span>
    </div>
  ),
}));

vi.mock('@/components/automatisations/panels/NodeLibrary', () => ({
  NodeLibrary: ({ onAddNode }: { onAddNode: (type: 'condition' | 'action' | 'delay') => void }) => (
    <div>
      <button onClick={() => onAddNode('action')}>Ajouter action</button>
    </div>
  ),
}));

vi.mock('@/components/automatisations/panels/NodeConfigPanel', () => ({
  NodeConfigPanel: () => <div data-testid="node-config-panel" />,
}));

vi.mock('@/components/automatisations/WorkflowRunsList', () => ({
  WorkflowRunsList: ({ workflow_id }: { workflow_id: string }) => <div>{`runs:${workflow_id}`}</div>,
}));

vi.mock('@/components/automatisations/AIWorkflowGenerator', () => ({
  AIWorkflowGenerator: () => <div>AI generator</div>,
}));

vi.mock('@/components/automatisations/WorkflowVersionsDialog', () => ({
  WorkflowVersionsDialog: () => <div>Versions</div>,
}));

vi.mock('@/components/automatisations/WorkflowImportExportMenu', () => ({
  WorkflowImportExportMenu: ({ workflowId, nom }: { workflowId: string; nom: string }) => (
    <div>{`import-export:${workflowId}:${nom}`}</div>
  ),
}));

vi.mock('@/components/automatisations/DryRunDialog', () => ({
  DryRunDialog: ({
    open,
    onLaunch,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    triggerType: string;
    onLaunch: (payload: Record<string, unknown>) => void | Promise<void>;
    isPending: boolean;
  }) => (open ? <button onClick={() => onLaunch({ input: 'sample' })}>Confirmer test</button> : null),
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    error,
    onRetry,
  }: {
    isLoading: boolean;
    isError: boolean;
    error?: Error;
    onRetry: () => void;
    children: React.ReactNode;
  }) => (
    <div>
      {isLoading && <div>Chargement en cours</div>}
      {isError && <div>{error?.message}</div>}
      {(isLoading || isError) && <button onClick={onRetry}>Réessayer</button>}
    </div>
  ),
}));

vi.mock('@/contexts/WorkflowExecutionContext', () => ({
  WorkflowExecutionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkflowExecution: () => {
    const [, setTick] = React.useState(0);
    return {
      nodeStatuses: executionStore.nodeStatuses,
      lastRunMeta: executionStore.lastRunMeta,
      setNodeStatuses: (v: Record<string, { status: string; error?: string; output?: Record<string, unknown>; branch?: string }>) => {
        executionStore.setNodeStatuses(v);
        setTick((n) => n + 1);
      },
      setExecutedEdgeIds: (v: Set<string>) => {
        executionStore.setExecutedEdgeIds(v);
        setTick((n) => n + 1);
      },
      setValidationIssues: (v: unknown[]) => {
        executionStore.setValidationIssues(v);
      },
      clearStatuses: () => {
        executionStore.clearStatuses();
        setTick((n) => n + 1);
      },
      setLastRunMeta: (v: { run_id: string; is_dry_run: boolean; at: string }) => {
        executionStore.setLastRunMeta(v);
        setTick((n) => n + 1);
      },
    };
  },
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

describe('AutomatisationBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executionStore.nodeStatuses = {};
    executionStore.executedEdgeIds = new Set<string>();
    executionStore.validationIssues = [];
    executionStore.lastRunMeta = null;
    mockValidateWorkflowGraph.mockReturnValue(VALIDATION_ISSUES);
    mockUseWorkflow.mockReturnValue({
      data: WORKFLOW,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
    mockUpdateMutateAsync.mockResolvedValue({ data: { id: 'wf-1' }, error: null });
    mockTriggerMutate.mockImplementation(() => undefined);
    mockDryRunMutateAsync.mockResolvedValue({
      run_id: 'run-1',
      steps_log: [
        { node_id: 'trigger-1', node_type: 'trigger', status: 'success', output: {} },
        { node_id: 'action-1', node_type: 'action', status: 'simulated', output: { done: true } },
      ],
    });
  });

  it('utilise renderHook avec QueryClientProvider', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ ok: true }), { wrapper });
    expect(result.current.ok).toBe(true);
  });

  it('affiche l’état de chargement', () => {
    mockUseWorkflow.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    expect(screen.getByText('Chargement en cours')).toBeInTheDocument();
  });

  it('affiche les données métier du workflow et valide le graph', async () => {
    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    expect(await screen.findByDisplayValue('Workflow de test')).toBeInTheDocument();
    expect(screen.getByText('Lancer maintenant')).toBeInTheDocument();
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.getByText('import-export:wf-1:Workflow de test')).toBeInTheDocument();
    expect(screen.getByText('nodes:2')).toBeInTheDocument();
    expect(screen.getByText('edges:1')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockValidateWorkflowGraph).toHaveBeenCalledWith(WORKFLOW.graph.nodes, WORKFLOW.graph.edges);
      expect(executionStore.setValidationIssues).toHaveBeenCalledWith(VALIDATION_ISSUES);
    });
  });

  it('enregistre le workflow avec les valeurs réelles', async () => {
    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    const input = await screen.findByDisplayValue('Workflow de test');
    fireEvent.change(input, { target: { value: 'Workflow modifié' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'));
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 'wf-1',
      nom: 'Workflow modifié',
      graph: {
        nodes: WORKFLOW.graph.nodes,
        edges: WORKFLOW.graph.edges,
      },
    });

    expect(mockToast).toHaveBeenCalledWith({ title: 'Workflow enregistré' });
  });

  it('déclenche une erreur métier si le workflow ne contient pas exactement un déclencheur', async () => {
    mockUseWorkflow.mockReturnValue({
      data: WORKFLOW_NO_TRIGGER,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    await act(async () => {
      fireEvent.click(await screen.findByText('Enregistrer'));
    });

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Workflow invalide',
      description: 'Le workflow doit contenir exactement un déclencheur.',
      variant: 'destructive',
    });
  });

  it('lance une exécution manuelle après sauvegarde', async () => {
    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    await act(async () => {
      fireEvent.click(await screen.findByText('Lancer maintenant'));
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 'wf-1',
      nom: 'Workflow de test',
      graph: {
        nodes: WORKFLOW.graph.nodes,
        edges: WORKFLOW.graph.edges,
      },
    });

    expect(mockTriggerMutate).toHaveBeenCalledWith({
      workflow_id: 'wf-1',
      payload: {
        manual: true,
        started_at: expect.any(String),
      },
    });
  });

  it('applique le dry-run et affiche le bandeau de résultat', async () => {
    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByText('Tester'));

    await act(async () => {
      fireEvent.click(await screen.findByText('Confirmer test'));
    });

    expect(mockDryRunMutateAsync).toHaveBeenCalledWith({
      workflow_id: 'wf-1',
      trigger_payload: { input: 'sample' },
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 'wf-1',
      nom: 'Workflow de test',
      graph: {
        nodes: WORKFLOW.graph.nodes,
        edges: WORKFLOW.graph.edges,
      },
    });

    await waitFor(() => {
      expect(executionStore.setNodeStatuses).toHaveBeenCalled();
      expect(executionStore.setExecutedEdgeIds).toHaveBeenCalled();
      expect(executionStore.setLastRunMeta).toHaveBeenCalled();
    });

    expect(screen.getByText('Mode test')).toBeInTheDocument();
    expect(screen.getByText('date-formattee')).toBeInTheDocument();
    expect(screen.getByText(/2 OK/)).toBeInTheDocument();
    expect(screen.getByText(/0 échec\(s\)/)).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith({
      title: '✅ Test réussi',
      description: '2 étape(s) OK · 0 échec(s)',
      variant: 'default',
    });
  });

  it('gère l’erreur du dry-run', async () => {
    mockDryRunMutateAsync.mockRejectedValue(new Error('x'));

    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByText('Tester'));

    await act(async () => {
      fireEvent.click(await screen.findByText('Confirmer test'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Échec du test',
        description: 'x',
        variant: 'destructive',
      });
    });
  });

  it('gère l’erreur de chargement', async () => {
    mockUseWorkflow.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
      refetch: mockRefetch,
    });

    render(<AutomatisationBuilder />, { wrapper: createWrapper() });

    expect(await screen.findByText('x')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Réessayer'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});