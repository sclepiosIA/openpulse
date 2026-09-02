// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CallWidget } from './CallWidget';

const {
  stableLocation,
  stableCallContext,
  stableSip,
  logCallActionMock,
  uploadCallRecordingMock,
  toastMock,
  closeWidgetMock,
  consumeTargetMock,
  connectMock,
  startCallMock,
  hangupMock,
  toggleMuteMock,
  sendDtmfMock,
  startRecordingMock,
} = vi.hoisted(() => {
  const stableLocation = { pathname: '/app' };

  const closeWidgetMock = vi.fn();
  const consumeTargetMock = vi.fn();

  const stableCallContext = {
    isOpen: true,
    pendingTarget: null,
    closeWidget: closeWidgetMock,
    consumeTarget: consumeTargetMock,
  };

  const connectMock = vi.fn();
  const startCallMock = vi.fn();
  const hangupMock = vi.fn();
  const toggleMuteMock = vi.fn();
  const sendDtmfMock = vi.fn();
  const startRecordingMock = vi.fn();

  const stableSip: {
    state: string;
    remoteStream: MediaStream | null;
    call:
      | null
      | {
          state: 'progress' | 'ringing' | 'connected' | 'ended' | 'failed';
          answeredAt?: number;
          displayName?: string;
          remote?: string;
        };
    error: string;
    isMuted: boolean;
    connect: typeof connectMock;
    startCall: typeof startCallMock;
    hangup: typeof hangupMock;
    toggleMute: typeof toggleMuteMock;
    sendDtmf: typeof sendDtmfMock;
    startRecording: typeof startRecordingMock;
  } = {
    state: 'registered',
    remoteStream: null,
    call: null,
    error: '',
    isMuted: false,
    connect: connectMock,
    startCall: startCallMock,
    hangup: hangupMock,
    toggleMute: toggleMuteMock,
    sendDtmf: sendDtmfMock,
    startRecording: startRecordingMock,
  };

  return {
    stableLocation,
    stableCallContext,
    stableSip,
    logCallActionMock: vi.fn(),
    uploadCallRecordingMock: vi.fn(),
    toastMock: vi.fn(),
    closeWidgetMock,
    consumeTargetMock,
    connectMock,
    startCallMock,
    hangupMock,
    toggleMuteMock,
    sendDtmfMock,
    startRecordingMock,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => stableLocation,
  };
});

vi.mock('@/contexts/CallContext', () => ({
  useCallContext: () => stableCallContext,
}));

vi.mock('@/hooks/voice/useSipClient', () => ({
  useSipClient: () => stableSip,
}));

