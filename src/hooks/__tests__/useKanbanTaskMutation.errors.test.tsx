import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      taches: { data: null, error: { message: 'RLS: taches forbidden' } },
    },
  }),
);
const toastSpy = vi.fn();
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message ?? String(e),
}));

import { useKanbanTaskMutation } from '../tasks/useKanbanTaskMutation';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useKanbanTaskMutation (error paths)', () => {
  it('shows destructive toast when update fails (RLS)', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useKanbanTaskMutation(), { wrapper });
    await act(async () => { result.current.mutate({ id: 't-1', data: { statut: 'fait' } }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const calls = toastSpy.mock.calls.filter((c) => c[0]?.variant === 'destructive');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.at(-1)?.[0]?.description).toMatch(/forbidden/);
  });
});
