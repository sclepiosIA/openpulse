import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  searchUserMemory,
  searchUserMemoryFallback,
  buildMemoryContext,
  incrementMemoryUsage,
  extractKeywordsForSearch,
} from "./semantic-memory.ts";

type RpcResponse = { data?: unknown; error?: unknown };

function createMockSupabase(options?: {
  rpcResponses?: Record<string, RpcResponse | (() => Promise<RpcResponse> | RpcResponse)>;
  fallbackSearchResult?: RpcResponse;
  topMemoriesResult?: RpcResponse;
  updateShouldThrowCount?: number;
}) {
  const calls = {
    rpc: [] as Array<{ fn: string; params: Record<string, unknown> }>,
    from: [] as string[],
    select: [] as Array<{ table: string; columns: string }>,
    eq: [] as Array<{ table: string; column: string; value: unknown }>,
    or: [] as Array<{ table: string; expression: string }>,
    order: [] as Array<{ table: string; column: string; options: unknown }>,
    limit: [] as Array<{ table: string; value: number }>,
    update: [] as Array<{ table: string; values: Record<string, unknown> }>,
  };

  let remainingUpdateThrows = options?.updateShouldThrowCount ?? 0;

  const rpc = async (fn: string, params: Record<string, unknown>) => {
    calls.rpc.push({ fn, params });
    const handler = options?.rpcResponses?.[fn];
    if (!handler) return { data: null, error: null };
    if (typeof handler === "function") {
      return await handler();
    }
    return handler;
  };

  const from = (table: string) => {
    calls.from.push(table);

    const state = {
      table,
      selectedColumns: "",
      updatedValues: undefined as Record<string, unknown> | undefined,
      eqFilters: [] as Array<{ column: string; value: unknown }>,
      orExpression: undefined as string | undefined,
      orderedBy: undefined as { column: string; options: unknown } | undefined,
    };

    const queryResult = () => {
      if (table !== "jarvis_user_memory") {
        return { data: [], error: null };
      }

      const isFallbackSearch =
        state.selectedColumns === "id, category, key, value, importance" &&
        state.eqFilters.some((f) => f.column === "user_id") &&
        typeof state.orExpression === "string" &&
        state.orderedBy?.column === "importance";

      if (isFallbackSearch) {
        return options?.fallbackSearchResult ?? { data: [], error: null };
      }

      const isTopMemories =
        state.selectedColumns === "id, category, key, value, importance" &&
        state.eqFilters.some((f) => f.column === "user_id") &&
        !state.orExpression &&
        state.orderedBy?.column === "importance";

      if (isTopMemories) {
        return options?.topMemoriesResult ?? { data: [], error: null };
      }

      return { data: [], error: null };
    };

    const builder = {
      select(columns: string) {
        state.selectedColumns = columns;
        calls.select.push({ table, columns });
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.eq.push({ table, column, value });
        state.eqFilters.push({ column, value });

        if (state.updatedValues) {
          return Promise.resolve({ data: null, error: null });
        }

        return builder;
      },
      or(expression: string) {
        calls.or.push({ table, expression });
        state.orExpression = expression;
        return builder;
      },
      order(column: string, optionsArg: unknown) {
        calls.order.push({ table, column, options: optionsArg });
        state.orderedBy = { column, options: optionsArg };
        return builder;
      },
      limit(value: number) {
        calls.limit.push({ table, value });
        return Promise.resolve(queryResult());
      },
      update(values: Record<string, unknown>) {
        calls.update.push({ table, values });
        state.updatedValues = values;
        if (remainingUpdateThrows > 0) {
          remainingUpdateThrows -= 1;
          throw new Error("update failed");
        }
        return builder;
      },
    };

    return builder;
  };

  return {
    rpc,
    from,
    calls,
  };
}

Deno.test("extractKeywordsForSearch extrait les mots utiles, supprime les stop words et déduplique", () => {
  const result = extractKeywordsForSearch(
    "Je veux savoir comment organiser mon projet projet avec café, café, et préférences !",
  );

  assertEquals(result, [
    "veux",
    "savoir",
    "organiser",
    "projet",
    "avec",
    "café",
    "préférences",
  ]);
});

