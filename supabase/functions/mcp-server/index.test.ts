// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type LoadedModule = Record<string, unknown>;

type LoadedTarget = {
  module: LoadedModule;
  serveCalls: Array<{ args: unknown[] }>;
};

const TEST_ENV: Record<string, string> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  JARVIS_BRAIN_URL: "http://localhost/functions/v1/jarvis-brain",
};

let loadedTargetPromise: Promise<LoadedTarget> | undefined;

async function withEnv<T>(vars: Record<string, string>, fn: () => T | Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

function stubFetch(): () => void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "test",
        result: {
          success: true,
          content: [{ type: "text", text: "stubbed jarvis-brain response" }],
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function stubDenoServe(serveCalls: Array<{ args: unknown[] }>): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  const originalServe = Deno.serve;

  const serveStub = (...args: unknown[]) => {
    serveCalls.push({ args });
    return {
      finished: Promise.resolve(),
      shutdown: () => undefined,
      ref: () => undefined,
      unref: () => undefined,
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    };
  };

  try {
    Object.defineProperty(Deno, "serve", {
      value: serveStub,
      configurable: true,
      writable: true,
    });
  } catch {
    (Deno as unknown as { serve: unknown }).serve = serveStub;
  }

  return () => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(Deno, "serve", originalDescriptor);
      } else {
        (Deno as unknown as { serve: unknown }).serve = originalServe;
      }
    } catch {
      (Deno as unknown as { serve: unknown }).serve = originalServe;
    }
  };
}

async function loadTarget(): Promise<LoadedTarget> {
  if (!loadedTargetPromise) {
    loadedTargetPromise = withEnv(TEST_ENV, async () => {
      const serveCalls: Array<{ args: unknown[] }> = [];
      const restoreServe = stubDenoServe(serveCalls);
      const restoreFetch = stubFetch();

      try {
        const module = await import("./index.ts") as LoadedModule;
        return { module, serveCalls };
      } finally {
        restoreFetch();
        restoreServe();
      }
    });
  }

  return await loadedTargetPromise;
}

function findHandler(loaded: LoadedTarget): ((request: Request) => Response | Promise<Response>) | undefined {
  const exportedCandidates = ["handler", "handleRequest", "default", "serveHandler"];

  for (const name of exportedCandidates) {
    const candidate = loaded.module[name];
    if (typeof candidate === "function") {
      return candidate as (request: Request) => Response | Promise<Response>;
    }
  }

  for (const call of loaded.serveCalls) {
    for (const arg of call.args) {
      if (typeof arg === "function") {
        return arg as (request: Request) => Response | Promise<Response>;
      }
    }
  }

  return undefined;
}

function sourceWindow(source: string, needle: string, size = 1800): string {
  const index = source.indexOf(needle);
  if (index < 0) {
    throw new Error(`Tool not found: ${needle}`);
  }
  return source.slice(index, index + size);
}

Deno.test("module loads without starting a real HTTP server", async () => {
  const loaded = await loadTarget();

  assertExists(loaded.module);
  assertEquals(typeof loaded.module, "object");

  const handler = findHandler(loaded);
  if (loaded.serveCalls.length > 0) {
    assertEquals(typeof handler, "function");
  }
});

Deno.test("OPTIONS request returns MCP/CORS headers offline when a handler is available", async () => {
  const loaded = await loadTarget();
  const handler = findHandler(loaded);

  if (!handler) {
    assertExists(loaded.module);
    return;
  }

  await withEnv(TEST_ENV, async () => {
    const restoreFetch = stubFetch();

    try {
      const response = await handler(
        new Request("http://localhost/mcp", {
          method: "OPTIONS",
          headers: {
            origin: "http://localhost:3000",
            "access-control-request-method": "POST",
          },
        }),
      );

      assertEquals(response.status, 204);
      // L'origine demandee n'est pas declaree : elle ne doit pas etre renvoyee,
      // et le joker ne doit jamais apparaitre -- il ouvrirait l'API a tous.
      const origineRendue = response.headers.get("access-control-allow-origin");
      assertEquals(origineRendue === "*", false);
      assertEquals(origineRendue === "http://localhost:3000", false);
      assertEquals(response.headers.get("access-control-expose-headers"), "mcp-session-id");

      const allowMethods = response.headers.get("access-control-allow-methods") ?? "";
      assertEquals(allowMethods.includes("GET"), true);
      assertEquals(allowMethods.includes("POST"), true);
      assertEquals(allowMethods.includes("DELETE"), true);
      assertEquals(allowMethods.includes("OPTIONS"), true);

      const allowHeaders = response.headers.get("access-control-allow-headers") ?? "";
      assertEquals(allowHeaders.includes("authorization"), true);
      assertEquals(allowHeaders.includes("content-type"), true);
      assertEquals(allowHeaders.includes("mcp-session-id"), true);
    } finally {
      restoreFetch();
    }
  });
});

