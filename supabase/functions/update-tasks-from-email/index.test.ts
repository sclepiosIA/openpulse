import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function readModuleSource(path = "./index.ts"): Promise<string> {
  return await Deno.readTextFile(new URL(path, import.meta.url));
}

function requireMatch(source: string, pattern: RegExp, label: string): RegExpMatchArray {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Missing expected source fragment: ${label}`);
  }
  return match;
}

function extractNumericConstant(source: string, constantName: string): number {
  const match = requireMatch(
    source,
    new RegExp(`const\\s+${constantName}\\s*=\\s*(\\d+)`),
    constantName,
  );
  return Number(match[1]);
}

function captureEnv(keys: string[]): Map<string, string | undefined> {
  const snapshot = new Map<string, string | undefined>();
  for (const key of keys) {
    snapshot.set(key, Deno.env.get(key));
  }
  return snapshot;
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

function createNonNetworkListener(): Deno.Listener {
  const never = () => new Promise<never>(() => {});

  return {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 } as Deno.NetAddr,
    close() {},
    ref() {},
    unref() {},
    async accept() {
      return await never();
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { done: true, value: undefined };
        },
      };
    },
  } as Deno.Listener;
}

Deno.test("module imports from ./index.ts with Deno.listen stubbed and without opening a real listener", async () => {
  const envSnapshot = captureEnv([
    "INTERNAL_FUNCTION_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  const originalListen = Deno.listen;
  const listenCalls: Deno.ListenOptions[] = [];

  try {
    Deno.env.set("INTERNAL_FUNCTION_SECRET", "test-internal-secret");
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    Object.defineProperty(Deno, "listen", {
      value: (options: Deno.ListenOptions) => {
        listenCalls.push(options);
        return createNonNetworkListener();
      },
      configurable: true,
      writable: true,
    });

    await import("./index.ts");

    assertEquals(listenCalls.length, 1);
    assertExists(listenCalls[0]);
  } finally {
    Object.defineProperty(Deno, "listen", {
      value: originalListen,
      configurable: true,
      writable: true,
    });
    restoreEnv(envSnapshot);
  }
});

Deno.test("source defines the expected Zod validation contract", async () => {
  const source = await readModuleSource();

  assertExists(requireMatch(source, /task_category:\s*z\.string\(\)\.max\(100\)/, "task_category max length"));
  assertExists(requireMatch(source, /task_title:\s*z\.string\(\)\.min\(1\)\.max\(500\)/, "task_title min and max length"));
  assertExists(requireMatch(source, /confidence:\s*z\.number\(\)\.min\(0\)\.max\(1\)/, "confidence range"));
  assertExists(requireMatch(source, /thread_id:\s*z\.string\(\)\.uuid\(\)/, "thread_id UUID validation"));
  assertExists(requireMatch(source, /etablissement_id:\s*z\.string\(\)\.uuid\(\)\.optional\(\)/, "optional etablissement_id UUID"));
  assertExists(requireMatch(source, /partenaire_id:\s*z\.string\(\)\.uuid\(\)\.optional\(\)/, "optional partenaire_id UUID"));
  assertExists(requireMatch(source, /completed_tasks:\s*z\.array\(CompletedTaskSchema\)\.max\(50\)/, "completed_tasks max size"));
  assertExists(requireMatch(source, /Exactly one of etablissement_id or partenaire_id must be provided/, "exclusive entity validation message"));
});

Deno.test("source contains the expected authorization, CORS, and rate-limit configuration", async () => {
  const source = await readModuleSource();

  const corsOrigin = requireMatch(
    source,
    /"Access-Control-Allow-Origin":\s*"([^"]+)"/,
    "CORS origin",
  )[1];

  assertEquals(corsOrigin, "https://gestion-marque-ia.apercu.example.org");
  assertEquals(
    source.includes("authorization, x-client-info, apikey, content-type, x-function-secret"),
    true,
  );
  assertEquals(source.includes('req.headers.get("x-function-secret")'), true);
  assertEquals(source.includes('Deno.env.get("INTERNAL_FUNCTION_SECRET")'), true);
  assertEquals(source.includes('JSON.stringify({ error: "Unauthorized" })'), true);
  assertEquals(extractNumericConstant(source, "RATE_LIMIT_WINDOW"), 60000);
  assertEquals(extractNumericConstant(source, "RATE_LIMIT_MAX_REQUESTS"), 100);

  assertThrows(
    () => extractNumericConstant(source, "RATE_LIMIT_DOES_NOT_EXIST"),
    Error,
    "Missing expected source fragment",
  );
});

Deno.test("source updates only high-confidence matching tasks and logs AI processing", async () => {
  const source = await readModuleSource();

  assertExists(requireMatch(source, /completedTask\.confidence\s*<\s*0\.7[\s\S]*?continue;/, "low-confidence skip"));
  assertEquals(source.includes(".ilike('titre', `%${completedTask.task_title}%`)"), true);
  assertEquals(source.includes(".neq('statut', 'Terminé')"), true);
  assertEquals(source.includes("statut: 'Terminé'"), true);
  assertEquals(source.includes("date_realisation: new Date().toISOString().split('T')[0]"), true);
  assertEquals(source.includes("action_type: 'task_completion_detection'"), true);
  assertEquals(source.includes("model_used: 'azure-openai'"), true);
  assertEquals(source.includes("tasks_updated: updatedTasks.length"), true);
});

Deno.test("source distinguishes establishment and partner task scopes", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("queryBuilder.eq('etablissement_id', etablissement_id)"), true);
  assertEquals(source.includes("queryBuilder.eq('partenaire_id', partenaire_id)"), true);
  assertEquals(source.includes("entity_type: etablissement_id ? 'etablissement' : 'partenaire'"), true);
  assertEquals(source.includes("etablissement_id: etablissement_id || null"), true);
  assertEquals(source.includes("partenaire_id: partenaire_id || null"), true);
});

Deno.test("source returns structured HTTP errors for validation, authorization, rate limiting, and catch-all failures", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes('return new Response(null, { headers: corsHeaders })'), true);
  assertEquals(source.includes('status: 401'), true);
  assertEquals(source.includes('status: 429'), true);
  assertEquals(source.includes('status: 400'), true);
  assertEquals(source.includes('error: "Invalid input"'), true);
  assertEquals(source.includes('details: validationResult.error.errors'), true);
  assertEquals(source.includes("return buildErrorResponse('update-tasks-from-email', error, corsHeaders, 500)"), true);
});

Deno.test("source loader rejects a missing relative module file", async () => {
  await assertRejects(
    () => readModuleSource("./__missing_index_test_file__.ts"),
    Deno.errors.NotFound,
  );
});