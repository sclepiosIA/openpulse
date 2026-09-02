import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('useJarvisVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct defaults', async () => {
    const { useJarvisVoice } = await import('@/hooks/jarvis/useJarvisVoice');
    const { result } = renderHook(() => useJarvisVoice());

    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isAwake).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.lastCommand).toBeNull();
  });

  it('should provide all required functions', async () => {
    const { useJarvisVoice } = await import('@/hooks/jarvis/useJarvisVoice');
    const { result } = renderHook(() => useJarvisVoice());

    expect(typeof result.current.startListening).toBe('function');
    expect(typeof result.current.stopListening).toBe('function');
    expect(typeof result.current.speak).toBe('function');
    expect(typeof result.current.stopSpeaking).toBe('function');
    expect(typeof result.current.setIsAwake).toBe('function');
    expect(typeof result.current.setWakeWord).toBe('function');
    expect(typeof result.current.setVoiceSpeed).toBe('function');
  });

  it('should accept custom options', async () => {
    const onCommand = vi.fn();
    const onWakeUp = vi.fn();
    const { useJarvisVoice } = await import('@/hooks/jarvis/useJarvisVoice');
    const { result } = renderHook(() =>
      useJarvisVoice({
        wakeWord: 'Assistant',
        language: 'en-US',
        voiceSpeed: 1.5,
        onCommand,
        onWakeUp,
      })
    );

    expect(result.current.isListening).toBe(false);
  });

  it('setIsAwake should toggle awake state', async () => {
    const { useJarvisVoice } = await import('@/hooks/jarvis/useJarvisVoice');
    const { result } = renderHook(() => useJarvisVoice());

    act(() => {
      result.current.setIsAwake(true);
    });

    expect(result.current.isAwake).toBe(true);

    act(() => {
      result.current.setIsAwake(false);
    });

    expect(result.current.isAwake).toBe(false);
  });

  it('stopListening should not throw when not listening', async () => {
    const { useJarvisVoice } = await import('@/hooks/jarvis/useJarvisVoice');
    const { result } = renderHook(() => useJarvisVoice());

    expect(() => {
      act(() => {
        result.current.stopListening();
      });
    }).not.toThrow();
  });
});
