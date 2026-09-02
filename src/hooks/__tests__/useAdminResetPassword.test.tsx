import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

// Error path: edge function returns { error }
vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    functionsResults: {
      'admin-reset-user-password': { data: null, error: new Error('permission denied') },
    },
  }),
);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn() } }));

import { useAdminResetPassword, generateSecurePassword } from '../auth/useAdminResetPassword';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useAdminResetPassword (error paths)', () => {
  it('rejects when edge function returns an error', async () => {
    const { result } = renderHook(() => useAdminResetPassword(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: 'u1', newPassword: 'Abcd1234!' } as any);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('generateSecurePassword', () => {
  it('generates a password of the requested length and char diversity', () => {
    const pw = generateSecurePassword(16);
    expect(pw).toHaveLength(16);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
    expect(/[!@#$%&*]/.test(pw)).toBe(true);
  });
});
