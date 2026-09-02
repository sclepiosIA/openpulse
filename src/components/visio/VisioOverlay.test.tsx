import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

const {
  mockInvokeEdge,
  LAST_VISIO_LOBBY_PROPS,
  LAST_VISIO_ROOM_PROPS,
  LAST_TRANSCRIPTION_PROPS,
  mockUseAuthValue,
  mockProfileValue,
  mockDebugError,
} = vi.hoisted(() => {
  const mockInvokeEdge = vi.fn();

  const LAST_VISIO_LOBBY_PROPS: { current: any | null } = { current: null };
  const LAST_VISIO_ROOM_PROPS: { current: any | null } = { current: null };
  const LAST_TRANSCRIPTION_PROPS: { current: any | null } = { current: null };

  const mockUseAuthValue = { user: { id: 'user-1', email: 'user1@example.com' } };

  const mockProfileValue = { data: { prenom: 'Jean', nom: 'Dupont', email: 'jean.dupont@example.com' } };

  const mockDebugError = vi.fn();

  return {
    mockInvokeEdge,
    LAST_VISIO_LOBBY_PROPS,
    LAST_VISIO_ROOM_PROPS,
    LAST_TRANSCRIPTION_PROPS,
    mockUseAuthValue,
    mockProfileValue,
    mockDebugError,
  };
});

// Mock lucide-react icons to simple elements
vi.mock('lucide-react', () => {
  return {
    X: (props: any) => React.createElement('svg', { 'data-testid': 'icon-x', ...props }),
    Loader2: (props: any) => React.createElement('svg', { 'data-testid': 'icon-loader', ...props }),
    AlertCircle: (props: any) => React.createElement('svg', { 'data-testid': 'icon-alert', ...props }),
  };
});

// Mock debug
vi.mock('@/lib/debug', () => {
  return {
    debug: {
      error: mockDebugError,
    },
  };
});

// Mock UI Button to a real button so clicks work; preserve children
vi.mock('@/components/ui/button', () => {
  return {
    Button: (props: any) =>
      React.createElement(
        'button',
        {
          ...props,
          'data-testid': props['aria-label'] || (typeof props.children === 'string' ? `btn-${props.children}` : 'btn'),
        },
        props.children
      ),
  };
});

// Mock auth hook
vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => mockUseAuthValue,
  };
});

// Mock profile hook
vi.mock('@/hooks/profile/useProfiles', () => {
  return {
    useCurrentProfile: () => mockProfileValue,
  };
});

// Mock edge functions (invokeEdge)
vi.mock('@/services/edgeFunctions', () => {
  return {
    invokeEdge: (...args: any[]) => mockInvokeEdge(...args),
  };
});

// Mock local subcomponents to capture props
vi.mock('./VisioLobby', () => {
  return {
    VisioLobby: (props: any) => {
      LAST_VISIO_LOBBY_PROPS.current = props;
      return React.createElement('div', { 'data-testid': 'visio-lobby' }, 'VisioLobby');
    },
  };
});

vi.mock('./VisioRoom', () => {
  return {
    VisioRoom: (props: any) => {
      LAST_VISIO_ROOM_PROPS.current = props;
      return React.createElement('div', { 'data-testid': 'visio-room' }, 'VisioRoom');
    },
  };
});

vi.mock('./TranscriptionShareModal', () => {
  return {
    TranscriptionShareModal: (props: any) => {
      LAST_TRANSCRIPTION_PROPS.current = props;
      return React.createElement('div', { 'data-testid': 'transcription-modal' }, 'TranscriptionShareModal');
    },
  };
});

// Import the module under test after mocks
import { VisioOverlay } from './VisioOverlay';

