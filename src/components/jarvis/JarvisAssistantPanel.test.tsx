const { mockToast, mockUseJarvis, mockUseJarvisStreaming, mockStreamChat, mockResetStream, mockInvokeEdge, mockFrom, makeBuilder } = vi.hoisted(() => {
  const mockToast = vi.fn();
  const mockStreamChat = vi.fn(async () => 'réponse assistant');
  const mockResetStream = vi.fn();
  const mockInvokeEdge = vi.fn(async () => ({ data: null, error: null }));

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete', 'upsert', 'neq', 'is', 'range'];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    builder.catch = () => Promise.resolve({ data: [], error: null });
    return builder;
  };
  const mockFrom = vi.fn(() => makeBuilder());

  const jarvisReturn = {
    isEnabled: true,
    pendingActions: [],
    pendingCount: 0,
    approveAction: vi.fn(),
    modifyAction: vi.fn(),
    rejectAction: vi.fn(),
    messages: [],
    setMessages: vi.fn(),
    isTyping: false,
    chat: vi.fn(),
    getPageContextForInjection: vi.fn(() => null),
    clearChat: vi.fn(),
    confirmToolCall: vi.fn(),
    rejectToolCall: vi.fn(),
    isConfirming: false,
  };

  const streamingReturn = {
    isStreaming: false,
    currentContent: '',
    activeTools: [],
    streamChat: mockStreamChat,
    resetStream: mockResetStream,
  };

  const mockUseJarvis = vi.fn(() => jarvisReturn);
  const mockUseJarvisStreaming = vi.fn(() => streamingReturn);

  return { mockToast, mockUseJarvis, mockUseJarvisStreaming, mockStreamChat, mockResetStream, mockInvokeEdge, mockFrom, makeBuilder };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: mockUseJarvis,
}));

vi.mock('@/hooks/jarvis/useJarvisStreaming', () => ({
  useJarvisStreaming: mockUseJarvisStreaming,
}));

vi.mock('@/hooks/profile/useProfiles', () => {
  const PROFILE = { id: 'p1', first_name: 'Tony', last_name: 'Stark' };
  return {
    useCurrentProfile: vi.fn(() => ({ data: PROFILE, isLoading: false })),
  };
});

vi.mock('@/hooks/jarvis/useJarvisFocus', () => ({
  useJarvisFocus: vi.fn(() => ({ hasFocus: false })),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('@/hooks/jarvis/useJarvisConversationPersistence', () => {
  const persistenceReturn = {
    saveMessages: vi.fn(async () => undefined),
    loadConversation: vi.fn(async () => []),
    conversations: [],
    currentConversationId: null,
    createConversation: vi.fn(async () => 'conv-1'),
  };
  return {
    useJarvisConversationPersistence: vi.fn(() => persistenceReturn),
  };
});

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: vi.fn(() => null),
}));

vi.mock('@/hooks/jarvis/useJarvisFeedback', () => ({
  useJarvisFeedback: vi.fn(() => ({ submitMessageFeedback: vi.fn() })),
}));

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimateLight: vi.fn(() => false),
}));

vi.mock('./JarvisAssistantPanelHeader', () => ({
  JarvisAssistantPanelHeader: () => <div data-testid="jarvis-header" />,
}));

vi.mock('./JarvisActionCard', () => ({
  JarvisActionCard: () => null,
  default: () => null,
}));

vi.mock('./JarvisVoiceInterface', () => ({
  JarvisVoiceInterface: () => null,
  default: () => null,
}));

vi.mock('./JarvisSettingsContent', () => ({
  JarvisSettingsContent: () => null,
  default: () => null,
}));

vi.mock('./JarvisHistorySheet', () => ({
  JarvisHistorySheet: () => null,
  default: () => null,
}));

vi.mock('./JarvisModifyDialog', () => ({
  JarvisModifyDialog: () => null,
  default: () => null,
}));

vi.mock('./JarvisTemplates', () => ({
  JarvisTemplates: () => null,
  default: () => null,
}));

vi.mock('./JarvisAnalyticsDashboard', () => ({
  JarvisAnalyticsDashboard: () => null,
  default: () => null,
}));

vi.mock('./JarvisFocusIndicator', () => ({
  JarvisFocusIndicator: () => null,
  default: () => null,
}));

vi.mock('./JarvisProactiveSuggestions', () => ({
  JarvisProactiveSuggestions: () => null,
  default: () => null,
}));

vi.mock('./JarvisEmailPreview', () => ({
  JarvisEmailPreview: () => null,
  default: () => null,
}));

vi.mock('./JarvisTeamPanel', () => ({
  JarvisTeamPanel: () => null,
  default: () => null,
}));

vi.mock('./JarvisEnhancedInput', () => ({
  JarvisEnhancedInput: () => <div data-testid="jarvis-input" />,
  default: () => null,
}));

vi.mock('./JarvisSkeletonLoader', () => ({
  JarvisTypingIndicator: () => null,
  default: () => null,
}));

vi.mock('./JarvisWelcomeScreen', () => ({
  JarvisWelcomeScreen: () => <div data-testid="jarvis-welcome" />,
  default: () => null,
}));

vi.mock('./JarvisMessageBubble', () => ({
  JarvisMessageBubble: () => <div data-testid="jarvis-message-bubble" />,
  default: () => null,
}));

vi.mock('./JarvisStreamingMessage', () => ({
  JarvisStreamingMessage: () => null,
  default: () => null,
}));

vi.mock('./JarvisTransitions', () => ({
  StaggerList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: 'jarvis-logo.png',
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop: string) => {
      const Component = ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => {
        const { initial, animate, exit, transition, variants, whileHover, whileTap, layout, ...domProps } = rest;
        return React.createElement(prop === 'span' ? 'span' : 'div', domProps, children);
      };
      return Component;
    },
  }),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { JarvisAssistantPanel } from './JarvisAssistantPanel';

function renderPanel(props: { onClose?: () => void; className?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <JarvisAssistantPanel {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('JarvisAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend le panel avec le header mocké sans crash', () => {
    renderPanel();
    expect(screen.getByTestId('jarvis-header')).toBeInTheDocument();
  });

  it('appelle les hooks principaux (useJarvis, useJarvisStreaming) au montage', () => {
    renderPanel();
    expect(mockUseJarvis).toHaveBeenCalled();
    expect(mockUseJarvisStreaming).toHaveBeenCalled();
  });

  it('affiche le WelcomeScreen quand il n\'y a aucun message', () => {
    renderPanel();
    expect(screen.getByTestId('jarvis-welcome')).toBeInTheDocument();
  });

  it('applique la className passée en prop sur le conteneur racine', () => {
    const { container } = renderPanel({ className: 'ma-classe-test' });
    const root = container.querySelector('.ma-classe-test');
    expect(root).not.toBeNull();
    expect(root?.className).toContain('flex-col');
  });

  it('affiche les bulles de message quand des messages existent', () => {
    const base = mockUseJarvis();
    mockUseJarvis.mockReturnValueOnce({
      ...base,
      messages: [
        { id: 'm1', role: 'user', content: 'Bonjour', timestamp: new Date() },
        { id: 'm2', role: 'assistant', content: 'Salut, comment puis-je aider ?', timestamp: new Date() },
      ],
    });
    renderPanel();
    expect(screen.queryByTestId('jarvis-welcome')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('jarvis-message-bubble').length).toBeGreaterThanOrEqual(2);
  });
});