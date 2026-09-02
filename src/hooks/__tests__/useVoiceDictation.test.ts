import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: { text: 'transcription' }, error: null }) },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import { useVoiceDictation } from '../voice/useVoiceDictation';
import { supabase } from '@/integrations/supabase/client';

describe('useVoiceDictation', () => {
  const onTranscript = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useVoiceDictation({ onTranscript }));
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.audioLevel).toBe(0);
    expect(result.current.isSupported).toBe(true);
  });

  it('provides toggle and start/stop functions', () => {
    const { result } = renderHook(() => useVoiceDictation({ onTranscript }));
    expect(typeof result.current.toggleRecording).toBe('function');
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
  });

  it('accepts language option', () => {
    const { result } = renderHook(() =>
      useVoiceDictation({ onTranscript, language: 'en-US' })
    );
    expect(result.current.isRecording).toBe(false);
  });

  it('accepts onInterimTranscript callback', () => {
    const onInterim = vi.fn();
    const { result } = renderHook(() =>
      useVoiceDictation({ onTranscript, onInterimTranscript: onInterim })
    );
    expect(result.current.isRecording).toBe(false);
  });
});