Deno.test("extractKeywordsForSearch gère accents, ponctuation et mots trop courts", () => {
  const result = extractKeywordsForSearch(
    "Où est le thé ? AI, UX, ça va; développeur confirmé en C++ et café.",
  );

  assertEquals(result, ["thé", "développeur", "confirmé", "café"]);
});

Deno.test("extractKeywordsForSearch retourne un tableau vide pour une requête composée seulement de stop words", () => {
  const result = extractKeywordsForSearch(
    "le la les un une des du de et ou mais donc car ni que qui quoi où quand comment",
  );

  assertEquals(result, []);
});

Deno.test("searchUserMemory appelle la RPC avec les bons paramètres et retourne les résultats", async () => {
  const expected = [
    {
      id: "m1",
      category: "fact",
      key: "ville",
      value: "Paris",
      importance: 8,
      relevance_score: 0.91,
    },
  ];

  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: { data: expected, error: null },
    },
  });

  const result = await searchUserMemory(
    supabase as never,
    "user-123",
    "où j'habite",
    3,
  );

  assertEquals(result, expected);
  assertEquals(supabase.calls.rpc, [{
    fn: "search_jarvis_memory",
    params: {
      p_user_id: "user-123",
      p_query: "où j'habite",
      p_limit: 3,
    },
  }]);
});

Deno.test("searchUserMemory retourne [] si la RPC renvoie une erreur", async () => {
  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: { data: null, error: { message: "boom" } },
    },
  });

  const result = await searchUserMemory(
    supabase as never,
    "user-123",
    "test",
    5,
  );

  assertEquals(result, []);
});

Deno.test("searchUserMemory retourne [] si la RPC lève une exception", async () => {
  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: () => {
        throw new Error("rpc crashed");
      },
    },
  });

  const result = await searchUserMemory(
    supabase as never,
    "user-123",
    "test",
    5,
  );

  assertEquals(result, []);
});

Deno.test("searchUserMemoryFallback construit la requête attendue et ajoute relevance_score=0.5", async () => {
  const rows = [
    {
      id: "m1",
      category: "preference",
      key: "boisson",
      value: "café",
      importance: 10,
    },
    {
      id: "m2",
      category: "fact",
      key: "ville",
      value: "Lyon",
      importance: 7,
    },
  ];

  const supabase = createMockSupabase({
    fallbackSearchResult: {
      data: rows,
      error: null,
    },
  });

  const result = await searchUserMemoryFallback(
    supabase as never,
    "user-9",
    "café",
    2,
  );

  assertEquals(result, [
    {
      id: "m1",
      category: "preference",
      key: "boisson",
      value: "café",
      importance: 10,
      relevance_score: 0.5,
    },
    {
      id: "m2",
      category: "fact",
      key: "ville",
      value: "Lyon",
      importance: 7,
      relevance_score: 0.5,
    },
  ]);

  assertEquals(supabase.calls.from, ["jarvis_user_memory"]);
  assertEquals(supabase.calls.select, [{
    table: "jarvis_user_memory",
    columns: "id, category, key, value, importance",
  }]);
  assertEquals(supabase.calls.eq[0], {
    table: "jarvis_user_memory",
    column: "user_id",
    value: "user-9",
  });
  assertEquals(supabase.calls.or[0], {
    table: "jarvis_user_memory",
    expression: "key.ilike.%café%,value.ilike.%café%",
  });
  assertEquals(supabase.calls.order[0], {
    table: "jarvis_user_memory",
    column: "importance",
    options: { ascending: false },
  });
  assertEquals(supabase.calls.limit[0], {
    table: "jarvis_user_memory",
    value: 2,
  });
});

Deno.test("searchUserMemoryFallback retourne [] si la requête fallback renvoie une erreur", async () => {
  const supabase = createMockSupabase({
    fallbackSearchResult: {
      data: null,
      error: { message: "query error" },
    },
  });

  const result = await searchUserMemoryFallback(
    supabase as never,
    "user-9",
    "café",
    2,
  );

  assertEquals(result, []);
});

