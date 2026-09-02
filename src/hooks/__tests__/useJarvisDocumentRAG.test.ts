import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { embedding: [0.1, 0.2, 0.3], success: true },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: () => createChainableProxy({ data: [], error: null }),
  },
}));

describe('useJarvisDocumentRAG', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should initialize with correct defaults', async () => {
    const { useJarvisDocumentRAG } = await import('@/hooks/jarvis/useJarvisDocumentRAG');
    const { result } = renderHook(() => useJarvisDocumentRAG());

    expect(result.current.isSearching).toBe(false);
    expect(result.current.isIndexing).toBe(false);
    expect(result.current.searchResults).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should provide all action functions', async () => {
    const { useJarvisDocumentRAG } = await import('@/hooks/jarvis/useJarvisDocumentRAG');
    const { result } = renderHook(() => useJarvisDocumentRAG());

    expect(typeof result.current.searchDocuments).toBe('function');
    expect(typeof result.current.indexDocument).toBe('function');
    expect(typeof result.current.batchIndexDocuments).toBe('function');
    expect(typeof result.current.getIndexingStatus).toBe('function');
    expect(typeof result.current.clearResults).toBe('function');
  });

  it('searchDocuments should return null for empty query', async () => {
    const { useJarvisDocumentRAG } = await import('@/hooks/jarvis/useJarvisDocumentRAG');
    const { result } = renderHook(() => useJarvisDocumentRAG());

    let searchResult: any;
    await act(async () => {
      searchResult = await result.current.searchDocuments('');
    });

    expect(searchResult).toBeNull();
  });

  it('clearResults should reset state', async () => {
    const { useJarvisDocumentRAG } = await import('@/hooks/jarvis/useJarvisDocumentRAG');
    const { result } = renderHook(() => useJarvisDocumentRAG());

    act(() => {
      result.current.clearResults();
    });

    expect(result.current.searchResults).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('indexDocument should return false for empty documentId', async () => {
    const { useJarvisDocumentRAG } = await import('@/hooks/jarvis/useJarvisDocumentRAG');
    const { result } = renderHook(() => useJarvisDocumentRAG());

    let indexResult: boolean = true;
    await act(async () => {
      indexResult = await result.current.indexDocument('');
    });

    expect(indexResult).toBe(false);
  });

  it('getIndexingStatus should return array', async () => {
    const { useJarvisDocumentRAG } = await import('@/hooks/jarvis/useJarvisDocumentRAG');
    const { result } = renderHook(() => useJarvisDocumentRAG());

    let status: any[];
    await act(async () => {
      status = await result.current.getIndexingStatus(['doc-1']);
    });

    expect(Array.isArray(status!)).toBe(true);
  });
});
