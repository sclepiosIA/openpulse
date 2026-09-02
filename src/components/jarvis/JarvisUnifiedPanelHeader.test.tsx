/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisUnifiedPanelHeader } from './JarvisUnifiedPanelHeader';

const {
  mockButton,
  mockBadge,
  mockTooltip,
  mockTooltipContent,
  mockTooltipTrigger,
  mockJarvisAgentAvatar,
  mockJarvisAgentRow,
  AGENT_METADATA_STABLE,
  jarvisLogoMock,
} = vi.hoisted(() => ({
  mockButton: vi.fn(),
  mockBadge: vi.fn(),
  mockTooltip: vi.fn(),
  mockTooltipContent: vi.fn(),
  mockTooltipTrigger: vi.fn(),
  mockJarvisAgentAvatar: vi.fn(),
  mockJarvisAgentRow: vi.fn(),
  AGENT_METADATA_STABLE: {
    alpha: { color: '#ff0066', name: 'Alpha', domain: 'Strategy' },
    beta: { color: '#00aaff', name: 'Beta', domain: 'Analysis' },
  } as const,
  jarvisLogoMock: '/jarvis-logo-test.png',
}));

vi.mock('framer-motion', () => {
  const ReactModule = React;
  const create = (tag: keyof JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) =>
      ReactModule.createElement(tag, { ...props, ref }, children),
    );

  return {
    motion: {
      div: create('div'),
      button: create('button'),
    },
  };
});

