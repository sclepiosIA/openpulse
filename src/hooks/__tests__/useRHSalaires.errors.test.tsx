import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      rh_salaires_mensuels: { data: null, error: { message: 'RLS: only rh/admin can manage salaires' } },
    },
  }),
);
const { toastErrorSpy } = vi.hoisted(() => ({
  toastErrorSpy: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastErrorSpy } }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn() } }));
// Audit helpers must not blow up when fetch fails — stub them.
vi.mock('../hr/useSalaryAudit', () => ({
  logSalaryBatchView: vi.fn(),
  logSalaryAccess: vi.fn(),
}));

import { useRHSalaires } from '../hr/useRHSalaires';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useRHSalaires (error paths)', () => {
  it('toasts sanitized error when createSalaire fails (RBAC)', async () => {
    toastErrorSpy.mockClear();
    const { result } = renderHook(() => useRHSalaires('2026-01'), { wrapper });
    await act(async () => {
      try {
        await result.current.createSalaire({
          profile_id: 'p1', mois: '2026-01-01',
          salaire_brut: 3000, salaire_net: 2400,
          cotisations_patronales: 800, cotisations_salariales: 600,
        } as any);
      } catch { /* expected */ }
    });
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
    expect(toastErrorSpy.mock.calls.at(-1)?.[0]).toMatch(/rh\/admin/);
  });

  it('toasts and rollbacks when deleteSalaire fails (RBAC)', async () => {
    toastErrorSpy.mockClear();
    const { result } = renderHook(() => useRHSalaires('2026-01'), { wrapper });
    await act(async () => {
      try { await result.current.deleteSalaire('sal-1'); } catch { /* expected */ }
    });
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
  });
});
