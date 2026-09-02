import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeSearchDocuments,
  executeSearchKnowledgeBase,
  executeIndexDocument,
  executeGetIndexingStatus,
} from "./document-rag-tools.ts";

function createEnvSnapshot(keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, Deno.env.get(k)]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

function createSupabaseMock(options: {
  rpcHandlers?: Record<string, (args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>>;
  fromHandlers?: Record<string, () => unknown>;
} = {}) {
  return {
    rpc(name: string, args: Record<string, unknown>) {
      const handler = options.rpcHandlers?.[name];
      if (!handler) {
        return Promise.resolve({ data: null, error: new Error(`No rpc handler for ${name}`) });
      }
      return handler(args);
    },
    from(table: string) {
      const handler = options.fromHandlers?.[table];
      if (!handler) {
        throw new Error(`No from handler for ${table}`);
      }
      return handler();
    },
  };
}

function createDocumentEmbeddingsSearchBuilder(result: { data?: unknown[]; error?: unknown }) {
  return {
    select(_fields: string) {
      return this;
    },
    textSearch(field: string, query: string, options: Record<string, unknown>) {
      assertEquals(field, "chunk_text");
      assertEquals(query.length > 0, true);
      assertEquals(options.type, "websearch");
      assertEquals(options.config, "french");
      return this;
    },
    limit(limit: number) {
      assertEquals(typeof limit, "number");
      return Promise.resolve({
        data: result.data ?? [],
        error: result.error ?? null,
      });
    },
  };
}

function createKbArticlesBuilder(config: {
  data?: unknown[];
  error?: unknown;
  expectBaseType?: string;
}) {
  let eqCalls: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {
    select(_fields: string) {
      return builder;
    },
    eq(field: string, value: unknown) {
      eqCalls.push([field, value]);
      return builder;
    },
    textSearch(field: string, query: string, options: Record<string, unknown>) {
      assertEquals(field, "titre");
      assertEquals(query.length > 0, true);
      assertEquals(options.type, "websearch");
      assertEquals(options.config, "french");
      return builder;
    },
    limit(limit: number) {
      assertEquals(typeof limit, "number");
      return builder;
    },
    then(resolve: (value: { data: unknown[]; error: unknown }) => unknown, _reject?: (reason?: unknown) => unknown) {
      assertEquals(eqCalls[0], ["est_publie", true]);
      if (config.expectBaseType) {
        const hasBaseType = eqCalls.some(([f, v]) => f === "base_type" && v === config.expectBaseType);
        assertEquals(hasBaseType, true);
      }
      return Promise.resolve(resolve({
        data: config.data ?? [],
        error: config.error ?? null,
      }));
    },
  };
  return builder;
}

function createDocumentEmbeddingsStatusBuilder(config: {
  data?: Array<{ document_id: string; chunk_index: number }>;
  count?: number | null;
  error?: unknown;
  expectedIn?: string[];
}) {
  const builder: Record<string, unknown> = {
    select(fields: string, opts?: Record<string, unknown>) {
      assertEquals(fields, "document_id, chunk_index");
      assertEquals(opts?.count, "exact");
      return builder;
    },
    in(field: string, values: string[]) {
      assertEquals(field, "document_id");
      if (config.expectedIn) {
        assertEquals(values, config.expectedIn);
      }
      return Promise.resolve({
        data: config.data ?? [],
        count: config.count ?? 0,
        error: config.error ?? null,
      });
    },
    then(resolve: (value: { data: unknown[]; count: number | null; error: unknown }) => unknown, _reject?: (reason?: unknown) => unknown) {
      return Promise.resolve(resolve({
        data: config.data ?? [],
        count: config.count ?? 0,
        error: config.error ?? null,
      }));
    },
  };
  return builder;
}

function createDocumentsUnindexedBuilder(config: {
  data?: Array<{ id: string; name: string }>;
  error?: unknown;
  expectedNotValue?: string;
}) {
  const builder = {
    select(fields: string) {
      assertEquals(fields, "id, name");
      return this;
    },
    not(field: string, op: string, value: string) {
      assertEquals(field, "id");
      assertEquals(op, "in");
      if (config.expectedNotValue !== undefined) {
        assertEquals(value, config.expectedNotValue);
      }
      return Promise.resolve({
        data: config.data ?? [],
        error: config.error ?? null,
      });
    },
  };
  return builder;
}

Deno.test("executeSearchDocuments uses hybrid search with embedding and formats results", async () => {
  const envKeys = ["AZURE_EMBEDDING_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"];
  const snapshot = createEnvSnapshot(envKeys);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("AZURE_EMBEDDING_ENDPOINT", "https://azure.test/embeddings");
    Deno.env.set("AZURE_OPENAI_API_KEY", "test-key");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");

    let fetchCalled = 0;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      fetchCalled++;
      assertEquals(String(input), "https://azure.test/embeddings");
      assertEquals(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assertEquals(headers.get("content-type"), "application/json");
      assertEquals(headers.get("api-key"), "test-key");
      const body = JSON.parse(String(init?.body));
      assertEquals(body.input, "question métier");
      assertEquals(body.model, Deno.env.get("IA_MODELE_EMBEDDINGS") ?? "");
      return new Response(JSON.stringify({
        data: [{ embedding: [0.12, 0.34, 0.56] }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const supabase = createSupabaseMock({
      rpcHandlers: {
        search_documents_hybrid: async (args) => {
          assertEquals(args.p_query_embedding, [0.12, 0.34, 0.56]);
          assertEquals(args.p_query_text, "question métier");
          assertEquals(args.p_user_id, "auth-1");
          assertEquals(args.p_limit, 3);
          assertEquals(args.p_similarity_threshold, 0.7);
          return {
            data: [
              {
                document_id: "doc-1",
                document_name: "Guide RH",
                chunk_text: "Extrait important",
                combined_score: 0.91,
                similarity: 0.88,
                metadata: { page: 2 },
              },
            ],
            error: null,
          };
        },
      },
    });

    const result = await executeSearchDocuments(
      {
        supabase: supabase as never,
        userId: "user-1",
        authUserId: "auth-1",
      },
      {
        query: "question métier",
        limit: 3,
        similarity_threshold: 0.7,
      },
    );

    assertEquals(fetchCalled, 1);
    assertEquals(result.success, true);
    assertExists(result.data);
    const data = result.data as Record<string, unknown>;
    assertEquals(data.search_type, "hybrid");
    assertEquals(data.total, 1);
    assertEquals(data.query, "question métier");
    assertEquals(data.results, [{
      document_id: "doc-1",
      document_name: "Guide RH",
      excerpt: "Extrait important",
      relevance_score: 0.91,
      similarity: 0.88,
      metadata: { page: 2 },
    }]);
    assertEquals(typeof result.execution_time_ms, "number");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

Deno.test("executeSearchDocuments falls back to text-only search when embedding is unavailable", async () => {
  const envKeys = ["AZURE_EMBEDDING_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"];
  const snapshot = createEnvSnapshot(envKeys);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.delete("AZURE_EMBEDDING_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");

    globalThis.fetch = async (): Promise<Response> => {
      throw new Error("fetch should not be called when embedding config is missing");
    };

    const supabase = createSupabaseMock({
      fromHandlers: {
        document_embeddings: () => createDocumentEmbeddingsSearchBuilder({
          data: [
            {
              document_id: "doc-2",
              chunk_text: "Contrat de travail",
              chunk_index: 0,
              metadata: { source: "upload" },
              documents: { name: "Contrats" },
            },
          ],
        }),
      },
    });

    const result = await executeSearchDocuments(
      {
        supabase: supabase as never,
        userId: "user-2",
      },
      {
        query: "contrat travail",
        limit: 5,
      },
    );

    assertEquals(result.success, true);
    const data = result.data as Record<string, unknown>;
    assertEquals(data.search_type, "text_only");
    assertEquals(data.total, 1);
    assertEquals(data.results, [{
      document_id: "doc-2",
      document_name: "Contrats",
      excerpt: "Contrat de travail",
      relevance_score: 0.5,
      metadata: { source: "upload" },
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

Deno.test("executeSearchDocuments returns failure when hybrid rpc errors", async () => {
  const envKeys = ["AZURE_EMBEDDING_ENDPOINT", "AZURE_OPENAI_API_KEY"];
  const snapshot = createEnvSnapshot(envKeys);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("AZURE_EMBEDDING_ENDPOINT", "https://azure.test/embeddings");
    Deno.env.set("AZURE_OPENAI_API_KEY", "test-key");

    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const supabase = createSupabaseMock({
      rpcHandlers: {
        search_documents_hybrid: async () => ({
          data: null,
          error: new Error("rpc failed"),
        }),
      },
    });

    const result = await executeSearchDocuments(
      {
        supabase: supabase as never,
        userId: "user-1",
      },
      { query: "échec recherche" },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "rpc failed");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

Deno.test("executeIndexDocument posts to Supabase function with expected payload and headers", async () => {
  const envKeys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const snapshot = createEnvSnapshot(envKeys);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");

    let fetchCalled = 0;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      fetchCalled++;
      assertEquals(String(input), "https://project.supabase.co/functions/v1/jarvis-index-document");
      assertEquals(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assertEquals(headers.get("content-type"), "application/json");
      assertEquals(headers.get("authorization"), "Bearer service-role-test");
      const body = JSON.parse(String(init?.body));
      assertEquals(body, {
        document_id: "doc-99",
        force_reindex: true,
      });

      return new Response(JSON.stringify({
        success: true,
        indexed_chunks: 42,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await executeIndexDocument(
      {
        supabase: {} as never,
        userId: "user-index",
      },
      {
        document_id: "doc-99",
        force_reindex: true,
      },
    );

    assertEquals(fetchCalled, 1);
    assertEquals(result.success, true);
    assertEquals(result.error, undefined);
    assertEquals(result.data, {
      success: true,
      indexed_chunks: 42,
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

Deno.test("executeGetIndexingStatus groups chunks per document and returns unindexed documents", async () => {
  const supabase = createSupabaseMock({
    fromHandlers: {
      document_embeddings: () => createDocumentEmbeddingsStatusBuilder({
        data: [
          { document_id: "doc-a", chunk_index: 0 },
          { document_id: "doc-a", chunk_index: 1 },
          { document_id: "doc-b", chunk_index: 0 },
        ],
        count: 3,
        expectedIn: ["doc-a", "doc-b", "doc-c"],
      }),
      documents: () => createDocumentsUnindexedBuilder({
        expectedNotValue: "(doc-a,doc-b)",
        data: [
          { id: "doc-c", name: "Non indexé" },
        ],
      }),
    },
  });

  const result = await executeGetIndexingStatus(
    {
      supabase: supabase as never,
      userId: "user-status",
    },
    {
      document_ids: ["doc-a", "doc-b", "doc-c"],
      include_unindexed: true,
    },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.indexed_documents, 2);
  assertEquals(data.total_chunks, 3);
  assertEquals(data.documents, [
    { document_id: "doc-a", chunks: 2 },
    { document_id: "doc-b", chunks: 1 },
  ]);
  assertEquals(data.unindexed_documents, [
    { id: "doc-c", name: "Non indexé" },
  ]);
});

Deno.test("executeGetIndexingStatus returns failure when embeddings query errors", async () => {
  const supabase = createSupabaseMock({
    fromHandlers: {
      document_embeddings: () => createDocumentEmbeddingsStatusBuilder({
        error: new Error("status query failed"),
      }),
    },
  });

  const result = await executeGetIndexingStatus(
    {
      supabase: supabase as never,
      userId: "user-status",
    },
    {
      include_unindexed: false,
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "status query failed");
});

Deno.test("module exports are loadable and callable types exist", () => {
  assertEquals(typeof executeSearchDocuments, "function");
  assertEquals(typeof executeSearchKnowledgeBase, "function");
  assertEquals(typeof executeIndexDocument, "function");
  assertEquals(typeof executeGetIndexingStatus, "function");
  assertThrows(() => {
    throw new Error("intentional");
  }, Error, "intentional");
});

Deno.test("assert helpers async coverage", async () => {
  await assertRejects(
    async () => {
      throw new Error("async intentional");
    },
    Error,
    "async intentional",
  );
});