vi.mock('lucide-react', () => {
  const ReactModule = React;
  const makeIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) =>
      ReactModule.createElement('svg', { 'data-testid': name, className });
    Icon.displayName = name;
    return Icon;
  };

  return {
    Sparkles: makeIcon('sparkles-icon'),
    ArrowLeftRight: makeIcon('arrow-left-right-icon'),
    History: makeIcon('history-icon'),
    X: makeIcon('x-icon'),
    Zap: makeIcon('zap-icon'),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
  }) => {
    mockButton({ ariaLabel, ariaPressed, className });
    return (
      <button type="button" onClick={onClick} className={className} aria-label={ariaLabel} aria-pressed={ariaPressed} {...rest}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    mockBadge({ className, text: typeof children === 'string' ? children : null });
    return <div data-testid="badge" className={className}>{children}</div>;
  },
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => {
    mockTooltip();
    return <div>{children}</div>;
  },
  TooltipContent: ({ children }: { children?: React.ReactNode; side?: string }) => {
    mockTooltipContent();
    return <div>{children}</div>;
  },
  TooltipTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => {
    mockTooltipTrigger();
    return <>{children}</>;
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('./JarvisAgentAvatar', () => ({
  JarvisAgentAvatar: ({
    agentId,
    status,
  }: {
    agentId: string;
    size: string;
    status: string;
  }) => {
    mockJarvisAgentAvatar({ agentId, status });
    return <div data-testid="agent-avatar">{agentId}:{status}</div>;
  },
  JarvisAgentRow: ({
    activeAgents,
    selectedAgent,
    onSelectAgent,
    enabledAgents,
  }: {
    activeAgents: string[];
    selectedAgent?: string;
    onSelectAgent: (id: string) => void;
    size: string;
    showNames: boolean;
    enabledAgents?: string[];
  }) => {
    mockJarvisAgentRow({ activeAgents, selectedAgent, enabledAgents });
    return (
      <div data-testid="agent-row">
        <button type="button" aria-label="select-alpha" onClick={() => onSelectAgent('alpha')}>select-alpha</button>
        <span>{activeAgents.join(',')}</span>
      </div>
    );
  },
}));

vi.mock('@/hooks/jarvis/useJarvisTeam', () => ({
  AGENT_METADATA: AGENT_METADATA_STABLE,
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: jarvisLogoMock,
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

describe('JarvisUnifiedPanelHeader', () => {
  const tabs = [
    {
      id: 'chat',
      label: 'Chat',
      icon: ({ className }: { className?: string }) => <svg data-testid="tab-icon-chat" className={className} />,
    },
    {
      id: 'team',
      label: 'Équipe',
      icon: ({ className }: { className?: string }) => <svg data-testid="tab-icon-team" className={className} />,
    },
    {
      id: 'actions',
      label: 'Actions',
      icon: ({ className }: { className?: string }) => <svg data-testid="tab-icon-actions" className={className} />,
    },
  ] as const;

  function renderComponent(
    overrideProps: Partial<React.ComponentProps<typeof JarvisUnifiedPanelHeader>> = {},
  ) {
    const setSelectedAgent = vi.fn();
    const setUnifiedMode = vi.fn();
    const setActiveTab = vi.fn();
    const setShowHistory = vi.fn();
    const onClose = vi.fn();

    const props: React.ComponentProps<typeof JarvisUnifiedPanelHeader> = {
      displayAgent: null,
      selectedAgent: undefined,
      setSelectedAgent,
      isProcessing: false,
      isEnabled: true,
      isTeamMode: false,
      pendingCount: 0,
      setUnifiedMode,
      setActiveTab,
      activeTab: 'chat',
      setShowHistory,
      onClose,
      teamActiveAgents: ['alpha', 'beta'],
      enabledAgents: ['alpha', 'beta'],
      tabs,
      ...overrideProps,
    };

    const view = render(<JarvisUnifiedPanelHeader {...props} />, { wrapper: createWrapper() });
    return { ...view, props, setSelectedAgent, setUnifiedMode, setActiveTab, setShowHistory, onClose };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le header JARVIS en mode solo avec logo, statut activé et tabs filtrés', () => {
    renderComponent({
      displayAgent: null,
      isEnabled: true,
      isTeamMode: false,
      pendingCount: 2,
      activeTab: 'actions',
    });

    expect(screen.getByText('JARVIS')).toBeInTheDocument();
    expect(screen.getByText('GPT-5')).toBeInTheDocument();
    expect(screen.getByText('🤖 Assistant IA proactif')).toBeInTheDocument();
    expect(screen.getByAltText('Jarvis')).toHaveAttribute('src', jarvisLogoMock);

    // Tabs: 'team' caché en mode solo, 'chat' et 'actions' visibles
    expect(screen.queryByText('Équipe')).not.toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Badge d’actions global
    expect(screen.getByText('2 actions')).toBeInTheDocument();

    // Badge dans le tab Actions avec "2"
    const actionsButton = screen.getByRole('button', { name: /Actions/i });
    expect(actionsButton).toBeInTheDocument();
    const badgeInTab = within(actionsButton).getByTestId('badge');
    expect(badgeInTab).toHaveTextContent('2');

    expect(mockJarvisAgentAvatar).not.toHaveBeenCalled();
    expect(screen.queryByTestId('agent-row')).not.toBeInTheDocument();
  });

  it('affiche les informations agent et la rangée d’agents en mode équipe avec agent sélectionné', () => {
    renderComponent({
      displayAgent: {
        color: '#ff0066',
        gradientFrom: '#111111',
        gradientTo: '#222222',
        name: 'Alpha',
        domain: 'Strategy',
      },
      selectedAgent: 'alpha',
      isProcessing: true,
      isTeamMode: true,
      activeTab: 'team',
      pendingCount: 1,
    });

    // Titre et badges
    expect(screen.getByText('v6.0 Team')).toBeInTheDocument();
    // Domaine agent
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    // Avatar agent avec statut "thinking"
    expect(screen.getByTestId('agent-avatar')).toHaveTextContent('alpha:thinking');
    // Rangée d’agents visible
    expect(screen.getByTestId('agent-row')).toBeInTheDocument();

    // Le tab Chat est caché en mode équipe
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    // Tabs visibles
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Texte "Mode agent unique" et nom de l’agent (peut apparaître plusieurs fois)
    expect(screen.getByText('Mode agent unique:')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();

    expect(mockJarvisAgentRow).toHaveBeenCalledWith({
      activeAgents: ['alpha', 'beta'],
      selectedAgent: 'alpha',
      enabledAgents: ['alpha', 'beta'],
    });
  });

  it('bascule entre mode solo et équipe, ouvre l’historique, ferme le panneau et change d’onglet', () => {
    const { setUnifiedMode, setActiveTab, setShowHistory, onClose } = renderComponent({
      isTeamMode: true,
      activeTab: 'actions',
      pendingCount: 3,
    });

    // Toggle vers Solo
    fireEvent.click(screen.getByRole('button', { name: 'Passer en mode Solo' }));
    expect(setUnifiedMode).toHaveBeenCalledWith('solo');
    expect(setActiveTab).toHaveBeenCalledWith('chat');

    // Historique
    fireEvent.click(screen.getByRole('button', { name: 'Historique des conversations' }));
    expect(setShowHistory).toHaveBeenCalledWith(true);

    // Fermer
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Changer d’onglet vers Actions
    fireEvent.click(screen.getByRole('button', { name: /Actions/i }));
    expect(setActiveTab).toHaveBeenCalledWith('actions');
  });

  it('sélectionne puis annule un agent unique depuis la rangée équipe', () => {
    const { setSelectedAgent } = renderComponent({
      isTeamMode: true,
      selectedAgent: 'alpha',
      displayAgent: {
        color: '#ff0066',
        gradientFrom: '#111111',
        gradientTo: '#222222',
        name: 'Alpha',
        domain: 'Strategy',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'select-alpha' }));
    expect(setSelectedAgent).toHaveBeenCalledTimes(1);
    const updater = setSelectedAgent.mock.calls[0][0] as (prev: string | undefined) => string | undefined;
    expect(updater('alpha')).toBeUndefined();
    expect(updater(undefined)).toBe('alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(setSelectedAgent).toHaveBeenCalledWith(undefined);
  });

  it('n’affiche pas le bouton fermer quand onClose est absent', () => {
    renderComponent({ onClose: undefined });
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
  });

  it('toggle depuis le mode solo vers le mode équipe met l’onglet Team actif', () => {
    const { setUnifiedMode, setActiveTab } = renderComponent({
      isTeamMode: false,
      activeTab: 'chat',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Passer en mode Équipe' }));
    expect(setUnifiedMode).toHaveBeenCalledWith('team');
    expect(setActiveTab).toHaveBeenCalledWith('team');
  });
});