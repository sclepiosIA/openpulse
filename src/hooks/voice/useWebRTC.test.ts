const { mockInvoke, mockChannelFactory, mockRemoveChannel, PARTICIPANTS, toastMock, getUserMediaMock, getDisplayMediaMock, RTCPeerConnectionMock } = vi.hoisted(() => {
  // Stable participants used by default successful join-room response
  const PARTICIPANTS = [
    { user_id: 'u1', display_name: 'Local User' },
    { user_id: 'u2', display_name: 'Remote User' },
  ];

  // Mock for supabase.functions.invoke - default behavior handles common actions
  const mockInvoke = vi.fn(async (_fnName: string, opts?: any) => {
    const action = opts?.body?.action;
    if (action === 'join-room') {
      return { data: { participants: PARTICIPANTS }, error: null };
    }
    if (action === 'signal') {
      return { data: null, error: null };
    }
    if (action === 'update-participant') {
      return { data: null, error: null };
    }
    if (action === 'leave-room') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });

  // Channel subscribe object returned by subscribe()
  const channelObj = { id: 'visio-channel-1' };

  // Factory for channel builder: .on(...).subscribe()
  const mockChannelFactory = vi.fn(() => {
    return {
      on: (_eventType: string, _opts: any, _handler: (payload: any) => Promise<void> | void) => {
        // Return object that has subscribe() for chaining
        return {
          subscribe: () => channelObj,
        };
      },
      subscribe: () => channelObj,
    };
  });

  const mockRemoveChannel = vi.fn();

  // Toast mock
  const toastMock = vi.fn();

  // Stable fake media tracks used across calls
  const audioTrack = {
    kind: 'audio',
    enabled: true,
    stop: vi.fn(),
    onended: null as null | (() => void),
  };
  const videoTrack = {
    kind: 'video',
    enabled: true,
    stop: vi.fn(),
    onended: null as null | (() => void),
  };

  // Fake media stream with stable tracks
  const fakeStream = {
    getTracks: () => [audioTrack, videoTrack],
    getAudioTracks: () => [audioTrack],
    getVideoTracks: () => [videoTrack],
  };

  const getUserMediaMock = vi.fn(async (_constraints?: any) => fakeStream);
  const getDisplayMediaMock = vi.fn(async (_opts?: any) => {
    // screen stream: one video track that can trigger onended
    const screenTrack = { kind: 'video', enabled: true, stop: vi.fn(), onended: null as null | (() => void) };
    const screenStream = {
      getTracks: () => [screenTrack],
      getVideoTracks: () => [screenTrack],
      getAudioTracks: () => [],
    };
    return screenStream;
  });

  // Mock RTCPeerConnection
  class RTCPeerConnectionMock {
    connectionState: string;
    localDescription: any;
    onicecandidate: ((event: any) => void) | null;
    ontrack: ((event: any) => void) | null;
    onconnectionstatechange: (() => void) | null;
    constructor(_opts?: any) {
      this.connectionState = 'connected';
      this.localDescription = undefined;
      this.onicecandidate = null;
      this.ontrack = null;
      this.onconnectionstatechange = null;
      // spies
      this.addTrack = vi.fn();
      this.createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'sdp-offer' }));
      this.setLocalDescription = vi.fn(async (desc: any) => {
        // ensure toJSON exists
        this.localDescription = {
          toJSON: () => (desc && typeof desc === 'object' ? { ...(desc as any) } : { type: 'offer', sdp: 'sdp-offer' }),
        };
      });
      this.createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'sdp-answer' }));
      this.setRemoteDescription = vi.fn(async () => { /* noop */ });
      this.getSenders = vi.fn(() => [{ track: { kind: 'video' }, replaceTrack: vi.fn() }]);
      this.close = vi.fn();
      this.addIceCandidate = vi.fn(async () => { /* noop */ });
    }
    // placeholders to satisfy TypeScript checks - will be overwritten in constructor
    addTrack: (...args: any[]) => any;
    createOffer: () => Promise<any>;
    setLocalDescription: (d: any) => Promise<void>;
    createAnswer: () => Promise<any>;
    setRemoteDescription: (d: any) => Promise<void>;
    getSenders: () => any[];
    close: () => void;
    addIceCandidate: (candidate: any) => Promise<void>;
  }

  return {
    mockInvoke,
    mockChannelFactory,
    mockRemoveChannel,
    PARTICIPANTS,
    toastMock,
    getUserMediaMock,
    getDisplayMediaMock,
    RTCPeerConnectionMock,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
      channel: mockChannelFactory,
      removeChannel: mockRemoveChannel,
    },
  };
});

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: toastMock }),
  };
});

