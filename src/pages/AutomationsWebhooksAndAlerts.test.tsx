import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AutomationsWebhooksAndAlerts from './AutomationsWebhooksAndAlerts';

const H = vi.hoisted(() => {
  const WORKFLOWS = [{ id: 'wf1', nom: 'Mon Workflow' }];
  const TOKENS = [
    {
      id: 't1',
      workflow_id: 'wf1',
      token: 'tokA1',
      label: 'Stripe',
      is_active: true,
      created_at: '2024-01-01T10:00:00.000Z',
      last_used_at: null,
      total_calls: 3,
    },
  ];
  const CONFIGS = [
    {
      id: 'c1',
      workflow_id: null,
      failure_rate_threshold: 0.3,
      min_runs: 5,
      window_minutes: 60,
      scheduled_backlog_threshold: 50,
      notify_user_ids: ['u1'],
      is_active: true,
      last_triggered_at: null,
    },
  ];
  const EMPTY: unknown[] = [];
  return {
    WORKFLOWS,
    TOKENS,
    CONFIGS,
    EMPTY,
    mockNavigate: vi.fn(),
    mockUsePageTitle: vi.fn(),
    mockUseWorkflows: vi.fn(),
    mockUseTokens: vi.fn(),
    mockUseConfigs: vi.fn(),
    createMut: { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    toggleMut: { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    deleteTokenMut: { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    upsertMut: { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    deleteConfigMut: { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    mockFrom: vi.fn(),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => H.mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: H.mockFrom },
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: H.mockUsePageTitle,
}));

vi.mock('@/hooks/workflows/useWorkflows', () => ({
  useWorkflows: H.mockUseWorkflows,
}));

vi.mock('@/hooks/workflows/useWorkflowWebhookTokens', () => ({
  useWorkflowWebhookTokens: H.mockUseTokens,
  useCreateWebhookToken: () => H.createMut,
  useToggleWebhookToken: () => H.toggleMut,
  useDeleteWebhookToken: () => H.deleteTokenMut,
}));

vi.mock('@/hooks/workflows/useWorkflowAlertConfig', () => ({
  useWorkflowAlertConfigs: H.mockUseConfigs,
  useUpsertAlertConfig: () => H.upsertMut,
  useDeleteAlertConfig: () => H.deleteConfigMut,
}));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'bg' }, children),
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }) =>
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      React.createElement('p', null, subtitle),
      actions,
    ),
}));

vi.mock('@/components/ui/button', () => {
  const Button = ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) =>
    React.createElement(
      'button',
      { onClick, disabled, 'aria-label': rest['aria-label'] },
      children,
    );
  return { Button, buttonVariants: () => '' };
});

vi.mock('@/components/ui/card', () => {
  const D = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { Card: D, CardHeader: D, CardTitle: D, CardDescription: D, CardContent: D, CardFooter: D };
});

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement('input', {
      value: props.value,
      onChange: props.onChange,
      placeholder: props.placeholder,
    }),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    'aria-label'?: string;
  }) =>
    React.createElement(
      'button',
      {
        'aria-label': rest['aria-label'] ?? 'switch',
        onClick: () => onCheckedChange?.(!checked),
      },
      checked ? 'on' : 'off',
    ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children),
  badgeVariants: () => '',
}));

vi.mock('@/components/ui/tabs', () => {
  const D = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { Tabs: D, TabsList: D, TabsContent: D, TabsTrigger: D };
});

vi.mock('@/components/ui/select', () => {
  const D = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { Select: D, SelectContent: D, SelectItem: D, SelectTrigger: D, SelectValue: D };
});

vi.mock('@/components/ui/dialog', () => {
  const D = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Dialog: D,
    DialogContent: D,
    DialogDescription: D,
    DialogFooter: D,
    DialogHeader: D,
    DialogTitle: D,
    DialogTrigger: D,
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AutomationsWebhooksAndAlerts />
    </QueryClientProvider>,
  );
}

describe('AutomationsWebhooksAndAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.mockUseWorkflows.mockReturnValue({ data: H.WORKFLOWS });
    H.mockUseTokens.mockReturnValue({ data: H.TOKENS, isLoading: false });
    H.mockUseConfigs.mockReturnValue({ data: H.CONFIGS, isLoading: false });
  });

  it('rend le titre de page, les sections et appelle usePageTitle', () => {
    renderPage();
    expect(H.mockUsePageTitle).toHaveBeenCalledWith('Webhooks & Alertes');
    expect(screen.getByRole('heading', { name: 'Webhooks & Alertes' })).toBeTruthy();
    expect(screen.getByText('Tokens webhooks entrants')).toBeTruthy();
    expect(screen.getByText('Alertes santé')).toBeTruthy();
  });

  it('affiche les données réelles du token et de la config alerte', () => {
    const { container } = renderPage();
    // 'Mon Workflow' apparaît dans la ligne du token ET dans le select du dialog (mocké rendu inline)
    expect(screen.getAllByText('Mon Workflow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/workflow-webhook-trigger\/tokA1/)).toBeTruthy();
    expect(container.textContent).toContain('3 appel(s)');
    expect(container.textContent).toContain('· Stripe');
    expect(screen.getAllByText('Tous workflows').length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('Seuil échec : 30%');
    expect(container.textContent).toContain('min 5 runs / 60 min');
    expect(container.textContent).toContain('Destinataires : 1 utilisateur(s)');
  });

  it('affiche les états de chargement', () => {
    H.mockUseTokens.mockReturnValue({ data: undefined, isLoading: true });
    H.mockUseConfigs.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getAllByText('Chargement…')).toHaveLength(2);
  });

  it('affiche les états vides', () => {
    H.mockUseTokens.mockReturnValue({ data: H.EMPTY, isLoading: false });
    H.mockUseConfigs.mockReturnValue({ data: H.EMPTY, isLoading: false });
    renderPage();
    expect(
      screen.getByText('Aucun token. Créez-en un pour exposer un déclencheur HTTP.'),
    ).toBeTruthy();
    expect(screen.getByText('Aucune alerte configurée.')).toBeTruthy();
  });

  it('désactive un token via le switch', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Activer/désactiver'));
    expect(H.toggleMut.mutate).toHaveBeenCalledWith({ id: 't1', is_active: false });
  });

  it('supprime un token et une config alerte', () => {
    renderPage();
    const deleteButtons = screen.getAllByLabelText('Supprimer');
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[0]);
    expect(H.deleteTokenMut.mutate).toHaveBeenCalledWith('t1');
    fireEvent.click(deleteButtons[1]);
    expect(H.deleteConfigMut.mutate).toHaveBeenCalledWith('c1');
  });

  it('navigue vers /automatisations au clic sur Retour', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Retour/ }));
    expect(H.mockNavigate).toHaveBeenCalledWith('/automatisations');
  });
});