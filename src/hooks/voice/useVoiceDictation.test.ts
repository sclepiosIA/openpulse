/* @vitest-environment jsdom */

import { createElement, type PropsWithChildren } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVoiceDictation } from './useVoiceDictation';

const {
  toastMock,
  invokeMock,
  mockFrom,
  debugLogMock,
  debugErrorMock,
  emptyQueryResult,
  transcriptionSuccessResponse,
  transcriptionFailureResponse,
  defaultInvokeResponse,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  invokeMock: vi.fn(),
  mockFrom: vi.fn(),
  debugLogMock: vi.fn(),
  debugErrorMock: vi.fn(),
  emptyQueryResult: { data: null, error: null },
  transcriptionSuccessResponse: { data: { text: 'Texte transcrit' }, error: null },
  transcriptionFailureResponse: { data: null, error: new Error('x') },
  defaultInvokeResponse: { data: null, error: null },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/integrations/supabase/client', () => {
  type QueryResult = typeof emptyQueryResult;
  type Fulfilled = (value: QueryResult) => unknown;
  type Rejected = (reason: unknown) => unknown;
  type SupabaseBuilder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    gt: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: Fulfilled | null, onRejected?: Rejected | null) => Promise<unknown>;
    catch: (onRejected?: Rejected | null) => Promise<unknown>;
  };

  let builder: SupabaseBuilder;

  builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => emptyQueryResult),
    maybeSingle: vi.fn(async () => emptyQueryResult),
    then: (onFulfilled?: Fulfilled | null, onRejected?: Rejected | null) =>
      Promise.resolve(emptyQueryResult).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: Rejected | null) =>
      Promise.resolve(emptyQueryResult).catch(onRejected ?? undefined),
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
      functions: {
        invoke: invokeMock,
      },
    },
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLogMock,
    error: debugErrorMock,
  },
}));

type RecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type RecognitionResult = {
  isFinal: boolean;
  length: number;
  0: RecognitionAlternative;
  item: (index: number) => RecognitionAlternative;
};

type RecognitionEvent = {
  resultIndex: number;
  results: RecognitionResult[];
};

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: RecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn(() => {
    this.onend?.();
  });
  abort = vi.fn();
  addEventListener = vi.fn((_type: string, _callback: EventListenerOrEventListenerObject) => undefined);
  removeEventListener = vi.fn((_type: string, _callback: EventListenerOrEventListenerObject) => undefined);
  dispatchEvent = vi.fn((_event: Event) => true);

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn((type: string) => type === 'audio/webm');

  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.onstop?.();
  });

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
    MockMediaRecorder.instances.push(this);
  }
}

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;

  readAsDataURL(_blob: Blob) {
    this.result = 'data:audio/webm;base64,abc';
    this.onloadend?.();
  }
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const createRecognitionResult = (transcript: string, isFinal: boolean): RecognitionResult => ({
  isFinal,
  length: 1,
  0: { transcript, confidence: isFinal ? 0.95 : 0.9 },
  item: (index: number) => ({
    transcript: index === 0 ? transcript : '',
    confidence: isFinal ? 0.95 : 0.9,
  }),
});

const removeWebSpeechSupport = () => {
  Reflect.deleteProperty(window, 'SpeechRecognition');
  Reflect.deleteProperty(window, 'webkitSpeechRecognition');
};

