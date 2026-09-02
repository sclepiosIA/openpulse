import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateEntityMutations } from '@/hooks/search/useCreateEntityMutations';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  const mockChain: any = {};
  const methods = ['from', 'insert', 'select', 'single', 'update', 'eq', 'delete'];
  for (const m of methods) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain);
  }
  mockChain.single = vi.fn().mockResolvedValue({
    data: { id: 'new-id', nom: 'Test' },
    error: null,
  });
  return { supabase: { from: vi.fn().mockReturnValue(mockChain) } };
});

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('useCreateEntityMutations', () => {
  it('should return hook structure', () => {
    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper: createWrapper() });
    expect(result.current).toHaveProperty('createEntity');
    expect(result.current).toHaveProperty('isCreating');
    expect(result.current.isCreating).toBe(false);
  });

  it('should create an etablissement', async () => {
    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper: createWrapper() });
    let entity: any;
    await act(async () => {
      entity = await result.current.createEntity('etablissement', { nom: 'CHU Test' });
    });
    expect(entity).toEqual({ id: 'new-id', nom: 'Test' });
  });

  it('should create a partenaire', async () => {
    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper: createWrapper() });
    let entity: any;
    await act(async () => {
      entity = await result.current.createEntity('partenaire', { nom: 'Partenaire Test' });
    });
    expect(entity).toBeDefined();
    expect(entity.id).toBe('new-id');
  });

  it('should create a groupe', async () => {
    const { result } = renderHook(() => useCreateEntityMutations(), { wrapper: createWrapper() });
    let entity: any;
    await act(async () => {
      entity = await result.current.createEntity('groupe', { nom: 'Groupe Test' });
    });
    expect(entity).toBeDefined();
    expect(entity.id).toBe('new-id');
  });
});