vi.mock('@/lib/debug', () => {
  return { debug: { log: vi.fn(), error: vi.fn() } };
});

vi.mock('@/lib/supabaseErrorSanitizer', () => {
  return { sanitizeSupabaseError: (err: unknown) => {
    if (err && typeof err === 'object' && 'message' in err) {
      // @ts-ignore
      return String(err.message);
    }
    return String(err ?? 'unknown');
  } };
});

// Ensure global navigator.mediaDevices and WebRTC globals are present and stable
Object.defineProperty(globalThis, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: getUserMediaMock,
      getDisplayMedia: getDisplayMediaMock,
    },
  },
  configurable: true,
});

Object.defineProperty(globalThis, 'RTCPeerConnection', {
  value: RTCPeerConnectionMock,
  configurable: true,
});

Object.defineProperty(globalThis, 'RTCSessionDescription', {
  value: class RTCSessionDescription {
    constructor(public init?: any) {
      return init;
    }
  },
  configurable: true,
});

Object.defineProperty(globalThis, 'RTCIceCandidate', {
  value: class RTCIceCandidate {
    constructor(public init?: any) {
      return init;
    }
  },
  configurable: true,
});

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWebRTC } from './useWebRTC';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
};

describe('useWebRTC hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connect success sets isConnected, participants and triggers signaling offers', async () => {
    const roomId = 'room-123';
    const userId = 'u1';
    const displayName = 'Tester';

    const { result } = renderHook(() =>
      useWebRTC({
        roomId,
        userId,
        displayName,
      }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);

    expect(Array.isArray(result.current.participants)).toBe(true);
    expect(result.current.participants.length).toBe(PARTICIPANTS.length);
    expect(result.current.participants[0]).toEqual(PARTICIPANTS[0]);
    expect(result.current.participants[1]).toEqual(PARTICIPANTS[1]);

    expect(mockInvoke).toHaveBeenCalledWith(
      'webrtc-signaling',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'join-room',
          roomId,
          displayName,
        }),
      })
    );

    expect(mockInvoke).toHaveBeenCalledWith(
      'webrtc-signaling',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'signal',
          signalType: 'offer',
          targetUserId: 'u2',
        }),
      })
    );
  });

  it('connect failure triggers toast with sanitized error', async () => {
    const roomId = 'room-err';
    const userId = 'u1';
    const displayName = 'TesterErr';

    mockInvoke.mockImplementationOnce(async (_fnName: string, opts?: any) => {
      const action = opts?.body?.action;
      if (action === 'join-room') {
        return { data: null, error: { message: 'simulated-join-error' } };
      }
      return { data: null, error: null };
    });

    const { result } = renderHook(() =>
      useWebRTC({
        roomId,
        userId,
        displayName,
      }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(false);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur de connexion',
        description: expect.stringContaining('simulated-join-error'),
        variant: 'destructive',
      })
    );
  });

  it('toggleMute updates mediaState and calls update-participant on server', async () => {
    const roomId = 'room-12';
    const userId = 'u1';
    const displayName = 'Mute';

    const { result } = renderHook(() =>
      useWebRTC({
        roomId,
        userId,
        displayName,
      }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.localStream).not.toBeNull();
    expect(result.current.mediaState.isMuted).toBe(false);

    mockInvoke.mockClear();

    await act(async () => {
      await result.current.toggleMute();
    });

    expect(result.current.mediaState.isMuted).toBe(true);

    expect(mockInvoke).toHaveBeenCalledWith(
      'webrtc-signaling',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'update-participant',
          roomId,
          isMuted: true,
        }),
      })
    );
  });
});