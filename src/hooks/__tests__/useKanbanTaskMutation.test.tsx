import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useKanbanTaskMutation } from '@/hooks/tasks/useKanbanTaskMutation';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue({ error: null });
  return { supabase: { from: vi.fn().mockReturnValue(chain) } };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('useKanbanTaskMutation', () => {
  it('should return a mutation object', () => {
    const { result } = renderHook(() => useKanbanTaskMutation(), { wrapper: createWrapper() });
    expect(result.current).toHaveProperty('mutateAsync');
    expect(result.current.isPending).toBe(false);
  });

  it('should update a task without error', async () => {
    const { result } = renderHook(() => useKanbanTaskMutation(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 'task-1', data: { statut: 'En cours' } });
    });
    // If no error thrown, mutation succeeded
    expect(result.current.isError).toBe(false);
  });
});
