import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  STATE,
  ROOM,
  CONNECT,
  DISCONNECT,
  TOGGLE_MUTE,
  TOGGLE_VIDEO,
  TOGGLE_SCREEN,
  START_SESSION,
  END_SESSION,
  NAVIGATE,
  DEBUG_WARN,
} = vi.hoisted(() => {
  const ROOM = {
    id: 'r1',
    name: 'Réunion Clinique',
    roomCode: 'ABC123',
    conversationId: 'conv1',
  };

  const STATE = {
    profile: { id: 'u1', prenom: 'Alice', nom: 'Durand', email: 'alice@example.com' },
    isRecording: false,
    activeSession: null as null | { id: string },
    webrtc: {
      isConnected: false,
      isConnecting: false,
      hasLeft: false,
      localStream: null as unknown,
      screenStream: null as unknown,
      remoteStreams: [] as unknown[],
      participants: [
        {
          user_id: 'u2',
          display_name: 'Bob Martin',
          joined_at: '2024-01-01T00:00:00Z',
          is_muted: true,
          is_video_off: false,
          is_screen_sharing: false,
          connection_quality: 'good',
        },
      ],
      mediaState: { isMuted: false, isVideoOff: false, isScreenSharing: false },
    },
  };

  const CONNECT = vi.fn().mockResolvedValue(undefined);
  const DISCONNECT = vi.fn().mockResolvedValue(undefined);
  const TOGGLE_MUTE = vi.fn();
  const TOGGLE_VIDEO = vi.fn();
  const TOGGLE_SCREEN = vi.fn();

  const START_SESSION = vi.fn().mockResolvedValue({ id: 's1' });
  const END_SESSION = vi.fn().mockResolvedValue(undefined);

  const NAVIGATE = vi.fn();
  const DEBUG_WARN = vi.fn();

  return {
    STATE,
    ROOM,
    CONNECT,
    DISCONNECT,
    TOGGLE_MUTE,
    TOGGLE_VIDEO,
    TOGGLE_SCREEN,
    START_SESSION,
    END_SESSION,
    NAVIGATE,
    DEBUG_WARN,
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: DEBUG_WARN,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => NAVIGATE,
  };
});

