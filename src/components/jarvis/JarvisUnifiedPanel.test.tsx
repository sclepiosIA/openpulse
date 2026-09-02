import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { JarvisUnifiedPanel } from './JarvisUnifiedPanel';

const {
  MOCK_PROFILE,
  MOCK_USE_JARVIS_RETURN,
  MOCK_USE_JARVIS_TEAM_RETURN,
  MOCK_USE_JARVIS_GESTURES_RETURN,
  MOCK_USE_JARVIS_FOCUS_RETURN,
  mockUseCurrentProfile,
  mockUseJarvis,
  mockUseJarvisTeam,
  mockUseJarvisGestures,
  mockUseJarvisFocus,
  mockOnClose,
  ROWS,
  mockFrom,
} = vi.hoisted(() => {
  const mockOnCloseFn = vi.fn();

  const mockProfile = {
    id: 'profile-1',
    prenom: 'Alex',
  };

  const mockUseJarvisReturn = {
    isEnabled: true,
    pendingActions: [],
    pendingCount: 0,
    approveAction: vi.fn(),
    modifyAction: vi.fn(),
    rejectAction: vi.fn(),
    messages: [],
    isTyping: false,
    chat: vi.fn(),
    clearChat: vi.fn(),
    confirmToolCall: vi.fn(),
    rejectToolCall: vi.fn(),
    isConfirming: false,
  };

  const mockUseJarvisTeamReturn = {
    teamState: {
      conversationHistory: [],
      activeAgents: [],
    },
    isProcessing: false,
    enabledAgents: [],
    sendToTeam: vi.fn(),
    sendToAgent: vi.fn(),
    requestStandup: vi.fn(),
    clearConversation: vi.fn(),
    getAgentMeta: vi.fn(),
  };

  const mockUseJarvisGesturesReturn = {
    activeGesture: null,
    swipeDistance: 0,
    longPressProgress: 0,
  };

  const mockUseJarvisFocusReturn = {
    hasFocus: false,
  };

  const mockUseCurrentProfileImpl = vi.fn(() => ({
    data: mockProfile,
  }));

  const mockUseJarvisImpl = vi.fn(() => mockUseJarvisReturn);
  const mockUseJarvisTeamImpl = vi.fn(() => mockUseJarvisTeamReturn);
  const mockUseJarvisGesturesImpl = vi.fn(() => mockUseJarvisGesturesReturn);
  const mockUseJarvisFocusImpl = vi.fn(() => mockUseJarvisFocusReturn);

  const builder: any = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.insert = chain;
  builder.update = chain;
  builder.delete = chain;
  builder.single = async () => ({ data: null, error: null });
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  builder.catch = (onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected);
  const fromFn = vi.fn(() => builder);

  return {
    MOCK_PROFILE: mockProfile,
    MOCK_USE_JARVIS_RETURN: mockUseJarvisReturn,
    MOCK_USE_JARVIS_TEAM_RETURN: mockUseJarvisTeamReturn,
    MOCK_USE_JARVIS_GESTURES_RETURN: mockUseJarvisGesturesReturn,
    MOCK_USE_JARVIS_FOCUS_RETURN: mockUseJarvisFocusReturn,
    mockUseCurrentProfile: mockUseCurrentProfileImpl,
    mockUseJarvis: mockUseJarvisImpl,
    mockUseJarvisTeam: mockUseJarvisTeamImpl,
    mockUseJarvisGestures: mockUseJarvisGesturesImpl,
    mockUseJarvisFocus: mockUseJarvisFocusImpl,
    mockOnClose: mockOnCloseFn,
    ROWS: [],
    mockFrom: fromFn,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => <div ref={ref} {...props} />
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => {
  const FakeComp = (props: any) => <div {...props} />;
  return {
    motion: new Proxy(FakeComp, {
      get: () => FakeComp,
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Bot: Icon,
    Users: Icon,
    Settings: Icon,
    Send: Icon,
    Loader2: Icon,
    Coffee: Icon,
    Trash2: Icon,
    ExternalLink: Icon,
  };
});

vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: () => MOCK_USE_JARVIS_RETURN,
}));

vi.mock('@/hooks/jarvis/useJarvisTeam', () => ({
  useJarvisTeam: () => MOCK_USE_JARVIS_TEAM_RETURN,
  AGENT_METADATA: {},
}));

vi.mock('@/hooks/jarvis/useJarvisGestures', () => ({
  useJarvisGestures: () => MOCK_USE_JARVIS_GESTURES_RETURN,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => mockUseCurrentProfile(),
}));

vi.mock('@/hooks/jarvis/useJarvisFocus', () => ({
  useJarvisFocus: () => MOCK_USE_JARVIS_FOCUS_RETURN,
}));

vi.mock('./JarvisActionsTab', () => ({
  JarvisActionsTab: () => <div data-testid="jarvis-actions-tab" />,
}));

vi.mock('./JarvisVoiceInterface', () => ({
  JarvisVoiceInterface: () => <div data-testid="jarvis-voice-interface" />,
}));

vi.mock('./JarvisSettingsContent', () => ({
  JarvisSettingsContent: () => <div data-testid="jarvis-settings-content" />,
}));

vi.mock('./JarvisHistorySheet', () => ({
  JarvisHistorySheet: () => <div data-testid="jarvis-history-sheet" />,
}));

vi.mock('./JarvisModifyDialog', () => ({
  JarvisModifyDialog: () => <div data-testid="jarvis-modify-dialog" />,
}));

vi.mock('./JarvisTemplates', () => ({
  JarvisTemplates: () => <div data-testid="jarvis-templates" />,
}));

vi.mock('./JarvisAnalyticsDashboard', () => ({
  JarvisAnalyticsDashboard: () => <div data-testid="jarvis-analytics-dashboard" />,
}));

vi.mock('./JarvisFocusIndicator', () => ({
  JarvisFocusIndicator: (props: { compact?: boolean }) => (
    <div data-testid="jarvis-focus-indicator">{props.compact ? 'compact' : 'full'}</div>
  ),
}));

vi.mock('./JarvisThinkingIndicator', () => ({
  JarvisThinkingIndicator: () => <div data-testid="jarvis-thinking-indicator" />,
}));

vi.mock('./JarvisAgentAvatar', () => ({
  JarvisAgentAvatar: () => <div data-testid="jarvis-agent-avatar" />,
}));

vi.mock('./JarvisWorkflowPanel', () => ({
  JarvisWorkflowPanel: () => <div data-testid="jarvis-workflow-panel" />,
}));

vi.mock('./JarvisPredictionsPanel', () => ({
  JarvisPredictionsPanel: () => <div data-testid="jarvis-predictions-panel" />,
}));

vi.mock('./JarvisPerformanceWidget', () => ({
  JarvisPerformanceWidget: () => <div data-testid="jarvis-performance-widget" />,
}));

vi.mock('./JarvisSmartBriefing', () => ({
  JarvisSmartBriefing: () => <div data-testid="jarvis-smart-briefing" />,
}));

vi.mock('./JarvisProductivityScore', () => ({
  JarvisProductivityScore: () => <div data-testid="jarvis-productivity-score" />,
}));

vi.mock('./JarvisCollectiveInsights', () => ({
  JarvisCollectiveInsights: () => <div data-testid="jarvis-collective-insights" />,
}));

vi.mock('./JarvisChallenges', () => ({
  JarvisChallenges: () => <div data-testid="jarvis-challenges" />,
}));

vi.mock('./JarvisUnifiedPanel.constants', () => ({
  TABS: [
    { id: 'chat', label: 'Chat' },
    { id: 'team', label: 'Équipe' },
  ],
}));

vi.mock('./JarvisUnifiedPanel.renderers', () => ({
  ToolCallCard: () => <div data-testid="tool-call-card" />,
  TeamMessage: () => <div data-testid="team-message" />,
}));

vi.mock('./JarvisUnifiedPanelHeader', () => ({
  JarvisUnifiedPanelHeader: (props: any) => (
    <header>
      <div data-testid="jarvis-unified-header">Header</div>
      <button type="button" onClick={() => props.onClose?.()} aria-label="close-panel">
        close
      </button>
      <button
        type="button"
        onClick={() => props.setActiveTab('chat')}
        aria-label="switch-chat"
      >
        chat-tab
      </button>
      <button
        type="button"
        onClick={() => props.setActiveTab('team')}
        aria-label="switch-team"
      >
        team-tab
      </button>
    </header>
  ),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

function renderWithProviders(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('JarvisUnifiedPanel', () => {
  it('affiche le message de bienvenue avec le prénom du profil en mode solo par défaut', () => {
    renderWithProviders(<JarvisUnifiedPanel />);

    expect(
      screen.getByText(/Bonjour, Alex/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Je suis JARVIS 6.0, votre assistant IA omniscient/i)
    ).toBeInTheDocument();

    expect(screen.getByText('État du pipeline')).toBeInTheDocument();
    expect(screen.getByText('Résumer mes emails')).toBeInTheDocument();
    expect(screen.getByText('Tâches prioritaires')).toBeInTheDocument();
    expect(screen.getByText('Mode Équipe')).toBeInTheDocument();
  });

  it('appelle onClose quand le bouton de fermeture du header est cliqué', () => {
    renderWithProviders(<JarvisUnifiedPanel onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('close-panel');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('bascule sur l’onglet équipe lorsque Mode Équipe est cliqué depuis le message de bienvenue', () => {
    renderWithProviders(<JarvisUnifiedPanel />);

    fireEvent.click(screen.getByText('Mode Équipe'));

    const teamTabButton = screen.getByLabelText('switch-team');
    fireEvent.click(teamTabButton);

    expect(teamTabButton).toBeInTheDocument();
  });

  it('initialise l’onglet team quand defaultMode vaut team', () => {
    renderWithProviders(<JarvisUnifiedPanel defaultMode="team" />);

    const teamTabButton = screen.getByLabelText('switch-team');
    fireEvent.click(teamTabButton);

    expect(teamTabButton).toBeInTheDocument();
  });
});