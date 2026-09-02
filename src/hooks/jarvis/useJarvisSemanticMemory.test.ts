/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisSemanticMemory } from './useJarvisSemanticMemory';

const {
  AUTH_STATE,
  FROM_ROWS,
  ADVANCED_ROWS,
  SEMANTIC_ROWS,
  EMBEDDING_DATA,
  INVOKE_ERROR_RESULT,
  RPC_ERROR_RESULT,
  FROM_ERROR_RESULT,
  SANITIZED_VALUE,
  mockUseAuth,
  mockWarn,
  mockError,
  mockSanitize,
  mockInvoke,
  mockRpc,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'user@test.local' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const FROM_ROWS = [
    {
      id: 'm1',
      category: 'preference',
      key: 'favorite color',
      value: 'blue ocean',
      importance: 5,
    },
    {
      id: 'm2',
      category: 'fact',
      key: 'pet',
      value: 'black cat',
      importance: 3,
    },
  ];

  const ADVANCED_ROWS = [
    {
      id: 'a1',
      category: 'fact',
      key: 'project status',
      value: 'alpha launch ready',
      importance: 2,
    },
    {
      id: 'a2',
      category: 'context',
      key: 'project alpha',
      value: 'launch checklist',
      importance: 4,
    },
  ];

  const SEMANTIC_ROWS = [
    {
      id: 's1',
      category: 'instruction',
      key: 'meeting preference',
      value: 'send summary after calls',
      similarity: 0.91,
    },
  ];

  const EMBEDDING_DATA = { embedding: [0.1, 0.2, 0.3] };
  const INVOKE_ERROR_RESULT = { data: null, error: { message: 'embed failed' } };
  const RPC_ERROR_RESULT = { data: null, error: { message: 'rpc failed' } };
  const FROM_ERROR_RESULT = { data: null, error: { message: 'select failed' } };
  const SANITIZED_VALUE = 'safe-query';

  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockWarn = vi.fn();
  const mockError = vi.fn();
  const mockSanitize = vi.fn(() => SANITIZED_VALUE);
  const mockInvoke = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  const builder: {
    __result: { data: unknown; error: { message: string } | null };
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  } = {
    __result: { data: FROM_ROWS, error: null },
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(this.__result).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(this.__result).catch(onRejected);
    },
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.or.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });

  return {
    AUTH_STATE,
    FROM_ROWS,
    ADVANCED_ROWS,
    SEMANTIC_ROWS,
    EMBEDDING_DATA,
    INVOKE_ERROR_RESULT,
    RPC_ERROR_RESULT,
    FROM_ERROR_RESULT,
    SANITIZED_VALUE,
    mockUseAuth,
    mockWarn,
    mockError,
    mockSanitize,
    mockInvoke,
    mockRpc,
    mockFrom,
    builder,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: mockWarn,
    error: mockError,
  },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: mockSanitize,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function calcTextSimilarity(query: string, text: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const q = words(query);
  const t = words(text);
  if (q.size === 0 || t.size === 0) return 0;
  const inter = new Set([...q].filter(w => t.has(w)));
  const union = new Set([...q, ...t]);
  return inter.size / union.size;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockUseAuth.mockReturnValue(AUTH_STATE);
  mockSanitize.mockReturnValue(SANITIZED_VALUE);

  builder.__result = { data: FROM_ROWS, error: null };

  mockFrom.mockImplementation(() => builder);
  mockRpc.mockResolvedValue({ data: SEMANTIC_ROWS, error: null });
  mockInvoke.mockResolvedValue({ data: EMBEDDING_DATA, error: null });
});

