import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn() } }));

import {
  useRgpdTraitements,
  useRgpdDemandes,
  useRgpdViolations,
  useRgpdKPIs,
} from '../auth/useRgpd';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: qc }, children);

describe('useRgpdTraitements', () => {
  it('returns data', async () => {
    const { result } = renderHook(() => useRgpdTraitements(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
});

describe('useRgpdDemandes', () => {
  it('returns data', async () => {
    const { result } = renderHook(() => useRgpdDemandes(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('useRgpdViolations', () => {
  it('returns data', async () => {
    const { result } = renderHook(() => useRgpdViolations(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('useRgpdKPIs', () => {
  it('returns KPI values', () => {
    const { result } = renderHook(() => useRgpdKPIs(), { wrapper });
    expect(result.current).toBeDefined();
  });
});