vi.mock('@/hooks/voice/useWebRTC', () => ({
  useWebRTC: () => ({
    isConnected: STATE.webrtc.isConnected,
    isConnecting: STATE.webrtc.isConnecting,
    hasLeft: STATE.webrtc.hasLeft,
    localStream: STATE.webrtc.localStream,
    screenStream: STATE.webrtc.screenStream,
    remoteStreams: STATE.webrtc.remoteStreams,
    participants: STATE.webrtc.participants,
    mediaState: STATE.webrtc.mediaState,
    connect: CONNECT,
    disconnect: DISCONNECT,
    toggleMute: TOGGLE_MUTE,
    toggleVideo: TOGGLE_VIDEO,
    toggleScreenShare: TOGGLE_SCREEN,
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({
    data: STATE.profile,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/contexts/TranscriptionContext', () => ({
  useTranscription: () => ({
    activeSession: STATE.activeSession,
    startSession: START_SESSION,
    endSession: END_SESSION,
    isRecording: STATE.isRecording,
  }),
}));

vi.mock('./VideoGrid', () => ({
  VideoGrid: () => <div data-testid="video-grid" />,
}));

vi.mock('./VisioControls', () => ({
  VisioControls: (props: any) => (
    <div data-testid="controls">
      <button data-testid="leave-btn" onClick={() => props.onLeave?.()} />
      <button data-testid="open-participants" onClick={() => props.onOpenParticipants?.()} />
    </div>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: any) => <div data-testid="sheet">{open ? children : null}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: any) => <div data-testid="sheet-title">{children}</div>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

vi.mock('lucide-react', () => ({
  Mic: () => null,
  MicOff: () => null,
  VideoOff: () => null,
  Monitor: () => null,
}));

import { VisioRoom } from './VisioRoom';

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  STATE.profile = { id: 'u1', prenom: 'Alice', nom: 'Durand', email: 'alice@example.com' };
  STATE.isRecording = false;
  STATE.activeSession = null;
  STATE.webrtc.isConnected = false;
  STATE.webrtc.isConnecting = false;
  STATE.webrtc.hasLeft = false;
  STATE.webrtc.localStream = null;
  STATE.webrtc.screenStream = null;
  STATE.webrtc.remoteStreams = [];
  STATE.webrtc.participants = [
    {
      user_id: 'u2',
      display_name: 'Bob Martin',
      joined_at: '2024-01-01T00:00:00Z',
      is_muted: true,
      is_video_off: false,
      is_screen_sharing: false,
      connection_quality: 'good',
    },
  ];
  STATE.webrtc.mediaState = { isMuted: false, isVideoOff: false, isScreenSharing: false };

  CONNECT.mockClear();
  DISCONNECT.mockClear();
  TOGGLE_MUTE.mockClear();
  TOGGLE_VIDEO.mockClear();
  TOGGLE_SCREEN.mockClear();
  START_SESSION.mockClear();
  END_SESSION.mockClear();
  NAVIGATE.mockClear();
  DEBUG_WARN.mockClear();

  CONNECT.mockResolvedValue(undefined);
  DISCONNECT.mockResolvedValue(undefined);
  START_SESSION.mockResolvedValue({ id: 's1' });
  END_SESSION.mockResolvedValue(undefined);
});

describe('VisioRoom component', () => {
  it('renders header, participants count (plural), room code, and triggers connect on mount', async () => {
    renderWithProviders(<VisioRoom room={ROOM} />);

    expect(screen.getByText(ROOM.name)).toBeInTheDocument();
    expect(screen.getByText('2 participants')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent(ROOM.roomCode);

    await waitFor(() => {
      expect(CONNECT).toHaveBeenCalledTimes(1);
    });
  });

  it('renders singular participant count when no remote participants', async () => {
    STATE.webrtc.participants = [];
    renderWithProviders(<VisioRoom room={ROOM} />);

    expect(screen.getByText('1 participant')).toBeInTheDocument();
  });

  it('auto-starts transcription when connected and shows indicator when recording', async () => {
    STATE.webrtc.isConnected = true;
    STATE.isRecording = true;
    STATE.activeSession = null;

    renderWithProviders(<VisioRoom room={ROOM} />);

    await waitFor(() => {
      expect(START_SESSION).toHaveBeenCalledTimes(1);
    });

    expect(START_SESSION).toHaveBeenCalledWith({
      title: ROOM.name,
      roomCode: ROOM.roomCode,
      provider: 'marque_meet',
      conversationId: ROOM.conversationId,
      autoRecord: true,
    });

    expect(screen.getByText('Transcription')).toBeInTheDocument();
  });

  it('logs a warning if auto-start transcription fails (non-blocking)', async () => {
    STATE.webrtc.isConnected = true;
    STATE.activeSession = null;
    START_SESSION.mockRejectedValueOnce(new Error('start failed'));

    renderWithProviders(<VisioRoom room={ROOM} />);

    await waitFor(() => {
      expect(START_SESSION).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(DEBUG_WARN).toHaveBeenCalled();
      expect(
        DEBUG_WARN.mock.calls.some((args) =>
          String(args[0]).includes('Transcription auto-start failed')
        )
      ).toBe(true);
    });
  });

  it('opens participants drawer and lists local and remote participants with "(Vous)" label and initials', async () => {
    renderWithProviders(<VisioRoom room={ROOM} />);

    fireEvent.click(screen.getByTestId('open-participants'));

    expect(screen.getByTestId('sheet-title')).toHaveTextContent('Participants (2)');
    expect(screen.getByText('Bob Martin')).toBeInTheDocument();
    expect(screen.getByText('Alice Durand')).toBeInTheDocument();
    expect(screen.getByText('(Vous)')).toBeInTheDocument();
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('onLeave prop receives active session id and ends transcription + disconnects', async () => {
    STATE.activeSession = { id: 's42' };

    const onLeave = vi.fn();
    renderWithProviders(<VisioRoom room={ROOM} onLeave={onLeave} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('leave-btn'));
    });

    expect(END_SESSION).toHaveBeenCalledTimes(1);
    expect(DISCONNECT).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith('s42');
    expect(NAVIGATE).not.toHaveBeenCalled();
  });

  it('navigates back on leave when no onLeave prop and logs warning if end/disconnect fail', async () => {
    STATE.activeSession = { id: 's99' };
    END_SESSION.mockRejectedValueOnce(new Error('end failed'));
    DISCONNECT.mockRejectedValueOnce(new Error('disconnect failed'));

    renderWithProviders(<VisioRoom room={ROOM} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('leave-btn'));
    });

    expect(END_SESSION).toHaveBeenCalledTimes(1);
    expect(DISCONNECT).toHaveBeenCalledTimes(1);
    expect(NAVIGATE).toHaveBeenCalledWith(-1);

    expect(DEBUG_WARN).toHaveBeenCalled();
    // Should be called at least twice: one for endSession error and one for disconnect error
    expect(DEBUG_WARN.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});