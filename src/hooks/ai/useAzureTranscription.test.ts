import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  PARTICIPANTS,
  mockFrom,
  mockInvoke,
  mockToast,
  mockChannel,
  mockRemoveChannel,
  mockDebug,
} = vi.hoisted(() => {
  const PARTICIPANTS = [
    {
      id: 'p1',
      session_id: 'sess-1',
      user_id: 'u1',
      display_name: 'Alice',
      joined_at: '2024-01-01T10:00:00Z',
      left_at: null,
      is_transcribing: false,
    },
  ];

  type Resolver = (v: { data: unknown; error: unknown }) => unknown;

  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: Resolver, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: PARTICIPANTS, error: null }).then(resolve, reject);
  builder.catch = (reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: PARTICIPANTS, error: null }).catch(reject);

  const mockFrom = vi.fn(() => builder);
  const mockInvoke = vi.fn(() =>
    Promise.resolve({ data: { success: true }, error: null })
  );
  const mockToast = vi.fn();

  const channelObj: Record<string, unknown> = {};
  channelObj.on = vi.fn(() => channelObj);
  channelObj.subscribe = vi.fn(() => channelObj);
  const mockChannel = vi.fn(() => channelObj);
  const mockRemoveChannel = vi.fn();

  const mockDebug = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    PARTICIPANTS,
    mockFrom,
    mockInvoke,
    mockToast,
    mockChannel,
    mockRemoveChannel,
    mockDebug,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: mockDebug,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { useAzureTranscription } from './useAzureTranscription';

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
  }
}

const trackStop = vi.fn();
const mockGetUserMedia = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const defaultOptions = {
  sessionId: 'sess-1',
  userId: 'u1',
  displayName: 'Alice',
  language: 'fr',
};

describe('useAzureTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
      writable: true,
    });
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expose un état initial correct et charge les participants', async () => {
    const { result } = renderHook(() => useAzureTranscription(defaultOptions), {
      wrapper: createWrapper(),
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.segments).toEqual([]);
    expect(result.current.currentText).toBe('');
    expect(result.current.error).toBeNull();
    expect(result.current.azureConfigured).toBe(true);

    await waitFor(() => {
      expect(result.current.participants).toEqual(PARTICIPANTS);
    });

    expect(mockFrom).toHaveBeenCalledWith('visio_transcription_participants');
    expect(mockChannel).toHaveBeenCalledWith('transcription-segments:sess-1');
    expect(mockChannel).toHaveBeenCalledWith('transcription-participants:sess-1');
  });

  it('démarre l\'enregistrement avec succès et notifie le backend', async () => {
    const { result } = renderHook(() => useAzureTranscription(defaultOptions), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith('visio-transcription-session', {
      body: {
        action: 'update-transcribing',
        sessionId: 'sess-1',
        userId: 'u1',
        isTranscribing: true,
      },
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Transcription démarrée',
      description: 'Votre voix est maintenant transcrite en temps réel.',
    });
  });

  it('gère le refus d\'accès au microphone (NotAllowedError)', async () => {
    const deniedError = new Error('Permission denied');
    deniedError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValueOnce(deniedError);

    const { result } = renderHook(() => useAzureTranscription(defaultOptions), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBe(
      'Accès au microphone refusé. Veuillez autoriser l\'accès.'
    );

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Accès au microphone refusé. Veuillez autoriser l\'accès.',
      variant: 'destructive',
    });
  });

  it('gère l\'absence de microphone (NotFoundError)', async () => {
    const notFoundError = new Error('No device');
    notFoundError.name = 'NotFoundError';
    mockGetUserMedia.mockRejectedValueOnce(notFoundError);

    const { result } = renderHook(() => useAzureTranscription(defaultOptions), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe('Aucun microphone trouvé.');
    expect(result.current.isRecording).toBe(false);
  });

  it('arrête l\'enregistrement, coupe le micro et notifie le backend', async () => {
    const { result } = renderHook(() => useAzureTranscription(defaultOptions), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    mockInvoke.mockClear();

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(trackStop).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('visio-transcription-session', {
      body: {
        action: 'update-transcribing',
        sessionId: 'sess-1',
        userId: 'u1',
        isTranscribing: false,
      },
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.currentText).toBe('');

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Transcription arrêtée',
      description: 'Votre microphone a été désactivé.',
    });
  });

  it('nettoie les channels realtime au démontage', async () => {
    const { result, unmount } = renderHook(
      () => useAzureTranscription(defaultOptions),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.participants).toEqual(PARTICIPANTS);
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(2);
  });
});