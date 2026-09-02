// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualWorkflowTrigger } from './ManualWorkflowTrigger';

const {
  WORKFLOWS_LOADING,
  WORKFLOWS_SUCCESS,
  WORKFLOWS_EMPTY,
  mutateSpy,
  useWorkflowsMock,
  useTriggerWorkflowManualMock,
} = vi.hoisted(() => ({
  WORKFLOWS_LOADING: [
    { id: 'wf-loading', nom: 'Chargement', trigger_type: 'manual', is_active: true, is_template: false },
  ],
  WORKFLOWS_SUCCESS: [
    { id: 'wf-1', nom: 'Workflow manuel actif', trigger_type: 'manual', is_active: true, is_template: false },
    { id: 'wf-2', nom: 'Workflow auto', trigger_type: 'auto', is_active: true, is_template: false },
    { id: 'wf-3', nom: 'Workflow inactif', trigger_type: 'manual', is_active: false, is_template: false },
    { id: 'wf-4', nom: 'Workflow template', trigger_type: 'manual', is_active: true, is_template: true },
    { id: 'wf-5', nom: 'Deuxième workflow manuel', trigger_type: 'manual', is_active: true, is_template: false },
  ],
  WORKFLOWS_EMPTY: [
    { id: 'wf-x', nom: 'Auto uniquement', trigger_type: 'auto', is_active: true, is_template: false },
    { id: 'wf-y', nom: 'Manual template', trigger_type: 'manual', is_active: true, is_template: true },
  ],
  mutateSpy: vi.fn(),
  useWorkflowsMock: vi.fn(),
  useTriggerWorkflowManualMock: vi.fn(),
}));

vi.mock('@/hooks/workflows/useWorkflows', () => ({
  useWorkflows: useWorkflowsMock,
  useTriggerWorkflowManual: useTriggerWorkflowManualMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => {
  type DropdownCtx = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  };

  const DropdownContext = React.createContext<DropdownCtx>({ open: false });

  function DropdownMenu({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) {
    return (
      <DropdownContext.Provider value={{ open: Boolean(open), onOpenChange }}>
        <div data-testid="dropdown-root">{children}</div>
      </DropdownContext.Provider>
    );
  }

  function DropdownMenuTrigger({
    children,
  }: {
    asChild?: boolean;
    children?: React.ReactElement;
  }) {
    const ctx = React.useContext(DropdownContext);
    if (!React.isValidElement(children)) return null;
    return React.cloneElement(children, {
      onClick: () => ctx.onOpenChange?.(!ctx.open),
    });
  }

  function DropdownMenuContent({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) {
    const ctx = React.useContext(DropdownContext);
    if (!ctx.open) return null;
    return <div {...props}>{children}</div>;
  }

  function DropdownMenuItem({
    children,
    onSelect,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    children?: React.ReactNode;
    onSelect?: () => void;
  }) {
    return (
      <div
        role="menuitem"
        tabIndex={0}
        onClick={() => onSelect?.()}
        {...props}
      >
        {children}
      </div>
    );
  }

  function DropdownMenuLabel({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) {
    return <div {...props}>{children}</div>;
  }

  function DropdownMenuSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
    return <div data-testid="dropdown-separator" {...props} />;
  }

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
  };
});

vi.mock('lucide-react', () => ({
  Zap: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="zap-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
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

describe('ManualWorkflowTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un bouton désactivé avec indicateur de chargement pendant isLoading', () => {
    useWorkflowsMock.mockReturnValue({
      data: WORKFLOWS_LOADING,
      isLoading: true,
    });
    useTriggerWorkflowManualMock.mockReturnValue({
      isPending: false,
      mutate: mutateSpy,
    });

    render(<ManualWorkflowTrigger label="Déclencher" />, { wrapper: createWrapper() });

    const button = screen.getByRole('button', { name: 'Déclencher' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.queryByText('Lancer un workflow')).not.toBeInTheDocument();
  });

  it('n’affiche rien quand aucun workflow manuel actif non-template n’est disponible', () => {
    useWorkflowsMock.mockReturnValue({
      data: WORKFLOWS_EMPTY,
      isLoading: false,
    });
    useTriggerWorkflowManualMock.mockReturnValue({
      isPending: false,
      mutate: mutateSpy,
    });

    const { container } = render(<ManualWorkflowTrigger />, { wrapper: createWrapper() });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Workflows' })).not.toBeInTheDocument();
  });

  it('affiche uniquement les workflows manuels actifs, puis déclenche la mutation avec le payload enrichi', async () => {
    useWorkflowsMock.mockReturnValue({
      data: WORKFLOWS_SUCCESS,
      isLoading: false,
    });
    useTriggerWorkflowManualMock.mockReturnValue({
      isPending: false,
      mutate: mutateSpy,
    });

    render(
      <ManualWorkflowTrigger
        label="Workflows"
        payload={{ etablissement_id: 'eta-1', statut_new: 'validé' }}
      />,
      { wrapper: createWrapper() }
    );

    const button = screen.getByRole('button', { name: 'Workflows' });
    expect(button).not.toBeDisabled();
    expect(screen.getByTestId('zap-icon')).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText('Lancer un workflow')).toBeInTheDocument();
    expect(screen.getByText('Workflow manuel actif')).toBeInTheDocument();
    expect(screen.getByText('Deuxième workflow manuel')).toBeInTheDocument();
    expect(screen.queryByText('Workflow auto')).not.toBeInTheDocument();
    expect(screen.queryByText('Workflow inactif')).not.toBeInTheDocument();
    expect(screen.queryByText('Workflow template')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Workflow manuel actif'));

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledTimes(1);
    });

    const firstCall = mutateSpy.mock.calls[0]?.[0] as {
      workflow_id: string;
      payload: Record<string, unknown>;
    };

    expect(firstCall.workflow_id).toBe('wf-1');
    expect(firstCall.payload.etablissement_id).toBe('eta-1');
    expect(firstCall.payload.statut_new).toBe('validé');
    expect(firstCall.payload.manual).toBe(true);
    expect(typeof firstCall.payload.started_at).toBe('string');
    expect(() => new Date(String(firstCall.payload.started_at)).toISOString()).not.toThrow();

    await waitFor(() => {
      expect(screen.queryByText('Lancer un workflow')).not.toBeInTheDocument();
    });
  });

  it('désactive le bouton et affiche le loader quand la mutation est en cours', () => {
    useWorkflowsMock.mockReturnValue({
      data: WORKFLOWS_SUCCESS,
      isLoading: false,
    });
    useTriggerWorkflowManualMock.mockReturnValue({
      isPending: true,
      mutate: mutateSpy,
    });

    render(<ManualWorkflowTrigger label="Lancer" />, { wrapper: createWrapper() });

    const button = screen.getByRole('button', { name: 'Lancer' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('zap-icon')).not.toBeInTheDocument();
  });
});