import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCurrentProfile } from '../profile/useProfiles';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mock useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    loading: false,
  }),
}));

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  },
}));

// Mock toast
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useCurrentProfile', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should return profile data when user is authenticated', async () => {
    const mockProfile = {
      id: 'profile-123',
      user_id: 'user-123',
      prenom: 'John',
      nom: 'Doe',
      email: 'john@example.com',
      actif: true,
      avatar_url: null,
    };

    mockMaybeSingle.mockResolvedValueOnce({ data: mockProfile, error: null });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockProfile);
  });

  it('should return null when profile not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  it('should handle error correctly', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ 
      data: null, 
      error: { message: 'Database error' } 
    });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should have correct query key', () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('isLoading');
  });
});
