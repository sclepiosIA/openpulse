import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { toastErrorSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseModule } = await import('@/test-utils/supabaseMockFactory');

  return mockSupabaseModule({
    fromResults: {
      rh_entretiens: { data: null, error: { message: 'RLS: rh_entretiens forbidden' } },
    },
  });
});

vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: vi.fn() },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

import { useRHEntretienMutation } from '../hr/useRHEntretienMutation';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useRHEntretienMutation (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('toast.error sanitisé sur RLS deny', async () => {
    const { result } = renderHook(() => useRHEntretienMutation(), { wrapper });

    await act(async () => {
      result.current.mutate({
        profile_id: 'p1',
        manager_id: 'm1',
        type: 'annuel',
        date_entretien: '2026-06-15',
      });
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(toastErrorSpy).toHaveBeenCalledWith(expect.stringContaining('RLS: rh_entretiens forbidden'));
    });
  });
});