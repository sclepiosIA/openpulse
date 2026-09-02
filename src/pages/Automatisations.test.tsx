import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Automatisations from './Automatisations';

const {
  navigateMock,
  toastMock,
  useWorkflowsMock,
  useWorkflowTemplatesMock,
  useDeleteWorkflowMock,
  useToggleWorkflowActiveMock,
  useCreateWorkflowMock,
  useTriggerWorkflowManualMock,
  useInstantiateTemplateMock,
  pageDataStateProps,
  titleMock,
  debouncedValueMock,
  WORKFLOWS,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TRIGGER_LABELS,
} = vi.hoisted(() => {
  const WORKFLOWS = [
    {
      id: 'wf1',
      nom: 'Relance prospect',
      trigger_type: 'manual',
      is_template: false,
      is_active: true,
      stats: { runs: 5, failed: 1 },
      last_run_at: '2024-01-02T10:00:00.000Z',
    },
    {
      id: 'wf2',
      nom: 'Alerte webhook',
      trigger_type: 'webhook',
      is_template: false,
      is_active: false,
      stats: { runs: 2, failed: 0 },
      last_run_at: null,
    },
    {
      id: 'tpl-hidden',
      nom: 'Template interne',
      trigger_type: 'manual',
      is_template: true,
      is_active: true,
      stats: { runs: 99, failed: 0 },
      last_run_at: null,
    },
  ];

  const TEMPLATES = [
    {
      id: 'tpl1',
      name: 'Relance automatique',
      description: 'Relance après 7 jours',
      category: 'sales',
      trigger_type: 'manual',
    },
    {
      id: 'tpl2',
      name: 'Webhook entrant',
      description: 'Traite un webhook',
      category: 'ops',
      trigger_type: 'webhook',
    },
  ];

  return {
    navigateMock: vi.fn(),
    toastMock: vi.fn(),
    useWorkflowsMock: vi.fn(),
    useWorkflowTemplatesMock: vi.fn(),
    useDeleteWorkflowMock: vi.fn(),
    useToggleWorkflowActiveMock: vi.fn(),
    useCreateWorkflowMock: vi.fn(),
    useTriggerWorkflowManualMock: vi.fn(),
    useInstantiateTemplateMock: vi.fn(),
    pageDataStateProps: vi.fn(),
    titleMock: vi.fn(),
    debouncedValueMock: vi.fn((v: string) => v),
    WORKFLOWS,
    TEMPLATES,
    TEMPLATE_CATEGORIES: ['sales', 'ops'],
    TRIGGER_LABELS: {
      manual: 'Manuel',
      webhook: 'Webhook',
      schedule: 'Planifié',
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: debouncedValueMock,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: titleMock,
}));

vi.mock('@/hooks/workflows/useWorkflows', () => ({
  useWorkflows: useWorkflowsMock,
  useDeleteWorkflow: useDeleteWorkflowMock,
  useToggleWorkflowActive: useToggleWorkflowActiveMock,
  useCreateWorkflow: useCreateWorkflowMock,
  useTriggerWorkflowManual: useTriggerWorkflowManualMock,
}));

vi.mock('@/hooks/workflows/useWorkflowTemplates', () => ({
  useWorkflowTemplates: useWorkflowTemplatesMock,
  useInstantiateTemplate: useInstantiateTemplateMock,
  TEMPLATE_CATEGORIES,
}));

vi.mock('@/types/workflow', () => ({
  TRIGGER_LABELS,
}));

vi.mock('date-fns', () => ({
  format: () => '2 janv. 2024 10:00',
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg data-testid="icon" />;
  return {
    Plus: Icon,
    Play: Icon,
    Edit2: Icon,
    Trash2: Icon,
    Copy: Icon,
    Workflow: Icon,
    Zap: Icon,
    Search: Icon,
    Sparkles: Icon,
    Activity: Icon,
    Download: Icon,
    Upload: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label={checked ? 'switch-on' : 'switch-off'}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    'aria-label': ariaLabel,
    className,
    type,
    accept,
    id,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    'aria-label'?: string;
    className?: string;
    type?: string;
    accept?: string;
    id?: string;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      type={type}
      accept={accept}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => <span>select-value</span>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    stats,
    actions,
  }: {
    title: string;
    subtitle?: string;
    stats?: Array<{ label: string; value: string | number }>;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {stats?.map((s) => (
        <div key={s.label}>
          <span>{s.label}</span>
          <span>{String(s.value)}</span>
        </div>
      ))}
      {actions}
    </div>
  ),
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    error,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    error?: { message?: string } | null;
    children: React.ReactNode;
  }) => {
    pageDataStateProps({ isLoading, isError, error });
    return (
      <div data-testid="page-data-state">
        {isError ? error?.message : null}
        {children}
      </div>
    );
  },
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderPage() {
  const client = createClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Automatisations />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Automatisations', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useWorkflowsMock.mockReturnValue({
      data: WORKFLOWS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    useWorkflowTemplatesMock.mockReturnValue({
      data: TEMPLATES,
      isLoading: false,
    });

    useDeleteWorkflowMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    useToggleWorkflowActiveMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    useCreateWorkflowMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    useTriggerWorkflowManualMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    useInstantiateTemplateMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('affiche le chargement des workflows', () => {
    useWorkflowsMock.mockReturnValue({
      data: WORKFLOWS,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Automatisations' })).toBeInTheDocument();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.getByText('Marketplace (2)')).toBeInTheDocument();
  });

  it('affiche les KPIs et les workflows réels hors templates', () => {
    renderPage();

    expect(titleMock).toHaveBeenCalledWith('Automatisations');
    expect(screen.getAllByText('Actifs').length).toBeGreaterThan(0);
    expect(screen.getByText('Exécutions totales')).toBeInTheDocument();
    expect(screen.getByText('Échecs')).toBeInTheDocument();
    expect(screen.getByText('Modèles disponibles')).toBeInTheDocument();

    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    expect(screen.getByText('Relance prospect')).toBeInTheDocument();
    expect(screen.getByText('Alerte webhook')).toBeInTheDocument();
    expect(screen.queryByText('Template interne')).not.toBeInTheDocument();

    expect(screen.getByText('Mes workflows (2)')).toBeInTheDocument();
    expect(screen.getByText('Marketplace (2)')).toBeInTheDocument();
    expect(screen.getAllByText('Manuel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Webhook').length).toBeGreaterThan(0);
    expect(screen.getByText('(1 ✗)')).toBeInTheDocument();
    expect(screen.getByText('2 janv. 2024 10:00')).toBeInTheDocument();
  });

  it('filtre les workflows par recherche', () => {
    renderPage();

    const input = screen.getByLabelText('Rechercher un workflow');
    fireEvent.change(input, { target: { value: 'webhook' } });

    expect(screen.queryByText('Relance prospect')).not.toBeInTheDocument();
    expect(screen.getByText('Alerte webhook')).toBeInTheDocument();
    expect(screen.getByText('Mes workflows (1)')).toBeInTheDocument();
  });

  it('navigue vers les pages santé, runs et webhooks', () => {
    renderPage();

    fireEvent.click(screen.getByText('Santé'));
    fireEvent.click(screen.getByText('Runs'));
    fireEvent.click(screen.getByText('Webhooks'));

    expect(navigateMock).toHaveBeenCalledWith('/automatisations/sante');
    expect(navigateMock).toHaveBeenCalledWith('/automatisations/runs');
    expect(navigateMock).toHaveBeenCalledWith('/automatisations/webhooks-alertes');
  });

  it('affiche l’état erreur via PageDataState', () => {
    const refetch = vi.fn();
    useWorkflowsMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
      refetch,
    });

    renderPage();

    expect(screen.getByTestId('page-data-state')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(pageDataStateProps).toHaveBeenCalledWith(
      expect.objectContaining({
        isLoading: false,
        isError: true,
        error: { message: 'x' },
      }),
    );
  });
});