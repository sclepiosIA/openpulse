/**
 * Tests for useJarvisWakeWord hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock window.SpeechRecognition
const mockRecognition = {
  continuous: false,
  interimResults: false,
  lang: '',
  start: vi.fn(),
  stop: vi.fn(),
  onstart: null as ((event: Event) => void) | null,
  onend: null as ((event: Event) => void) | null,
  onresult: null as ((event: unknown) => void) | null,
  onerror: null as ((event: unknown) => void) | null,
};

const MockSpeechRecognition = vi.fn(() => mockRecognition);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock recognition state
  mockRecognition.start.mockClear();
  mockRecognition.stop.mockClear();
  
  // Setup window mock
  Object.defineProperty(window, 'SpeechRecognition', {
    value: MockSpeechRecognition,
    writable: true,
    configurable: true
  });
});

// Import after mocks are set up
import { useJarvisWakeWord } from '@/hooks/jarvis/useJarvisWakeWord';

describe('useJarvisWakeWord', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useJarvisWakeWord());
    
    expect(result.current.isListening).toBe(false);
    expect(result.current.isDetected).toBe(false);
    expect(result.current.confidence).toBe(0);
  });

  it('should start listening when startListening is called', () => {
    const { result } = renderHook(() => useJarvisWakeWord());
    
    act(() => {
      result.current.startListening();
    });
    
    expect(mockRecognition.start).toHaveBeenCalled();
  });

  it('should stop listening when stopListening is called', () => {
    const { result } = renderHook(() => useJarvisWakeWord());
    
    act(() => {
      result.current.startListening();
    });
    
    act(() => {
      result.current.stopListening();
    });
    
    expect(result.current.isListening).toBe(false);
  });

  it('should detect wake word "jarvis"', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(() => useJarvisWakeWord({ onWakeUp }));
    
    act(() => {
      result.current.startListening();
    });
    
    // Simulate speech recognition result
    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [{
            0: { transcript: 'hey jarvis' },
            isFinal: true
          }]
        });
      }
    });
    
    expect(result.current.isDetected).toBe(true);
    expect(onWakeUp).toHaveBeenCalled();
  });

  it('should detect wake word "hey jarvis"', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(() => useJarvisWakeWord({ onWakeUp }));
    
    act(() => {
      result.current.startListening();
    });
    
    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [{
            0: { transcript: 'Hey Jarvis, can you help me?' },
            isFinal: true
          }]
        });
      }
    });
    
    expect(result.current.isDetected).toBe(true);
  });

  it('should reset detection state', () => {
    const { result } = renderHook(() => useJarvisWakeWord());
    
    act(() => {
      result.current.startListening();
    });
    
    // Trigger detection
    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [{
            0: { transcript: 'jarvis' },
            isFinal: true
          }]
        });
      }
    });
    
    expect(result.current.isDetected).toBe(true);
    
    act(() => {
      result.current.resetDetection();
    });
    
    expect(result.current.isDetected).toBe(false);
    expect(result.current.confidence).toBe(0);
  });

  it('should not detect unrelated speech', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(() => useJarvisWakeWord({ onWakeUp }));
    
    act(() => {
      result.current.startListening();
    });
    
    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [{
            0: { transcript: 'hello world how are you' },
            isFinal: true
          }]
        });
      }
    });
    
    expect(result.current.isDetected).toBe(false);
    expect(onWakeUp).not.toHaveBeenCalled();
  });

  it('should support custom wake words', () => {
    const onWakeUp = vi.fn();
    const { result } = renderHook(() => 
      useJarvisWakeWord({ wakeWords: ['assistant', 'helper'], onWakeUp })
    );
    
    act(() => {
      result.current.startListening();
    });
    
    act(() => {
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [{
            0: { transcript: 'hey assistant' },
            isFinal: true
          }]
        });
      }
    });
    
    expect(result.current.isDetected).toBe(true);
    expect(onWakeUp).toHaveBeenCalled();
  });

  it('should handle sensitivity levels', () => {
    const { result: highSensitivity } = renderHook(() => 
      useJarvisWakeWord({ sensitivity: 'high' })
    );
    
    const { result: lowSensitivity } = renderHook(() => 
      useJarvisWakeWord({ sensitivity: 'low' })
    );
    
    expect(highSensitivity.current).toBeDefined();
    expect(lowSensitivity.current).toBeDefined();
  });
});
