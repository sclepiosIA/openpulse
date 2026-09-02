import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisVoice } from './useJarvisVoice';

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface FakeResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface FakeResultEvent {
  resultIndex: number;
  results: FakeResult[];
}
interface FakeErrorEvent {
  error: string;
}

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: FakeErrorEvent) => void) | null = null;
  onresult: ((event: FakeResultEvent) => void) | null = null;
  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn();
  constructor() {
    recognitionInstances.push(this);
  }
}

const recognitionInstances: FakeRecognition[] = [];

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const FRENCH_VOICES = [
  { lang: 'fr-FR', name: 'Google français' },
] as unknown as SpeechSynthesisVoice[];

const mockSpeak = vi.fn((utterance: FakeUtterance) => {
  utterance.onstart?.();
  utterance.onend?.();
});
const mockCancel = vi.fn();
const mockGetVoices = vi.fn(() => FRENCH_VOICES);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function fireResult(recognition: FakeRecognition, transcript: string) {
  recognition.onresult?.({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript } }],
  });
}

beforeEach(() => {
  recognitionInstances.length = 0;
  mockSpeak.mockClear();
  mockCancel.mockClear();
  mockGetVoices.mockClear();

  Object.defineProperty(window, 'SpeechRecognition', {
    value: FakeRecognition,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: mockGetVoices,
      onvoiceschanged: null,
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    writable: true,
    configurable: true,
  });
});

describe('useJarvisVoice', () => {
  it('retourne un état initial inactif', () => {
    const { result } = renderHook(() => useJarvisVoice(), { wrapper: createWrapper() });

    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isAwake).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.lastCommand).toBeNull();
  });

  it('startListening crée une recognition configurée et passe isListening à true', () => {
    const { result } = renderHook(() => useJarvisVoice({ language: 'fr-FR' }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startListening();
    });

    expect(recognitionInstances).toHaveLength(1);
    const recognition = recognitionInstances[0];
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.continuous).toBe(false);
    expect(recognition.interimResults).toBe(false);
    expect(recognition.lang).toBe('fr-FR');
    expect(result.current.isListening).toBe(true);
  });

  it('stopListening arrête la recognition et remet isListening à false', () => {
    const { result } = renderHook(() => useJarvisVoice(), { wrapper: createWrapper() });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      result.current.stopListening();
    });

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isListening).toBe(false);
  });

  it('détecte le wake word, réveille Jarvis et parse la commande approve', async () => {
    const onCommand = vi.fn();
    const onWakeUp = vi.fn();
    const { result } = renderHook(() => useJarvisVoice({ onCommand, onWakeUp }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      fireResult(recognition, 'Jarvis approuve cette action');
    });

    await waitFor(() => {
      expect(result.current.isAwake).toBe(true);
    });
    expect(onWakeUp).toHaveBeenCalledTimes(1);
    expect(result.current.transcript).toBe('Jarvis approuve cette action');
    expect(result.current.lastCommand).toEqual({ type: 'approve' });
    expect(onCommand).toHaveBeenCalledWith({ type: 'approve' });
  });

  it('extrait le détail "sources" pour une commande de lecture', async () => {
    const onCommand = vi.fn();
    const { result } = renderHook(() => useJarvisVoice({ onCommand }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      fireResult(recognition, 'Jarvis lis les sources');
    });

    await waitFor(() => {
      expect(result.current.lastCommand).toEqual({ type: 'read', what: 'sources' });
    });
    expect(onCommand).toHaveBeenCalledWith({ type: 'read', what: 'sources' });
  });

  it('retombe sur une commande ask avec la query pour un texte libre', async () => {
    const onCommand = vi.fn();
    const { result } = renderHook(() => useJarvisVoice({ onCommand }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      fireResult(recognition, 'Jarvis quelle heure est-il');
    });

    await waitFor(() => {
      expect(result.current.lastCommand).toEqual({ type: 'ask', query: 'quelle heure est-il' });
    });
  });

  it('traite une commande directe quand Jarvis est déjà réveillé, sans wake word', async () => {
    const onCommand = vi.fn();
    const { result } = renderHook(() => useJarvisVoice({ onCommand }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setIsAwake(true);
    });
    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      fireResult(recognition, 'rejette cette action');
    });

    await waitFor(() => {
      expect(result.current.lastCommand).toEqual({ type: 'reject' });
    });
    expect(onCommand).toHaveBeenCalledWith({ type: 'reject' });
  });

  it('ignore le texte sans wake word quand Jarvis dort', async () => {
    const onCommand = vi.fn();
    const onWakeUp = vi.fn();
    const { result } = renderHook(() => useJarvisVoice({ onCommand, onWakeUp }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      fireResult(recognition, 'bonjour tout le monde');
    });

    await waitFor(() => {
      expect(result.current.transcript).toBe('bonjour tout le monde');
    });
    expect(result.current.isAwake).toBe(false);
    expect(result.current.lastCommand).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    expect(onWakeUp).not.toHaveBeenCalled();
  });

  it('arrête l\'écoute sur une erreur fatale de reconnaissance', () => {
    const { result } = renderHook(() => useJarvisVoice(), { wrapper: createWrapper() });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];
    expect(result.current.isListening).toBe(true);

    act(() => {
      recognition.onerror?.({ error: 'not-allowed' });
    });

    expect(result.current.isListening).toBe(false);
  });

  it('reste en écoute sur une erreur no-speech (non fatale)', () => {
    const { result } = renderHook(() => useJarvisVoice(), { wrapper: createWrapper() });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];

    act(() => {
      recognition.onerror?.({ error: 'no-speech' });
    });

    expect(result.current.isListening).toBe(true);
  });

  it('speak annule la synthèse en cours, prononce le texte avec la voix française et la vitesse configurée', async () => {
    const { result } = renderHook(() => useJarvisVoice({ voiceSpeed: 1.5, language: 'fr-FR' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.speak('Bonjour monsieur');
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe('Bonjour monsieur');
    expect(utterance.lang).toBe('fr-FR');
    expect(utterance.rate).toBe(1.5);
    expect(utterance.voice).toBe(FRENCH_VOICES[0]);
    expect(result.current.isSpeaking).toBe(false);
  });

  it('stopSpeaking annule la synthèse et remet isSpeaking à false', () => {
    const { result } = renderHook(() => useJarvisVoice(), { wrapper: createWrapper() });

    act(() => {
      result.current.stopSpeaking();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('nettoie la recognition et la synthèse au démontage', () => {
    const { result, unmount } = renderHook(() => useJarvisVoice(), { wrapper: createWrapper() });

    act(() => {
      result.current.startListening();
    });
    const recognition = recognitionInstances[0];
    mockCancel.mockClear();

    unmount();

    expect(recognition.stop).toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();
  });
});