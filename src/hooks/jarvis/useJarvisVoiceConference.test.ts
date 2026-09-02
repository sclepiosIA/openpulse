import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const {
  mockInvoke,
  mockToast,
  mockUser,
  AGENT_VOICE_MAP,
  JARVIS_AGENTS,
  getRandomHandoffPhrase,
  mockDebugLog,
  mockDebugWarn,
  mockDebugError,
  MockAudio,
  audioInstances,
  mockAudioPausedCount,
  mockSpeechCancel,
  mockSpeechSpeak,
  mockCrypto,
} = vi.hoisted(() => {
  const mockInvoke = vi.fn(async (fn: string, opts?: any) => {
    if (fn === 'jarvis-tts') {
      return { data: { audioUrl: `https://audio.example/${Date.now()}.mp3` }, error: null };
    }
    if (fn === 'jarvis-brain') {
      const agentId = opts?.body?.agent_id;
      return { data: { response: `${agentId} response` }, error: null };
    }
    return { data: null, error: { message: 'unknown function' } };
  });

  const mockToast = vi.fn();

  const mockUser = { id: 'user-unique-01', email: 'user@test.example' };

  const AGENT_VOICE_MAP = {
    sophia: 'voice-sophia',
    marcus: 'voice-marcus',
    olivia: 'voice-olivia',
    noah: 'voice-noah',
    emma: 'voice-emma',
    alex: 'voice-alex',
    prime: 'voice-prime',
  } as Record<string, string>;

  const JARVIS_AGENTS = {
    sophia: { name: 'Sophia', shortDescription: 'Lead' },
    marcus: { name: 'Marcus', shortDescription: 'Dev' },
    olivia: { name: 'Olivia', shortDescription: 'Designer' },
    noah: { name: 'Noah', shortDescription: 'Ops' },
    emma: { name: 'Emma', shortDescription: 'PM' },
    alex: { name: 'Alex', shortDescription: 'QA' },
  } as Record<string, { name: string; shortDescription: string }>;

  const getRandomHandoffPhrase = vi.fn((agentId: string) => `À toi ${agentId}`);

  const mockDebugLog = vi.fn();
  const mockDebugWarn = vi.fn();
  const mockDebugError = vi.fn();

  const audioInstances: any[] = [];
  let mockAudioPausedCount = 0;

  class MockAudio {
    src = '';
    listeners: Record<string, Function[]> = {};
    paused = false;
    constructor() {
      this.src = '';
      this.listeners = {};
      this.paused = false;
      audioInstances.push(this);
    }
    play() {
      return Promise.resolve().then(() => {
        // give listeners a chance to be attached, then fire ended
        setTimeout(() => {
          (this.listeners['ended'] || []).forEach((fn) => fn());
        }, 0);
      });
    }
    pause() {
      this.paused = true;
      this.src = '';
      mockAudioPausedCount++;
    }
    addEventListener(name: string, fn: Function) {
      this.listeners[name] = (this.listeners[name] || []).concat(fn);
    }
    removeEventListener(name: string, fn: Function) {
      const arr = this.listeners[name] || [];
      this.listeners[name] = arr.filter((f) => f !== fn);
    }
  }

  const mockSpeechCancel = vi.fn();
  const mockSpeechSpeak = vi.fn((utterance: any) => {
    setTimeout(() => {
      if (typeof utterance.onend === 'function') utterance.onend();
    }, 0);
  });

  const mockCrypto = { randomUUID: vi.fn(() => 'uuid-unique-0001') };

  return {
    mockInvoke,
    mockToast,
    mockUser,
    AGENT_VOICE_MAP,
    JARVIS_AGENTS,
    getRandomHandoffPhrase,
    mockDebugLog,
    mockDebugWarn,
    mockDebugError,
    MockAudio,
    audioInstances,
    mockAudioPausedCount,
    mockSpeechCancel,
    mockSpeechSpeak,
    mockCrypto,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

vi.mock('@/hooks/shared/useAuth', () => {
  return {
    useAuth: () => ({ user: mockUser }),
  };
});

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('@/lib/debug', () => {
  return {
    debug: {
      log: mockDebugLog,
      warn: mockDebugWarn,
      error: mockDebugError,
    },
  };
});

vi.mock('@/lib/jarvis-agents-config', () => {
  return {
    AGENT_VOICE_MAP,
    JARVIS_AGENTS,
    getRandomHandoffPhrase,
  };
});

// Stable global replacements
vi.stubGlobal('Audio', MockAudio as unknown);
vi.stubGlobal('speechSynthesis', { speak: mockSpeechSpeak, cancel: mockSpeechCancel });
vi.stubGlobal('crypto', mockCrypto as unknown);

import { useJarvisVoiceConference } from './useJarvisVoiceConference';

describe('useJarvisVoiceConference', () => {
  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children as React.ReactNode);
  };

  beforeEach(() => {
    mockInvoke.mockClear();
    mockToast.mockClear();
    mockDebugLog.mockClear();
    mockDebugWarn.mockClear();
    mockDebugError.mockClear();
    (mockCrypto.randomUUID as vi.Mock).mockClear();
    (mockCrypto.randomUUID as vi.Mock).mockImplementation(() => 'uuid-unique-0001');

    mockInvoke.mockImplementation(async (fn: string, opts?: any) => {
      if (fn === 'jarvis-tts') {
        return { data: { audioUrl: `https://audio.example/${opts?.body?.agentId || 'prime'}.mp3` }, error: null };
      }
      if (fn === 'jarvis-brain') {
        const agentId = opts?.body?.agent_id;
        return { data: { response: `${agentId} response` }, error: null };
      }
      return { data: null, error: { message: 'unknown function' } };
    });

    audioInstances.length = 0;
    mockSpeechCancel.mockClear();
    mockSpeechSpeak.mockClear();
  });

  it('starts a conference and completes with expected participant responses and audio played', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisVoiceConference(), { wrapper });

    await act(async () => {
      await result.current.startConference('Sprint Planning', ['sophia', 'marcus']);
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.status).toBe('completed');
    expect(result.current.currentSpeaker).toBeNull();
    expect(result.current.isConferenceActive).toBe(false);

    const participants = result.current.session?.participants || [];
    expect(participants).toHaveLength(2);
    expect(participants[0].agentId).toBe('sophia');
    expect(participants[0].response).toBe('sophia response');
    expect(participants[1].agentId).toBe('marcus');
    expect(participants[1].response).toBe('marcus response');

    const calledFns = mockInvoke.mock.calls.map((call) => call[0]);
    expect(calledFns).toContain('jarvis-brain');
    expect(calledFns).toContain('jarvis-tts');

    expect(audioInstances.length).toBeGreaterThanOrEqual(1);
    const lastAudio = audioInstances[audioInstances.length - 1];
    expect(typeof lastAudio.src).toBe('string');
    expect(lastAudio.src).toContain('.mp3');

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('handles agent brain error by using fallback response string', async () => {
    mockInvoke.mockImplementation(async (fn: string, opts?: any) => {
      if (fn === 'jarvis-tts') {
        return { data: { audioUrl: `https://audio.example/${opts?.body?.agentId || 'prime'}.mp3` }, error: null };
      }
      if (fn === 'jarvis-brain') {
        const agentId = opts?.body?.agent_id;
        if (agentId === 'marcus') {
          return { data: null, error: { message: 'brain failure' } };
        }
        return { data: { response: `${agentId} response` }, error: null };
      }
      return { data: null, error: { message: 'unknown function' } };
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisVoiceConference(), { wrapper });

    await act(async () => {
      await result.current.startConference('Retrospective', ['sophia', 'marcus']);
    });

    const participants = result.current.session?.participants || [];
    expect(participants).toHaveLength(2);
    expect(participants[0].response).toBe('sophia response');
    expect(participants[1].response).toBe("Désolé, je n'ai pas pu analyser ce sujet pour le moment.");
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('stopConference aborts and clears session, stops audio and cancels speech synthesis', async () => {
    mockInvoke.mockImplementation(async (fn: string, opts?: any) => {
      if (fn === 'jarvis-tts') {
        return { data: { audioUrl: `https://audio.example/long-running-${opts?.body?.agentId || 'prime'}.mp3` }, error: null };
      }
      if (fn === 'jarvis-brain') {
        const agentId = opts?.body?.agent_id;
        return { data: { response: `${agentId} response` }, error: null };
      }
      return { data: null, error: { message: 'unknown function' } };
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useJarvisVoiceConference(), { wrapper });

    await act(async () => {
      const startPromise = result.current.startConference('Emergency', ['sophia', 'marcus']);
      await new Promise((r) => setTimeout(r, 0));
      result.current.stopConference();
      await startPromise;
    });

    expect(result.current.session).toBeNull();
    expect(result.current.currentSpeaker).toBeNull();

    expect(audioInstances.length).toBeGreaterThanOrEqual(1);
    const anyPaused = audioInstances.some((a) => a.paused === true || a.src === '');
    expect(anyPaused).toBe(true);

    expect(mockSpeechCancel).toHaveBeenCalled();
    expect(mockDebugLog).toHaveBeenCalled();
  });
});