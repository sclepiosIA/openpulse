import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useJarvisDocumentRAG } from './useJarvisDocumentRAG';

const h = vi.hoisted(() => {
  const fromState: { result: { data: unknown; error: unknown } } = {
    result: { data: [], error: null },
  };

  const makeBuilder = () => {
    type Builder = {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      textSearch: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      then: (
        onFulfilled?: (v: { data: unknown; error: unknown }) => unknown,
        onRejected?: (e: unknown) => unknown
      ) => Promise<unknown>;
      catch: (onRejected?: (e: unknown) => unknown) => Promise<unknown>;
    };

    const builder = {} as Builder;
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.textSearch = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.delete = vi.fn(() => builder);
    builder.single = vi.fn(() => Promise.resolve(fromState.result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(fromState.result));
    builder.then = (onFulfilled, onRejected) =>
      Promise.resolve(fromState.result).then(onFulfilled, onRejected);
    builder.catch = (onRejected) =>
      Promise.resolve(fromState.result).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());
  const mockRpc = vi.fn();
  const mockInvoke = vi.fn();

  const USER = { id: 'u1', email: 't@t.co' };

  const HYBRID_ROWS = [
    {
      document_id: 'doc-1',
      document_name: 'Contrat A',
      chunk_text: 'Extrait du contrat A',
      combined_score: 0.91,
      similarity: 0.88,
      metadata: { page: 1 },
    },
    {
      document_id: 'doc-2',
      document_name: 'Facture B',
      chunk_text: 'Extrait de la facture B',
      combined_score: 0.74,
      similarity: 0.7,
      metadata: { page: 3 },
    },
  ];

  const KB_ROWS = [
    {
      id: 'kb-1',
      title: 'Article KB 1',
      content_preview: 'Aperçu article 1',
      category_name: 'RH',
      base_type: 'internal',
      combined_score: 0.8,
    },
  ];

  const TEXT_ROWS = [
    {
      document_id: 'doc-9',
      chunk_text: 'Texte trouvé par recherche plein texte',
      metadata: { source: 'upload' },
      documents: { name: 'Doc Texte' },
    },
  ];

  return { fromState, mockFrom, mockRpc, mockInvoke, USER, HYBRID_ROWS, KB_ROWS, TEXT_ROWS };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: h.mockFrom,
    rpc: h.mockRpc,
    functions: { invoke: h.mockInvoke },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: h.USER, session: { user: h.USER }, isLoading: false }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisDocumentRAG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.fromState.result = { data: [], error: null };
  });

  it('expose un état initial cohérent', () => {
    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.isIndexing).toBe(false);
    expect(result.current.searchResults).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('searchDocuments effectue une recherche hybride avec embedding et retourne documents + KB', async () => {
    h.mockInvoke.mockResolvedValue({ data: { embedding: [0.1, 0.2, 0.3] }, error: null });
    h.mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'search_documents_hybrid') {
        return Promise.resolve({ data: h.HYBRID_ROWS, error: null });
      }
      if (fnName === 'search_kb_semantic') {
        return Promise.resolve({ data: h.KB_ROWS, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let results: Awaited<ReturnType<typeof result.current.searchDocuments>> = null;
    await act(async () => {
      results = await result.current.searchDocuments('contrat', { limit: 5 });
    });

    expect(h.mockInvoke).toHaveBeenCalledWith('jarvis-generate-embedding', {
      body: { text: 'contrat' },
    });
    expect(h.mockRpc).toHaveBeenCalledWith('search_documents_hybrid', {
      p_query_embedding: [0.1, 0.2, 0.3],
      p_query_text: 'contrat',
      p_user_id: 'u1',
      p_limit: 5,
      p_similarity_threshold: 0.65,
    });

    expect(results).not.toBeNull();
    expect(result.current.searchResults?.search_type).toBe('hybrid');
    // 2 documents, sans l'article de base de connaissances que la recherche
    // semantique ajoutait : la table est retiree.
    expect(result.current.searchResults?.total).toBe(2);
    expect(result.current.searchResults?.documents).toHaveLength(2);
    expect(result.current.searchResults?.documents[0]).toMatchObject({
      document_id: 'doc-1',
      document_name: 'Contrat A',
      excerpt: 'Extrait du contrat A',
      relevance_score: 0.91,
      similarity: 0.88,
    });
    // La recherche ne rend plus d'article de base de connaissances : la
    // table est retiree, et la liste doit etre vide plutot qu'absente.
    expect(result.current.searchResults?.kb_articles).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('searchDocuments bascule en recherche texte sans embedding', async () => {
    h.mockInvoke.mockResolvedValue({ data: null, error: { message: 'embedding down' } });
    h.fromState.result = { data: h.TEXT_ROWS, error: null };

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.searchDocuments('facture');
    });

    expect(h.mockFrom).toHaveBeenCalledWith('document_embeddings');
    expect(h.mockRpc).not.toHaveBeenCalled();
    expect(result.current.searchResults?.search_type).toBe('text_only');
    expect(result.current.searchResults?.documents).toHaveLength(1);
    expect(result.current.searchResults?.documents[0]).toMatchObject({
      document_id: 'doc-9',
      document_name: 'Doc Texte',
      excerpt: 'Texte trouvé par recherche plein texte',
      relevance_score: 0.5,
    });
    expect(result.current.searchResults?.kb_articles).toHaveLength(0);
    expect(result.current.searchResults?.total).toBe(1);
  });

  it('searchDocuments retourne null pour une requête vide sans appeler supabase', async () => {
    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let res: Awaited<ReturnType<typeof result.current.searchDocuments>> = null;
    await act(async () => {
      res = await result.current.searchDocuments('   ');
    });

    expect(res).toBeNull();
    expect(h.mockInvoke).not.toHaveBeenCalled();
  });

  it('searchDocuments capture les exceptions et positionne error', async () => {
    h.mockInvoke.mockRejectedValue(new Error('x'));

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let res: Awaited<ReturnType<typeof result.current.searchDocuments>> = null;
    await act(async () => {
      res = await result.current.searchDocuments('contrat');
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('x');
    expect(result.current.isSearching).toBe(false);
  });

  it('indexDocument retourne true en cas de succès et appelle la bonne edge function', async () => {
    h.mockInvoke.mockResolvedValue({ data: { success: true, chunks: 4 }, error: null });

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let ok = false;
    await act(async () => {
      ok = await result.current.indexDocument('doc-42', true);
    });

    expect(ok).toBe(true);
    expect(h.mockInvoke).toHaveBeenCalledWith('jarvis-index-document', {
      body: { document_id: 'doc-42', force_reindex: true },
    });
    expect(result.current.isIndexing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('indexDocument retourne false et positionne error quand le serveur signale un échec', async () => {
    h.mockInvoke.mockResolvedValue({ data: { success: false, error: 'boom' }, error: null });

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let ok = true;
    await act(async () => {
      ok = await result.current.indexDocument('doc-43');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('boom');
    expect(result.current.isIndexing).toBe(false);
  });

  it('getIndexingStatus compte les chunks par document demandé', async () => {
    h.fromState.result = {
      data: [
        { document_id: 'd1' },
        { document_id: 'd1' },
        { document_id: 'd2' },
      ],
      error: null,
    };

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let statuses: Awaited<ReturnType<typeof result.current.getIndexingStatus>> = [];
    await act(async () => {
      statuses = await result.current.getIndexingStatus(['d1', 'd2', 'd3']);
    });

    expect(h.mockFrom).toHaveBeenCalledWith('document_embeddings');
    expect(statuses).toEqual([
      { document_id: 'd1', chunks: 2, is_indexed: true },
      { document_id: 'd2', chunks: 1, is_indexed: true },
      { document_id: 'd3', chunks: 0, is_indexed: false },
    ]);
  });

  it('getIndexingStatus retourne un tableau vide en cas erreur supabase', async () => {
    h.fromState.result = { data: null, error: { message: 'x' } };

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    let statuses: Awaited<ReturnType<typeof result.current.getIndexingStatus>> = [];
    await act(async () => {
      statuses = await result.current.getIndexingStatus(['d1']);
    });

    expect(statuses).toEqual([]);
  });

  it('clearResults réinitialise searchResults et error', async () => {
    h.mockInvoke.mockResolvedValue({ data: { embedding: [0.1] }, error: null });
    h.mockRpc.mockResolvedValue({ data: h.HYBRID_ROWS, error: null });

    const { result } = renderHook(() => useJarvisDocumentRAG(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.searchDocuments('contrat');
    });
    expect(result.current.searchResults).not.toBeNull();

    act(() => {
      result.current.clearResults();
    });

    expect(result.current.searchResults).toBeNull();
    expect(result.current.error).toBeNull();
  });
});