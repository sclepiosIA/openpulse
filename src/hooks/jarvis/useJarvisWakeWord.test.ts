const { mockDebug, DEFAULT_WAKE_WORDS, ALT_WAKE_WORDS } = vi.hoisted(() => ({
  mockDebug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  DEFAULT_WAKE_WORDS: ['jarvis', 'hey jarvis'] as string[],
  ALT_WAKE_WORDS: ['athena'] as string[],
}));

vi.mock('@/lib/debug', () => ({
  debug: mockDebug,
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useJarvisWakeWord } from './useJarvisWakeWord';

interface MockRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface MockRecognitionEvent {
  resultIndex: number;
  results: MockRecognitionResult[];
}

interface MockRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionLikeForTest {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: MockRecognitionErrorEvent) => void) | null;
  onresult: ((event: MockRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtorForTest = new () => SpeechRecognitionLikeForTest;

const instances: MockSpeechRecognition[] = [];

class MockSpeechRecognition implements SpeechRecognitionLikeForTest {
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: MockRecognitionErrorEvent) => void) | null = null;
  onresult: ((event: MockRecognitionEvent) => void) | null = null;

  start = vi.fn(() => {
    const onstart = this.onstart;
    if (onstart) {
      onstart();
    }
  });

  stop = vi.fn();

  constructor() {
    instances.push(this);
  }
}

const makeEvent = (transcript: string, isFinal: boolean): MockRecognitionEvent => ({
  resultIndex: 0,
  results: [{ isFinal, 0: { transcript } }],
});

const getRecognition = (index = 0): MockSpeechRecognition => {
  const recognition = instances[index];
  if (recognition === undefined) {
    throw new Error('Instance de reconnaissance manquante');
  }
  return recognition;
};

const speechWindow = (): Window & {
  SpeechRecognition?: SpeechRecognitionCtorForTest;
  webkitSpeechRecognition?: SpeechRecognitionCtorForTest;
} => window as Window & {
  SpeechRecognition?: SpeechRecognitionCtorForTest;
  webkitSpeechRecognition?: SpeechRecognitionCtorForTest;
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useJarvisWakeWord', () => {
  beforeEach(() => {
    instances.length = 0;
    vi.clearAllMocks();
    speechWindow().SpeechRecognition = MockSpeechRecognition;
    delete speechWindow().webkitSpeechRecognition;
  });

  afterEach(() => {
    delete speechWindow().SpeechRecognition;
    delete speechWindow().webkitSpeechRecognition;
    vi.clearAllMocks();
  });

  it('expose un état initial inactif', () => {
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isListening).toBe(false);
    expect(result.current.isDetected).toBe(false);
    expect(result.current.confidence).toBe(0);
    expect(typeof result.current.startListening).toBe('function');
    expect(typeof result.current.stopListening).toBe('function');
    expect(typeof result.current.resetDetection).toBe('function');
  });

  it('ne démarre pas et journalise un warning quand la Web Speech API est absente', () => {
    delete speechWindow().SpeechRecognition;
    delete speechWindow().webkitSpeechRecognition;

    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    expect(instances).toHaveLength(0);
    expect(result.current.isListening).toBe(false);
    expect(mockDebug.warn).toHaveBeenCalledTimes(1);
    expect(mockDebug.warn).toHaveBeenCalledWith('[WakeWord] Speech recognition not supported');
  });

  it('démarre la reconnaissance continue en français au startListening', () => {
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    expect(instances).toHaveLength(1);
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe('fr-FR');
    expect(result.current.isListening).toBe(true);
    expect(mockDebug.log).toHaveBeenCalledWith('[WakeWord] Recognition started - listening for wake word');
  });

  it('détecte "hey jarvis" final avec confiance 0.95, déclenche onWakeUp et stoppe la reconnaissance', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS, onWakeUp }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('hey jarvis allume la lumière', true));
      }
    });

    expect(result.current.isDetected).toBe(true);
    expect(result.current.confidence).toBe(0.95);
    expect(onWakeUp).toHaveBeenCalledTimes(1);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(mockDebug.log).toHaveBeenCalledWith(
      '[WakeWord] Wake word detected!',
      'hey jarvis allume la lumière',
      'confidence:',
      0.95
    );
  });

  it('détecte une variation de pattern "harvis" avec confiance 0.85 quand les wake words personnalisés ne matchent pas', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: ALT_WAKE_WORDS, onWakeUp }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('salut harvis', true));
      }
    });

    expect(result.current.isDetected).toBe(true);
    expect(result.current.confidence).toBe(0.85);
    expect(onWakeUp).toHaveBeenCalledTimes(1);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  it('détecte une approximation floue "javis" avec confiance 0.7', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: ALT_WAKE_WORDS, onWakeUp }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('salut javis', true));
      }
    });

    expect(result.current.isDetected).toBe(true);
    expect(result.current.confidence).toBe(0.7);
    expect(onWakeUp).toHaveBeenCalledTimes(1);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  it('ignore une phrase sans wake word', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS, onWakeUp }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('bonjour tout le monde il fait beau', true));
      }
    });

    expect(result.current.isDetected).toBe(false);
    expect(result.current.confidence).toBe(0);
    expect(onWakeUp).not.toHaveBeenCalled();
    expect(recognition.stop).not.toHaveBeenCalled();
  });

  it('en sensibilité low, exige 2 détections intermédiaires avant de déclencher', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS, onWakeUp, sensitivity: 'low' }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('jarvis', false));
      }
    });

    expect(result.current.isDetected).toBe(false);
    expect(result.current.confidence).toBe(0.95);
    expect(onWakeUp).not.toHaveBeenCalled();
    expect(recognition.stop).not.toHaveBeenCalled();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('jarvis', false));
      }
    });

    expect(result.current.isDetected).toBe(true);
    expect(result.current.confidence).toBe(0.95);
    expect(onWakeUp).toHaveBeenCalledTimes(1);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  it('stopListening arrête la reconnaissance et passe isListening à false', () => {
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stopListening();
    });

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isListening).toBe(false);
  });

  it('resetDetection remet isDetected et confidence à zéro après une détection', () => {
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onresult = recognition.onresult;
      if (onresult) {
        onresult(makeEvent('ok jarvis', true));
      }
    });

    expect(result.current.isDetected).toBe(true);
    expect(result.current.confidence).toBe(0.95);

    act(() => {
      result.current.resetDetection();
    });

    expect(result.current.isDetected).toBe(false);
    expect(result.current.confidence).toBe(0);
  });

  it('démarre automatiquement l’écoute quand autoStart est actif et stoppe au démontage', async () => {
    const { result, unmount } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS, autoStart: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isListening).toBe(true);
    });

    const recognition = getRecognition();

    expect(instances).toHaveLength(1);
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.continuous).toBe(true);
    expect(recognition.lang).toBe('fr-FR');

    unmount();

    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  it('journalise les erreurs de reconnaissance sauf no-speech et aborted', () => {
    const { result } = renderHook(
      () => useJarvisWakeWord({ wakeWords: DEFAULT_WAKE_WORDS }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.startListening();
    });

    const recognition = getRecognition();

    act(() => {
      const onerror = recognition.onerror;
      if (onerror) {
        onerror({ error: 'network' });
        onerror({ error: 'no-speech' });
        onerror({ error: 'aborted' });
      }
    });

    expect(mockDebug.warn).toHaveBeenCalledTimes(1);
    expect(mockDebug.warn).toHaveBeenCalledWith('[WakeWord] Recognition error:', 'network');
  });
});