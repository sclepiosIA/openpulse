/* @vitest-environment jsdom */
import React, { PropsWithChildren, createElement } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisStreaming } from './useJarvisStreaming';

const {
  AUTH_STATE,
  TOAST_FN,
  SANITIZE_FN,
  DEBUG_LOG,
  DEBUG_ERROR,
  CACHE_STATS,
  CACHE_GET,
  CACHE_SET,
  SESSION_DATA,
  BUILDER_RESULT,
  BUILDER,
  MOCK_FROM,
  GET_SESSION,
} = vi.hoisted(() => {
  const AUTH_STATE_LOCAL = {
    user: { id: 'u1', email: 'u1@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };
  const TOAST_LOCAL = vi.fn();
  const SANITIZE_LOCAL = vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'unknown error';
  });
  const DEBUG_LOG_LOCAL = vi.fn();
  const DEBUG_ERROR_LOCAL = vi.fn();
  const CACHE_STATS_LOCAL = { hits: 0, misses: 0, entries: 0, hitRate: '0%' };
  const CACHE_GET_LOCAL = vi.fn();
  const CACHE_SET_LOCAL = vi.fn();
  const SESSION_DATA_LOCAL = {
    data: {
      session: {
        access_token: 'tkn1',
      },
    },
    error: null,
  };
  const BUILDER_RESULT_LOCAL = { data: null, error: null };
  const BUILDER_LOCAL = {
    select: vi.fn(() => BUILDER_LOCAL),
    eq: vi.fn(() => BUILDER_LOCAL),
    gte: vi.fn(() => BUILDER_LOCAL),
    lte: vi.fn(() => BUILDER_LOCAL),
    in: vi.fn(() => BUILDER_LOCAL),
    order: vi.fn(() => BUILDER_LOCAL),
    limit: vi.fn(() => BUILDER_LOCAL),
    insert: vi.fn(() => BUILDER_LOCAL),
    update: vi.fn(() => BUILDER_LOCAL),
    delete: vi.fn(() => BUILDER_LOCAL),
    upsert: vi.fn(() => BUILDER_LOCAL),
    single: vi.fn(async () => BUILDER_RESULT_LOCAL),
    maybeSingle: vi.fn(async () => BUILDER_RESULT_LOCAL),
    then: (onFulfilled: (value: typeof BUILDER_RESULT_LOCAL) => unknown) =>
      Promise.resolve(onFulfilled(BUILDER_RESULT_LOCAL)),
    catch: vi.fn(),
  };
  const MOCK_FROM_LOCAL = vi.fn(() => BUILDER_LOCAL);
  const GET_SESSION_LOCAL = vi.fn(async () => SESSION_DATA_LOCAL);
  return {
    AUTH_STATE: AUTH_STATE_LOCAL,
    TOAST_FN: TOAST_LOCAL,
    SANITIZE_FN: SANITIZE_LOCAL,
    DEBUG_LOG: DEBUG_LOG_LOCAL,
    DEBUG_ERROR: DEBUG_ERROR_LOCAL,
    CACHE_STATS: CACHE_STATS_LOCAL,
    CACHE_GET: CACHE_GET_LOCAL,
    CACHE_SET: CACHE_SET_LOCAL,
    SESSION_DATA: SESSION_DATA_LOCAL,
    BUILDER_RESULT: BUILDER_RESULT_LOCAL,
    BUILDER: BUILDER_LOCAL,
    MOCK_FROM: MOCK_FROM_LOCAL,
    GET_SESSION: GET_SESSION_LOCAL,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: DEBUG_LOG,
    error: DEBUG_ERROR,
  },
}));

