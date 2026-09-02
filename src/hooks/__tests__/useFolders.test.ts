import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

const createChainableProxy = (resolvedValue: any) => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: any) => resolve(resolvedValue);
      return new Proxy(() => {}, handler);
    },
    apply: () => new Proxy({}, handler),
  };
  return new Proxy({}, handler);
};


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
    from: () => createChainableProxy({ data: [], error: null }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

describe('useFolders', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('should return folders array and CRUD functions', async () => {
    const { useFolders } = await import('@/hooks/documents/useFolders');
    const { result } = renderHook(() => useFolders(null), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(Array.isArray(result.current.folders)).toBe(true);
    expect(result.current.createFolder).toBeDefined();
    expect(result.current.updateFolder).toBeDefined();
    expect(result.current.deleteFolder).toBeDefined();
    expect(result.current.isCreating).toBe(false);
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.isDeleting).toBe(false);
  });

  it('useFolderBreadcrumb should return breadcrumb for null folderId', async () => {
    const { useFolderBreadcrumb } = await import('@/hooks/documents/useFolders');
    const { result } = renderHook(() => useFolderBreadcrumb(null), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([{ id: null, name: 'Mes documents' }]);
  });

  it('useMoveToFolder should return a mutation', async () => {
    const { useMoveToFolder } = await import('@/hooks/documents/useFolders');
    const { result } = renderHook(() => useMoveToFolder(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });
});
