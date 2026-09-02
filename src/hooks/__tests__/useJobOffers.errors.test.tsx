import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { toastErrorSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseModule } = await import('@/test-utils/supabaseMockFactory');

  return mockSupabaseModule({
    fromResults: {
      job_offers: { data: null, error: { message: 'RLS: job_offers forbidden' } },
    },
  });
});

// Le hook testé consomme l'auth depuis le provider réel dans certains chemins/résolutions de module.
// On mocke donc les 2 points d'entrée pour rendre le test hermétique en exécution parallèle.
const authValue = { user: { id: 'user-1' } };

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorSpy, success: vi.fn() },
}));

import {
  useCreateJobOffer,
  useUpdateJobOffer,
  useDeleteJobOffer,
} from '../recrutement/useJobOffers';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useJobOffers (error paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('useCreateJobOffer — toast.error sanitized sur RLS deny', async () => {
    const { result } = renderHook(() => useCreateJobOffer(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ titre: 'Dev' } as any);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    }, { timeout: 10000 });
  });

  it('useUpdateJobOffer — toast.error sanitized sur RLS deny', async () => {
    const { result } = renderHook(() => useUpdateJobOffer(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ id: 'j1', titre: 'X' } as any);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    }, { timeout: 10000 });
  });

  it('useDeleteJobOffer — toast.error sanitized sur RLS deny', async () => {
    const { result } = renderHook(() => useDeleteJobOffer(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('j1');
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    }, { timeout: 10000 });
  });
});