vi.mock('./useJarvisResponseCache', () => ({
  useJarvisResponseCache: () => ({
    get: CACHE_GET,
    set: CACHE_SET,
    stats: CACHE_STATS,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: MOCK_FROM,
    auth: {
      getSession: GET_SESSION,
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

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createSseResponse(chunks: string[], options?: { status?: number; ok?: boolean }) {
  let index = 0;
  return {
    status: options?.status ?? 200,
    ok: options?.ok ?? true,
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          if (index < chunks.length) {
            const value = new TextEncoder().encode(chunks[index]);
            index += 1;
            return { done: false, value };
          }
          return { done: true, value: undefined };
        }),
      }),
    },
  } as unknown as Response;
}

describe('useJarvisStreaming', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    CACHE_GET.mockReturnValue(null);
    CACHE_SET.mockReturnValue(undefined);
    SANITIZE_FN.mockImplementation((error: unknown) => {
      if (error instanceof Error) return error.message;
      return 'unknown error';
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('gère le chargement puis le succès avec reasoning, outils, delta, done et mise en cache', async () => {
    const chunks = [
      'data: {"type":"reasoning","step":1,"phase":"analyze","label":"Analyse","detail":"Lecture","status":"active"}\n',
      'data: {"type":"tool_start","tool":"search","round":1}\n',
      'data: {"type":"tool_result","tool":"search","success":true,"summary":"2 résultats"}\n',
      'data: {"type":"delta","content":"Bon"}\n',
      'data: {"type":"reasoning","step":1,"phase":"analyze","label":"Analyse","detail":"Terminé","status":"completed"}\n',
      'data: {"type":"delta","content":"jour"}\n',
      'data: {"type":"done","content":"Bonjour"}\n',
    ];

    vi.mocked(global.fetch).mockResolvedValue(
      createSseResponse(chunks)
    );

    const { result } = renderHook(() => useJarvisStreaming(), {
      wrapper: createWrapper(),
    });

    let promise: Promise<string | null>;
    await act(async () => {
      promise = result.current.streamChat('Salut');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.currentContent).toBe('Bonjour');
      expect(result.current.isDone).toBe(true);
      expect(result.current.tokensGenerated).toBe(2);
    });

    await expect(promise!).resolves.toBe('Bonjour');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, request] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain('jarvis-brain-stream');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer tkn1',
      })
    );

    const bodyObj = JSON.parse(String(request?.body));
    expect(bodyObj.user_id).toBe('u1');
    expect(bodyObj.message).toBe('Salut');
    expect(bodyObj).not.toHaveProperty('page_context');

    expect(result.current.reasoningSteps).toEqual([
      {
        step: 1,
        phase: 'analyze',
        label: 'Analyse',
        detail: 'Terminé',
        status: 'completed',
      },
    ]);

    expect(result.current.activeTools).toEqual([
      {
        tool: 'search',
        status: 'success',
        round: 1,
        summary: '2 résultats',
      },
    ]);

    expect(CACHE_SET).toHaveBeenCalledWith('Salut', 'Bonjour', expect.any(Number));
    expect(result.current.cacheStats).toBe(CACHE_STATS);
    expect(result.current.error).toBeNull();
    expect(TOAST_FN).not.toHaveBeenCalled();
  });

  it('retourne immédiatement la réponse du cache quand disponible', async () => {
    CACHE_GET.mockReturnValue('Réponse cache');

    const { result } = renderHook(() => useJarvisStreaming(), {
      wrapper: createWrapper(),
    });

    let response: string | null = null;
    await act(async () => {
      response = await result.current.streamChat('Question cache');
    });

    expect(response).toBe('Réponse cache');
    expect(CACHE_GET).toHaveBeenCalledWith('Question cache');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.currentContent).toBe('Réponse cache');
    expect(result.current.isDone).toBe(true);
    expect(result.current.tokensGenerated).toBe('Réponse cache'.length / 4);
    expect(result.current.isStreaming).toBe(false);
  });

  it('passe en erreur quand le flux SSE renvoie un événement error', async () => {
    const chunks = [
      'data: {"error":"stream cassé"}\n',
    ];

    vi.mocked(global.fetch).mockResolvedValue(
      createSseResponse(chunks)
    );

    const { result } = renderHook(() => useJarvisStreaming(), {
      wrapper: createWrapper(),
    });

    let response: string | null = 'init';
    await act(async () => {
      response = await result.current.streamChat('Question erreur');
    });

    expect(response).toBeNull();

    await waitFor(() => {
      expect(result.current.error).toBe('stream cassé');
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.isDone).toBe(false);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'stream cassé',
      variant: 'destructive',
    });
  });

  it('gère une erreur HTTP classique en isError métier avec message sanitizé', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 500,
      ok: false,
      body: {
        getReader: () => null,
      },
    } as unknown as Response);

    const { result } = renderHook(() => useJarvisStreaming(), {
      wrapper: createWrapper(),
    });

    let response: string | null = 'init';
    await act(async () => {
      response = await result.current.streamChat('Question http');
    });

    expect(response).toBeNull();

    await waitFor(() => {
      expect(result.current.error).toBe('HTTP 500');
      expect(result.current.isStreaming).toBe(false);
    });

    expect(SANITIZE_FN).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'HTTP 500',
      variant: 'destructive',
    });
  });

  it('cancelStream arrête explicitement le stream en cours', async () => {
    let abortSignal: AbortSignal | undefined;

    vi.mocked(global.fetch).mockImplementation(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        abortSignal = init?.signal;
        return {
          status: 200,
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn(() => new Promise(() => undefined)),
            }),
          },
        } as unknown as Response;
      }
    );

    const { result } = renderHook(() => useJarvisStreaming(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      void result.current.streamChat('Annule-moi');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });

    await act(async () => {
      result.current.cancelStream();
    });

    expect(abortSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it('resetStream réinitialise complètement l’état', async () => {
    CACHE_GET.mockReturnValue('Texte déjà là');

    const { result } = renderHook(() => useJarvisStreaming(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.streamChat('seed');
    });

    expect(result.current.currentContent).toBe('Texte déjà là');
    expect(result.current.isDone).toBe(true);

    await act(async () => {
      result.current.resetStream();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentContent).toBe('');
    expect(result.current.isDone).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.tokensGenerated).toBe(0);
    expect(result.current.streamDurationMs).toBe(0);
    expect(result.current.activeTools).toEqual([]);
    expect(result.current.reasoningSteps).toEqual([]);
  });
});