describe('VisioOverlay', () => {
  const originalLocalStorage = global.localStorage;
  beforeEach(() => {
    // reset captured props
    LAST_VISIO_LOBBY_PROPS.current = null;
    LAST_VISIO_ROOM_PROPS.current = null;
    LAST_TRANSCRIPTION_PROPS.current = null;

    mockInvokeEdge.mockReset();
    mockDebugError.mockReset();

    // Clear localStorage between tests to avoid persisted displayName
    const store: Record<string, string> = {};
    const localStorageMock = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    };
    // @ts-expect-error replace global
    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    // restore localStorage reference
    // @ts-expect-error restore
    global.localStorage = originalLocalStorage;
  });

  it('shows loading then renders lobby with profile displayName and authentication flag', async () => {
    const roomPayload = {
      room: {
        id: 'r1',
        roomCode: 'RC123',
        name: 'Salle 123',
        status: 'waiting',
        createdBy: 'user-1',
        conversationId: 'c1',
        participants: [],
        maxParticipants: 10,
        startedAt: null,
      },
    };

    // First call (fetchRoom) resolves to roomPayload
    mockInvokeEdge.mockResolvedValueOnce(roomPayload);

    const onClose = vi.fn();

    render(<VisioOverlay roomCode="RC123" roomName="Fallback name" onClose={onClose} />);

    // Loading UI visible initially
    expect(screen.getByTestId('icon-loader')).toBeTruthy();
    expect(screen.getByText('Chargement de la salle...')).toBeTruthy();

    // Wait for the VisioLobby to be rendered and props captured
    await waitFor(() => {
      expect(LAST_VISIO_LOBBY_PROPS.current).not.toBeNull();
    });

    const props = LAST_VISIO_LOBBY_PROPS.current;

    // Assert room info forwarded correctly
    expect(props.room).toBeDefined();
    expect(props.room.id).toBe('r1');
    expect(props.room.roomCode).toBe('RC123');
    expect(props.room.name).toBe('Salle 123');

    // Display name should be built from profile prenom + nom
    expect(props.displayName).toBe('Jean Dupont');

    // Authenticated flag should reflect presence of user
    expect(props.isAuthenticated).toBe(true);

    // onJoin should be a function
    expect(typeof props.onJoin).toBe('function');
  });

  it('handles join: calls invokeEdge for join-room and renders VisioRoom with updated participants and status', async () => {
    const roomPayload = {
      room: {
        id: 'r2',
        roomCode: 'JOIN123',
        name: 'Join Room',
        status: 'waiting',
        createdBy: 'user-1',
        conversationId: 'c2',
        participants: [{ id: 'p0' }],
        maxParticipants: 5,
        startedAt: null,
      },
    };

    // fetchRoom resolves to room
    mockInvokeEdge.mockResolvedValueOnce(roomPayload);

    const onClose = vi.fn();

    render(<VisioOverlay roomCode="JOIN123" roomName="Fallback" onClose={onClose} />);

    // wait for lobby props
    await waitFor(() => expect(LAST_VISIO_LOBBY_PROPS.current).not.toBeNull());

    // Prepare join-room response
    const joinResponse = { success: true, participants: [{ id: 'p1', name: 'Participant 1' }] };
    // Next call to invokeEdge (join) resolves to joinResponse
    mockInvokeEdge.mockResolvedValueOnce(joinResponse);

    // Trigger join via the lobby's onJoin prop
    await act(async () => {
      await LAST_VISIO_LOBBY_PROPS.current.onJoin();
    });

    // Expect that invokeEdge was called at least once with join action
    const calledWithJoin = mockInvokeEdge.mock.calls.some(
      (call) => call[0] === 'webrtc-signaling' && call[1] && call[1].action === 'join-room'
    );
    expect(calledWithJoin).toBe(true);

    // Wait for VisioRoom to be rendered and props captured
    await waitFor(() => expect(LAST_VISIO_ROOM_PROPS.current).not.toBeNull());

    const roomProps = LAST_VISIO_ROOM_PROPS.current;

    // After successful join, room status should be 'active'
    expect(roomProps.room.status).toBe('active');

    // Participants should be updated to those returned by joinResponse
    expect(Array.isArray(roomProps.room.participants)).toBe(true);
    expect(roomProps.room.participants).toHaveLength(1);
    expect(roomProps.room.participants[0].id).toBe('p1');
  });

  it('shows error state when fetchRoom returns no room and allows closing', async () => {
    // fetchRoom resolves to empty object -> triggers "Salle introuvable" error
    mockInvokeEdge.mockResolvedValueOnce({});

    const onClose = vi.fn();

    render(<VisioOverlay roomCode="MISSING" roomName="Missing room" onClose={onClose} />);

    // Wait for error UI
    await waitFor(() => {
      expect(screen.getByText('Erreur')).toBeTruthy();
    });

    // The error message should be the specific one thrown by the component
    expect(screen.getByText('Salle introuvable')).toBeTruthy();

    // Click the "Fermer" button to close
    const closeButton = screen.getByText('Fermer');
    fireEvent.click(closeButton);

    // onClose should have been called
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('when leaving a joined room via VisioRoom onLeave with sessionId opens TranscriptionShareModal and calls invokeEdge leave-room', async () => {
    const roomPayload = {
      room: {
        id: 'r3',
        roomCode: 'LEAVE123',
        name: 'Room Leave',
        status: 'active',
        createdBy: 'user-1',
        conversationId: 'c3',
        participants: [{ id: 'p0' }],
        maxParticipants: 5,
        startedAt: null,
      },
    };

    // fetchRoom resolves
    mockInvokeEdge.mockResolvedValueOnce(roomPayload);

    // Render and wait for lobby
    const onClose = vi.fn();
    render(<VisioOverlay roomCode="LEAVE123" roomName="Fallback" onClose={onClose} />);

    await waitFor(() => expect(LAST_VISIO_LOBBY_PROPS.current).not.toBeNull());

    // Simulate join success so VisioRoom is rendered
    const joinResponse = { success: true, participants: [{ id: 'p1' }] };
    mockInvokeEdge.mockResolvedValueOnce(joinResponse);

    await act(async () => {
      await LAST_VISIO_LOBBY_PROPS.current.onJoin();
    });

    await waitFor(() => expect(LAST_VISIO_ROOM_PROPS.current).not.toBeNull());

    // Prepare leave-room response (for the invokeEdge called within handleVisioLeave)
    mockInvokeEdge.mockResolvedValueOnce({ success: true });

    // Call VisioRoom's onLeave with a sessionId to trigger transcription modal
    await act(async () => {
      await LAST_VISIO_ROOM_PROPS.current.onLeave('session-xyz');
    });

    // invokeEdge should have been called with action leave-room and the room id
    const leaveCall = mockInvokeEdge.mock.calls.find(
      (call) => call[0] === 'webrtc-signaling' && call[1] && call[1].action === 'leave-room'
    );
    expect(leaveCall).toBeTruthy();
    expect(leaveCall && leaveCall[1].roomId).toBe('r3');

    // Transcription modal should be opened with the sessionId provided
    expect(LAST_TRANSCRIPTION_PROPS.current).not.toBeNull();
    expect(LAST_TRANSCRIPTION_PROPS.current.open).toBe(true);
    expect(LAST_TRANSCRIPTION_PROPS.current.sessionId).toBe('session-xyz');

    // Now simulate closing the transcription modal via its onClose prop
    await act(async () => {
      LAST_TRANSCRIPTION_PROPS.current.onClose();
    });

    // onClose passed to VisioOverlay should have been called once when transcription modal closed
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('when closing after joining, handleClose triggers leave-room and calls onClose', async () => {
    const roomPayload = {
      room: {
        id: 'r4',
        roomCode: 'CLOSE123',
        name: 'Room Close',
        status: 'active',
        createdBy: 'user-1',
        conversationId: 'c4',
        participants: [{ id: 'p0' }],
        maxParticipants: 5,
        startedAt: null,
      },
    };

    mockInvokeEdge.mockResolvedValueOnce(roomPayload);

    const onClose = vi.fn();

    render(<VisioOverlay roomCode="CLOSE123" roomName="Fallback" onClose={onClose} />);

    await waitFor(() => expect(LAST_VISIO_LOBBY_PROPS.current).not.toBeNull());

    // Simulate join success
    mockInvokeEdge.mockResolvedValueOnce({ success: true, participants: [{ id: 'pX' }] });

    await act(async () => {
      await LAST_VISIO_LOBBY_PROPS.current.onJoin();
    });

    await waitFor(() => expect(LAST_VISIO_ROOM_PROPS.current).not.toBeNull());

    // Now find the close button rendered in the overlay (aria-label="Fermer")
    const closeButtons = screen.getAllByTestId('Fermer') // Button mock uses aria-label -> data-testid
      .filter(Boolean);

    // If not found via data-testid fallback to finding by aria-label attribute directly
    let closeButtonElement: HTMLElement | null = null;
    if (closeButtons.length > 0) {
      closeButtonElement = closeButtons[0] as unknown as HTMLElement;
    } else {
      // query by aria-label attribute
      const allButtons = Array.from(document.querySelectorAll('button'));
      closeButtonElement = allButtons.find((b) => b.getAttribute('aria-label') === 'Fermer') || null;
    }

    // Ensure we have the close button
    expect(closeButtonElement).not.toBeNull();

    // Prepare the leave-room mock for handleClose
    mockInvokeEdge.mockResolvedValueOnce({ success: true });

    // Click the close button to trigger handleClose
    fireEvent.click(closeButtonElement!);

    // handleClose should call onClose synchronously
    expect(onClose).toHaveBeenCalledTimes(1);

    // And invokeEdge should have been called with leave-room for the room id
    const leaveCall = mockInvokeEdge.mock.calls.find(
      (call) => call[0] === 'webrtc-signaling' && call[1] && call[1].action === 'leave-room' && call[1].roomId === 'r4'
    );
    expect(leaveCall).toBeTruthy();
  });
});