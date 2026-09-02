import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  PROFILE,
  mockInvokeEdge,
  mockStartSession,
  mockEndSession,
  mockDebug,
  WEBRTC,
  TRANSCRIPTION,
} = vi.hoisted(() => {
  const PROFILE = { id: 'u1', prenom: 'Jean', nom: 'Dupont' };

  const mockInvokeEdge = vi.fn();

  const mockStartSession = vi.fn(() => Promise.resolve({ id: 's1' }));
  const mockEndSession = vi.fn(() => Promise.resolve());

  const mockDebug = {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  };

  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn(() => Promise.resolve());
  const mockToggleMute = vi.fn();

  // Stable object returned by useWebRTC - will be mutated in tests
  const WEBRTC = {
    isConnected: false,
    isConnecting: false,
    localStream: null,
    remoteStreams: [] as any[],
    participants: [] as any[],
    mediaState: { isMuted: false },
    connect: mockConnect,
    disconnect: mockDisconnect,
    toggleMute: mockToggleMute,
  };

  // Transcription stable state object
  const TRANSCRIPTION = {
    activeSession: null as null | { id: string },
    startSession: (...args: unknown[]) => mockStartSession(...(args as [])),
    endSession: (...args: unknown[]) => mockEndSession(...(args as [])),
    isRecording: false,
  };

  return {
    PROFILE,
    mockInvokeEdge,
    mockStartSession,
    mockEndSession,
    mockDebug,
    WEBRTC,
    TRANSCRIPTION,
  };
});

// Mock services and hooks used by the component
vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: (...args: unknown[]) => mockInvokeEdge(...args),
}));

vi.mock('@/lib/debug', () => ({
  debug: mockDebug,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: PROFILE }),
}));

vi.mock('@/contexts/TranscriptionContext', () => ({
  useTranscription: () => TRANSCRIPTION,
}));

vi.mock('@/hooks/voice/useWebRTC', () => ({
  useWebRTC: (_opts: unknown) => WEBRTC,
}));

// Simple UI component mocks using React.createElement to avoid JSX in mock factories
vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => React.createElement('button', { ...props }, props.children),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: any) => React.createElement('div', { ...props }, props.children),
  AvatarFallback: (props: any) => React.createElement('div', { ...props }, props.children),
  AvatarImage: (props: any) => React.createElement('img', { ...props }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: (props: any) => React.createElement('div', { ...props }, props.children),
  TooltipTrigger: (props: any) => React.createElement('div', { ...props }, props.children),
  TooltipContent: (props: any) => React.createElement('div', { ...props }, props.children),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' '),
}));

// Mock lucide-react icons as simple spans with accessible names
vi.mock('lucide-react', () => {
  const names = ['Phone', 'PhoneOff', 'Mic', 'MicOff', 'Volume2', 'VolumeX', 'X', 'Users', 'Clock'];
  const icons: Record<string, any> = {};
  names.forEach((n) => {
    icons[n] = (props: any) =>
      React.createElement('span', { 'data-icon': n, ...props }, props && props.children ? props.children : n);
  });
  return icons;
});

// Ensure any other '@/...' imports that might appear are stubbed generically
vi.mock('@/types/visio', () => ({}));

import { AudioCallOverlay } from './AudioCallOverlay';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

