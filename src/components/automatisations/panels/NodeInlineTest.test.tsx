// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeInlineTest } from './NodeInlineTest';

const {
  stableUser,
  mockToastError,
  mockToastSuccess,
  mockMutateAsync,
} = vi.hoisted(() => ({
  stableUser: {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  FlaskConical: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-flask" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-success" {...props} />,
  XCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-error" {...props} />,
}));

vi.mock('@/hooks/workflows/useWorkflowDryRun', () => ({
  useWorkflowDryRun: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
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

describe('NodeInlineTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le contenu de base et permet de lancer un test', () => {
    render(
      <NodeInlineTest
        workflowId="wf-1"
        nodeId="node-1"
        nodeType="http"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Test rapide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tester ce nœud/i })).toBeInTheDocument();
    expect(
      screen.getByText('Exécute un dry-run complet et affiche le résultat de ce nœud.')
    ).toBeInTheDocument();
  });

  it('affiche un résultat de succès avec le statut et la sortie du nœud ciblé', async () => {
    mockMutateAsync.mockResolvedValue({
      steps_log: [
        { node_id: 'other-node', status: 'success', output: { ignored: true } },
        { node_id: 'node-1', status: 'success', output: { count: 3, message: 'ok' }, error: null },
      ],
    });

    const user = userEvent.setup();

    render(
      <NodeInlineTest
        workflowId="wf-1"
        nodeId="node-1"
        nodeType="http"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: /tester ce nœud/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        workflow_id: 'wf-1',
        trigger_payload: { manual: true },
      });
    });

    expect(await screen.findByText('success')).toBeInTheDocument();
    expect(screen.getByTestId('icon-success')).toBeInTheDocument();
    expect(screen.getByText(/"count": 3/)).toBeInTheDocument();
    expect(screen.getByText(/"message": "ok"/)).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('utilise le triggerPayload fourni au lieu du payload manuel par défaut', async () => {
    mockMutateAsync.mockResolvedValue({
      steps_log: [
        { node_id: 'node-42', status: 'simulated', output: { source: 'custom' }, error: null },
      ],
    });

    const user = userEvent.setup();
    const triggerPayload = { event: 'created', id: 9 };

    render(
      <NodeInlineTest
        workflowId="wf-9"
        nodeId="node-42"
        nodeType="trigger"
        triggerPayload={triggerPayload}
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: /tester ce nœud/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        workflow_id: 'wf-9',
        trigger_payload: triggerPayload,
      });
    });

    expect(await screen.findByText('simulated')).toBeInTheDocument();
    expect(screen.getByTestId('icon-success')).toBeInTheDocument();
    expect(screen.getByText(/"source": "custom"/)).toBeInTheDocument();
  });

  it("affiche un état skipped et le message dédié si le nœud n'a pas été atteint", async () => {
    mockMutateAsync.mockResolvedValue({
      steps_log: [
        { node_id: 'another-node', status: 'success', output: { value: 1 }, error: null },
      ],
    });

    const user = userEvent.setup();

    render(
      <NodeInlineTest
        workflowId="wf-2"
        nodeId="missing-node"
        nodeType="code"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: /tester ce nœud/i }));

    expect(await screen.findByText('skipped')).toBeInTheDocument();
    expect(screen.getByTestId('icon-error')).toBeInTheDocument();
    expect(
      screen.getByText("Ce nœud n'a pas été atteint durant le test.")
    ).toBeInTheDocument();
  });

  it("affiche un statut d'échec et le message d'erreur du step quand le dry-run retourne une erreur métier", async () => {
    mockMutateAsync.mockResolvedValue({
      steps_log: [
        {
          node_id: 'node-fail',
          status: 'failed',
          output: null,
          error: 'Le service distant a refusé la requête',
        },
      ],
    });

    const user = userEvent.setup();

    render(
      <NodeInlineTest
        workflowId="wf-3"
        nodeId="node-fail"
        nodeType="api"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: /tester ce nœud/i }));

    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(screen.getByTestId('icon-error')).toBeInTheDocument();
    expect(screen.getByText('Le service distant a refusé la requête')).toBeInTheDocument();
  });

  it("déclenche un toast d'erreur si mutateAsync rejette", async () => {
    mockMutateAsync.mockRejectedValue(new Error('dry-run indisponible'));

    const user = userEvent.setup();

    render(
      <NodeInlineTest
        workflowId="wf-4"
        nodeId="node-err"
        nodeType="task"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: /tester ce nœud/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Test échoué : dry-run indisponible');
    });

    expect(screen.queryByText('success')).not.toBeInTheDocument();
    expect(screen.queryByText('failed')).not.toBeInTheDocument();
    expect(screen.queryByText('skipped')).not.toBeInTheDocument();
  });
});