describe('useVoiceDictation', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>;
  let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
  let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;
  let trackStopMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    MockSpeechRecognition.instances = [];
    MockMediaRecorder.instances = [];
    invokeMock.mockResolvedValue(defaultInvokeResponse);

    trackStopMock = vi.fn();

    getUserMediaMock = vi.fn(async () => ({
      getTracks: () => [{ stop: trackStopMock }],
    }));

    requestAnimationFrameMock = vi.fn((_callback: FrameRequestCallback) => 1);
    cancelAnimationFrameMock = vi.fn();

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      },
      configurable: true,
    });

    Object.defineProperty(window, 'SpeechRecognition', {
      value: MockSpeechRecognition,
      configurable: true,
      writable: true,
    });

    Reflect.deleteProperty(window, 'webkitSpeechRecognition');

    Object.defineProperty(globalThis, 'MediaRecorder', {
      value: MockMediaRecorder,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'MediaRecorder', {
      value: MockMediaRecorder,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'FileReader', {
      value: MockFileReader,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'FileReader', {
      value: MockFileReader,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      value: requestAnimationFrameMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'requestAnimationFrame', {
      value: requestAnimationFrameMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      value: cancelAnimationFrameMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: cancelAnimationFrameMock,
      configurable: true,
      writable: true,
    });

    const AudioContextMock = class {
      createMediaStreamSource(_stream: MediaStream) {
        return {
          connect: vi.fn(),
        };
      }

      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 4,
          getByteFrequencyData: (arr: Uint8Array) => {
            arr[0] = 255;
            arr[1] = 255;
            arr[2] = 255;
            arr[3] = 255;
          },
        };
      }
    };

    Object.defineProperty(globalThis, 'AudioContext', {
      value: AudioContextMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'AudioContext', {
      value: AudioContextMock,
      configurable: true,
      writable: true,
    });
  });

  it('expose les états initiaux puis démarre en mode Web Speech avec la langue demandée', async () => {
    const onTranscript = vi.fn();
    const onInterimTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
          onInterimTranscript,
          language: 'fr-FR',
        }),
      { wrapper }
    );

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.audioLevel).toBe(0);
    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      result.current.startRecording();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
      expect(result.current.audioLevel).toBe(1);
    });

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition).toBeDefined();
    if (recognition === undefined) {
      throw new Error('SpeechRecognition non instancié');
    }

    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe('fr-FR');
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
    expect(debugLogMock).toHaveBeenCalledWith('[VoiceDictation] Started');
  });

  it('traite les transcripts intermédiaires et finaux du Web Speech API', async () => {
    const onTranscript = vi.fn();
    const onInterimTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
          onInterimTranscript,
          language: 'fr-FR',
        }),
      { wrapper }
    );

    await act(async () => {
      result.current.startRecording();
      await Promise.resolve();
    });

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition).toBeDefined();
    if (recognition === undefined) {
      throw new Error('SpeechRecognition non instancié');
    }

    await act(async () => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [
          createRecognitionResult('bonjour ', false),
          createRecognitionResult('le monde', true),
        ],
      });
    });

    expect(onInterimTranscript).toHaveBeenCalledTimes(1);
    expect(onInterimTranscript).toHaveBeenCalledWith('bonjour ');
    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('le monde');
  });

  it('gère l’erreur not-allowed du Web Speech avec toast et message métier', async () => {
    const onTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
        }),
      { wrapper }
    );

    await act(async () => {
      result.current.startRecording();
      await Promise.resolve();
    });

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition).toBeDefined();
    if (recognition === undefined) {
      throw new Error('SpeechRecognition non instancié');
    }

    await act(async () => {
      recognition.onerror?.({ error: 'not-allowed' });
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBe('Permission micro refusée');
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Permission refusée',
      description: "Autorisez l'accès au microphone pour la dictée vocale",
      variant: 'destructive',
    });
    expect(debugErrorMock).toHaveBeenCalledWith('[VoiceDictation] Error:', 'not-allowed');
  });

  it('arrête Web Speech proprement et stoppe le flux micro', async () => {
    const onTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
        }),
      { wrapper }
    );

    await act(async () => {
      result.current.startRecording();
      await Promise.resolve();
    });

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition).toBeDefined();
    if (recognition === undefined) {
      throw new Error('SpeechRecognition non instancié');
    }

    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioLevel).toBe(0);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(trackStopMock).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1);
    expect(debugLogMock).toHaveBeenCalledWith('[VoiceDictation] Ended');
  });

  it('bascule en fallback Whisper, transcrit avec Supabase Functions puis arrête proprement', async () => {
    removeWebSpeechSupport();
    invokeMock.mockResolvedValue(transcriptionSuccessResponse);

    const onTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
          language: 'fr-FR',
        }),
      { wrapper }
    );

    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.error).toBeNull();
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });

    await waitFor(() => {
      expect(result.current.audioLevel).toBe(1);
    });

    const mediaRecorder = MockMediaRecorder.instances[0];
    expect(mediaRecorder).toBeDefined();
    if (mediaRecorder === undefined) {
      throw new Error('MediaRecorder non instancié');
    }

    expect(mediaRecorder.mimeType).toBe('audio/webm');
    expect(mediaRecorder.start).toHaveBeenCalledWith(1000);

    await act(async () => {
      await result.current.stopRecording();
    });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioLevel).toBe(0);
    expect(trackStopMock).toHaveBeenCalledTimes(1);
    expect(mediaRecorder.stop).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('transcribe-audio', {
      body: { audio: 'abc', language: 'fr-FR' },
    });
    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('Texte transcrit');
  });

  it('gère une erreur de transcription Whisper et expose le message d’erreur', async () => {
    removeWebSpeechSupport();
    invokeMock.mockResolvedValue(transcriptionFailureResponse);

    const onTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
          language: 'fr-FR',
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBe('x');
    expect(onTranscript).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('transcribe-audio', {
      body: { audio: 'abc', language: 'fr-FR' },
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur de transcription',
      description: 'x',
      variant: 'destructive',
    });
    expect(debugErrorMock).toHaveBeenCalledWith('[VoiceDictation] Transcription error:', transcriptionFailureResponse.error);
  });

  it('affiche une erreur si le fallback Whisper ne peut pas accéder au micro', async () => {
    removeWebSpeechSupport();
    getUserMediaMock.mockRejectedValue(new Error('micro indisponible'));

    const onTranscript = vi.fn();
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useVoiceDictation({
          onTranscript,
        }),
      { wrapper }
    );

    let started = true;

    await act(async () => {
      started = await result.current.startRecording();
    });

    expect(started).toBe(false);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBe('micro indisponible');
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: "Impossible d'accéder au microphone",
      variant: 'destructive',
    });
    expect(invokeMock).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
  });
});