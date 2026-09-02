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
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

describe('useEmailTemplates', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('useEmailTemplates should return templates', async () => {
    const { useEmailTemplates } = await import('@/hooks/email/useEmailTemplates');
    const { result } = renderHook(() => useEmailTemplates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  it('useCreateEmailTemplate should return a mutation', async () => {
    const { useCreateEmailTemplate } = await import('@/hooks/email/useEmailTemplates');
    const { result } = renderHook(() => useCreateEmailTemplate(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useUpdateEmailTemplate should return a mutation', async () => {
    const { useUpdateEmailTemplate } = await import('@/hooks/email/useEmailTemplates');
    const { result } = renderHook(() => useUpdateEmailTemplate(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useDeleteEmailTemplate should return a mutation', async () => {
    const { useDeleteEmailTemplate } = await import('@/hooks/email/useEmailTemplates');
    const { result } = renderHook(() => useDeleteEmailTemplate(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });
});
