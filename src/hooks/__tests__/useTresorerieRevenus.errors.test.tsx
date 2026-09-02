import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      tresorerie_revenus: { data: null, error: { message: 'check_violation: montant_prevu invalid' } },
    },
  }),
);
const toastSpy = vi.fn();
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

import { useTresorerieRevenus } from '../tresorerie/useTresorerieRevenus';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useTresorerieRevenus (error paths)', () => {
  it('shows error toast when create fails (constraint violation)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useTresorerieRevenus(), { wrapper });
    await act(async () => {
      result.current.createRevenu({
        etablissement_id: 'etab-1',
        mois: '2026-01-01',
        montant_prevu: -1,
      } as any);
    });
    await waitFor(() => {
      const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('shows error toast when marquerPaye fails (update RLS deny)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useTresorerieRevenus(), { wrapper });
    await act(async () => { result.current.marquerPaye('rev-1', 1000); });
    await waitFor(() => {
      const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
