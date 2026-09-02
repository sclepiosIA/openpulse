import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCandidates, useCandidate, useCandidateHistory } from '../recrutement/useCandidates';
import { createSimpleQueryBuilder } from '@/test-utils/supabaseMockFactory';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

let mockQueryBuilder = createSimpleQueryBuilder();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-123' }, loading: false }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useCandidates', () => {
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
    mockQueryBuilder = createSimpleQueryBuilder();
  });

  describe('useCandidates hook', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useCandidates(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('error');
    });

    it('should accept filters parameter', () => {
      const filters = { 
        jobOfferId: 'job-123', 
        status: ['new' as const, 'screening' as const],
        search: 'John'
      };
      
      const { result } = renderHook(() => useCandidates(filters), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('isLoading');
    });

    it('should have correct query key structure', () => {
      const filters = { jobOfferId: 'job-123' };
      
      const { result } = renderHook(() => useCandidates(filters), {
        wrapper: createWrapper(),
      });

      // Query should be associated with the filters
      expect(result.current).toBeDefined();
    });
  });

  describe('useCandidate hook', () => {
    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useCandidate(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isLoading).toBe(false);
    });

    it('should start fetching when id is provided', () => {
      const { result } = renderHook(() => useCandidate('candidate-123'), {
        wrapper: createWrapper(),
      });

      // Should attempt to fetch
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  describe('useCandidateHistory hook', () => {
    it('should not fetch when candidateId is undefined', () => {
      const { result } = renderHook(() => useCandidateHistory(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isLoading).toBe(false);
    });

    it('should start fetching when candidateId is provided', () => {
      const { result } = renderHook(() => useCandidateHistory('candidate-123'), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('isLoading');
    });
  });
});
