import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
    functions: { invoke: vi.fn().mockResolvedValue({ data: { filename: 'test.pdf' }, error: null }) },
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url' } }),
      }),
    },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

describe('useEmailAttachments', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('should return empty attachments and loading state', async () => {
    const { useEmailAttachments } = await import('@/hooks/email/useEmailAttachments');
    const { result } = renderHook(() => useEmailAttachments('msg-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.attachments).toEqual([]);
  });

  it('should provide downloadAttachment function', async () => {
    const { useEmailAttachments } = await import('@/hooks/email/useEmailAttachments');
    const { result } = renderHook(() => useEmailAttachments('msg-1'), { wrapper });

    expect(typeof result.current.downloadAttachment).toBe('function');
    expect(result.current.isDownloading).toBe(false);
  });

  it('should provide getAttachmentUrl function', async () => {
    const { useEmailAttachments } = await import('@/hooks/email/useEmailAttachments');
    const { result } = renderHook(() => useEmailAttachments('msg-1'), { wrapper });

    expect(typeof result.current.getAttachmentUrl).toBe('function');
  });
});
