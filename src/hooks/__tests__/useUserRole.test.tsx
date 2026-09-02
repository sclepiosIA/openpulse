import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

const mockSingle = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
          maybeSingle: mockSingle,
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn() } }));

import { useUserRole } from '../shared/useUserRole';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: any) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

describe('useUserRole', () => {
  it('returns admin flags when role is admin', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe('admin');
  });

  it('returns non-admin for regular user', async () => {
    qc.clear();
    mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isCopil).toBe(false);
  });

  it('returns direction flags', async () => {
    qc.clear();
    mockSingle.mockResolvedValue({ data: { role: 'direction' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isDirection).toBe(true);
  });

  it('returns copil flag', async () => {
    qc.clear();
    mockSingle.mockResolvedValue({ data: { role: 'copil' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isCopil).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('handles error gracefully', async () => {
    qc.clear();
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const { result } = renderHook(() => useUserRole(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });
});
