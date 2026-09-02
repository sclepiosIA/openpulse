import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Handler = (req: Request) => Promise<Response> | Response;

type QueryState = {
  filters: Record<string, unknown>;
  inserted?: Record<string, unknown>;
};

function makeChain(
  resultResolver: (state: QueryState) => unknown | Promise<unknown>,
) {
  const state: QueryState = { filters: {} };

  const chain = {
    select: (_columns?: string) => chain,
    eq: (key: string, value: unknown) => {
      state.filters[key] = value;
      return chain;
    },
    maybeSingle: async () => await resultResolver(state),
    insert: (payload: Record<string, unknown>) => {
      state.inserted = payload;
      return chain;
    },
    single: async () => await resultResolver(state),
  };

  return chain;
}

function createSupabaseStub(options?: {
  existingByEmail?: Record<string, unknown> | null;
  existingByName?: Record<string, unknown> | null;
  insertError?: { message: string } | null;
  insertedRecordFactory?: (payload: Record<string, unknown>) => Record<string, unknown>;
  throwOnInsert?: Error;
}) {
  const inserts: Record<string, unknown>[] = [];

  const resolver = (state: QueryState) => {
    if (state.inserted) {
      if (options?.throwOnInsert) {
        throw options.throwOnInsert;
      }
      inserts.push(state.inserted);
      if (options?.insertError) {
        return { data: null, error: options.insertError };
      }
      const payload = state.inserted;
      const record = options?.insertedRecordFactory
        ? options.insertedRecordFactory(payload)
        : { id: 999, ...payload };
      return { data: record, error: null };
    }

    if (state.filters.email && options?.existingByEmail) {
      return { data: options.existingByEmail, error: null };
    }

    if (state.filters.nom && state.filters.prenom && options?.existingByName) {
      return { data: options.existingByName, error: null };
    }

    return { data: null, error: null };
  };

  return {
    inserts,
    client: {
      from: (_table: string) => makeChain(resolver),
    },
  };
}

async function loadHandler(params?: {
  serviceRoleKey?: string;
  supabaseUrl?: string;
  supabaseStub?: unknown;
  errorResponseBody?: unknown;
  errorStatus?: number;
}) {
  const originalServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalUrl = Deno.env.get("SUPABASE_URL");

  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", params?.serviceRoleKey ?? "service-role-test-key");
  Deno.env.set("SUPABASE_URL", params?.supabaseUrl ?? "https://example.supabase.co");

  const g = globalThis as typeof globalThis & {
    __testServeHandler?: Handler;
    __testCreateClient?: (...args: unknown[]) => unknown;
    __testBuildErrorResponse?: (
      fnName: string,
      error: unknown,
      headers: Record<string, string>,
      status: number,
    ) => Response;
    __testServeShim?: (handler: Handler) => void;
  };

  g.__testServeHandler = undefined;
  g.__testServeShim = (handler: Handler) => {
    g.__testServeHandler = handler;
  };
  g.__testCreateClient = () =>
    params?.supabaseStub ?? { from: () => makeChain(() => ({ data: null, error: null })) };
  g.__testBuildErrorResponse = (_fnName, _error, headers, status) =>
    new Response(JSON.stringify(params?.errorResponseBody ?? { error: "sanitized-error" }), {
      status: params?.errorStatus ?? status ?? 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const rewritten = source
    // L'import relatif ne se resout pas depuis une URL `data:`.
    .replace(`import { corsHeaders } from '../_shared/cors.ts'`, `const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:8080', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };`)
    .replace(
      'import { serve } from "https://deno.land/std@0.168.0/http/server.ts";',
      'const serve = (globalThis.__testServeShim ?? ((handler) => { globalThis.__testServeHandler = handler; }));',
    )
    .replace(
      'import { createClient } from "@supabase/supabase-js";',
      'const createClient = (...args) => globalThis.__testCreateClient(...args);',
    )
    .replace(
      'import { buildErrorResponse } from "../_shared/error-sanitizer.ts";',
      'const buildErrorResponse = (...args) => globalThis.__testBuildErrorResponse(...args);',
    );

  const moduleUrl = `data:application/typescript;charset=utf-8,${encodeURIComponent(rewritten)}#${crypto.randomUUID()}`;

  try {
    await import(moduleUrl);
    const handler = g.__testServeHandler;
    return {
      handler,
      restore() {
        if (originalServiceRole === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
        else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalServiceRole);

        if (originalUrl === undefined) Deno.env.delete("SUPABASE_URL");
        else Deno.env.set("SUPABASE_URL", originalUrl);

        delete g.__testServeHandler;
        delete g.__testCreateClient;
        delete g.__testBuildErrorResponse;
        delete g.__testServeShim;
      },
    };
  } catch (e) {
    if (originalServiceRole === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalServiceRole);

    if (originalUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", originalUrl);

    delete g.__testServeHandler;
    delete g.__testCreateClient;
    delete g.__testBuildErrorResponse;
    delete g.__testServeShim;
    throw e;
  }
}

Deno.test("module loads and registers a handler via serve", async () => {
  const ctx = await loadHandler();
  try {
    assertExists(ctx.handler);
  } finally {
    ctx.restore();
  }
});

Deno.test("OPTIONS returns CORS headers and empty body", async () => {
  const ctx = await loadHandler();
  try {
    const res = await ctx.handler!(new Request("http://localhost", { method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertNotEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      res.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
    assertEquals(await res.text(), "");
  } finally {
    ctx.restore();
  }
});

Deno.test("rejects request without service role authorization", async () => {
  const ctx = await loadHandler({ serviceRoleKey: "srv-key" });
  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-key",
      },
      body: JSON.stringify({ partenaire_id: 1, contacts: [] }),
    });

    const res = await ctx.handler!(req);
    assertEquals(res.status, 401);
    assertEquals(res.headers.get("Content-Type"), "application/json");
    assertEquals(await res.json(), { error: "Unauthorized: service role required" });
  } finally {
    ctx.restore();
  }
});

Deno.test("accepts authorization when apikey matches service role key", async () => {
  const supabase = createSupabaseStub();
  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "srv-key",
      },
      body: JSON.stringify({ partenaire_id: 42, contacts: [] }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.success, true);
    assertEquals(body.created_count, 0);
    assertEquals(body.skipped_count, 0);
    assertEquals(body.error_count, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("accepts authorization when Authorization header includes service role key", async () => {
  const supabase = createSupabaseStub();
  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer srv-key",
      },
      body: JSON.stringify({ partenaire_id: 42, contacts: [] }),
    });

    const res = await ctx.handler!(req);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, true);
  } finally {
    ctx.restore();
  }
});

