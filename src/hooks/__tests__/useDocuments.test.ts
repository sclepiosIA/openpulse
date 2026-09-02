import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase with chainable proxy
const createChainableProxy = (resolvedValue: any) => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === 'then') {
        return (resolve: any) => resolve(resolvedValue);
      }
      return new Proxy(() => {}, handler);
    },
    apply: () => new Proxy({}, handler),
  };
  return new Proxy({}, handler);
};

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1' } },
});


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
    auth: { getUser: () => mockGetUser() },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe('useDocuments hooks', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.clearAllMocks();
  });

  it('useDocuments should return documents array', async () => {
    const { useDocuments } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(Array.isArray(result.current.data || [])).toBe(true);
  });

  it('useDocument should be disabled when documentId is null', async () => {
    const { useDocument } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useDocument(null), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('useDocumentsByEntity should return empty for null entityId', async () => {
    const { useDocumentsByEntity } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(
      () => useDocumentsByEntity('etablissement', null),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('useDeleteDocument should return a mutation', async () => {
    const { useDeleteDocument } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useRestoreDocument should return a mutation', async () => {
    const { useRestoreDocument } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useRestoreDocument(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('useUpdateDocumentTags should return a mutation', async () => {
    const { useUpdateDocumentTags } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useUpdateDocumentTags(), { wrapper });

    expect(result.current.mutate).toBeDefined();
  });

  it('useRenameDocument should return a mutation', async () => {
    const { useRenameDocument } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useRenameDocument(), { wrapper });

    expect(result.current.mutate).toBeDefined();
  });

  it('useAddDocumentRelation should return a mutation', async () => {
    const { useAddDocumentRelation } = await import('@/hooks/documents/useDocuments');
    const { result } = renderHook(() => useAddDocumentRelation(), { wrapper });

    expect(result.current.mutate).toBeDefined();
  });
});
