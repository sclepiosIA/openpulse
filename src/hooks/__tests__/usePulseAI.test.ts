import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePulseAI } from '../pulse/usePulseAI';
import { supabase } from '@/integrations/supabase/client';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('usePulseAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => usePulseAI());
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.lastResult).toBeNull();
  });

  it('provides summarize, suggestResponse, extractActions functions', () => {
    const { result } = renderHook(() => usePulseAI());
    expect(typeof result.current.summarize).toBe('function');
    expect(typeof result.current.suggestResponse).toBe('function');
    expect(typeof result.current.extractActions).toBe('function');
    expect(typeof result.current.clearResult).toBe('function');
  });

  it('summarize calls edge function with correct params', async () => {
    mockInvoke.mockResolvedValue({
      data: { result: { summary: 'test', key_points: [], decisions: [], open_questions: [] } },
      error: null,
    });

    const { result } = renderHook(() => usePulseAI());

    await act(async () => {
      await result.current.summarize('conv-1');
    });

    expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-summarize', {
      body: { conversation_id: 'conv-1', action: 'summarize', message_ids: undefined },
    });
    expect(result.current.isProcessing).toBe(false);
  });

  it('handles errors gracefully', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('fail') });

    const { result } = renderHook(() => usePulseAI());

    await act(async () => {
      const res = await result.current.summarize('conv-1');
      expect(res).toBeNull();
    });
  });

  it('clearResult resets lastResult', async () => {
    mockInvoke.mockResolvedValue({
      data: { result: { summary: 'test', key_points: [], decisions: [], open_questions: [] } },
      error: null,
    });

    const { result } = renderHook(() => usePulseAI());

    await act(async () => {
      await result.current.summarize('conv-1');
    });
    expect(result.current.lastResult).not.toBeNull();

    act(() => {
      result.current.clearResult();
    });
    expect(result.current.lastResult).toBeNull();
  });
});
