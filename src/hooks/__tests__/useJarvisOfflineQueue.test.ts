import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/shared/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, isOffline: false }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

// Mock IndexedDB
const mockIDB = {
  open: vi.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: { contains: () => true },
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          getAll: vi.fn().mockReturnValue({ onsuccess: null }),
          put: vi.fn().mockReturnValue({ onsuccess: null }),
          delete: vi.fn().mockReturnValue({ onsuccess: null }),
        }),
      }),
    },
  }),
};
vi.stubGlobal('indexedDB', mockIDB);

import { useJarvisOfflineQueue } from '../jarvis/useJarvisOfflineQueue';
import { supabase } from '@/integrations/supabase/client';

describe('useJarvisOfflineQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes with empty queue', () => {
    const { result } = renderHook(() => useJarvisOfflineQueue());
    expect(result.current.queue).toEqual([]);
    expect(result.current.isSyncing).toBe(false);
  });

  it('provides expected API', () => {
    const { result } = renderHook(() => useJarvisOfflineQueue());
    expect(typeof result.current.enqueue).toBe('function');
    expect(typeof result.current.sync).toBe('function');
    expect(typeof result.current.clearQueue).toBe('function');
    expect(result.current).toHaveProperty('pendingCount');
  });

  it('accepts options', () => {
    const { result } = renderHook(() =>
      useJarvisOfflineQueue({ maxRetries: 5, autoSync: false, dedupeTimeMs: 1000 })
    );
    expect(result.current.queue).toEqual([]);
  });
});