Deno.test("buildMemoryContext utilise la recherche sémantique puis fusionne avec les top memories sans doublons", async () => {
  const semanticResults = [
    {
      id: "m1",
      category: "preference",
      key: "langage",
      value: "TypeScript",
      importance: 9,
      relevance_score: 0.92,
    },
    {
      id: "m2",
      category: "fact",
      key: "ville",
      value: "Paris",
      importance: 8,
      relevance_score: 0.6,
    },
  ];

  const topMemories = [
    {
      id: "m2",
      category: "fact",
      key: "ville",
      value: "Paris",
      importance: 8,
    },
    {
      id: "m3",
      category: "instruction",
      key: "style",
      value: "Répondre brièvement",
      importance: 10,
    },
    {
      id: "m4",
      category: "context",
      key: "projet",
      value: "Migration Deno",
      importance: 7,
    },
  ];

  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: { data: semanticResults, error: null },
    },
    topMemoriesResult: {
      data: topMemories,
      error: null,
    },
  });

  const context = await buildMemoryContext(
    supabase as never,
    "user-1",
    "rappelle mes préférences",
    4,
  );

  assertEquals(context.memories, [
    semanticResults[0],
    semanticResults[1],
    {
      id: "m3",
      category: "instruction",
      key: "style",
      value: "Répondre brièvement",
      importance: 10,
      relevance_score: 0.3,
    },
    {
      id: "m4",
      category: "context",
      key: "projet",
      value: "Migration Deno",
      importance: 7,
      relevance_score: 0.3,
    },
  ]);
  assertEquals(context.hasRelevantMemories, true);
  assertExists(context.formattedContext);
  assertEquals(
    context.formattedContext.includes("========== MÉMOIRE JARVIS"),
    true,
  );
  assertEquals(
    context.formattedContext.includes("🎯 PRÉFÉRENCES UTILISATEUR:"),
    true,
  );
  assertEquals(
    context.formattedContext.includes("- langage: TypeScript ★"),
    true,
  );
  assertEquals(
    context.formattedContext.includes("📋 FAITS CONNUS:"),
    true,
  );
  assertEquals(
    context.formattedContext.includes("- ville: Paris ☆"),
    true,
  );
  assertEquals(
    context.formattedContext.includes("⚙️ INSTRUCTIONS PERMANENTES:"),
    true,
  );
  assertEquals(
    context.formattedContext.includes("- style: Répondre brièvement "),
    true,
  );
  assertEquals(
    context.formattedContext.includes("📍 CONTEXTE ACTUEL:"),
    true,
  );
});

Deno.test("buildMemoryContext utilise le fallback si la recherche sémantique ne retourne rien", async () => {
  const fallbackRows = [
    {
      id: "f1",
      category: "fact",
      key: "framework",
      value: "Deno",
      importance: 9,
    },
  ];

  const topMemories = [
    {
      id: "t1",
      category: "preference",
      key: "éditeur",
      value: "VS Code",
      importance: 8,
    },
  ];

  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: { data: [], error: null },
    },
    fallbackSearchResult: {
      data: fallbackRows,
      error: null,
    },
    topMemoriesResult: {
      data: topMemories,
      error: null,
    },
  });

  const context = await buildMemoryContext(
    supabase as never,
    "user-2",
    "deno",
    3,
  );

  assertEquals(context.memories, [
    {
      id: "f1",
      category: "fact",
      key: "framework",
      value: "Deno",
      importance: 9,
      relevance_score: 0.5,
    },
    {
      id: "t1",
      category: "preference",
      key: "éditeur",
      value: "VS Code",
      importance: 8,
      relevance_score: 0.3,
    },
  ]);
  assertEquals(context.hasRelevantMemories, false);
  assertEquals(context.formattedContext.includes("- framework: Deno "), true);
  assertEquals(context.formattedContext.includes("- éditeur: VS Code "), true);
});

Deno.test("buildMemoryContext retourne un contexte vide formaté si aucune mémoire n'est trouvée", async () => {
  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: { data: [], error: null },
    },
    fallbackSearchResult: {
      data: [],
      error: null,
    },
    topMemoriesResult: {
      data: [],
      error: null,
    },
  });

  const context = await buildMemoryContext(
    supabase as never,
    "user-empty",
    "inexistant",
    5,
  );

  assertEquals(context.memories, []);
  assertEquals(context.formattedContext, "");
  assertEquals(context.hasRelevantMemories, false);
});

