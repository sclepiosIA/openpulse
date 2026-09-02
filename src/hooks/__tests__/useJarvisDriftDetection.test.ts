import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJarvisDriftDetection } from '../jarvis/useJarvisDriftDetection';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

describe('useJarvisDriftDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tracking functions', () => {
    const { result } = renderHook(() => useJarvisDriftDetection());
    
    expect(typeof result.current.trackGeneratedContent).toBe('function');
    expect(typeof result.current.recordFinalContent).toBe('function');
    expect(typeof result.current.cancelTracking).toBe('function');
    expect(typeof result.current.isTracking).toBe('function');
    expect(typeof result.current.getTrackingCount).toBe('function');
  });

  it('tracks and cancels content', () => {
    const { result } = renderHook(() => useJarvisDriftDetection());

    act(() => {
      result.current.trackGeneratedContent('id-1', 'email', 'Hello world');
    });

    expect(result.current.isTracking('id-1')).toBe(true);
    expect(result.current.getTrackingCount()).toBe(1);

    act(() => {
      result.current.cancelTracking('id-1');
    });

    expect(result.current.isTracking('id-1')).toBe(false);
    expect(result.current.getTrackingCount()).toBe(0);
  });

  it('recordFinalContent returns no drift for untracked id', async () => {
    const { result } = renderHook(() => useJarvisDriftDetection());

    let driftResult: any;
    await act(async () => {
      driftResult = await result.current.recordFinalContent('unknown-id', 'Some content');
    });

    expect(driftResult.driftPercentage).toBe(0);
    expect(driftResult.isSignificant).toBe(false);
    expect(driftResult.feedbackRecorded).toBe(false);
  });

  it('detects significant drift when content is very different', async () => {
    const { result } = renderHook(() => useJarvisDriftDetection());

    act(() => {
      result.current.trackGeneratedContent('id-2', 'email', 'This is the original generated content from Jarvis AI assistant');
    });

    let driftResult: any;
    await act(async () => {
      driftResult = await result.current.recordFinalContent('id-2', 'Completely different text that has nothing to do with the original');
    });

    expect(driftResult.driftPercentage).toBeGreaterThan(20);
    expect(driftResult.isSignificant).toBe(true);
  });

  it('detects no significant drift when content is similar', async () => {
    const { result } = renderHook(() => useJarvisDriftDetection());

    act(() => {
      result.current.trackGeneratedContent('id-3', 'email', 'Bonjour, merci pour votre message');
    });

    let driftResult: any;
    await act(async () => {
      driftResult = await result.current.recordFinalContent('id-3', 'Bonjour, merci pour votre message.');
    });

    expect(driftResult.isSignificant).toBe(false);
  });
});
