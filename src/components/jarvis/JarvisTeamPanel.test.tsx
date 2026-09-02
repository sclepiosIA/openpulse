/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisTeamPanel } from './JarvisTeamPanel';

const {
  stableHookState,
  sendToTeamMock,
  sendToAgentMock,
  requestStandupMock,
  clearConversationMock,
  onOpenSettingsMock,
  AGENT_METADATA_STABLE,
} = vi.hoisted(() => ({
  stableHookState: {
    teamState: {
      conversationHistory: [] as Array<{
        id: string;
        agentId: string;
        content: string;
        timestamp: string;
      }>,
      activeAgents: ['sales'] as string[],
    },
    isProcessing: false,
    enabledAgents: ['sales', 'support', 'finance', 'ops', 'marketing', 'product'] as string[],
  },
  sendToTeamMock: vi.fn<(...args: [string]) => Promise<void>>().mockResolvedValue(undefined),
  sendToAgentMock: vi.fn<(...args: [string, string]) => Promise<void>>().mockResolvedValue(undefined),
  requestStandupMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  clearConversationMock: vi.fn(),
  onOpenSettingsMock: vi.fn(),
  AGENT_METADATA_STABLE: {
    sales: {
      name: 'Sales',
      displayName: 'Commercial',
      color: '#f00',
      domain: 'Ventes',
    },
    support: {
      name: 'Support',
      displayName: 'Support',
      color: '#0f0',
      domain: 'Assistance',
    },
    finance: {
      name: 'Finance',
      displayName: 'Finance',
      color: '#00f',
      domain: 'Finance',
    },
    ops: {
      name: 'Ops',
      displayName: 'Opérations',
      color: '#ff0',
      domain: 'Opérations',
    },
    marketing: {
      name: 'Marketing',
      displayName: 'Marketing',
      color: '#f0f',
      domain: 'Marketing',
    },
    product: {
      name: 'Product',
      displayName: 'Produit',
      color: '#0ff',
      domain: 'Produit',
    },
  } as Record<string, { name: string; displayName: string; color: string; domain: string }>,
}));

vi.mock('@/hooks/jarvis/useJarvisTeam', () => ({
  AGENT_METADATA: AGENT_METADATA_STABLE,
  useJarvisTeam: () => ({
    teamState: stableHookState.teamState,
    isProcessing: stableHookState.isProcessing,
    enabledAgents: stableHookState.enabledAgents,
    sendToTeam: sendToTeamMock,
    sendToAgent: sendToAgentMock,
    requestStandup: requestStandupMock,
    clearConversation: clearConversationMock,
    getAgentMeta: (agentId: string) => AGENT_METADATA_STABLE[agentId],
  }),
}));

