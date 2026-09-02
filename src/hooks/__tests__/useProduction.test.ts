import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { createChainableProxy } from '@/test-utils/supabaseMockFactory';

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: () => createChainableProxy({ data: [], error: null }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: '1' }, loading: false }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: {
    production: {
      key: 'production',
      statuts: ['Production'],
    },
    deploiement: {
      key: 'deploiement',
      statuts: ['Déploiement', 'Formation'],
    },
  },
}));

import { useProduction, useDeploiement } from '../production/useProduction';
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

describe('useProduction', () => {
  it('returns data array', async () => {
    const { result } = renderHook(() => useProduction(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});

describe('useDeploiement', () => {
  it('returns data array', async () => {
    const { result } = renderHook(() => useDeploiement(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});
