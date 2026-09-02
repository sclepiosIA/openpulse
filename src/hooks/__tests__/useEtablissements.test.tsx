import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { useEtablissements, useEtablissement } from '@/hooks/crm/useEtablissements';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEtablissements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Structure', () => {
    it('should return hook structure with correct initial state', () => {
      const { result } = renderHook(() => useEtablissements(), {
        wrapper: createWrapper(),
      });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should start in loading state', () => {
      const { result } = renderHook(() => useEtablissements(), {
        wrapper: createWrapper(),
      });
      expect(result.current.isLoading).toBe(true);
    });
  });
});

describe('useEtablissement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct initial state', () => {
    const { result } = renderHook(() => useEtablissement('etab-1'), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('should start in loading state when id provided', () => {
    const { result } = renderHook(() => useEtablissement('etab-1'), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });
});