Deno.test("returns 400 when partenaire_id or contacts are missing or invalid", async () => {
  const supabase = createSupabaseStub();
  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "srv-key",
      },
      body: JSON.stringify({ partenaire_id: null, contacts: "not-an-array" }),
    });

    const res = await ctx.handler!(req);
    assertEquals(res.status, 400);
    assertEquals(await res.json(), { error: "Missing required fields: partenaire_id and contacts" });
  } finally {
    ctx.restore();
  }
});

Deno.test("skips contacts missing nom or prenom and contacts with invalid email", async () => {
  const supabase = createSupabaseStub();
  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "srv-key",
      },
      body: JSON.stringify({
        partenaire_id: 123,
        contacts: [
          { prenom: "Alice", email: "alice@example.com" },
          { nom: "Martin", prenom: "Bob", email: "bad-email" },
        ],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 0);
    assertEquals(body.skipped_count, 2);
    assertEquals(body.error_count, 0);
    assertEquals(body.skipped[0].reason, "Missing nom or prenom");
    assertEquals(body.skipped[1].reason, "Invalid email format");
    assertEquals(supabase.inserts.length, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("skips existing contact found by email", async () => {
  const supabase = createSupabaseStub({
    existingByEmail: {
      id: 7,
      nom: "Dupont",
      prenom: "Jean",
      email: "jean.dupont@example.com",
    },
  });

  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer srv-key",
      },
      body: JSON.stringify({
        partenaire_id: 321,
        contacts: [{ nom: "Dupont", prenom: "Jean", email: "jean.dupont@example.com" }],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 0);
    assertEquals(body.skipped_count, 1);
    assertEquals(body.error_count, 0);
    assertEquals(body.skipped[0].reason, "Contact already exists");
    assertEquals(body.skipped[0].existing_id, 7);
    assertEquals(supabase.inserts.length, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("skips existing contact found by nom and prenom when no email match exists", async () => {
  const supabase = createSupabaseStub({
    existingByName: {
      id: 12,
      nom: "Durand",
      prenom: "Claire",
      email: null,
    },
  });

  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "srv-key",
      },
      body: JSON.stringify({
        partenaire_id: 10,
        contacts: [{ nom: "Durand", prenom: "Claire" }],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 0);
    assertEquals(body.skipped_count, 1);
    assertEquals(body.error_count, 0);
    assertEquals(body.skipped[0].existing_id, 12);
    assertEquals(supabase.inserts.length, 0);
  } finally {
    ctx.restore();
  }
});

Deno.test("creates a new contact with notes from thread_id and default null optional fields", async () => {
  const supabase = createSupabaseStub({
    insertedRecordFactory: (payload) => ({ id: 55, ...payload }),
  });

  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer srv-key",
      },
      body: JSON.stringify({
        thread_id: "thread-abc",
        partenaire_id: 88,
        contacts: [{ nom: "Leroy", prenom: "Emma" }],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 1);
    assertEquals(body.skipped_count, 0);
    assertEquals(body.error_count, 0);
    assertEquals(body.created[0].id, 55);
    assertEquals(body.created[0].nom, "Leroy");
    assertEquals(body.created[0].prenom, "Emma");

    assertEquals(supabase.inserts.length, 1);
    assertEquals(supabase.inserts[0], {
      partenaire_id: 88,
      nom: "Leroy",
      prenom: "Emma",
      fonction: null,
      email: null,
      telephone: null,
      est_contact_principal: false,
      notes: "Créé automatiquement depuis l'email thread thread-abc",
    });
  } finally {
    ctx.restore();
  }
});

Deno.test("creates a new contact preserving provided optional fields and null notes without thread_id", async () => {
  const supabase = createSupabaseStub({
    insertedRecordFactory: (payload) => ({ id: 77, ...payload }),
  });

  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "srv-key",
      },
      body: JSON.stringify({
        partenaire_id: 5,
        contacts: [{
          nom: "Bernard",
          prenom: "Sophie",
          fonction: "CEO",
          email: "sophie.bernard@example.com",
          telephone: "0102030405",
        }],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 1);
    assertEquals(body.created[0].id, 77);

    assertEquals(supabase.inserts[0], {
      partenaire_id: 5,
      nom: "Bernard",
      prenom: "Sophie",
      fonction: "CEO",
      email: "sophie.bernard@example.com",
      telephone: "0102030405",
      est_contact_principal: false,
      notes: null,
    });
  } finally {
    ctx.restore();
  }
});

Deno.test("collects insert errors in errors array", async () => {
  const supabase = createSupabaseStub({
    insertError: { message: "duplicate key value violates unique constraint" },
  });

  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer srv-key",
      },
      body: JSON.stringify({
        partenaire_id: 99,
        contacts: [{ nom: "Petit", prenom: "Luc", email: "luc.petit@example.com" }],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 0);
    assertEquals(body.skipped_count, 0);
    assertEquals(body.error_count, 1);
    assertEquals(body.errors[0].error, "duplicate key value violates unique constraint");
  } finally {
    ctx.restore();
  }
});

Deno.test("collects thrown exceptions during insert in errors array", async () => {
  const supabase = createSupabaseStub({
    throwOnInsert: new Error("database offline"),
  });

  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
  });

  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "srv-key",
      },
      body: JSON.stringify({
        partenaire_id: 7,
        contacts: [{ nom: "Roux", prenom: "Paul", email: "paul.roux@example.com" }],
      }),
    });

    const res = await ctx.handler!(req);
    const body = await res.json();

    assertEquals(res.status, 200);
    assertEquals(body.created_count, 0);
    assertEquals(body.skipped_count, 0);
    assertEquals(body.error_count, 1);
    assertEquals(body.errors[0].error, "database offline");
  } finally {
    ctx.restore();
  }
});

Deno.test("uses buildErrorResponse when req.json throws", async () => {
  const supabase = createSupabaseStub();
  const ctx = await loadHandler({
    serviceRoleKey: "srv-key",
    supabaseStub: supabase.client,
    errorResponseBody: { error: "sanitized-error" },
    errorStatus: 500,
  });

  try {
    const req = {
      method: "POST",
      headers: new Headers({
        authorization: "Bearer srv-key",
        "content-type": "application/json",
      }),
      json() {
        throw new Error("invalid json");
      },
    } as unknown as Request;

    const res = await ctx.handler!(req);
    assertEquals(res.status, 500);
    assertEquals(res.headers.get("Content-Type"), "application/json");
    assertEquals(await res.json(), { error: "sanitized-error" });
  } finally {
    ctx.restore();
  }
});

Deno.test("static sanity asserts for imported assert helpers", async () => {
  assertThrows(() => {
    throw new Error("boom");
  });

  await assertRejects(async () => {
    throw new Error("async boom");
  });
});