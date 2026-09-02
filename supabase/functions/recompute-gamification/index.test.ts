// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type AuthResult = { authorized: boolean; isServiceCall?: boolean; userId?: string | null };

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function createSupabaseStub(options?: {
  activeUsers?: string[];
  selectError?: { message: string } | null;
  rpcErrorsByCall?: Record<string, { message: string }>;
}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const activeUsers = options?.activeUsers ?? [];
  const selectError = options?.selectError ?? null;
  const rpcErrorsByCall = options?.rpcErrorsByCall ?? {};

  const selectBuilder = {
    _table: "",
    select(_cols: string) {
      return this;
    },
    eq(_col: string, _val: unknown) {
      return this;
    },
    not(_col: string, _op: string, _val: unknown) {
      return this;
    },
    limit(_n: number) {
      return Promise.resolve(
        selectError
          ? { data: null, error: selectError }
          : { data: activeUsers.map((user_id) => ({ user_id })), error: null },
      );
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        return Object.assign({}, selectBuilder, { _table: table });
      },
      async rpc(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        const key = `${fn}:${String(args.p_user_id)}:${String(args.p_period ?? "")}`;
        const directKey = `${fn}:${String(args.p_user_id)}`;
        const error = rpcErrorsByCall[key] ?? rpcErrorsByCall[directKey] ?? null;
        return error ? { data: null, error } : { data: null, error: null };
      },
    },
  };
}

async function loadModuleWithStubs(params: {
  authResult: AuthResult;
  supabaseStub: ReturnType<typeof createSupabaseStub>;
  errorResponseBody?: Record<string, unknown>;
}) {
  const originalServe = Deno.serve;
  const originalEnvGet = Deno.env.get;
  const originalFetch = globalThis.fetch;

  let capturedHandler: ((req: Request) => Promise<Response> | Response) | null = null;

  Deno.serve = ((handler: (req: Request) => Promise<Response> | Response) => {
    capturedHandler = handler;
    return {} as Deno.HttpServer;
  }) as typeof Deno.serve;

  Deno.env.get = ((key: string) => {
    if (key === "SUPABASE_URL") return "https://example.supabase.co";
    if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
    return originalEnvGet.call(Deno.env, key);
  }) as typeof Deno.env.get;

  globalThis.fetch = (() => {
    throw new Error("unexpected network call");
  }) as typeof fetch;

  const createClientStub = () => params.supabaseStub.client;
  const validateServiceOrUserStub = async () => params.authResult;
  const buildErrorResponseStub = (_context: string, e: unknown, headers: HeadersInit, status: number) =>
    makeJsonResponse(
      params.errorResponseBody ?? {
        error: e instanceof Error ? e.message : String(e),
        context: "recompute-gamification",
      },
      status,
      headers as Record<string, string>,
    );

  const moduleUrl = new URL("./index.ts", import.meta.url).href;
  const code = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const patched = code
    // L'import relatif ne se resout pas depuis une URL `data:`.
    .replace(`import { corsHeaders } from '../_shared/cors.ts'`, `const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:8080', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };`)
    .replace(
      /import\s+\{\s*createClient\s*\}\s+from\s+"https:\/\/esm\.sh\/@supabase\/supabase-js@2\.45\.0";/,
      'const { createClient } = globalThis.__testDeps;',
    )
    .replace(
      /import\s+\{\s*buildErrorResponse\s*\}\s+from\s+"\.\.\/_shared\/error-sanitizer\.ts";/,
      'const { buildErrorResponse } = globalThis.__testDeps;',
    )
    .replace(
      /import\s+\{\s*validateServiceOrUser\s*\}\s+from\s+"\.\.\/_shared\/auth-helpers\.ts";/,
      'const { validateServiceOrUser } = globalThis.__testDeps;',
    );

  (globalThis as unknown as { __testDeps: unknown }).__testDeps = {
    createClient: createClientStub,
    validateServiceOrUser: validateServiceOrUserStub,
    buildErrorResponse: buildErrorResponseStub,
  };

  try {
    await import(`data:application/typescript;base64,${btoa(patched)}#${crypto.randomUUID()}`);
    assertExists(capturedHandler);
    return {
      handler: capturedHandler!,
      restore() {
        Deno.serve = originalServe;
        Deno.env.get = originalEnvGet;
        globalThis.fetch = originalFetch;
        delete (globalThis as unknown as { __testDeps?: unknown }).__testDeps;
      },
      moduleUrl,
    };
  } catch (e) {
    Deno.serve = originalServe;
    Deno.env.get = originalEnvGet;
    globalThis.fetch = originalFetch;
    delete (globalThis as unknown as { __testDeps?: unknown }).__testDeps;
    throw e;
  }
}

Deno.test("module loads and registers a handler", async () => {
  const supabaseStub = createSupabaseStub();
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: true },
    supabaseStub,
  });
  try {
    assertExists(ctx.handler);
  } finally {
    ctx.restore();
  }
});

