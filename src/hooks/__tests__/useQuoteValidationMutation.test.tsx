import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuoteValidationMutation } from '@/hooks/quote/useQuoteValidationMutation';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue({ error: null });
  return { supabase: { from: vi.fn().mockReturnValue(chain) } };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('useQuoteValidationMutation', () => {
  it('should return a mutation object', () => {
    const { result } = renderHook(() => useQuoteValidationMutation(), { wrapper: createWrapper() });
    expect(result.current).toHaveProperty('mutateAsync');
    expect(result.current.isPending).toBe(false);
  });

  it('should handle succes type validation', async () => {
    const { result } = renderHook(() => useQuoteValidationMutation(), { wrapper: createWrapper() });
    await act(async () => {
      const res = await result.current.mutateAsync({
        type: 'succes',
        etablissementId: '123',
        etablissementNom: 'CHU Test',
        pallierVise: '3',
        tarifsData: { palier1: 100, palier2: 200, palier3: 300, palier4: 400 },
        seuilsData: { palier1: 10, palier2: 20, palier3: 30, palier4: 40 },
        fraisAcces: 500,
      });
      expect(res.type).toBe('succes');
    });
  });

  it('should handle statique type validation', async () => {
    const { result } = renderHook(() => useQuoteValidationMutation(), { wrapper: createWrapper() });
    await act(async () => {
      const res = await result.current.mutateAsync({
        type: 'statique',
        etablissementId: '456',
        etablissementNom: 'Clinique Test',
        tarifAnnuel: 5000,
        fraisAcces: 1000,
      });
      expect(res.type).toBe('statique');
    });
  });
});
