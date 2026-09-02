import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [
        { id: '1', nom: 'Urgent', description: 'Tâches urgentes', couleur: '#ff0000', ordre: 1, created_at: '2025-01-01' },
        { id: '2', nom: 'Normal', description: null, couleur: '#00ff00', ordre: 2, created_at: '2025-01-01' },
      ], error: null })),
    })),
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: { reference: { staleTime: 0 } },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useCategories', () => {
  it('fetches categories from supabase', async () => {
    const { useCategories } = await import('../catalogue/useCategories');
    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].nom).toBe('Urgent');
  });
});