vi.mock('@/hooks/voice/useCalls', () => ({
  logCallAction: logCallActionMock,
  uploadCallRecording: uploadCallRecordingMock,
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: toastMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    className,
    variant,
    size,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    title?: string;
    className?: string;
    variant?: string;
    size?: string;
    'aria-label'?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={className}
      data-variant={variant}
      data-size={size}
      aria-label={props['aria-label']}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    rows?: number;
    className?: string;
  }) => (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
  }: {
    children?: React.ReactNode;
    variant?: string;
  }) => <div data-variant={variant}>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Phone: Icon,
    PhoneOff: Icon,
    Mic: Icon,
    MicOff: Icon,
    X: Icon,
    Circle: Icon,
    Loader2: Icon,
    Hash: Icon,
  };
});

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWidget() {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CallWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CallWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableLocation.pathname = '/app';
    stableCallContext.isOpen = true;
    stableCallContext.pendingTarget = null;
    stableCallContext.closeWidget = closeWidgetMock;
    stableCallContext.consumeTarget = consumeTargetMock;

    stableSip.state = 'registered';
    stableSip.remoteStream = null;
    stableSip.call = null;
    stableSip.error = '';
    stableSip.isMuted = false;

    connectMock.mockResolvedValue(undefined);
    startCallMock.mockResolvedValue(undefined);
    hangupMock.mockReturnValue(undefined);
    toggleMuteMock.mockReturnValue(undefined);
    sendDtmfMock.mockReturnValue(undefined);
    startRecordingMock.mockReturnValue(null);
    logCallActionMock.mockResolvedValue({ call_id: 'call-1' });
    uploadCallRecordingMock.mockResolvedValue('recordings/file.webm');
    consumeTargetMock.mockReturnValue(null);
    vi.useRealTimers();
  });

  it('ne rend rien sur une route publique', () => {
    stableLocation.pathname = '/auth/login';

    const { container } = renderWidget();

    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien quand le widget est fermé', () => {
    stableCallContext.isOpen = false;

    const { container } = renderWidget();

    expect(container.firstChild).toBeNull();
  });

  it('affiche l’état initialisation quand le widget est ouvert sans appel actif', () => {
    renderWidget();

    expect(screen.getByText('Initialisation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Notes d'appel (sauvegardées à la fin)…")).toBeInTheDocument();
    expect(screen.getByLabelText('Raccrocher')).toBeInTheDocument();
  });

  it('démarre un appel sortant et affiche les informations métier de l’appel', async () => {
    consumeTargetMock.mockReturnValue({
      phoneNumber: '0199001234',
      displayName: 'Alice Martin',
      contactId: 'contact-1',
      etablissementId: 'eta-1',
      prospectId: 'prospect-1',
    });

    stableSip.call = {
      state: 'progress',
      displayName: 'Alice Martin',
      remote: '0199001234',
    };

    renderWidget();

    await waitFor(() => {
      expect(logCallActionMock).toHaveBeenCalledWith({
        action: 'start',
        direction: 'outbound',
        to_number: '0199001234',
        display_name: 'Alice Martin',
        contact_id: 'contact-1',
        etablissement_id: 'eta-1',
        prospect_id: 'prospect-1',
      });
    });

    expect(startCallMock).toHaveBeenCalledWith('0199001234', 'Alice Martin');
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('0199001234')).toBeInTheDocument();
    expect(screen.getByText('Connexion…')).toBeInTheDocument();
  });

  it('connecte le client SIP avant de lancer l’appel si non enregistré', async () => {
    stableSip.state = 'idle';
    consumeTargetMock.mockReturnValue({
      phoneNumber: '0555000111',
      displayName: 'Bob',
      contactId: 'c2',
      etablissementId: 'e2',
      prospectId: 'p2',
    });

    renderWidget();

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(1);
    });

    expect(startCallMock).toHaveBeenCalledWith('0555000111', 'Bob');
  });

  it('affiche le timer et permet mute, clavier DTMF et hangup sur appel connecté', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T10:00:05Z'));

    stableSip.call = {
      state: 'connected',
      answeredAt: new Date('2025-01-01T10:00:00Z').getTime(),
      displayName: 'Claire',
      remote: '0600000000',
    };

    renderWidget();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('00:06')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Couper le micro'));
    expect(toggleMuteMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Tag'));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '#' }));
    expect(sendDtmfMock).toHaveBeenCalledWith('1');
    expect(sendDtmfMock).toHaveBeenCalledWith('#');

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    fireEvent.click(screen.getByLabelText('Raccrocher'));
    expect(hangupMock).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 600);

    vi.useRealTimers();
  });

  it('affiche une erreur SIP remontée par le hook', () => {
    stableSip.call = {
      state: 'failed',
      displayName: 'David',
      remote: '0700000000',
    };
    stableSip.error = 'Micro indisponible';

    renderWidget();

    expect(screen.getByText('Échec')).toBeInTheDocument();
    expect(screen.getByText('Micro indisponible')).toBeInTheDocument();
  });

  it('toast une erreur et ferme le widget si le démarrage d’appel échoue', async () => {
    consumeTargetMock.mockReturnValue({
      phoneNumber: '0777000000',
      displayName: 'Eva',
      contactId: 'c3',
      etablissementId: 'e3',
      prospectId: 'p3',
    });
    startCallMock.mockRejectedValue(new Error('Ligne occupée'));

    renderWidget();

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Appel impossible',
        description: 'Ligne occupée',
        variant: 'destructive',
      });
    });

    expect(closeWidgetMock).toHaveBeenCalledTimes(1);
  });
});