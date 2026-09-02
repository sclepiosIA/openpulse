import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'f1' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

import { useJarvisLearning } from '../jarvis/useJarvisLearning';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useJarvisLearning', () => {
  it('returns insights with empty patterns when no history', async () => {
    const { result } = renderHook(() => useJarvisLearning(), { wrapper });
    await waitFor(() => expect(result.current.insights?.patterns).toBeDefined());
    expect(result.current.insights?.patterns).toEqual([]);
  });

  it('exposes recordAction function', () => {
    const { result } = renderHook(() => useJarvisLearning(), { wrapper });
    expect(typeof result.current.recordAction).toBe('function');
  });
});