Deno.test("buildMemoryContext respecte maxMemories après fusion", async () => {
  const semanticResults = [
    {
      id: "m1",
      category: "fact",
      key: "a",
      value: "A",
      importance: 10,
      relevance_score: 0.9,
    },
    {
      id: "m2",
      category: "fact",
      key: "b",
      value: "B",
      importance: 9,
      relevance_score: 0.8,
    },
  ];

  const topMemories = [
    {
      id: "m3",
      category: "fact",
      key: "c",
      value: "C",
      importance: 8,
    },
    {
      id: "m4",
      category: "fact",
      key: "d",
      value: "D",
      importance: 7,
    },
  ];

  const supabase = createMockSupabase({
    rpcResponses: {
      search_jarvis_memory: { data: semanticResults, error: null },
    },
    topMemoriesResult: {
      data: topMemories,
      error: null,
    },
  });

  const context = await buildMemoryContext(
    supabase as never,
    "user-limit",
    "query",
    3,
  );

  assertEquals(context.memories.length, 3);
  assertEquals(context.memories.map((m) => m.id), ["m1", "m2", "m3"]);
});

Deno.test("incrementMemoryUsage effectue un update avec last_accessed_at et un appel rpc increment_usage", async () => {
  const supabase = createMockSupabase();

  await incrementMemoryUsage(supabase as never, "mem-1");

  assertEquals(supabase.calls.from, ["jarvis_user_memory"]);
  assertEquals(supabase.calls.rpc, [{
    fn: "increment_usage",
    params: { row_id: "mem-1" },
  }]);

  assertEquals(supabase.calls.update.length, 1);
  assertEquals(supabase.calls.update[0].table, "jarvis_user_memory");
  assertEquals("usage_count" in supabase.calls.update[0].values, true);
  assertEquals("last_accessed_at" in supabase.calls.update[0].values, true);
  assertExists(supabase.calls.update[0].values.last_accessed_at);
  assertEquals(
    typeof supabase.calls.update[0].values.last_accessed_at,
    "string",
  );
  assertEquals(supabase.calls.eq[supabase.calls.eq.length - 1], {
    table: "jarvis_user_memory",
    column: "id",
    value: "mem-1",
  });
});

Deno.test("incrementMemoryUsage bascule sur le fallback si update lève une exception", async () => {
  const supabase = createMockSupabase({ updateShouldThrowCount: 1 });

  await incrementMemoryUsage(supabase as never, "mem-2");

  assertEquals(supabase.calls.from, ["jarvis_user_memory", "jarvis_user_memory"]);
  assertEquals(supabase.calls.update.length, 2);
  assertEquals("usage_count" in supabase.calls.update[0].values, true);
  assertEquals("usage_count" in supabase.calls.update[1].values, false);
  assertEquals("last_accessed_at" in supabase.calls.update[1].values, true);
  assertEquals(supabase.calls.eq[supabase.calls.eq.length - 1], {
    table: "jarvis_user_memory",
    column: "id",
    value: "mem-2",
  });
});

Deno.test("les fonctions exportées restent offline et ne dépendent d'aucun réseau", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const supabase = createMockSupabase({
      rpcResponses: {
        search_jarvis_memory: { data: [], error: null },
      },
      fallbackSearchResult: {
        data: [],
        error: null,
      },
      topMemoriesResult: {
        data: [],
        error: null,
      },
    });

    await assertRejects(
      async () => {
        throw new Error("offline sentinel");
      },
      Error,
      "offline sentinel",
    );

    const searchResult = await searchUserMemory(supabase as never, "u", "q", 1);
    const fallbackResult = await searchUserMemoryFallback(supabase as never, "u", "q", 1);
    const context = await buildMemoryContext(supabase as never, "u", "q", 1);

    assertEquals(searchResult, []);
    assertEquals(fallbackResult, []);
    assertEquals(context, {
      memories: [],
      formattedContext: "",
      hasRelevantMemories: false,
    });
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("assertThrows fonctionne dans le fichier de test", () => {
  assertThrows(() => {
    throw new TypeError("expected");
  }, TypeError, "expected");
});