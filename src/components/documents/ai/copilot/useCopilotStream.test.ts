import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useCopilotStream, useCopilotTransform } from "./useCopilotStream";

const {
  AUTH_SESSION,
  ROWS,
  TRANSFORM_RESULT,
  mockFrom,
  mockGetSession,
  mockInvoke,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => {
  type TransformResult = {
    action: string;
    result: string;
    parsed: { kind: string; score: number };
    latency_ms: number;
  };

  const ROWS = [{ id: "1" }] as const;
  const queryResult = { data: ROWS, error: null } as const;

  type QueryResult = typeof queryResult;
  type ChainBuilder = {
    select: (...args: unknown[]) => ChainBuilder;
    eq: (...args: unknown[]) => ChainBuilder;
    neq: (...args: unknown[]) => ChainBuilder;
    gt: (...args: unknown[]) => ChainBuilder;
    gte: (...args: unknown[]) => ChainBuilder;
    lt: (...args: unknown[]) => ChainBuilder;
    lte: (...args: unknown[]) => ChainBuilder;
    in: (...args: unknown[]) => ChainBuilder;
    is: (...args: unknown[]) => ChainBuilder;
    ilike: (...args: unknown[]) => ChainBuilder;
    order: (...args: unknown[]) => ChainBuilder;
    limit: (...args: unknown[]) => ChainBuilder;
    range: (...args: unknown[]) => ChainBuilder;
    insert: (...args: unknown[]) => ChainBuilder;
    upsert: (...args: unknown[]) => ChainBuilder;
    update: (...args: unknown[]) => ChainBuilder;
    delete: (...args: unknown[]) => ChainBuilder;
    single: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: Promise<QueryResult>["then"];
    catch: Promise<QueryResult>["catch"];
  };

  const builder = {} as ChainBuilder;
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.neq = () => builder;
  builder.gt = () => builder;
  builder.gte = () => builder;
  builder.lt = () => builder;
  builder.lte = () => builder;
  builder.in = () => builder;
  builder.is = () => builder;
  builder.ilike = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.range = () => builder;
  builder.insert = () => builder;
  builder.upsert = () => builder;
  builder.update = () => builder;
  builder.delete = () => builder;
  builder.single = () => Promise.resolve(queryResult);
  builder.maybeSingle = () => Promise.resolve(queryResult);
  builder.then = (onfulfilled, onrejected) => Promise.resolve(queryResult).then(onfulfilled, onrejected);
  builder.catch = (onrejected) => Promise.resolve(queryResult).catch(onrejected);

  const TRANSFORM_RESULT: TransformResult = {
    action: "rewrite",
    result: "Texte réécrit",
    parsed: { kind: "rewrite", score: 9 },
    latency_ms: 42,
  };

  const AUTH_SESSION = {
    session: {
      access_token: "tok",
    },
  };

  return {
    AUTH_SESSION,
    ROWS,
    TRANSFORM_RESULT,
    mockFrom: vi.fn((_table: string) => builder),
    mockGetSession: vi.fn(async (): Promise<{ data: typeof AUTH_SESSION; error: null }> => ({
      data: AUTH_SESSION,
      error: null,
    })),
    mockInvoke: vi.fn(
      async (
        _name: string,
        _options: unknown,
      ): Promise<{ data: TransformResult | null; error: { message: string } | null }> => ({
        data: TRANSFORM_RESULT,
        error: null,
      }),
    ),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createSseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

  return new Response(stream, { status });
}

describe("useCopilotTransform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: TRANSFORM_RESULT, error: null });
    mockGetSession.mockResolvedValue({ data: AUTH_SESSION, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("expose isLoading pendant l'appel puis retourne le résultat métier", async () => {
    const deferred = createDeferred<{ data: typeof TRANSFORM_RESULT; error: null }>();
    mockInvoke.mockImplementationOnce(() => deferred.promise);

    const { result } = renderHook(() => useCopilotTransform(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    let runPromise: Promise<Awaited<ReturnType<typeof result.current.run>>> | undefined;
    act(() => {
      runPromise = result.current.run({
        action: "rewrite",
        selection: "Bonjour",
        language: "fr",
      });
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    let output: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      deferred.resolve({ data: TRANSFORM_RESULT, error: null });
      const pending = runPromise;
      if (pending) {
        output = await pending;
      }
    });

    expect(output).toEqual(TRANSFORM_RESULT);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("doc-ai-transform", {
      body: {
        action: "rewrite",
        selection: "Bonjour",
        fullText: undefined,
        language: "fr",
        documentId: null,
        surface: "document",
        extraContext: undefined,
      },
    });
  });

  it("renseigne error et affiche un toast quand la fonction Supabase renvoie une erreur", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    const { result } = renderHook(() => useCopilotTransform(), { wrapper: createWrapper() });

    let output: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      output = await result.current.run({
        action: "summarize",
        fullText: "Un texte court",
        surface: "presentation",
        documentId: "doc-1",
        extraContext: "contexte",
      });
    });

    expect(output).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Erreur IA");
    expect(mockToastError).toHaveBeenCalledWith("Erreur IA");
    expect(mockInvoke).toHaveBeenCalledWith("doc-ai-transform", {
      body: {
        action: "summarize",
        selection: undefined,
        fullText: "Un texte court",
        language: undefined,
        documentId: "doc-1",
        surface: "presentation",
        extraContext: "contexte",
      },
    });
  });
});

describe("useCopilotStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "http://localhost");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon");
    mockInvoke.mockResolvedValue({ data: TRANSFORM_RESULT, error: null });
    mockGetSession.mockResolvedValue({ data: AUTH_SESSION, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("expose isStreaming pendant le fetch SSE puis transmet les deltas et le payload attendu", async () => {
    const fetchDeferred = createDeferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => fetchDeferred.promise);
    vi.stubGlobal("fetch", fetchMock);

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useCopilotStream(), { wrapper: createWrapper() });

    expect(result.current.isStreaming).toBe(false);

    let startPromise: Promise<void> | undefined;
    act(() => {
      startPromise = result.current.start({
        messages: [{ role: "user", content: "Aide-moi" }],
        documentTitle: "Titre",
        documentHtml: "<p>Bonjour</p>",
        contextSummary: "Résumé",
        documentId: null,
        onDelta,
        onDone,
        onError,
      });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.isStreaming).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();
    if (!call) {
      throw new Error("fetch call missing");
    }

    const [url, init] = call;
    expect(url).toBe("http://localhost/functions/v1/doc-ai-copilot");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer tok",
      apikey: "anon",
    });
    expect(typeof init?.body).toBe("string");
    if (typeof init?.body !== "string") {
      throw new Error("fetch body missing");
    }
    expect(JSON.parse(init.body) as unknown).toEqual({
      messages: [{ role: "user", content: "Aide-moi" }],
      documentTitle: "Titre",
      documentHtml: "<p>Bonjour</p>",
      contextSummary: "Résumé",
      documentId: null,
    });

    await act(async () => {
      fetchDeferred.resolve(
        createSseResponse([
          'data: {"delta":"Bon"}\n',
          'data: {"delta":"jour"}\n',
          "event: ignored\n",
          "data: invalid-json\n",
        ]),
      );
      const pending = startPromise;
      if (pending) {
        await pending;
      }
    });

    expect(onDelta).toHaveBeenNthCalledWith(1, "Bon");
    expect(onDelta).toHaveBeenNthCalledWith(2, "jour");
    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it("appelle onError sans fetch quand la session ne contient pas de jeton", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(createSseResponse(['data: {"delta":"x"}\n'])),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useCopilotStream(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.start({
        messages: [{ role: "user", content: "Question" }],
        onDelta,
        onDone,
        onError,
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDelta).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Session expirée");
    expect(result.current.isStreaming).toBe(false);
  });

  it("appelle onError avec le statut et le corps quand la réponse SSE échoue", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(new Response("boom", { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useCopilotStream(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.start({
        messages: [{ role: "user", content: "Question" }],
        documentId: "doc-2",
        onDelta,
        onDone,
        onError,
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDelta).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Erreur 500: boom");
    expect(result.current.isStreaming).toBe(false);
  });

  it("utilise une référence stable pour le builder Supabase chainable", async () => {
    const query = mockFrom("documents").select("*").eq("id", ROWS[0].id).limit(1);
    await expect(query).resolves.toEqual({ data: ROWS, error: null });
    expect(mockFrom).toHaveBeenCalledWith("documents");
  });
});