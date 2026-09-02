/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisPremiumPanel } from './JarvisPremiumPanel';

const {
  AUTH_STATE,
  PROFILE_STATE,
  JARVIS_STATE,
  STREAMING_STATE,
  PERSISTENCE_STATE,
  UNIFIED_STATE,
  HEADER_PROPS,
  WELCOME_PROPS,
  SMART_INPUT_PROPS,
  PREMIUM_MESSAGES,
  EMAIL_PREVIEWS,
  THINKING_PROPS,
  STREAMING_MESSAGE_PROPS,
  HISTORY_PROPS,
  SETTINGS_PROPS,
  SKELETON_PROPS,
  mockCn,
  mockDebugLog,
  mockSubmitFeedback,
  mockSetMessages,
  mockClearChat,
  mockGetPageContextForInjection,
  mockConfirmToolCall,
  mockRejectToolCall,
  mockStreamChat,
  mockResetStream,
  mockCancelStream,
  mockSaveMessages,
  mockLoadConversation,
  mockCreateConversation,
  mockToast,
  mockRegisterChatHandler,
  mockClearPendingQuickCommand,
  mockMarkResponseReady,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  PROFILE_STATE: {
    data: { prenom: 'Alice', nom: 'Martin' },
  },
  JARVIS_STATE: {
    pendingCount: 2,
    messages: [] as Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
      toolCalls?: Array<{
        id: string;
        name: string;
        status: string;
        arguments?: { to: string; subject?: string; body: string; cc?: string[]; thread_id?: string };
      }>;
    }>,
    isTyping: false,
    chat: [],
    isConfirming: false,
  },
  STREAMING_STATE: {
    isStreaming: false,
    isDone: true,
    currentContent: '',
    activeTools: [] as Array<unknown>,
    reasoningSteps: [] as Array<unknown>,
  },
  PERSISTENCE_STATE: {
    conversations: [] as Array<{ id: string; title: string; updated_at: string }>,
    currentConversationId: null as string | null,
  },
  UNIFIED_STATE: {
    pendingQuickCommand: '',
  },
  HEADER_PROPS: [] as Array<Record<string, unknown>>,
  WELCOME_PROPS: [] as Array<Record<string, unknown>>,
  SMART_INPUT_PROPS: [] as Array<Record<string, unknown>>,
  PREMIUM_MESSAGES: [] as Array<Record<string, unknown>>,
  EMAIL_PREVIEWS: [] as Array<Record<string, unknown>>,
  THINKING_PROPS: [] as Array<Record<string, unknown>>,
  STREAMING_MESSAGE_PROPS: [] as Array<Record<string, unknown>>,
  HISTORY_PROPS: [] as Array<Record<string, unknown>>,
  SETTINGS_PROPS: [] as Array<Record<string, unknown>>,
  SKELETON_PROPS: [] as Array<Record<string, unknown>>,
  mockCn: vi.fn((...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' ')),
  mockDebugLog: vi.fn(),
  mockSubmitFeedback: vi.fn(async () => undefined),
  mockSetMessages: vi.fn(),
  mockClearChat: vi.fn(),
  mockGetPageContextForInjection: vi.fn(() => ({ page: 'dashboard' })),
  mockConfirmToolCall: vi.fn(async () => undefined),
  mockRejectToolCall: vi.fn(async () => undefined),
  mockStreamChat: vi.fn(async () => 'Réponse IA complète'),
  mockResetStream: vi.fn(),
  mockCancelStream: vi.fn(),
  mockSaveMessages: vi.fn(async () => undefined),
  mockLoadConversation: vi.fn(async () => []),
  mockCreateConversation: vi.fn(async () => 'conv-new'),
  mockToast: vi.fn(),
  mockRegisterChatHandler: vi.fn(),
  mockClearPendingQuickCommand: vi.fn(),
  mockMarkResponseReady: vi.fn(),
}));

vi.mock('framer-motion', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
  return {
    motion: { div: Div },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockDebugLog,
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => PROFILE_STATE,
}));

vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: () => ({
    pendingCount: JARVIS_STATE.pendingCount,
    messages: JARVIS_STATE.messages,
    setMessages: mockSetMessages,
    isTyping: JARVIS_STATE.isTyping,
    chat: JARVIS_STATE.chat,
    clearChat: mockClearChat,
    getPageContextForInjection: mockGetPageContextForInjection,
    confirmToolCall: mockConfirmToolCall,
    rejectToolCall: mockRejectToolCall,
    isConfirming: JARVIS_STATE.isConfirming,
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisStreaming', () => ({
  useJarvisStreaming: () => ({
    isStreaming: STREAMING_STATE.isStreaming,
    isDone: STREAMING_STATE.isDone,
    currentContent: STREAMING_STATE.currentContent,
    streamChat: mockStreamChat,
    resetStream: mockResetStream,
    activeTools: STREAMING_STATE.activeTools,
    cancelStream: mockCancelStream,
    reasoningSteps: STREAMING_STATE.reasoningSteps,
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisConversationPersistence', () => ({
  useJarvisConversationPersistence: () => ({
    saveMessages: mockSaveMessages,
    loadConversation: mockLoadConversation,
    conversations: PERSISTENCE_STATE.conversations,
    currentConversationId: PERSISTENCE_STATE.currentConversationId,
    createConversation: mockCreateConversation,
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisFeedback', () => ({
  useJarvisFeedback: () => ({
    submitMessageFeedback: mockSubmitFeedback,
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: () => ({
    pendingQuickCommand: UNIFIED_STATE.pendingQuickCommand,
    clearPendingQuickCommand: mockClearPendingQuickCommand,
    registerChatHandler: mockRegisterChatHandler,
    markResponseReady: mockMarkResponseReady,
  }),
}));

vi.mock('./JarvisGlassHeader', () => ({
  JarvisGlassHeader: (props: Record<string, unknown>) => {
    HEADER_PROPS.push(props);
    return (
      <div data-testid="jarvis-header">
        <span>header</span>
        <span>{String(props.connectionStatus)}</span>
        <span>{String(props.pendingCount)}</span>
      </div>
    );
  },
}));

vi.mock('./JarvisEnhancedWelcome', () => ({
  JarvisEnhancedWelcome: (props: Record<string, unknown>) => {
    WELCOME_PROPS.push(props);
    const recent = props.recentConversations as Array<{ title: string }> | undefined;
    return (
      <div data-testid="jarvis-welcome">
        <span>{String(props.userName)}</span>
        <span>{recent?.[0]?.title ?? 'no-recent'}</span>
      </div>
    );
  },
}));

vi.mock('./JarvisSmartInput', () => ({
  JarvisSmartInput: (props: Record<string, unknown>) => {
    SMART_INPUT_PROPS.push(props);
    return <div data-testid="jarvis-smart-input">smart-input</div>;
  },
}));

vi.mock('./JarvisPremiumMessage', () => ({
  JarvisPremiumMessage: (props: Record<string, unknown>) => {
    PREMIUM_MESSAGES.push(props);
    return (
      <div data-testid="jarvis-premium-message">
        <span>{String(props.role)}</span>
        <span>{String(props.content)}</span>
      </div>
    );
  },
}));

vi.mock('./JarvisIntelligentThinking', () => ({
  JarvisIntelligentThinking: (props: Record<string, unknown>) => {
    THINKING_PROPS.push(props);
    return <div data-testid="jarvis-thinking">thinking</div>;
  },
}));

vi.mock('./JarvisStreamingMessage', () => ({
  JarvisStreamingMessage: (props: Record<string, unknown>) => {
    STREAMING_MESSAGE_PROPS.push(props);
    return <div data-testid="jarvis-streaming-message">{String(props.content ?? '')}</div>;
  },
}));

vi.mock('./JarvisHistorySheet', () => ({
  JarvisHistorySheet: (props: Record<string, unknown>) => {
    HISTORY_PROPS.push(props);
    return <div data-testid="jarvis-history-sheet">history</div>;
  },
}));

vi.mock('./JarvisEmailPreview', () => ({
  JarvisEmailPreview: (props: Record<string, unknown>) => {
    EMAIL_PREVIEWS.push(props);
    const emailData = props.emailData as { to: string; subject?: string; body: string };
    return (
      <div data-testid="jarvis-email-preview">
        <span>{emailData.to}</span>
        <span>{emailData.subject ?? 'no-subject'}</span>
      </div>
    );
  },
}));

vi.mock('./JarvisSettingsSheet', () => ({
  JarvisSettingsSheet: (props: Record<string, unknown>) => {
    SETTINGS_PROPS.push(props);
    return <div data-testid="jarvis-settings-sheet">settings</div>;
  },
}));

vi.mock('./JarvisSkeletonLoader', () => ({
  JarvisSkeletonLoader: (props: Record<string, unknown>) => {
    SKELETON_PROPS.push(props);
    return <div data-testid="jarvis-skeleton-loader">{String(props.variant)}</div>;
  },
}));

vi.mock('./JarvisDesignSystem', () => ({
  JARVIS_ANIMATIONS: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
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

function renderPanel(props: Partial<React.ComponentProps<typeof JarvisPremiumPanel>> = {}) {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <JarvisPremiumPanel {...props} />
    </QueryClientProvider>
  );
}

describe('JarvisPremiumPanel', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    cleanup();

    HEADER_PROPS.length = 0;
    WELCOME_PROPS.length = 0;
    SMART_INPUT_PROPS.length = 0;
    PREMIUM_MESSAGES.length = 0;
    EMAIL_PREVIEWS.length = 0;
    THINKING_PROPS.length = 0;
    STREAMING_MESSAGE_PROPS.length = 0;
    HISTORY_PROPS.length = 0;
    SETTINGS_PROPS.length = 0;
    SKELETON_PROPS.length = 0;

    AUTH_STATE.user = { id: 'u1', email: 'user@test.local' };
    AUTH_STATE.session = { user: { id: 'u1' } };
    AUTH_STATE.isLoading = false;

    PROFILE_STATE.data = { prenom: 'Alice', nom: 'Martin' };

    JARVIS_STATE.pendingCount = 2;
    JARVIS_STATE.messages = [];
    JARVIS_STATE.isTyping = false;
    JARVIS_STATE.chat = [];
    JARVIS_STATE.isConfirming = false;

    STREAMING_STATE.isStreaming = false;
    STREAMING_STATE.isDone = true;
    STREAMING_STATE.currentContent = '';
    STREAMING_STATE.activeTools = [];
    STREAMING_STATE.reasoningSteps = [];

    PERSISTENCE_STATE.conversations = [];
    PERSISTENCE_STATE.currentConversationId = null;

    UNIFIED_STATE.pendingQuickCommand = '';

    mockCn.mockClear();
    mockDebugLog.mockClear();
    mockSubmitFeedback.mockClear();
    mockSetMessages.mockClear();
    mockClearChat.mockClear();
    mockGetPageContextForInjection.mockClear();
    mockConfirmToolCall.mockClear();
    mockRejectToolCall.mockClear();
    mockStreamChat.mockClear();
    mockResetStream.mockClear();
    mockCancelStream.mockClear();
    mockSaveMessages.mockClear();
    mockLoadConversation.mockClear();
    mockCreateConversation.mockClear();
    mockToast.mockClear();
    mockRegisterChatHandler.mockClear();
    mockClearPendingQuickCommand.mockClear();
    mockMarkResponseReady.mockClear();
  });

  it('affiche le welcome screen avec le nom du profil et les conversations récentes', async () => {
    PERSISTENCE_STATE.conversations = [
      { id: 'c1', title: 'Projet marketing', updated_at: '2024-05-01T10:00:00.000Z' },
      { id: 'c2', title: 'Support client', updated_at: '2024-05-02T10:00:00.000Z' },
      { id: 'c3', title: 'Plan produit', updated_at: '2024-05-03T10:00:00.000Z' },
      { id: 'c4', title: 'Archive', updated_at: '2024-05-04T10:00:00.000Z' },
    ];
    mockLoadConversation.mockImplementation(async () => []);

    renderPanel({ className: 'panel-premium' });

    expect(screen.getByTestId('jarvis-header')).toHaveTextContent('connected');
    expect(screen.getByTestId('jarvis-header')).toHaveTextContent('2');

    const welcome = await screen.findByTestId('jarvis-welcome');
    expect(welcome).toHaveTextContent('Alice');
    expect(welcome).toHaveTextContent('Projet marketing');

    expect(WELCOME_PROPS.length).toBeGreaterThan(0);
    const welcomeProps = WELCOME_PROPS[WELCOME_PROPS.length - 1] as {
      recentConversations: Array<{ id: string; title: string; date: Date }>;
      userName: string;
    };
    expect(welcomeProps.userName).toBe('Alice');
    expect(welcomeProps.recentConversations).toHaveLength(3);
    expect(welcomeProps.recentConversations[0].id).toBe('c1');
    expect(welcomeProps.recentConversations[1].title).toBe('Support client');
    expect(welcomeProps.recentConversations[2].date).toBeInstanceOf(Date);
  });

  it('affiche le skeleton puis charge la conversation récente avec ses messages', async () => {
    PERSISTENCE_STATE.conversations = [
      { id: 'conv-1', title: 'Dernière conversation', updated_at: '2024-06-01T09:00:00.000Z' },
    ];
    mockLoadConversation.mockImplementation(async () => [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Bonjour premium',
        timestamp: new Date('2024-06-01T09:01:00.000Z'),
      },
    ]);

    renderPanel();

    expect(await screen.findByTestId('jarvis-skeleton-loader')).toHaveTextContent('panel');

    await waitFor(() => {
      expect(mockLoadConversation).toHaveBeenCalledWith('conv-1');
    });

    await waitFor(() => {
      expect(mockSetMessages).toHaveBeenCalledTimes(1);
    });

    const firstCallArg = mockSetMessages.mock.calls[0][0] as Array<{ id: string; content: string }>;
    expect(firstCallArg).toHaveLength(1);
    expect(firstCallArg[0].id).toBe('m1');
    expect(firstCallArg[0].content).toBe('Bonjour premium');
  });

  it('affiche les messages premium et le preview email pour un tool call de confirmation', async () => {
    JARVIS_STATE.messages = [
      {
        id: 'u-msg',
        role: 'user',
        content: 'Envoie un email',
        timestamp: new Date('2024-06-02T08:00:00.000Z'),
      },
      {
        id: 'a-msg',
        role: 'assistant',
        content: 'Préparation de l’email',
        timestamp: new Date('2024-06-02T08:01:00.000Z'),
        toolCalls: [
          {
            id: 'tc-1',
            name: 'send_email',
            status: 'requires_confirmation',
            arguments: {
              to: 'client@test.local',
              subject: 'Suivi',
              body: 'Bonjour',
            },
          },
        ],
      },
    ];

    renderPanel();

    const premiumMessages = await screen.findAllByTestId('jarvis-premium-message');
    expect(premiumMessages).toHaveLength(1);
    expect(premiumMessages[0]).toHaveTextContent('user');
    expect(premiumMessages[0]).toHaveTextContent('Envoie un email');

    const emailPreview = await screen.findByTestId('jarvis-email-preview');
    expect(emailPreview).toHaveTextContent('client@test.local');
    expect(emailPreview).toHaveTextContent('Suivi');

    expect(PREMIUM_MESSAGES).toHaveLength(1);
    expect(EMAIL_PREVIEWS).toHaveLength(1);

    const emailProps = EMAIL_PREVIEWS[0] as {
      emailData: { to: string; subject?: string; body: string };
      onConfirm: () => Promise<void>;
      onCancel: () => Promise<void>;
      isConfirming: boolean;
    };
    expect(emailProps.emailData.to).toBe('client@test.local');
    expect(emailProps.emailData.body).toBe('Bonjour');
    expect(emailProps.isConfirming).toBe(false);

    await emailProps.onConfirm();
    await emailProps.onCancel();

    expect(mockConfirmToolCall).toHaveBeenCalledWith('tc-1');
    expect(mockRejectToolCall).toHaveBeenCalledWith('tc-1');
  });
});