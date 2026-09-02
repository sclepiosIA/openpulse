import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

const toastErrorSpy = vi.fn();
const toastSuccessSpy = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorSpy(...args),
    success: (...args: unknown[]) => toastSuccessSpy(...args),
  },
}));

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      rh_absences: { data: null, error: { message: 'RLS: rh_absences forbidden' } },
    },
  }),
);

import { useRHAbsences } from '../hr/useRHAbsences';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useRHAbsences (error paths)', () => {
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

  it('toast.error appelé quand createAbsence échoue (RLS deny)', async () => {
    const { result } = renderHook(() => useRHAbsences(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current
        .createAbsence({
          profile_id: 'p1',
          date_debut: '2026-06-01',
          date_fin: '2026-06-02',
          type_absence: 'conges',
          statut: 'demande',
        } as any)
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('toast.error appelé quand updateAbsence échoue (rollback optimistic)', async () => {
    const { result } = renderHook(() => useRHAbsences(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.updateAbsence({ id: 'a1', statut: 'validee' }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});