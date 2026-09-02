import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks must be defined inline in vi.mock due to hoisting

// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'profile-123' }, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock useCurrentProfile
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({
    data: { id: 'profile-123', nom: 'Test', prenom: 'User' },
    isLoading: false,
  }),
}));

import { usePulseMessages, useSendPulseMessage, useDeletePulseMessage } from '@/hooks/pulse/usePulseMessages';
import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { 
      queries: { 
        retry: false,
        gcTime: 0,
      } 
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('usePulseMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return infinite query structure', () => {
    const { result } = renderHook(
      () => usePulseMessages('conv-123'),
      { wrapper: createWrapper() }
    );
    
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('fetchNextPage');
    expect(result.current).toHaveProperty('hasNextPage');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isFetchingNextPage');
  });

  it('should not fetch when conversationId is undefined', () => {
    const { result } = renderHook(
      () => usePulseMessages(undefined),
      { wrapper: createWrapper() }
    );
    
    expect(result.current.isLoading).toBe(false);
  });

  it('should start loading when conversationId is provided', () => {
    const { result } = renderHook(
      () => usePulseMessages('conv-123'),
      { wrapper: createWrapper() }
    );
    
    // Should be loading initially
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useSendPulseMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return mutation structure', () => {
    const { result } = renderHook(
      () => useSendPulseMessage(),
      { wrapper: createWrapper() }
    );
    
    expect(result.current).toHaveProperty('mutate');
    expect(result.current).toHaveProperty('mutateAsync');
    expect(result.current).toHaveProperty('isPending');
    expect(result.current).toHaveProperty('isError');
  });
});

describe('useDeletePulseMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return mutation structure', () => {
    const { result } = renderHook(
      () => useDeletePulseMessage(),
      { wrapper: createWrapper() }
    );
    
    expect(result.current).toHaveProperty('mutate');
    expect(result.current).toHaveProperty('mutateAsync');
    expect(result.current).toHaveProperty('isPending');
  });

  it('should use optimistic update on delete', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    
    // Pre-populate cache with messages
    queryClient.setQueryData(['pulse-messages', 'conversation', 'conv-123'], {
      pages: [{
        messages: [
          { id: 'msg-123', content: 'To delete' },
          { id: 'msg-456', content: 'To keep' },
        ],
        hasMore: false,
      }],
      pageParams: [0],
    });
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    
    const { result } = renderHook(
      () => useDeletePulseMessage(),
      { wrapper }
    );
    
    // Start mutation (don't await)
    result.current.mutate({
      messageId: 'msg-123',
      conversationId: 'conv-123',
    });
    
    // Check cache was updated optimistically
    await waitFor(() => {
      const cached = queryClient.getQueryData(['pulse-messages', 'conversation', 'conv-123']) as any;
      const messages = cached?.pages?.[0]?.messages || [];
      expect(messages.find((m: any) => m.id === 'msg-123')).toBeUndefined();
    });
  });
});
