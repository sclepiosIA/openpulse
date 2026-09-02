/// <reference types="vitest" />
/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  PLAYBOOKS,
  STEPS_BY_PLAYBOOK,
  EXECUTIONS,
  DASHBOARD,
  HOOKS_STATE,
  mockUsePageTitle,
  mockRunMutate,
  mockUpsertPlaybookMutate,
  mockUpsertPlaybookMutateAsync,
  mockUpsertStepMutate,
  mockUpsertStepMutateAsync,
  mockDeletePlaybookMutate,
  mockDeleteStepMutate,
  mockRefetch,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const PLAYBOOKS = [
    {
      id: 'pb1',
      name: 'Playbook Santé',
      description: 'Desc pb1',
      category: 'health',
      cooldown_days: 14,
      is_active: true,
      trigger_config: { field: 'health_score', operator: 'lt', threshold: 60 },
    },
    {
      id: 'pb2',
      name: 'Playbook Rétention',
      description: null,
      category: 'retention',
      cooldown_days: 7,
      is_active: false,
      trigger_config: { field: 'health_score', operator: 'lte', threshold: 40 },
    },
  ] as const;

  const STEPS_BY_PLAYBOOK: Record<
    string,
    Array<{
      id: string;
      playbook_id: string;
      step_order: number;
      step_type: string;
      config: unknown;
      delay_days: number;
    }>
  > = {
    pb1: [
      {
        id: 's1',
        playbook_id: 'pb1',
        step_order: 1,
        step_type: 'create_task',
        config: { titre: 'Contacter le client', priorite: 'haute' },
        delay_days: 0,
      },
    ],
    pb2: [],
  };

  const EXECUTIONS = [
    {
      id: 'ex1',
      status: 'completed',
      current_step_order: 2,
      next_action_at: null,
      etablissement_id: 'etab_1234567890',
      last_error: null,
      started_at: '2024-01-10T08:30:00.000Z',
    },
    {
      id: 'ex2',
      status: 'pending',
      current_step_order: 1,
      next_action_at: '2024-01-11T10:00:00.000Z',
      etablissement_id: 'etab_abcdef123456',
      last_error: null,
      started_at: '2024-01-10T09:00:00.000Z',
    },
  ] as const;

  const DASHBOARD = {
    active_playbooks: 1,
    pending_executions: 3,
    completed_30d: 12,
    failed_30d: 2,
    total_playbooks: 2,
  } as const;

  const HOOKS_STATE = {
    playbooks: {
      data: PLAYBOOKS as unknown as Array<Record<string, unknown>>,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    },
    steps: new Map<string | undefined, unknown>([
      ['pb1', STEPS_BY_PLAYBOOK.pb1],
      ['pb2', STEPS_BY_PLAYBOOK.pb2],
      [undefined, []],
    ]),
    executions: {
      data: EXECUTIONS as unknown as Array<Record<string, unknown>>,
    },
    dashboard: {
      data: DASHBOARD as unknown as Record<string, unknown>,
    },
    runEngine: {
      isPending: false,
      mutate: vi.fn(),
    },
    upsertPlaybook: {
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn(async (payload: unknown) => {
        const p = payload as Record<string, unknown>;
        const id = typeof p.id === 'string' ? p.id : 'pb_new';
        return { ...p, id };
      }),
    },
    deletePlaybook: {
      mutate: vi.fn(),
    },
    upsertStep: {
      mutate: vi.fn(),
      mutateAsync: vi.fn(async (payload: unknown) => payload),
    },
    deleteStep: {
      mutate: vi.fn(),
    },
  };

  const mockUsePageTitle = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const mockNavigate = vi.fn();
  const mockRefetch = HOOKS_STATE.playbooks.refetch;

  const mockRunMutate = HOOKS_STATE.runEngine.mutate;
  const mockUpsertPlaybookMutate = HOOKS_STATE.upsertPlaybook.mutate;
  const mockUpsertPlaybookMutateAsync = HOOKS_STATE.upsertPlaybook.mutateAsync;
  const mockUpsertStepMutate = HOOKS_STATE.upsertStep.mutate;
  const mockUpsertStepMutateAsync = HOOKS_STATE.upsertStep.mutateAsync;
  const mockDeletePlaybookMutate = HOOKS_STATE.deletePlaybook.mutate;
  const mockDeleteStepMutate = HOOKS_STATE.deleteStep.mutate;

  const makeThenableBuilder = () => {
    const builder: Record<string, unknown> = {};
    const methods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'range',
      'ilike',
      'like',
      'contains',
      'overlaps',
      'is',
      'not',
      'match',
      'insert',
      'update',
      'upsert',
      'delete',
      'rpc',
    ] as const;

    for (const m of methods) builder[m] = vi.fn(() => builder);

    builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));

    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      try {
        const res = { data: null, error: null };
        return Promise.resolve(res).then(onFulfilled, onRejected);
      } catch (e) {
        return Promise.reject(e).then(onFulfilled, onRejected);
      }
    };
    builder.catch = (onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn(() => makeThenableBuilder());

  return {
    PLAYBOOKS,
    STEPS_BY_PLAYBOOK,
    EXECUTIONS,
    DASHBOARD,
    HOOKS_STATE,
    mockUsePageTitle,
    mockRunMutate,
    mockUpsertPlaybookMutate,
    mockUpsertPlaybookMutateAsync,
    mockUpsertStepMutate,
    mockUpsertStepMutateAsync,
    mockDeletePlaybookMutate,
    mockDeleteStepMutate,
    mockRefetch,
    mockFrom,
    mockNavigate,
    toastSuccess,
    toastError,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: mockUsePageTitle,
}));

