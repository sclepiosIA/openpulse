// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LiveChatWidget from './LiveChatWidget';

const {
  SESSION_RESPONSE,
  INITIAL_MESSAGES,
  STABLE_CHANNEL,
  VISITOR_ID,
  mockInvoke,
  mockFrom,
  mockCreateLiveChatVisitorClient,
  mockDebugError,
  mockChannel,
  mockRemoveChannel,
  mockInsert,
  mockSelect,
  mockEq,
  mockOrder,
  mockSubscribe,
  mockOn,
  mockVisitorFrom,
  mockFormat,
} = vi.hoisted(() => {
  const SESSION_RESPONSE = {
    session_id: 'session-1',
    session_token: 'token-1',
  };

  const INITIAL_MESSAGES = [
    {
      id: 'm1',
      content: 'Bonjour du support',
      sender_type: 'agent' as const,
      created_at: '2024-01-01T10:15:00.000Z',
    },
    {
      id: 'm2',
      content: 'Bienvenue',
      sender_type: 'bot' as const,
      created_at: '2024-01-01T10:16:00.000Z',
    },
  ];

  const STABLE_CHANNEL = { name: 'stable-channel' };
  const VISITOR_ID = 'visitor-uuid-1';

  return {
    SESSION_RESPONSE,
    INITIAL_MESSAGES,
    STABLE_CHANNEL,
    VISITOR_ID,
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(),
    mockCreateLiveChatVisitorClient: vi.fn(),
    mockDebugError: vi.fn(),
    mockChannel: vi.fn(),
    mockRemoveChannel: vi.fn(),
    mockInsert: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOrder: vi.fn(),
    mockSubscribe: vi.fn(),
    mockOn: vi.fn(),
    mockVisitorFrom: vi.fn(),
    mockFormat: vi.fn(),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    style,
    size,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    size?: string;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
      data-size={size}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    type,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      type={type}
      className={className}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  AvatarFallback: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-icon="true" className={className} />;
  return {
    MessageCircle: Icon,
    X: Icon,
    Send: Icon,
    Minimize2: Icon,
    Bot: Icon,
    User: Icon,
  };
});

vi.mock('date-fns', () => ({
  format: mockFormat,
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('@/lib/liveChatClient', () => ({
  createLiveChatVisitorClient: mockCreateLiveChatVisitorClient,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });

  Object.defineProperty(window, 'crypto', {
    value: {
      randomUUID: vi.fn(() => VISITOR_ID),
    },
    configurable: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  mockFormat.mockImplementation((date: Date) => {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  mockInvoke.mockResolvedValue({
    data: SESSION_RESPONSE,
    error: null,
  });

  const visitorBuilder = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    insert: mockInsert,
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve({
        data: INITIAL_MESSAGES,
        error: null,
      }).then(onFulfilled, onRejected);
    },
    catch(onRejected: (reason: unknown) => unknown) {
      return Promise.resolve({
        data: INITIAL_MESSAGES,
        error: null,
      }).catch(onRejected);
    },
  };

  mockSelect.mockImplementation(() => visitorBuilder);
  mockEq.mockImplementation(() => visitorBuilder);
  mockOrder.mockResolvedValue({
    data: INITIAL_MESSAGES,
    error: null,
  });
  mockInsert.mockResolvedValue({
    data: null,
    error: null,
  });

  mockVisitorFrom.mockImplementation(() => visitorBuilder);
  mockCreateLiveChatVisitorClient.mockReturnValue({
    from: mockVisitorFrom,
  });

  mockSubscribe.mockReturnValue(STABLE_CHANNEL);
  mockOn.mockImplementation(() => ({
    subscribe: mockSubscribe,
  }));
  mockChannel.mockReturnValue({
    on: mockOn,
  });
  mockRemoveChannel.mockReturnValue(undefined);
});

describe('LiveChatWidget', () => {
  it('ouvre le widget, démarre une conversation, affiche les messages initiaux et permet d envoyer un message', async () => {
    const user = userEvent.setup();

    render(<LiveChatWidget etablissementId="eta-1" primaryColor="#123456" />, {
      wrapper: Wrapper,
    });

    const launcherButton = screen.getByRole('button');
    await user.click(launcherButton);

    expect(screen.getByText('Support en ligne')).toBeInTheDocument();
    expect(screen.getByText('Veuillez vous identifier pour démarrer la conversation.')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: 'Démarrer la conversation' });
    expect(startButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText('Votre nom *');
    const emailInput = screen.getByPlaceholderText('Votre email (optionnel)');

    await user.type(nameInput, 'Jean');
    await user.type(emailInput, 'jean@example.com');

    expect(startButton).toBeEnabled();

    await user.click(startButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create-live-chat-session', {
        body: {
          guest_name: 'Jean',
          guest_email: 'jean@example.com',
          etablissement_id: 'eta-1',
          source: 'widget',
        },
      });
    });

    await waitFor(() => {
      expect(mockCreateLiveChatVisitorClient).toHaveBeenCalledWith('token-1');
    });

    await waitFor(() => {
      expect(screen.getByText('Bonjour du support')).toBeInTheDocument();
      expect(screen.getByText('Bienvenue')).toBeInTheDocument();
      expect(screen.getByText('10:15')).toBeInTheDocument();
      expect(screen.getByText('10:16')).toBeInTheDocument();
    });

    expect(mockVisitorFrom).toHaveBeenCalledWith('live_chat_messages');
    expect(mockSelect).toHaveBeenCalledWith('id, content, sender_type, created_at');
    expect(mockEq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });

    expect(mockChannel).toHaveBeenCalledWith('chat-widget-session-1');
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat_messages',
        filter: 'session_id=eq.session-1',
      },
      expect.any(Function)
    );

    const messageInput = screen.getByPlaceholderText('Écrire un message...');
    const sendButton = screen.getByLabelText('Envoyer');

    expect(sendButton).toBeDisabled();

    await user.type(messageInput, 'Je souhaite une information');

    expect(sendButton).toBeEnabled();

    await user.click(sendButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: 'session-1',
        content: 'Je souhaite une information',
        sender_type: 'visitor',
      });
    });

    expect((messageInput as HTMLInputElement).value).toBe('');
    expect(localStorage.getItem('chat_visitor_id')).toBe(VISITOR_ID);
  });

  it('démarre la conversation avec la touche Entrée depuis le formulaire', async () => {
    const user = userEvent.setup();

    render(<LiveChatWidget />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button'));

    const nameInput = screen.getByPlaceholderText('Votre nom *');
    await user.type(nameInput, 'Alice');

    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create-live-chat-session', {
        body: {
          guest_name: 'Alice',
          guest_email: null,
          etablissement_id: null,
          source: 'widget',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Écrire un message...')).toBeInTheDocument();
    });
  });

  it('journalise une erreur si la création de session échoue et reste sur le formulaire', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'x' },
    });

    render(<LiveChatWidget />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByPlaceholderText('Votre nom *'), 'Marc');
    await user.click(screen.getByRole('button', { name: 'Démarrer la conversation' }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith('Error starting conversation:', { message: 'x' });
    });

    expect(screen.getByText('Veuillez vous identifier pour démarrer la conversation.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Écrire un message...')).not.toBeInTheDocument();
  });

  it('journalise une erreur si l envoi du message échoue', async () => {
    const user = userEvent.setup();

    mockInsert.mockRejectedValueOnce(new Error('x'));

    render(<LiveChatWidget />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByPlaceholderText('Votre nom *'), 'Lina');
    await user.click(screen.getByRole('button', { name: 'Démarrer la conversation' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Écrire un message...')).toBeInTheDocument();
    });

    const messageInput = screen.getByPlaceholderText('Écrire un message...');
    await user.type(messageInput, 'Test erreur');
    await user.click(screen.getByLabelText('Envoyer'));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: 'session-1',
        content: 'Test erreur',
        sender_type: 'visitor',
      });
      expect(mockDebugError).toHaveBeenCalled();
    });
  });

  it('se ferme correctement et nettoie le channel à la destruction', async () => {
    const user = userEvent.setup();

    const { unmount } = render(<LiveChatWidget />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByPlaceholderText('Votre nom *'), 'Nora');
    await user.click(screen.getByRole('button', { name: 'Démarrer la conversation' }));

    await waitFor(() => {
      expect(screen.getByText('Bonjour du support')).toBeInTheDocument();
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(STABLE_CHANNEL);
  });
});