import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJarvisMultiChannel } from '../jarvis/useJarvisMultiChannel';
import { supabase } from '@/integrations/supabase/client';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('useJarvisMultiChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useJarvisMultiChannel());
    
    expect(result.current.channels).toEqual([]);
    expect(result.current.history).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.availableChannels).toEqual([]);
  });

  it('provides all expected functions', () => {
    const { result } = renderHook(() => useJarvisMultiChannel());
    
    expect(typeof result.current.fetchChannels).toBe('function');
    expect(typeof result.current.fetchHistory).toBe('function');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.isChannelAvailable).toBe('function');
  });

  it('isChannelAvailable returns false for unknown channel', () => {
    const { result } = renderHook(() => useJarvisMultiChannel());
    expect(result.current.isChannelAvailable('email')).toBe(false);
  });

  it('fetchChannels calls edge function', async () => {
    mockInvoke.mockResolvedValue({
      data: { channels: [{ id: 'email', name: 'Email', enabled: true, configured: true }] },
      error: null,
    });

    const { result } = renderHook(() => useJarvisMultiChannel());
    
    await act(async () => {
      await result.current.fetchChannels();
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-multi-channel', {
      body: { action: 'get_channels', user_id: 'test-user-id' },
    });
  });

  it('sendMessage calls edge function with correct params', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, message_id: 'msg-1' },
      error: null,
    });

    const { result } = renderHook(() => useJarvisMultiChannel());
    
    let response: any;
    await act(async () => {
      response = await result.current.sendMessage({
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Test',
        message: 'Hello',
      });
    });

    expect(response.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('jarvis-multi-channel', expect.objectContaining({
      body: expect.objectContaining({ action: 'send' }),
    }));
  });
});
