import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      tresorerie_depenses: { data: null, error: { message: 'check_violation: montant must be > 0' } },
    },
  }),
);
const toastSpy = vi.fn();
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => (e?.message ?? String(e)),
}));

import { useTresorerieDepenses } from '../tresorerie/useTresorerieDepenses';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useTresorerieDepenses (error paths)', () => {
  it('shows error toast when create fails (DB constraint violation)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useTresorerieDepenses(), { wrapper });
    await act(async () => {
      result.current.createDepense({ nom: 'X', montant: -10, date_prevue: '2026-01-01' });
    });
    await waitFor(() => {
      const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('shows error toast when delete fails (RLS deny)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useTresorerieDepenses(), { wrapper });
    await act(async () => {
      result.current.deleteDepense('dep-1');
    });
    await waitFor(() => {
      const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
