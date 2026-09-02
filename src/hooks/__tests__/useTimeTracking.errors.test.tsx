import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      time_entries: { data: null, error: { message: 'RLS: time_entries forbidden' } },
    },
  }),
);

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import { useClockIn, useClockOut } from '../hr/useTimeTracking';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useTimeTracking (error paths)', () => {
  it('useClockIn propage erreur RLS', async () => {
    const { result } = renderHook(() => useClockIn(), { wrapper });
    await act(async () => {
      result.current.mutate(undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error)?.message).toContain('RLS');
  });

  it('useClockOut propage erreur RLS', async () => {
    const { result } = renderHook(() => useClockOut(), { wrapper });
    await act(async () => {
      result.current.mutate('session-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error)?.message).toContain('RLS');
  });
});
