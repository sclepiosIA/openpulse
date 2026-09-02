import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_PATH = "./index.ts";

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL(INDEX_PATH, import.meta.url));
}

function withPatchedDenoListen<T>(fn: () => Promise<T>): Promise<T> {
  const originalListen = Deno.listen;
  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    close() {},
    accept() {
      return new Promise<never>(() => {});
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { done: true, value: undefined };
        },
      };
    },
  };

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: () => fakeListener,
  });

  return fn().finally(() => {
    Object.defineProperty(Deno, "listen", {
      configurable: true,
      writable: true,
      value: originalListen,
    });
  });
}

function requireSourceFragment(source: string, fragment: string): string {
  if (!source.includes(fragment)) {
    throw new Error(`Missing expected source fragment: ${fragment}`);
  }
  return fragment;
}

Deno.test("module loads offline with HTTP serve listener stubbed", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    const mod = await withPatchedDenoListen(() => import(INDEX_PATH));
    assertExists(mod);
    assertEquals(Object.keys(mod), []);
  } finally {
    if (previousUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousUrl);
    }

    if (previousServiceKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
    }
  }
});

Deno.test("source defines expected CORS preflight behavior and auth errors", async () => {
  const source = await readIndexSource();

  // Le durcissement CORS a deporte les en-tetes dans ../_shared/cors.ts :
  // index.ts ne porte plus les noms d'en-tetes, il importe corsHeaders et
  // conserve en commentaire la liste d'en-tetes acceptes d'origine.
  assertExists(requireSourceFragment(source, "import { corsHeaders } from '../_shared/cors.ts'"));
  assertExists(requireSourceFragment(source, "en-tetes autorises d'origine :"));
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false);
  assertExists(requireSourceFragment(source, "req.method === 'OPTIONS'"));
  assertExists(requireSourceFragment(source, "No authorization"));
  assertExists(requireSourceFragment(source, "Invalid token"));
  assertExists(requireSourceFragment(source, "Profile not found"));

  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("status: 404"), true);
  assertEquals(source.includes("'Content-Type': 'application/json'"), true);
});

Deno.test("source queries the expected Supabase tables without relying on network in tests", async () => {
  const source = await readIndexSource();

  const expectedTables = [
    "profiles",
    "jarvis_conversations",
    "ai_processing_log",
    "taches",
    "jarvis_proactive_alerts",
  ];

  for (const table of expectedTables) {
    assertEquals(source.includes(`from('${table}')`), true);
  }

  assertExists(requireSourceFragment(source, ".eq('user_id', user.id)"));
  assertExists(requireSourceFragment(source, ".eq('processed_by', profileId)"));
  assertExists(requireSourceFragment(source, ".gte('created_at', thirtyDaysAgo)"));
  assertExists(requireSourceFragment(source, ".gte('processed_at', thirtyDaysAgo)"));
  assertExists(requireSourceFragment(source, ".upsert("));
});

Deno.test("source keeps prediction business rules for routines and confidence ordering", async () => {
  const source = await readIndexSource();

  assertExists(requireSourceFragment(source, "daily_briefing"));
  assertExists(requireSourceFragment(source, "weekly_review"));
  assertExists(requireSourceFragment(source, "weekly_summary"));
  assertExists(requireSourceFragment(source, "end_of_day_review"));
  assertExists(requireSourceFragment(source, "mid_month_review"));
  assertExists(requireSourceFragment(source, "month_end_close"));
  assertExists(requireSourceFragment(source, "support_review"));

  assertExists(requireSourceFragment(source, "confidence: 0.85"));
  assertExists(requireSourceFragment(source, "confidence: 0.9"));
  assertExists(requireSourceFragment(source, "confidence: 0.8"));
  assertExists(requireSourceFragment(source, "confidence: 0.7"));
  assertExists(requireSourceFragment(source, "sort((a, b) => b.confidence - a.confidence)"));
  assertExists(requireSourceFragment(source, "slice(0, 8)"));
});

Deno.test("source keeps action extraction heuristics for user messages", async () => {
  const source = await readIndexSource();

  assertExists(requireSourceFragment(source, "check_pipeline"));
  assertExists(requireSourceFragment(source, "check_emails"));
  assertExists(requireSourceFragment(source, "review_tasks"));
  assertExists(requireSourceFragment(source, "check_invoices"));

  assertEquals(source.includes("msg.content.toLowerCase().includes('pipeline')"), true);
  assertEquals(source.includes("msg.content.toLowerCase().includes('email')"), true);
  assertEquals(source.includes("msg.content.toLowerCase().includes('tâche')"), true);
  assertEquals(source.includes("msg.content.toLowerCase().includes('facture')"), true);
});

Deno.test("source fragment helper throws for missing business rule", async () => {
  const source = await readIndexSource();

  assertThrows(
    () => requireSourceFragment(source, "definitely_missing_prediction_rule_for_test"),
    Error,
    "Missing expected source fragment",
  );
});

Deno.test("reading a missing local module path rejects", async () => {
  await assertRejects(
    async () => {
      await Deno.readTextFile(new URL("./__missing_index_for_test__.ts", import.meta.url));
    },
    Deno.errors.NotFound,
  );
});