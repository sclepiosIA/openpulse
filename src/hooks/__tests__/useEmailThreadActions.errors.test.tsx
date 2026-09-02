import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      email_threads: { data: null, error: { message: 'RLS: thread forbidden' } },
    },
  }),
);
const toastSpy = vi.fn();
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

import { useEmailThreadActions } from '../email/useEmailThreadActions';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useEmailThreadActions (error paths)', () => {
  it('shows destructive toast when archiveThread fails (RLS)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper });
    await act(async () => { result.current.archiveThread({ threadId: 't1', archived: true }); });
    await waitFor(() => {
      const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('shows destructive toast when markAsRead fails (RLS)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper });
    await act(async () => { result.current.markAsRead({ threadId: 't1', read: true }); });
    await waitFor(() => {
      const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
