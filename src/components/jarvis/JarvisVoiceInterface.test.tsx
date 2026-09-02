/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisVoiceInterface, JarvisVoiceButton } from './JarvisVoiceInterface';

const {
  builder,
  mockFrom,
  authState,
  toast,
  navigateMock,
  jarvisVoiceState,
  useJarvisVoiceMock,
} = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.then.mockImplementation((resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
  chain.catch.mockImplementation((reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(reject)
  );

  return {
    builder: chain,
    mockFrom: vi.fn(() => chain),
    ROWS: [{ id: '1' }],
    authState: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    navigateMock: vi.fn(),
    jarvisVoiceState: {
      isListening: false,
      isSpeaking: false,
      isAwake: false,
      transcript: '',
      startListening: vi.fn(),
      stopListening: vi.fn(),
      stopSpeaking: vi.fn(),
      lastOptions: undefined as { onCommand?: (cmd: { type: string; query?: string }) => void } | undefined,
    },
    useJarvisVoiceMock: vi.fn((options?: { onCommand?: (cmd: { type: string; query?: string }) => void }) => {
      jarvisVoiceState.lastOptions = options;
      return {
        isListening: jarvisVoiceState.isListening,
        isSpeaking: jarvisVoiceState.isSpeaking,
        isAwake: jarvisVoiceState.isAwake,
        transcript: jarvisVoiceState.transcript,
        startListening: jarvisVoiceState.startListening,
        stopListening: jarvisVoiceState.stopListening,
        stopSpeaking: jarvisVoiceState.stopSpeaking,
      };
    }),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: authState.user }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: authState.session }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => authState),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => authState),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => authState),
}));

vi.mock('sonner', () => ({
  toast,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/jarvis/useJarvisVoice', () => ({
  useJarvisVoice: useJarvisVoiceMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    variant,
    size,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Mic: ({ className }: { className?: string }) => <svg data-testid="icon-mic" className={className} />,
  MicOff: ({ className }: { className?: string }) => <svg data-testid="icon-mic-off" className={className} />,
  Volume2: ({ className }: { className?: string }) => <svg data-testid="icon-volume-2" className={className} />,
  VolumeX: ({ className }: { className?: string }) => <svg data-testid="icon-volume-x" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="icon-loader" className={className} />,
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

describe('JarvisVoiceInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jarvisVoiceState.isListening = false;
    jarvisVoiceState.isSpeaking = false;
    jarvisVoiceState.isAwake = false;
    jarvisVoiceState.transcript = '';
    jarvisVoiceState.startListening = vi.fn();
    jarvisVoiceState.stopListening = vi.fn();
    jarvisVoiceState.stopSpeaking = vi.fn();
    jarvisVoiceState.lastOptions = undefined;
  });

  it('transmet uniquement une commande ask avec query à onCommand', async () => {
    const onCommand = vi.fn();
    const wrapper = createWrapper();

    render(
      <wrapper>
        <JarvisVoiceInterface onCommand={onCommand} />
      </wrapper>
    );

    expect(jarvisVoiceState.lastOptions).toBeDefined();

    await act(async () => {
      jarvisVoiceState.lastOptions?.onCommand?.({ type: 'ask', query: 'quel est mon planning' });
    });

    expect(onCommand).toHaveBeenCalledWith('quel est mon planning');

    await act(async () => {
      jarvisVoiceState.lastOptions?.onCommand?.({ type: 'notify', query: 'ne doit pas passer' });
      jarvisVoiceState.lastOptions?.onCommand?.({ type: 'ask' });
    });

    expect(onCommand).toHaveBeenCalledTimes(1);
  });
});

describe('JarvisVoiceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jarvisVoiceState.isListening = false;
    jarvisVoiceState.isSpeaking = false;
    jarvisVoiceState.isAwake = false;
    jarvisVoiceState.transcript = '';
    jarvisVoiceState.startListening = vi.fn();
    jarvisVoiceState.stopListening = vi.fn();
    jarvisVoiceState.stopSpeaking = vi.fn();
  });

  it('démarre puis arrête l’écoute selon l’état', async () => {
    const { rerender } = render(<JarvisVoiceButton />);

    const buttonStart = screen.getByRole('button', { name: 'Micro' });
    expect(screen.getByTestId('icon-mic-off')).toBeInTheDocument();

    fireEvent.click(buttonStart);
    expect(jarvisVoiceState.startListening).toHaveBeenCalledTimes(1);

    jarvisVoiceState.isListening = true;
    rerender(<JarvisVoiceButton />);

    expect(screen.getByTestId('icon-mic')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Micro' }));
    expect(jarvisVoiceState.stopListening).toHaveBeenCalledTimes(1);
  });

  it('affiche l’indicateur awake quand non en écoute', () => {
    jarvisVoiceState.isAwake = true;
    render(<JarvisVoiceButton />);

    const button = screen.getByRole('button', { name: 'Micro' });
    expect(button.querySelector('div')).not.toBeNull();
  });
});