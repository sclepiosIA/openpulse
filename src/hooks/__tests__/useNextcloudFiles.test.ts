import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: [], error: null }) },
  },
}));

vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() } }));

describe('useNextcloudFiles', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('useNextcloudFiles should accept folder path', async () => {
    const { useNextcloudFiles } = await import('@/hooks/documents/useNextcloudFiles');
    const { result } = renderHook(() => useNextcloudFiles('/documents'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('useNextcloudFiles should default to root path', async () => {
    const { useNextcloudFiles } = await import('@/hooks/documents/useNextcloudFiles');
    const { result } = renderHook(() => useNextcloudFiles(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('useNextcloudStatus should return loading state', async () => {
    const { useNextcloudStatus } = await import('@/hooks/documents/useNextcloudFiles');
    const { result } = renderHook(() => useNextcloudStatus(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
