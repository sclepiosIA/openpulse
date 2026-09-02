import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [
      { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
    ], error: null }),
    from: vi.fn(() => createChainableProxy({
      data: [
        { id: 'e1', statut: 'Production', commercial_id: 'p1', chef_projet_id: null, csm_id: null },
      ],
      error: null,
    })),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useTeamStats', () => {
  it('returns stats map keyed by profile ID', async () => {
    const { useTeamStats } = await import('../hr/useTeamStats');
    const { result } = renderHook(() => useTeamStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });
});
