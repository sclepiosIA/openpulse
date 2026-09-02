import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'user-1' } }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import { usePulsePresence } from '../pulse/usePulsePresence';
import { supabase } from '@/integrations/supabase/client';

describe('usePulsePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial empty state without conversationId', () => {
    const { result } = renderHook(() => usePulsePresence(undefined));
    expect(result.current.onlineUsers).toEqual([]);
    expect(result.current.typingUsers).toEqual([]);
    expect(typeof result.current.setTyping).toBe('function');
    expect(typeof result.current.updatePresence).toBe('function');
  });

  it('provides setTyping and updatePresence functions', () => {
    const { result } = renderHook(() => usePulsePresence('conv-1'));
    expect(typeof result.current.setTyping).toBe('function');
    expect(typeof result.current.updatePresence).toBe('function');
  });
});
