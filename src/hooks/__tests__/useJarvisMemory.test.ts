import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

const createChainableProxy = (resolvedValue: any) => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: any) => resolve(resolvedValue);
      return new Proxy(() => {}, handler);
    },
    apply: () => new Proxy({}, handler),
  };
  return new Proxy({}, handler);
};

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: () => createChainableProxy({
    data: [
      { id: 'm1', user_id: 'user-1', category: 'preference', key: 'theme', value: 'dark', metadata: {}, importance: 5, created_at: '2025-01-01', updated_at: '2025-01-01', expires_at: null },
      { id: 'm2', user_id: 'user-1', category: 'fact', key: 'name', value: 'John', metadata: {}, importance: 3, created_at: '2025-01-01', updated_at: '2025-01-01', expires_at: null },
    ],
    error: null,
  }),
}));

describe('useJarvisMemory', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('should return memories and utility functions', async () => {
    const { useJarvisMemory } = await import('@/hooks/jarvis/useJarvisMemory');
    const { result } = renderHook(() => useJarvisMemory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.memories).toBeDefined();
    expect(typeof result.current.addMemory).toBe('function');
    expect(typeof result.current.deleteMemory).toBe('function');
    expect(typeof result.current.clearCategory).toBe('function');
    expect(typeof result.current.getMemoryContext).toBe('function');
    expect(typeof result.current.getMemoriesByCategory).toBe('function');
    expect(typeof result.current.hasMemory).toBe('function');
    expect(typeof result.current.getMemoryValue).toBe('function');
    expect(result.current.isAdding).toBe(false);
    expect(result.current.isDeleting).toBe(false);
  });

  it('getMemoryContext should return formatted string', async () => {
    const { useJarvisMemory } = await import('@/hooks/jarvis/useJarvisMemory');
    const { result } = renderHook(() => useJarvisMemory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const context = result.current.getMemoryContext();
    expect(typeof context).toBe('string');
    if (result.current.memories?.length) {
      expect(context).toContain('MÉMOIRE PERSISTANTE');
    }
  });

  it('getMemoriesByCategory should filter correctly', async () => {
    const { useJarvisMemory } = await import('@/hooks/jarvis/useJarvisMemory');
    const { result } = renderHook(() => useJarvisMemory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const prefs = result.current.getMemoriesByCategory('preference');
    expect(Array.isArray(prefs)).toBe(true);
  });

  it('hasMemory should check key existence', async () => {
    const { useJarvisMemory } = await import('@/hooks/jarvis/useJarvisMemory');
    const { result } = renderHook(() => useJarvisMemory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    if (result.current.memories?.length) {
      expect(result.current.hasMemory('theme')).toBe(true);
      expect(result.current.hasMemory('nonexistent')).toBe(false);
    }
  });

  it('getMemoryValue should return value for key', async () => {
    const { useJarvisMemory } = await import('@/hooks/jarvis/useJarvisMemory');
    const { result } = renderHook(() => useJarvisMemory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    if (result.current.memories?.length) {
      expect(result.current.getMemoryValue('theme')).toBe('dark');
      expect(result.current.getMemoryValue('nonexistent')).toBeUndefined();
    }
  });
});
