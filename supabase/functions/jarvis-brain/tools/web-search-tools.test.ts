import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeWebSearch } from "./web-search-tools.ts";

function createCtx() {
  return {
    supabase: {} as never,
    userId: "user-test",
  };
}

function snapshotEnv(keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, Deno.env.get(k)]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

Deno.test("executeWebSearch returns config error when BRAVE_SEARCH_API_KEY is missing", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.delete("BRAVE_SEARCH_API_KEY");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");

    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "actualité IA",
    });

    assertEquals(result.success, false);
    assertEquals(
      result.error,
      "Brave Search API non configurée. Veuillez ajouter le secret BRAVE_SEARCH_API_KEY.",
    );
    assertEquals(fetchCalled, false);
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch performs web search, caps count to 20 and returns formatted raw results when analyze=false", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");

    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      return new Response(JSON.stringify({
        web: {
          results: [
            {
              title: "Résultat 1",
              url: "https://example.com/1",
              description: "Description 1",
              age: "1 day ago",
            },
            {
              title: "Résultat 2",
              url: "https://example.com/2",
              description: "Description 2",
              page_age: "2 days ago",
            },
          ],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "supabase edge functions",
      count: 99,
      freshness: "week",
      country: "FR",
      analyze: false,
    });

    assertEquals(calls.length, 1);
    const calledUrl = new URL(calls[0].url);
    assertEquals(calledUrl.origin + calledUrl.pathname, "https://api.search.brave.com/res/v1/web/search");
    assertEquals(calledUrl.searchParams.get("q"), "supabase edge functions");
    assertEquals(calledUrl.searchParams.get("count"), "20");
    assertEquals(calledUrl.searchParams.get("freshness"), "pw");
    assertEquals(calledUrl.searchParams.get("country"), "FR");
    assertEquals(calledUrl.searchParams.get("text_decorations"), "false");
    assertEquals(calledUrl.searchParams.get("search_lang"), "fr");
    assertEquals(calledUrl.searchParams.get("ui_lang"), "fr-FR");

    assertEquals((calls[0].init?.headers as Record<string, string>)["X-Subscription-Token"], "brave-test-key");
    assertEquals(result.success, true);
    assertEquals(result.data.query, "supabase edge functions");
    assertEquals(result.data.search_type, "web");
    assertEquals(result.data.count, 2);
    assertEquals(result.data.analyzed, false);
    assertEquals(result.data.results, [
      {
        position: 1,
        title: "Résultat 1",
        url: "https://example.com/1",
        description: "Description 1",
        age: "1 day ago",
      },
      {
        position: 2,
        title: "Résultat 2",
        url: "https://example.com/2",
        description: "Description 2",
        age: "2 days ago",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch uses news endpoint and defaults freshness fallback when invalid value is provided at runtime", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");

    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return new Response(JSON.stringify({
        news: {
          results: [
            {
              title: "News A",
              url: "https://news.example.com/a",
              description: "Breaking news",
            },
          ],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "économie france",
      search_type: "news",
      freshness: "invalid" as "day",
      analyze: false,
    });

    assertEquals(calls.length, 1);
    const calledUrl = new URL(calls[0]);
    assertEquals(calledUrl.origin + calledUrl.pathname, "https://api.search.brave.com/res/v1/news/search");
    assertEquals(calledUrl.searchParams.get("freshness"), "pw");

    assertEquals(result.success, true);
    assertEquals(result.data.search_type, "news");
    assertEquals(result.data.results[0].title, "News A");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch returns raw results with note when Azure config is missing and analysis is requested", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return new Response(JSON.stringify({
        web: {
          results: [
            {
              title: "Doc",
              url: "https://example.com/doc",
              description: "Un document utile",
            },
          ],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "documentation deno",
      analyze: true,
    });

    assertEquals(fetchCount, 1);
    assertEquals(result.success, true);
    assertEquals(result.data.analyzed, false);
    assertEquals(result.data.note, "Azure GPT-5 non configuré pour l'analyse");
    assertEquals(result.data.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch performs Azure analysis and returns synthesized response with sources", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.set("AZURE_OPENAI_ENDPOINT", "https://azure.example.com/openai/deployments/gpt5/chat/completions");
    Deno.env.set("AZURE_OPENAI_API_KEY", "azure-test-key");

    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url.startsWith("https://api.search.brave.com/")) {
        return new Response(JSON.stringify({
          web: {
            results: [
              {
                title: "Source 1",
                url: "https://example.com/1",
                description: "Description source 1",
              },
              {
                title: "Source 2",
                url: "https://example.com/2",
                description: "Description source 2",
                age: "3 days ago",
              },
            ],
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: "Synthèse: information clé [1]. Complément utile [2].",
            },
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "marché IA 2026",
      analyze: true,
      analysis_focus: "tendances et acteurs clés",
    });

    assertEquals(calls.length, 2);
    assertEquals(calls[1].url, "https://azure.example.com/openai/deployments/gpt5/chat/completions");

    const azureInit = calls[1].init!;
    assertEquals(azureInit.method, "POST");
    assertEquals((azureInit.headers as Record<string, string>)["api-key"], "azure-test-key");
    assertEquals((azureInit.headers as Record<string, string>)["Content-Type"], "application/json");

    const body = JSON.parse(String(azureInit.body));
    assertEquals(body.max_completion_tokens, 2000);
    assertEquals(body.reasoning_effort, "low");
    assertEquals(body.verbosity, "low");
    assertEquals(body.messages[0].role, "system");
    assertEquals(body.messages[1].role, "user");
    assertEquals(
      body.messages[1].content.includes("Analyse ces résultats de recherche web en te concentrant sur: tendances et acteurs clés"),
      true,
    );
    assertEquals(body.messages[1].content.includes('Question de recherche: "marché IA 2026"'), true);
    assertEquals(body.messages[1].content.includes("[1] Source 1"), true);
    assertEquals(body.messages[1].content.includes("[2] Source 2"), true);

    assertEquals(result.success, true);
    assertEquals(result.data.analyzed, true);
    assertEquals(result.data.analysis, "Synthèse: information clé [1]. Complément utile [2].");
    assertEquals(result.data.analysis_focus, "tendances et acteurs clés");
    assertEquals(result.data.count, 2);
    assertEquals(result.data.sources, [
      { title: "Source 1", url: "https://example.com/1" },
      { title: "Source 2", url: "https://example.com/2" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch falls back to non analyzed results when Azure returns non-ok", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.set("AZURE_OPENAI_ENDPOINT", "https://azure.example.com/chat");
    Deno.env.set("AZURE_OPENAI_API_KEY", "azure-test-key");

    let step = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      step++;

      if (url.startsWith("https://api.search.brave.com/")) {
        return new Response(JSON.stringify({
          web: {
            results: [
              {
                title: "R1",
                url: "https://example.com/r1",
                description: "D1",
              },
            ],
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "temporary unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "veille cybersécurité",
      analyze: true,
    });

    assertEquals(step, 2);
    assertEquals(result.success, true);
    assertEquals(result.data.analyzed, false);
    assertEquals(result.data.note, "Analyse GPT-5 non disponible temporairement");
    assertEquals(result.data.results.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch falls back to non analyzed results when Azure fetch throws", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.set("AZURE_OPENAI_ENDPOINT", "https://azure.example.com/chat");
    Deno.env.set("AZURE_OPENAI_API_KEY", "azure-test-key");

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("https://api.search.brave.com/")) {
        return new Response(JSON.stringify({
          web: {
            results: [
              {
                title: "R1",
                url: "https://example.com/r1",
                description: "D1",
              },
            ],
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error("Azure timeout");
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "veille réglementaire",
      analyze: true,
    });

    assertEquals(result.success, true);
    assertEquals(result.data.analyzed, false);
    assertEquals(result.data.note, "Analyse GPT-5 timeout ou erreur");
    assertEquals(result.data.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch returns success with empty results and no analysis when Brave response has no results", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.set("AZURE_OPENAI_ENDPOINT", "https://azure.example.com/chat");
    Deno.env.set("AZURE_OPENAI_API_KEY", "azure-test-key");

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return new Response(JSON.stringify({ web: { results: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "requête introuvable",
      analyze: true,
    });

    assertEquals(fetchCount, 1);
    assertEquals(result.success, true);
    assertEquals(result.data.results, []);
    assertEquals(result.data.count, 0);
    assertEquals(result.data.analyzed, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});

Deno.test("executeWebSearch returns failure when Brave API responds with non-ok status", async () => {
  const env = snapshotEnv([
    "BRAVE_SEARCH_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);
  const originalFetch = globalThis.fetch;

  try {
    Deno.env.set("BRAVE_SEARCH_API_KEY", "brave-test-key");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");

    globalThis.fetch = (async () => {
      return new Response("bad request", {
        status: 400,
        headers: { "content-type": "text/plain" },
      });
    }) as typeof fetch;

    const result = await executeWebSearch(createCtx(), {
      query: "test erreur brave",
      analyze: false,
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "Brave Search API error: 400");
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(env);
  }
});