vi.mock('@/hooks/csm/useCsmPlaybooks', () => ({
  useCsmPlaybookDashboard: () => HOOKS_STATE.dashboard,
  useCsmPlaybooks: () => HOOKS_STATE.playbooks,
  useCsmPlaybookExecutions: () => HOOKS_STATE.executions,
  useCsmPlaybookSteps: (playbookId?: string) => ({
    data: (HOOKS_STATE.steps.get(playbookId) as unknown[] | undefined) ?? [],
  }),
  useUpsertPlaybook: () => HOOKS_STATE.upsertPlaybook,
  useDeletePlaybook: () => HOOKS_STATE.deletePlaybook,
  useUpsertPlaybookStep: () => HOOKS_STATE.upsertStep,
  useDeletePlaybookStep: () => HOOKS_STATE.deleteStep,
  useRunPlaybookEngine: () => HOOKS_STATE.runEngine,
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    isEmpty,
    emptyTitle,
    emptyDescription,
    onRetry,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    isEmpty: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onRetry: () => void;
    children: React.ReactNode;
  }) => {
    if (isLoading) return <div data-testid="pds-loading">loading</div>;
    if (isError)
      return (
        <button data-testid="pds-error" type="button" onClick={onRetry}>
          error
        </button>
      );
    if (isEmpty) return <div data-testid="pds-empty">{emptyTitle} {emptyDescription}</div>;
    return <div data-testid="pds-ok">{children}</div>;
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" data-class={className ?? ''}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-variant={variant ?? ''}
      data-size={size ?? ''}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant ?? ''}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
  }) => (
    <input
      data-testid="switch"
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.currentTarget.checked)}
    />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    type,
    placeholder,
    className,
    title,
  }: {
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
    className?: string;
    title?: string;
  }) => (
    <input
      data-testid="input"
      value={value ?? ''}
      onChange={onChange}
      type={type ?? 'text'}
      placeholder={placeholder}
      className={className}
      title={title}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    rows,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    className?: string;
  }) => (
    <textarea data-testid="textarea" value={value ?? ''} onChange={onChange} rows={rows} className={className} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" data-testid="select-trigger" className={className}>
      {children}
    </button>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode; defaultValue?: string }) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button type="button" data-testid="tabs-trigger" data-value={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
    <div data-testid="tabs-content" data-value={value} data-class={className ?? ''}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean; onOpenChange?: (v: boolean) => void }) => (
    <div data-testid="dialog" data-open={open ? '1' : '0'}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Play: () => <span data-testid="icon-play" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Activity: () => <span data-testid="icon-activity" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  CheckCircle2: () => <span data-testid="icon-check" />,
  Clock: () => <span data-testid="icon-clock" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function importModule() {
  const mod = await import('./PlaybooksCsm');
  return mod;
}

describe('PlaybooksCsm', () => {
  beforeEach(() => {
    HOOKS_STATE.playbooks.data = PLAYBOOKS as unknown as Array<Record<string, unknown>>;
    HOOKS_STATE.playbooks.isLoading = false;
    HOOKS_STATE.playbooks.isError = false;

    HOOKS_STATE.dashboard.data = DASHBOARD as unknown as Record<string, unknown>;
    HOOKS_STATE.executions.data = EXECUTIONS as unknown as Array<Record<string, unknown>>;
    HOOKS_STATE.runEngine.isPending = false;

    mockUsePageTitle.mockClear();
    mockRunMutate.mockClear();
    mockUpsertPlaybookMutate.mockClear();
    mockUpsertPlaybookMutateAsync.mockClear();
    mockUpsertStepMutate.mockClear();
    mockUpsertStepMutateAsync.mockClear();
    mockDeletePlaybookMutate.mockClear();
    mockDeleteStepMutate.mockClear();
    mockRefetch.mockClear();

    mockFrom.mockClear();
    mockNavigate.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();

    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('affiche un état de chargement via PageDataState', async () => {
    HOOKS_STATE.playbooks.isLoading = true;
    HOOKS_STATE.playbooks.data = [];

    const { default: PlaybooksCsm } = await importModule();
    renderWithClient(<PlaybooksCsm />);

    expect(screen.getByRole('heading', { name: 'Playbooks CSM' })).toBeTruthy();
    expect(screen.getByTestId('pds-loading')).toBeTruthy();
    expect(mockUsePageTitle).toHaveBeenCalledWith('Playbooks CSM');
  });

  it('rendu succès: KPIs (ciblés) + liste playbooks + exécutions', async () => {
    const { default: PlaybooksCsm } = await importModule();
    renderWithClient(<PlaybooksCsm />);

    expect(screen.getByRole('heading', { name: 'Playbooks CSM' })).toBeTruthy();

    const container = screen.getByRole('heading', { name: 'Playbooks CSM' }).closest('div');
    expect(container).toBeTruthy();

    const kpiActifs = screen.getByText('Actifs').closest('[data-testid="card"]');
    expect(kpiActifs).toBeTruthy();
    if (kpiActifs) {
      expect(within(kpiActifs).getByText(String(DASHBOARD.active_playbooks))).toBeTruthy();
    }

    const kpiTotal = screen.getByText('Total').closest('[data-testid="card"]');
    expect(kpiTotal).toBeTruthy();
    if (kpiTotal) {
      expect(within(kpiTotal).getByText(String(DASHBOARD.total_playbooks))).toBeTruthy();
    }

    expect(screen.getByText('Playbook Santé')).toBeTruthy();
    expect(screen.getByText('cooldown 14j')).toBeTruthy();
    expect(screen.getByText('1 étape')).toBeTruthy();
    expect(screen.getByText('Desc pb1')).toBeTruthy();

    expect(screen.getByText('Playbook Rétention')).toBeTruthy();
    expect(screen.getByText('cooldown 7j')).toBeTruthy();
    expect(screen.getByText('0 étape')).toBeTruthy();

    expect(screen.getByText(`Exécutions (${EXECUTIONS.length})`)).toBeTruthy();
    expect(screen.getAllByText('pending').length).toBe(1);
    expect(screen.getAllByText('completed').length).toBe(1);
    expect(screen.getAllByText(/Établissement : /).length).toBe(2);
  });

  it('erreur: PageDataState isError + retry appelle refetch', async () => {
    HOOKS_STATE.playbooks.isError = true;
    HOOKS_STATE.playbooks.isLoading = false;

    const { default: PlaybooksCsm } = await importModule();
    renderWithClient(<PlaybooksCsm />);

    const btn = screen.getByTestId('pds-error');
    expect(btn).toBeTruthy();

    fireEvent.click(btn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('mutations: lancer le worker (confirm) + toggle switch playbook appelle upsert.mutate avec is_active inversé', async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);

    const { default: PlaybooksCsm } = await importModule();
    renderWithClient(<PlaybooksCsm />);

    const runBtn = screen.getByLabelText('Lancer le worker des playbooks (avec confirmation)');
    await act(async () => {
      fireEvent.click(runBtn);
    });
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mockRunMutate).toHaveBeenCalledTimes(1);

    const switches = screen.getAllByTestId('switch');
    expect(switches.length).toBe(2);

    await act(async () => {
      fireEvent.click(switches[0]);
    });

    expect(mockUpsertPlaybookMutate).toHaveBeenCalledTimes(1);
    const payload = mockUpsertPlaybookMutate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.id).toBe('pb1');
    expect(payload.is_active).toBe(false);
  });

  it('création: ouvre "Nouveau playbook" et Enregistrer déclenche mutateAsync puis crée une étape par défaut', async () => {
    const { default: PlaybooksCsm } = await importModule();
    renderWithClient(<PlaybooksCsm />);

    const newBtn = screen.getByRole('button', { name: 'Nouveau playbook' });
    fireEvent.click(newBtn);

    expect(screen.getByTestId('dialog-title').textContent).toBe('Nouveau playbook');

    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: 'PB nouveau' } });
    });

    const saveBtn = screen.getByRole('button', { name: 'Enregistrer' });
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockUpsertPlaybookMutateAsync).toHaveBeenCalledTimes(1);
    const pbPayload = mockUpsertPlaybookMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pbPayload.name).toBe('PB nouveau');
    expect(pbPayload.cooldown_days).toBe(14);

    expect(mockUpsertStepMutateAsync).toHaveBeenCalledTimes(1);
    const stepPayload = mockUpsertStepMutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stepPayload.playbook_id).toBe('pb_new');
    expect(stepPayload.step_order).toBe(1);
    expect(stepPayload.step_type).toBe('create_task');
  });
});