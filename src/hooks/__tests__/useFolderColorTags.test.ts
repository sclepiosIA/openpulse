import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => createChainableProxy({ data: [], error: null }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() } }));

describe('useFolderColorTags', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('useUpdateFolderColorTags should return a mutation', async () => {
    const { useUpdateFolderColorTags } = await import('@/hooks/documents/useFolderColorTags');
    const { result } = renderHook(() => useUpdateFolderColorTags(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useToggleFolderColorTag should return toggleTag and isPending', async () => {
    const { useToggleFolderColorTag } = await import('@/hooks/documents/useFolderColorTags');
    const { result } = renderHook(() => useToggleFolderColorTag(), { wrapper });
    expect(result.current.toggleTag).toBeDefined();
    expect(typeof result.current.toggleTag).toBe('function');
    expect(result.current.isPending).toBe(false);
  });
});
