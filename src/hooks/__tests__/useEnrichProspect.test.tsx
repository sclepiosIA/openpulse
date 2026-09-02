import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    functionsResults: {
      'enrich-prospect': { data: null, error: new Error('rate limited') },
    },
    fromResults: {
      prospect_enrichment_log: { data: null, error: { message: 'RLS deny' } },
    },
  }),
);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { useEnrichProspect, useEnrichmentHistory } from '../crm/useEnrichProspect';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useEnrichProspect (error paths)', () => {
  it('rejects when edge function fails', async () => {
    const { result } = renderHook(() => useEnrichProspect(), { wrapper });
    await act(async () => {
      result.current.mutate('etab-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/rate limited/);
  });
});

describe('useEnrichmentHistory (error paths)', () => {
  it('propagates supabase error', async () => {
    const { result } = renderHook(() => useEnrichmentHistory('etab-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
