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

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() } }));

describe('useNextcloudStorage', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('useNextcloudUpload should return a mutation', async () => {
    const { useNextcloudUpload } = await import('@/hooks/documents/useNextcloudStorage');
    const { result } = renderHook(() => useNextcloudUpload(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useNextcloudDelete should return a mutation', async () => {
    const { useNextcloudDelete } = await import('@/hooks/documents/useNextcloudStorage');
    const { result } = renderHook(() => useNextcloudDelete(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useNextcloudMove should return a mutation', async () => {
    const { useNextcloudMove } = await import('@/hooks/documents/useNextcloudStorage');
    const { result } = renderHook(() => useNextcloudMove(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useNextcloudCreateFolder should return a mutation', async () => {
    const { useNextcloudCreateFolder } = await import('@/hooks/documents/useNextcloudStorage');
    const { result } = renderHook(() => useNextcloudCreateFolder(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});