describe('AudioCallOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeEdge.mockReset();
    mockStartSession.mockReset();
    mockEndSession.mockReset();
    mockDebug.error.mockReset();
    mockDebug.warn.mockReset();
    mockDebug.log.mockReset();

    // Reset WEBRTC stable object fields
    WEBRTC.isConnected = true;
    WEBRTC.isConnecting = false;
    WEBRTC.localStream = null;
    WEBRTC.remoteStreams.length = 0;
    WEBRTC.participants.length = 0;
    WEBRTC.mediaState = { isMuted: false };
    WEBRTC.connect = WEBRTC.connect; // keep same fn reference
    WEBRTC.disconnect = WEBRTC.disconnect;
    WEBRTC.toggleMute = WEBRTC.toggleMute;

    // Reset transcription state
    TRANSCRIPTION.activeSession = null;
    TRANSCRIPTION.isRecording = false;
    mockStartSession.mockImplementation(() => Promise.resolve({ id: 's1' }));
    mockEndSession.mockImplementation(() => Promise.resolve());
  });

  it('shows loading then main UI and starts transcription when room is found and connected', async () => {
    mockInvokeEdge.mockResolvedValueOnce({ room: { id: 'room-1', code: 'code-1' } });

    const onClose = vi.fn();

    const client = createQueryClient();
    renderHook(() => true, {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    render(<AudioCallOverlay roomCode="code-1" roomName="Salle 1" onClose={onClose} />);

    // initially the loading text should be present
    expect(screen.getByText("Connexion à l'appel...")).toBeTruthy();

    // Wait for the room to be fetched and UI to update
    await screen.findByText('Salle 1');

    // Because WEBRTC.isConnected is true, the duration display should be visible and start at 00:00
    expect(screen.getByText('00:00')).toBeInTheDocument();

    // startSession should have been called with expected parameters
    await waitFor(() =>
      expect(mockStartSession).toHaveBeenCalledWith({
        title: 'Appel: Salle 1',
        roomCode: 'code-1',
        provider: 'marque_meet',
        autoRecord: true,
      })
    );
  });

  it('calls endSession, disconnect and onClose when hanging up and an activeSession exists', async () => {
    mockInvokeEdge.mockResolvedValueOnce({ room: { id: 'room-2' } });

    // Make transcription active so handleHangUp will call endSession
    TRANSCRIPTION.activeSession = { id: 's1' };
    TRANSCRIPTION.isRecording = true;

    const onClose = vi.fn();

    const client = createQueryClient();
    renderHook(() => true, {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    render(<AudioCallOverlay roomCode="code-2" roomName="Salle Hang" onClose={onClose} />);

    // Wait for UI to show the room name
    await screen.findByText('Salle Hang');

    // Find the hang up button by its aria-label
    const hangupButton = screen.getByLabelText('Raccrocher');

    await act(async () => {
      fireEvent.click(hangupButton);
    });

    // endSession and disconnect should have been called and onClose invoked
    expect(mockEndSession).toHaveBeenCalled();
    expect(WEBRTC.disconnect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error state when room is not found and allows closing', async () => {
    mockInvokeEdge.mockResolvedValueOnce({});

    const onClose = vi.fn();

    const client = createQueryClient();
    renderHook(() => true, {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    render(<AudioCallOverlay roomCode="nope" roomName="Salle X" onClose={onClose} />);

    // Wait for error UI to appear
    await screen.findByText("Impossible de rejoindre l'appel");

    // Error message should match the "Salle non trouvée" message set in the component
    expect(screen.getByText('Salle non trouvée')).toBeInTheDocument();

    // Click the "Fermer" button to trigger onClose
    const closeBtn = screen.getByText('Fermer');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('toggles speaker and updates remote audio elements muted property', async () => {
    mockInvokeEdge.mockResolvedValueOnce({ room: { id: 'room-remote' } });

    // Provide a remote stream entry to render an audio element
    WEBRTC.remoteStreams.length = 0;
    WEBRTC.remoteStreams.push({
      peerId: 'peer-1',
      participant: { display_name: 'Alice', is_muted: false },
      stream: {}, // dummy stream object; the ref will set srcObject only if truthy
    });

    const onClose = vi.fn();

    const client = createQueryClient();
    renderHook(() => true, {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    render(<AudioCallOverlay roomCode="code-remote" roomName="Salle Remote" onClose={onClose} />);

    // Wait for main UI
    await screen.findByText('Salle Remote');

    // Locate all buttons and pick the last one which corresponds to the speaker button in the layout
    const buttons = screen.getAllByRole('button');
    const speakerButton = buttons[buttons.length - 1];

    // Ensure the audio element exists
    const audio = document.querySelector('audio.remote-audio') as HTMLAudioElement | null;
    expect(audio).toBeTruthy();
    // initial muted value should be false (isSpeakerOff initial false)
    expect(audio?.muted).toBe(false);

    // Click speaker button to toggle
    await act(async () => {
      fireEvent.click(speakerButton);
    });

    // After clicking, the audio should be muted
    expect(audio?.muted).toBe(true);
  });

  it('handles invokeEdge throwing an error and surfaces the error message', async () => {
    const error = new Error('Impossible de joindre le service');
    mockInvokeEdge.mockRejectedValueOnce(error);

    const onClose = vi.fn();

    const client = createQueryClient();
    renderHook(() => true, {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    render(<AudioCallOverlay roomCode="err" roomName="Salle Err" onClose={onClose} />);

    // Wait for error UI
    await screen.findByText("Impossible de rejoindre l'appel");

    // The error paragraph should contain the thrown error message
    expect(screen.getByText('Impossible de joindre le service')).toBeInTheDocument();

    // debug.error should have been called with the error
    expect(mockDebug.error).toHaveBeenCalled();
  });
});