Deno.test("OPTIONS returns CORS headers and no auth/db work", async () => {
  const supabaseStub = createSupabaseStub();
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: false },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(new Request("http://localhost", { method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertNotEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      res.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
    assertEquals(await res.text(), "");
    assertEquals(supabaseStub.calls.length, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("unauthorized request returns 401 JSON error", async () => {
  const supabaseStub = createSupabaseStub();
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: false },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(new Request("http://localhost", { method: "POST", body: "{}" }));
    assertEquals(res.status, 401);
    assertEquals(res.headers.get("Content-Type"), "application/json");
    const body = await res.json();
    assertEquals(body, { error: "Unauthorized" });
    assertEquals(supabaseStub.calls.length, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("service call recomputes all active users and aggregates success counts", async () => {
  const supabaseStub = createSupabaseStub({
    activeUsers: ["u1", "u2"],
  });
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: true },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(new Request("http://localhost", { method: "GET" }));
    assertEquals(res.status, 200);
    const body = await res.json();

    assertEquals(body.success, true);
    assertEquals(body.scope, "all");
    assertEquals(body.users_total, 2);
    assertEquals(body.users_ok, 2);
    assertEquals(body.users_error, 0);
    assertEquals(Array.isArray(body.errors), true);
    assertEquals(body.errors.length, 0);
    assertEquals(typeof body.duration_ms, "number");

    assertEquals(supabaseStub.calls.length, 12);
    assertEquals(supabaseStub.calls[0], {
      fn: "compute_gamification_points",
      args: { p_user_id: "u1", p_period: "week" },
    });
    assertEquals(supabaseStub.calls[4], {
      fn: "compute_gamification_points",
      args: { p_user_id: "u1", p_period: "all" },
    });
    assertEquals(supabaseStub.calls[5], {
      fn: "unlock_badges",
      args: { p_user_id: "u1" },
    });
    assertEquals(supabaseStub.calls[11], {
      fn: "unlock_badges",
      args: { p_user_id: "u2" },
    });
  } finally {
    ctx.restore();
  }
});

Deno.test("service POST with user_id scopes to single user only", async () => {
  const supabaseStub = createSupabaseStub({
    activeUsers: ["ignored-user"],
  });
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: true },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: "target-user" }),
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.scope, "single");
    assertEquals(body.users_total, 1);
    assertEquals(body.users_ok, 1);
    assertEquals(body.users_error, 0);

    assertEquals(supabaseStub.calls.length, 6);
    assertEquals(
      supabaseStub.calls.map((c) => c.args.p_user_id),
      ["target-user", "target-user", "target-user", "target-user", "target-user", "target-user"],
    );
  } finally {
    ctx.restore();
  }
});

Deno.test("non-service caller is forced to own user even if body requests another user", async () => {
  const supabaseStub = createSupabaseStub({
    activeUsers: ["ignored-user"],
  });
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: false, userId: "self-user" },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: "other-user" }),
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.scope, "single");
    assertEquals(body.users_total, 1);
    assertEquals(body.users_ok, 1);

    assertEquals(supabaseStub.calls.length, 6);
    for (const call of supabaseStub.calls) {
      assertEquals(call.args.p_user_id, "self-user");
    }
  } finally {
    ctx.restore();
  }
});

Deno.test("invalid POST JSON is tolerated and service call falls back to all active users", async () => {
  const supabaseStub = createSupabaseStub({
    activeUsers: ["u1"],
  });
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: true },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.scope, "all");
    assertEquals(body.users_total, 1);
    assertEquals(body.users_ok, 1);
    assertEquals(body.users_error, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("per-user RPC failure increments error count and continues other users", async () => {
  const supabaseStub = createSupabaseStub({
    activeUsers: ["u1", "u2"],
    rpcErrorsByCall: {
      "compute_gamification_points:u2:month": { message: "month failed" },
    },
  });
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: true },
    supabaseStub,
  });
  try {
    const res = await ctx.handler(new Request("http://localhost", { method: "GET" }));
    assertEquals(res.status, 200);
    const body = await res.json();

    assertEquals(body.success, true);
    assertEquals(body.users_total, 2);
    assertEquals(body.users_ok, 1);
    assertEquals(body.users_error, 1);
    assertEquals(body.errors, [{ user_id: "u2", error: "month failed" }]);

    const u2Unlock = supabaseStub.calls.find((c) => c.fn === "unlock_badges" && c.args.p_user_id === "u2");
    assertEquals(u2Unlock, undefined);
  } finally {
    ctx.restore();
  }
});

Deno.test("profiles query error is handled by buildErrorResponse with 500", async () => {
  const supabaseStub = createSupabaseStub({
    selectError: { message: "profiles read failed" },
  });
  const ctx = await loadModuleWithStubs({
    authResult: { authorized: true, isServiceCall: true },
    supabaseStub,
    errorResponseBody: { error: "sanitized", source: "buildErrorResponse" },
  });
  try {
    const res = await ctx.handler(new Request("http://localhost", { method: "GET" }));
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body, { error: "sanitized", source: "buildErrorResponse" });
  } finally {
    ctx.restore();
  }
});