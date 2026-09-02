import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardCoreData } from '@/hooks/dashboard/useDashboardCoreData';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

// Mock useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'test-user-id' } },
    user: { id: 'test-user-id', email: 'test@test.com' },
    isLoading: false,
  }),
}));

// Mock useCurrentProfile
vi.mock('@/hooks/useCurrentProfile', () => ({
  useCurrentProfile: () => ({
    data: { id: 'test-user-id', prenom: 'Test', nom: 'User' },
    isLoading: false,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDashboardCoreData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return expected properties', () => {
    const { result } = renderHook(() => useDashboardCoreData(), { wrapper: createWrapper() });
    
    expect(result.current).toHaveProperty('etablissements');
    expect(result.current).toHaveProperty('taches');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('errors');
  });

  it('should start in loading state', () => {
    const { result } = renderHook(() => useDashboardCoreData(), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
  });

  it('should have overview property', () => {
    const { result } = renderHook(() => useDashboardCoreData(), { wrapper: createWrapper() });
    
    expect(result.current).toHaveProperty('overview');
  });
});
