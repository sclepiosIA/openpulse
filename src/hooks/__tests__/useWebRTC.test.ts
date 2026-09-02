import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock RTCPeerConnection
vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(() => ({
  createOffer: vi.fn().mockResolvedValue({}),
  createAnswer: vi.fn().mockResolvedValue({}),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addTrack: vi.fn(),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  ontrack: null,
  onicecandidate: null,
  onconnectionstatechange: null,
  connectionState: 'new',
  getReceivers: () => [],
  getSenders: () => [],
})));

// Mock MediaStream
vi.stubGlobal('MediaStream', vi.fn().mockImplementation(() => ({
  getTracks: () => [],
  getVideoTracks: () => [],
  getAudioTracks: () => [],
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
})));

// Mock getUserMedia
const mockGetUserMedia = vi.fn().mockResolvedValue(new MediaStream());
vi.stubGlobal('navigator', {
  ...globalThis.navigator,
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: vi.fn().mockResolvedValue(new MediaStream()),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      unsubscribe: vi.fn(),
      send: vi.fn(),
      track: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'error',
}));

import { useWebRTC } from '../voice/useWebRTC';
import { supabase } from '@/integrations/supabase/client';

describe('useWebRTC', () => {
  beforeEach(() => vi.clearAllMocks());

  const defaultOpts = {
    roomId: 'room-1',
    userId: 'user-1',
    displayName: 'Test User',
  };

  it('initializes with disconnected state', () => {
    const { result } = renderHook(() => useWebRTC(defaultOpts));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.localStream).toBeNull();
  });

  it('provides media control functions', () => {
    const { result } = renderHook(() => useWebRTC(defaultOpts));
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.toggleMute).toBe('function');
    expect(typeof result.current.toggleVideo).toBe('function');
    expect(typeof result.current.toggleScreenShare).toBe('function');
  });

  it('provides media state', () => {
    const { result } = renderHook(() => useWebRTC(defaultOpts));
    expect(result.current.mediaState).toEqual({
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    });
  });

  it('provides participants list', () => {
    const { result } = renderHook(() => useWebRTC(defaultOpts));
    expect(result.current.participants).toEqual([]);
  });

  it('provides settings', () => {
    const { result } = renderHook(() => useWebRTC(defaultOpts));
    expect(result.current.settings).toEqual({
      videoQuality: 'medium',
      noiseSuppression: true,
      echoCancellation: true,
    });
  });
});