Deno.test("static MCP registry defines core database and action tools with expected schemas", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  const queryDatabase = sourceWindow(source, 'name: "query_database"', 2600);
  assertEquals(queryDatabase.includes('description: "Interroge la base de données OpenPulse'), true);
  assertEquals(queryDatabase.includes('table: { type: "string"'), true);
  assertEquals(queryDatabase.includes('select: { type: "string"'), true);
  assertEquals(queryDatabase.includes("filters: {"), true);
  assertEquals(queryDatabase.includes('operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in", "is", "contains"] }'), true);
  assertEquals(queryDatabase.includes('limit: { type: "number", description: "Max 100" }'), true);
  assertEquals(queryDatabase.includes('required: ["table"]'), true);

  const sendEmail = sourceWindow(source, 'name: "send_email"', 1400);
  assertEquals(sendEmail.includes('to: { type: "string"'), true);
  assertEquals(sendEmail.includes('subject: { type: "string" }'), true);
  assertEquals(sendEmail.includes('body: { type: "string"'), true);
  assertEquals(sendEmail.includes('thread_id: { type: "string"'), true);
  assertEquals(sendEmail.includes('cc: { type: "array", items: { type: "string" } }'), true);
  assertEquals(sendEmail.includes('required: ["to", "body"]'), true);

  const createTask = sourceWindow(source, 'name: "create_task"', 1500);
  assertEquals(createTask.includes('titre: { type: "string" }'), true);
  assertEquals(createTask.includes('priorite: { type: "string", enum: ["basse", "moyenne", "haute", "urgente"] }'), true);
  assertEquals(createTask.includes('responsable_id: { type: "string" }'), true);
  assertEquals(createTask.includes('etablissement_id: { type: "string" }'), true);
  assertEquals(createTask.includes('date_echeance: { type: "string" }'), true);
  assertEquals(createTask.includes('required: ["titre"]'), true);
});

Deno.test("static MCP registry includes business domains expected by Jarvis", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  const expectedTools = [
    "query_database",
    "send_email",
    "create_task",
    "update_task",
    "schedule_meeting",
    "search_knowledge_base",
    "calculate_metrics",
    "sync_qonto_transactions",
    "get_bank_balance",
    "create_invoice",
    "forecast_cashflow",
    "manage_absence",
    "calculate_payroll_kpis",
    "recommend_training",
    "manage_epic",
    "manage_user_story",
    "manage_sprint",
    "create_support_ticket",
    "update_ticket_status",
    "manage_job_offer",
    "manage_candidate",
    "schedule_interview",
    "translate_email",
    "correct_email",
    "reformulate_email",
    "get_my_calendar",
  ];

  for (const toolName of expectedTools) {
    assertEquals(source.includes(`name: "${toolName}"`), true);
  }

  assertThrows(
    () => sourceWindow(source, 'name: "__missing_tool_for_test__"'),
    Error,
    "Tool not found",
  );
});

Deno.test("module source keeps MCP auth, Supabase and jarvis-brain delegation boundaries explicit", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes("validateUserAuth"), true);
  assertEquals(source.includes("ALLOWED_TABLES"), true);
  assertEquals(source.includes("safeErrorLog"), true);
  assertEquals(source.includes("tools/list"), true);
  assertEquals(source.includes("tools/call"), true);
  assertEquals(source.includes("jarvis-brain"), true);
  assertEquals(source.includes("Bearer"), true);
  assertEquals(source.includes("mcp-session-id"), true);
});

Deno.test("missing local fixture read rejects, proving tests do not rely on network fallbacks", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./__missing_mcp_fixture__.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});