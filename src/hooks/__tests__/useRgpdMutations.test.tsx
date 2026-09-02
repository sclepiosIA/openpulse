import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

// RLS-style error on insert/update for rgpd_* tables.
vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      rgpd_demandes_droits: {
        data: null,
        error: { message: 'permission denied for table rgpd_demandes_droits' },
      },
      rgpd_violations: {
        data: null,
        error: { message: 'permission denied for table rgpd_violations' },
      },
    },
  }),
);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn() } }));

import { useCreateRgpdDemande, useCreateRgpdViolation } from '../auth/useRgpd';

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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return JSON.stringify(error);
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false },
        },
      }),
  );

  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useCreateRgpdDemande (error paths)', () => {
  it('propagates RLS error when inserting a "droit à l\'oubli"', async () => {
    const { result } = renderHook(() => useCreateRgpdDemande(), { wrapper });

    await act(async () => {
      result.current.mutate({
        demandeur_email: 'test@example.com',
        demandeur_nom: 'Test',
        type_droit: 'effacement' as any,
        description: 'Demande RGPD',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(getErrorMessage(result.current.error)).toMatch(/permission denied/);
    });
  });
});

describe('useCreateRgpdViolation (error paths)', () => {
  it('propagates RLS error when declaring a data breach', async () => {
    const { result } = renderHook(() => useCreateRgpdViolation(), { wrapper });

    await act(async () => {
      result.current.mutate({
        titre: 'Fuite test',
        severite: 'haute' as any,
        description: 'Incident test',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(getErrorMessage(result.current.error)).toMatch(/permission denied/);
    });
  });
});