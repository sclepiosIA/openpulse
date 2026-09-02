import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useEmailAnalytics } from '../email/useEmailAnalytics';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: vi.fn().mockResolvedValue({ data: { accepted: 5, rejected: 1, pending: 2, total: 8, avg_confidence: 0.85 }, error: null }),
  },
}));

describe('useEmailAnalytics', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_messages') {
        return createChainableProxy({
          data: [
            { created_at: '2026-03-10T10:00:00Z', is_sent: false },
            { created_at: '2026-03-10T11:00:00Z', is_sent: true },
          ],
          error: null,
        });
      }
      if (table === 'etablissements') {
        return createChainableProxy({ data: [], error: null });
      }
      if (table === 'ai_processing_log') {
        return createChainableProxy({
          data: [
            { processing_duration_ms: 500, total_tokens: 1000, success: true, processed_at: '2026-03-10' },
          ],
          error: null,
        });
      }
      if (table === 'email_threads') {
        return createChainableProxy({ data: [], error: null });
      }
      return createChainableProxy({ data: [], error: null });
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useEmailAnalytics(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('provides volume, commercial, ai quality, and threads data', () => {
    const { result } = renderHook(() => useEmailAnalytics(), { wrapper });
    expect(result.current).toHaveProperty('volumeData');
    expect(result.current).toHaveProperty('commercialData');
    expect(result.current).toHaveProperty('aiQualityData');
    expect(result.current).toHaveProperty('threadsData');
  });
});
