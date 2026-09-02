import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      workflows: { data: null, error: { message: 'RLS: workflows forbidden' } },
    },
  }),
);

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const toastSpy = vi.fn();
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
} from '../workflows/useWorkflows';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useWorkflows (error paths)', () => {
  it('useCreateWorkflow — toast destructive sur RLS deny', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useCreateWorkflow(), { wrapper });
    await act(async () => {
      result.current.mutate({ nom: 'WF', trigger_type: 'manual' as any });
    });
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
  });

  it('useUpdateWorkflow — toast destructive sur RLS deny', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper });
    await act(async () => {
      result.current.mutate({ id: 'w1', patch: { nom: 'x' } } as any);
    });
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
  });

  it('useDeleteWorkflow — toast destructive sur RLS deny', async () => {
    toastSpy.mockClear();
    const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });
    await act(async () => {
      result.current.mutate('w1');
    });
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
  });
});