describe('useJarvisSemanticMemory', () => {
  it('initialise avec état par défaut', () => {
    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.lastResults).toEqual([]);
    expect(typeof result.current.searchMemory).toBe('function');
    expect(typeof result.current.searchMemoryAdvanced).toBe('function');
    expect(typeof result.current.buildContextFromQuery).toBe('function');
    expect(typeof result.current.getContextualMemories).toBe('function');
    expect(typeof result.current.generateEmbedding).toBe('function');
  });

  it('effectue une recherche sémantique via embeddings et stocke les résultats', async () => {
    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.searchMemory('meeting summary', 5);
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(true);
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await promise;
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-generate-embedding', {
      body: { text: 'meeting summary', mode: 'query' },
    });

    expect(mockRpc).toHaveBeenCalledWith('search_jarvis_memory_semantic', {
      p_user_id: 'user-1',
      p_query_embedding: EMBEDDING_DATA.embedding,
      p_limit: 5,
    });

    expect(returned).toEqual([
      {
        id: 's1',
        category: 'instruction',
        key: 'meeting preference',
        value: 'send summary after calls',
        importance: 3,
        relevance_score: 0.91,
      },
    ]);

    expect(result.current.lastResults).toEqual([
      {
        id: 's1',
        category: 'instruction',
        key: 'meeting preference',
        value: 'send summary after calls',
        importance: 3,
        relevance_score: 0.91,
      },
    ]);
    expect(result.current.isSearching).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fallback en recherche textuelle si la génération d’embedding échoue', async () => {
    mockInvoke.mockResolvedValue(INVOKE_ERROR_RESULT);
    builder.__result = { data: FROM_ROWS, error: null };

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.searchMemory('blue ocean', 2);
    });

    expect(mockWarn).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('jarvis_user_memory');
    expect(builder.select).toHaveBeenCalledWith('id, category, key, value, importance');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.or).toHaveBeenCalledWith('key.ilike.%safe-query%,value.ilike.%safe-query%');
    expect(builder.order).toHaveBeenCalledWith('importance', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(mockSanitize).toHaveBeenCalledWith('blue ocean');

    const rows = returned as Array<{ id: string; relevance_score: number }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('m1');
    expect(rows[0].relevance_score).toBeCloseTo(calcTextSimilarity('blue ocean', 'favorite color blue ocean'), 5);
    expect(rows[1].id).toBe('m2');
    expect(rows[1].relevance_score).toBeCloseTo(calcTextSimilarity('blue ocean', 'pet black cat'), 5);
    expect(result.current.lastResults).toEqual(rows);
    expect(result.current.isSearching).toBe(false);
  });

  it('fallback en recherche textuelle si la recherche sémantique retourne une erreur', async () => {
    mockRpc.mockResolvedValue(RPC_ERROR_RESULT);
    builder.__result = { data: FROM_ROWS, error: null };

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.searchMemory('blue ocean', 3);
    });

    expect(mockRpc).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('jarvis_user_memory');
    expect((returned as Array<unknown>)).toHaveLength(2);
    expect(result.current.isSearching).toBe(false);
  });

  it('retourne [] et log une erreur si la recherche textuelle échoue', async () => {
    mockInvoke.mockResolvedValue(INVOKE_ERROR_RESULT);
    builder.__result = FROM_ERROR_RESULT;

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.searchMemory('failure case', 4);
    });

    expect(returned).toEqual([]);
    expect(result.current.lastResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(mockError).toHaveBeenCalled();
  });

  it('effectue une recherche avancée avec filtres, tri par similarité et mise à jour de lastResults', async () => {
    builder.__result = { data: ADVANCED_ROWS, error: null };

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.searchMemoryAdvanced('project alpha', {
        categories: ['fact', 'context'],
        minImportance: 2,
        limit: 10,
      });
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(true);
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await promise;
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_user_memory');
    expect(builder.select).toHaveBeenCalledWith('id, category, key, value, importance');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.gte).toHaveBeenCalledWith('importance', 2);
    expect(builder.or).toHaveBeenCalledWith('key.ilike.%safe-query%,value.ilike.%safe-query%');
    expect(builder.order).toHaveBeenCalledWith('importance', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(builder.in).toHaveBeenCalledWith('category', ['fact', 'context']);

    const rows = returned as Array<{ id: string; relevance_score: number }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('a2');
    expect(rows[0].relevance_score).toBeCloseTo(calcTextSimilarity('project alpha', 'project alpha launch checklist'), 5);
    expect(rows[1].id).toBe('a1');
    expect(rows[1].relevance_score).toBeCloseTo(calcTextSimilarity('project alpha', 'project status alpha launch ready'), 5);
    expect(result.current.lastResults).toEqual(rows);
    expect(result.current.isSearching).toBe(false);
  });

  it('retourne [] si la recherche avancée échoue', async () => {
    builder.__result = FROM_ERROR_RESULT;

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.searchMemoryAdvanced('oops', {
        categories: ['fact'],
        minImportance: 3,
        limit: 5,
      });
    });

    expect(returned).toEqual([]);
    expect(result.current.lastResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(mockError).toHaveBeenCalled();
  });

  it('construit un contexte formaté à partir des résultats regroupés par catégorie', async () => {
    mockInvoke.mockResolvedValue(INVOKE_ERROR_RESULT);
    builder.__result = { data: FROM_ROWS, error: null };

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let ctx = '';
    await act(async () => {
      ctx = await result.current.buildContextFromQuery('blue ocean');
    });

    expect(ctx).toContain('[MÉMOIRE SÉMANTIQUE]:');
    expect(ctx).toContain('PRÉFÉRENCES:');
    expect(ctx).toContain('- favorite color: blue ocean (pertinence: 50%)');
    expect(ctx).toContain('FAITS:');
    expect(ctx).toContain('- pet: black cat (pertinence: 0%)');
  });

  it('retourne une chaîne vide si buildContextFromQuery ne trouve rien', async () => {
    mockInvoke.mockResolvedValue(INVOKE_ERROR_RESULT);
    builder.__result = { data: [], error: null };

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let ctx = 'filled';
    await act(async () => {
      ctx = await result.current.buildContextFromQuery('nothing');
    });

    expect(ctx).toBe('');
  });

  it('getContextualMemories concatène pageContext et entityType avant la recherche', async () => {
    mockInvoke.mockResolvedValue(INVOKE_ERROR_RESULT);
    builder.__result = { data: FROM_ROWS, error: null };

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.getContextualMemories('dashboard', 'invoice');
    });

    expect(mockSanitize).toHaveBeenCalledWith('dashboard invoice');
    expect(builder.limit).toHaveBeenCalledWith(5);
    expect((returned as Array<unknown>)).toHaveLength(2);
  });

  it('generateEmbedding retourne null si invoke lève une exception', async () => {
    mockInvoke.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let embedding: number[] | null = [9];
    await act(async () => {
      embedding = await result.current.generateEmbedding('hello');
    });

    expect(embedding).toBeNull();
    expect(mockError).toHaveBeenCalled();
  });

  it('retourne [] si utilisateur absent ou requête vide', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let noUserResults: unknown = null;
    await act(async () => {
      noUserResults = await result.current.searchMemory('hello', 5);
    });
    expect(noUserResults).toEqual([]);

    mockUseAuth.mockReturnValue(AUTH_STATE);

    const { result: result2 } = renderHook(() => useJarvisSemanticMemory(), {
      wrapper: createWrapper(),
    });

    let emptyQueryResults: unknown = null;
    await act(async () => {
      emptyQueryResults = await result2.current.searchMemory('   ', 5);
    });

    expect(emptyQueryResults).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});