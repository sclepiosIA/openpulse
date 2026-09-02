import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => {
  const mockData = [
    { id: 'ip1', ip_address: '192.168.1.1', description: 'Office', created_at: '', updated_at: '', created_by: 'u1' },
  ];
  return {
    supabase: {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: mockData, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: mockData[0], error: null }),
          }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
      },
    },
  };
});

import { useAuthorizedIPs } from '../auth/useAuthorizedIPs';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useAuthorizedIPs', () => {
  it('returns IP list', async () => {
    const { result } = renderHook(() => useAuthorizedIPs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].ip_address).toBe('192.168.1.1');
  });
});
