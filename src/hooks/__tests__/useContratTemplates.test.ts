import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn() } }));

import { useContratTemplates, useContratClauses } from '../contracts/useContratTemplates';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: qc }, children);

describe('useContratTemplates', () => {
  it('returns templates data', async () => {
    const { result } = renderHook(() => useContratTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
});

describe('useContratClauses', () => {
  it('returns clauses data', async () => {
    const { result } = renderHook(() => useContratClauses(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
