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
      custom_dashboards: { data: null, error: { message: 'RLS: custom_dashboards forbidden' } },
    },
  });
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: vi.fn() },
}));

import {
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
} from '../dashboard/useCustomDashboards';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useCustomDashboards (error paths)', () => {
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

  it('useCreateDashboard — toast.error sur RLS deny', async () => {
    const { result } = renderHook(() => useCreateDashboard(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ nom: 'Rapport X' }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
    });
  });

  it('useUpdateDashboard — toast.error sur RLS deny', async () => {
    const { result } = renderHook(() => useUpdateDashboard(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ id: 'd1', patch: { nom: 'New name' } as any })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
    });
  });

  it('useDeleteDashboard — toast.error sur RLS deny', async () => {
    const { result } = renderHook(() => useDeleteDashboard(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('d1').catch(() => undefined);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
    });
  });
});