vi.mock('./JarvisAgentAvatar', () => ({
  JarvisAgentAvatar: ({ agentId, status, size }: { agentId: string; status?: string; size?: string }) => (
    <div data-testid={`avatar-${agentId}-${status ?? 'idle'}-${size ?? 'md'}`}>{agentId}</div>
  ),
  JarvisAgentRow: ({
    selectedAgent,
    onSelectAgent,
    enabledAgents,
  }: {
    selectedAgent?: string;
    onSelectAgent: (id: string) => void;
    enabledAgents: string[];
  }) => (
    <div>
      <div data-testid="selected-agent">{selectedAgent ?? 'none'}</div>
      {enabledAgents.map((id) => (
        <button key={id} type="button" onClick={() => onSelectAgent(id)}>
          select-{id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    className,
    size,
    variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
    className?: string;
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={className} data-size={size} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function ScrollArea(props, ref) {
    return <div ref={ref} {...props} />;
  }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Users: Icon,
    Send: Icon,
    Loader2: Icon,
    Sparkles: Icon,
    Coffee: Icon,
    Trash2: Icon,
    Settings: Icon,
    MessageSquare: Icon,
  };
});

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

describe('JarvisTeamPanel', () => {
  beforeEach(() => {
    stableHookState.teamState = {
      conversationHistory: [],
      activeAgents: ['sales'],
    };
    stableHookState.isProcessing = false;
    stableHookState.enabledAgents = ['sales', 'support', 'finance', 'ops', 'marketing', 'product'];
    sendToTeamMock.mockReset();
    sendToTeamMock.mockResolvedValue(undefined);
    sendToAgentMock.mockReset();
    sendToAgentMock.mockResolvedValue(undefined);
    requestStandupMock.mockReset();
    requestStandupMock.mockResolvedValue(undefined);
    clearConversationMock.mockReset();
    onOpenSettingsMock.mockReset();
  });

  it('utilise un wrapper QueryClientProvider compatible renderHook', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 'ok', { wrapper });
    expect(result.current).toBe('ok');
  });

  it('affiche l’état de chargement métier avec agents actifs en réflexion', () => {
    stableHookState.isProcessing = true;
    stableHookState.teamState = {
      conversationHistory: [],
      activeAgents: ['sales', 'support'],
    };

    render(<JarvisTeamPanel onOpenSettings={onOpenSettingsMock} />, { wrapper: createWrapper() });

    expect(screen.getByText('Sales, Support en réflexion...')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-sales-thinking-sm')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-support-thinking-sm')).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Posez une question à l'équipe...")).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Briefing du jour' })).toBeDisabled();
  });

  it('affiche la conversation et les valeurs métier réelles au succès', () => {
    stableHookState.teamState = {
      conversationHistory: [
        {
          id: 'm1',
          agentId: 'prime',
          content: 'Synthèse équipe',
          timestamp: '2024-01-01T10:15:00.000Z',
        },
        {
          id: 'm2',
          agentId: 'sales',
          content: 'Pipeline stable',
          timestamp: '2024-01-01T10:16:00.000Z',
        },
        {
          id: 'm3',
          agentId: 'user',
          content: 'Quel est le statut ?',
          timestamp: '2024-01-01T10:17:00.000Z',
        },
      ],
      activeAgents: ['sales'],
    };

    render(<JarvisTeamPanel onOpenSettings={onOpenSettingsMock} className="panel-test" />, { wrapper: createWrapper() });

    expect(screen.getByText('JARVIS Team')).toBeInTheDocument();
    expect(screen.getByText('6 agents spécialisés à votre service')).toBeInTheDocument();
    expect(screen.getByText('JARVIS TEAM')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Ventes')).toBeInTheDocument();
    expect(screen.getByText('Synthèse équipe')).toBeInTheDocument();
    expect(screen.getByText('Pipeline stable')).toBeInTheDocument();
    expect(screen.getByText('Quel est le statut ?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(onOpenSettingsMock).toHaveBeenCalledTimes(1);
  });

  it('envoie un message à toute l’équipe puis à un agent sélectionné', async () => {
    render(<JarvisTeamPanel />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText("Posez une question à l'équipe...");
    fireEvent.change(input, { target: { value: 'Bonjour équipe' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Chargement' }));
    });

    expect(sendToTeamMock).toHaveBeenCalledWith('Bonjour équipe');

    fireEvent.click(screen.getByRole('button', { name: 'select-sales' }));
    expect(screen.getByText('Mode agent unique:')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();

    const agentInput = screen.getByPlaceholderText('Message pour Commercial...');
    fireEvent.change(agentInput, { target: { value: 'Bonjour commercial' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Chargement' }));
    });

    expect(sendToAgentMock).toHaveBeenCalledWith('sales', 'Bonjour commercial');
  });

  it('déclenche les actions rapides et efface la conversation', async () => {
    stableHookState.teamState = {
      conversationHistory: [
        {
          id: 'm1',
          agentId: 'sales',
          content: 'hello',
          timestamp: '2024-01-01T10:00:00.000Z',
        },
      ],
      activeAgents: ['sales'],
    };

    const { rerender } = render(<JarvisTeamPanel />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(clearConversationMock).toHaveBeenCalledTimes(1);

    stableHookState.teamState = {
      conversationHistory: [],
      activeAgents: ['sales'],
    };

    rerender(<JarvisTeamPanel />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Briefing du jour' }));
    });
    expect(requestStandupMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pipeline' }));
    });
    expect(sendToTeamMock).toHaveBeenCalledWith('État du pipeline commercial');
  });

  it('évite les rejets non gérés et reflète un état d’erreur du hook', async () => {
    const errorState = {
      data: null,
      error: { message: 'x' },
      isError: true,
      isLoading: false,
    };

    const { result } = renderHook(() => errorState, { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error.message).toBe('x');

    sendToTeamMock.mockImplementation(async () => {
      return undefined;
    });

    render(<JarvisTeamPanel />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText("Posez une question à l'équipe..."), {
      target: { value: 'Message erreur' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Chargement' }));
    });

    await waitFor(() => {
      expect(sendToTeamMock).toHaveBeenCalledWith('Message erreur');
    });
  });
});