import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const importOriginalModule = () => import("./index.ts");

const MODULE_URL = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(MODULE_URL);
}

function extractHashApiKeyFunction(source: string): (key: string) => Promise<string> {
  const match = source.match(/async function hashApiKey\(key:\s*string\):\s*Promise<string>\s*\{[\s\S]*?\n\}/m);
  if (!match) {
    throw new Error("hashApiKey function not found");
  }

  const jsFunction = match[0].replace(
    /async function hashApiKey\(key:\s*string\):\s*Promise<string>\s*/,
    "async function hashApiKey(key) ",
  );

  return eval(`(${jsFunction})`) as (key: string) => Promise<string>;
}

async function withSupabaseEnv<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = new Map<string, string | undefined>();

  for (const key of keys) {
    previous.set(key, Deno.env.get(key));
  }

  Deno.env.set("SUPABASE_URL", "http://localhost.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

type MockConfig = {
  apiKey?: Record<string, unknown> | null;
  keyError?: unknown;
  minuteCount?: number;
  dayCount?: number;
  ticketError?: unknown;
  attachError?: unknown;
  uploadError?: unknown;
};

function createSupabaseMock(config: MockConfig = {}) {
  const calls: Array<Record<string, unknown>> = [];
  const storageCalls: Array<Record<string, unknown>> = [];
  let apiLogCountCalls = 0;

  const defaultApiKey = {
    id: "api-key-1",
    nom: "Integration test key",
    permissions: ["write"],
    rate_limit_per_minute: null,
    rate_limit_per_day: null,
    total_requests: 7,
    est_active: true,
    expires_at: null,
    created_by: "user-1",
  };

  function snapshot(state: Record<string, unknown>) {
    return {
      table: state.table,
      op: state.op,
      columns: state.columns,
      options: state.options,
      filters: [...((state.filters as Array<unknown>) ?? [])],
      payload: state.payload,
    };
  }

  function resolveQuery(state: Record<string, unknown>) {
    calls.push(snapshot(state));

    if (state.table === "api_keys" && state.op === "select") {
      if (state.columns === "id") {
        return { data: { id: "api-key-1" }, error: null };
      }

      if (config.keyError) {
        return { data: null, error: config.keyError };
      }

      if (config.apiKey === null) {
        return { data: null, error: null };
      }

      return { data: config.apiKey ?? defaultApiKey, error: null };
    }

    if (state.table === "api_logs" && state.op === "select") {
      apiLogCountCalls += 1;
      return {
        count: apiLogCountCalls === 1 ? (config.minuteCount ?? 0) : (config.dayCount ?? 0),
        data: null,
        error: null,
      };
    }

    if (state.table === "support_tickets" && state.op === "insert") {
      if (config.ticketError) {
        return { data: null, error: config.ticketError };
      }

      const payload = state.payload as Record<string, unknown>;

      return {
        data: {
          id: "ticket-1",
          numero_ticket: "SUP-0001",
          titre: payload.titre,
          priorite: payload.priorite,
          statut: "nouveau",
          created_at: "2025-01-01T00:00:00.000Z",
        },
        error: null,
      };
    }

    if (state.table === "support_ticket_attachments" && state.op === "insert") {
      return { data: null, error: config.attachError ?? null };
    }

    if (state.table === "api_logs" && state.op === "insert") {
      return { data: null, error: null };
    }

    if (state.table === "api_keys" && state.op === "update") {
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  function createQuery(table: string) {
    const state: Record<string, unknown> = {
      table,
      op: "select",
      columns: undefined,
      options: undefined,
      filters: [],
      payload: undefined,
    };

    const query = {
      select(columns: string, options?: Record<string, unknown>) {
        if (state.op !== "insert" && state.op !== "update") {
          state.op = "select";
        }
        state.columns = columns;
        state.options = options;
        return query;
      },
      eq(column: string, value: unknown) {
        (state.filters as Array<unknown>).push({ type: "eq", column, value });
        return query;
      },
      gte(column: string, value: unknown) {
        (state.filters as Array<unknown>).push({ type: "gte", column, value });
        return query;
      },
      insert(payload: unknown) {
        state.op = "insert";
        state.payload = payload;
        return query;
      },
      update(payload: unknown) {
        state.op = "update";
        state.payload = payload;
        return query;
      },
      single() {
        return Promise.resolve(resolveQuery(state));
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(resolveQuery(state)).then(onFulfilled, onRejected);
      },
    };

    return query;
  }

  const client = {
    from(table: string) {
      return createQuery(table);
    },
    storage: {
      from(bucket: string) {
        return {
          upload(path: string, data: Uint8Array, options: Record<string, unknown>) {
            storageCalls.push({ bucket, path, data, options });
            return Promise.resolve({ data: { path }, error: config.uploadError ?? null });
          },
        };
      },
    },
  };

  return {
    calls,
    storageCalls,
    createClient(_url: string, _key: string) {
      return client;
    },
  };
}

async function loadHandler(createClientImpl: unknown) {
  const originalMockCreateClient = (globalThis as Record<string, unknown>).__mockCreateClient;
  const originalCapturedHandler = (globalThis as Record<string, unknown>).__capturedHandler;

  let source = await readModuleSource();

  source = source
    .replace(/import\s+\{\s*serve\s*\}\s+from\s+["']https:\/\/deno\.land\/std@0\.168\.0\/http\/server\.ts["'];\s*/g, "")
    .replace(/import\s+\{\s*createClient\s*\}\s+from\s+["']https:\/\/esm\.sh\/@supabase\/supabase-js@2["'];\s*/g, "")
    .replace(/import\s+\{\s*buildErrorResponse\s*\}\s+from\s+["']\.\.\/_shared\/error-sanitizer\.ts["'];\s*/g, "")
    // L'import relatif ajoute par la consolidation CORS ne se resout pas depuis
    // le fichier temporaire : on le pointe vers le vrai module partage.
    .replace(
      /import\s+\{\s*origineAutorisee\s*\}\s+from\s+["']\.\.\/_shared\/cors\.ts["'];?/,
      "const { origineAutorisee } = await import(" + JSON.stringify(new URL("../_shared/cors.ts", import.meta.url).href) + ");",
    );

  const transformed = `
const serve = (handler: (req: Request) => Response | Promise<Response>) => {
  (globalThis as any).__capturedHandler = handler;
};
const createClient = (globalThis as any).__mockCreateClient;
const buildErrorResponse = (
  functionName: string,
  _error: unknown,
  headers: Record<string, string>,
  status = 500,
) => new Response(
  JSON.stringify({ error: "Internal server error", function: functionName }),
  { status, headers: { ...headers, "Content-Type": "application/json" } },
);
${source}
export const __handler = (globalThis as any).__capturedHandler;
`;

  const tempFile = await Deno.makeTempFile({ suffix: ".ts" });

  try {
    (globalThis as Record<string, unknown>).__mockCreateClient = createClientImpl;
    (globalThis as Record<string, unknown>).__capturedHandler = undefined;

    await Deno.writeTextFile(tempFile, transformed);

    const moduleUrl = `file://${tempFile}?v=${crypto.randomUUID()}`;
    const imported = await import(moduleUrl);
    const handler = imported.__handler as (req: Request) => Promise<Response>;

    assertExists(handler);

    return handler;
  } finally {
    if (originalMockCreateClient === undefined) {
      delete (globalThis as Record<string, unknown>).__mockCreateClient;
    } else {
      (globalThis as Record<string, unknown>).__mockCreateClient = originalMockCreateClient;
    }

    if (originalCapturedHandler === undefined) {
      delete (globalThis as Record<string, unknown>).__capturedHandler;
    } else {
      (globalThis as Record<string, unknown>).__capturedHandler = originalCapturedHandler;
    }

    await Deno.remove(tempFile).catch(() => {});
  }
}

async function withHandler<T>(
  config: MockConfig,
  fn: (
    handler: (req: Request) => Promise<Response>,
    mock: ReturnType<typeof createSupabaseMock>,
  ) => Promise<T>,
): Promise<T> {
  const mock = createSupabaseMock(config);

  return await withSupabaseEnv(async () => {
    const handler = await loadHandler(mock.createClient);
    return await fn(handler, mock);
  });
}

Deno.test("module source is available and original relative import is declared for smoke usage", async () => {
  const source = await readModuleSource();

  assertExists(importOriginalModule);
  assertEquals(source.includes("serve(async (req) =>"), true);
  assertEquals(source.includes('from("api_keys")'), true);
  assertEquals(source.includes('from("support_tickets")'), true);
});

Deno.test("hashApiKey computes deterministic SHA-256 hex digests", async () => {
  const source = await readModuleSource();
  const hashApiKey = extractHashApiKeyFunction(source);

  assertEquals(
    await hashApiKey("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assertEquals(
    await hashApiKey(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

Deno.test("hashApiKey extractor fails clearly if helper is absent", () => {
  assertThrows(
    () => extractHashApiKeyFunction("const unrelated = true;"),
    Error,
    "hashApiKey function not found",
  );
});

Deno.test("missing source file rejects with NotFound in test harness", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./definitely-missing-index.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});

Deno.test("OPTIONS request returns CORS preflight headers without database access", async () => {
  await withHandler({}, async (handler, mock) => {
    const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assertEquals(mock.calls.length, 0);
  });
});

Deno.test("non-POST request returns 405 JSON error", async () => {
  await withHandler({}, async (handler) => {
    const response = await handler(new Request("http://localhost", { method: "GET" }));
    const body = await response.json();

    assertEquals(response.status, 405);
    assertEquals(body, { error: "Method not allowed" });
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  });
});

Deno.test("POST without X-API-Key returns 401 before querying api_keys", async () => {
  await withHandler({}, async (handler, mock) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ titre: "Ticket" }),
      }),
    );
    const body = await response.json();

    assertEquals(response.status, 401);
    assertEquals(body, { error: "Missing X-API-Key header" });
    assertEquals(mock.calls.length, 0);
  });
});

Deno.test("invalid API key returns 401 and queries by hash and key prefix", async () => {
  await withHandler({ apiKey: null }, async (handler, mock) => {
    const apiKey = "test_api_key_1234567890";
    const source = await readModuleSource();
    const expectedHash = await extractHashApiKeyFunction(source)(apiKey);

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "X-API-Key": apiKey },
        body: JSON.stringify({ titre: "Ticket" }),
      }),
    );
    const body = await response.json();

    assertEquals(response.status, 401);
    assertEquals(body, { error: "Invalid API key" });

    const apiKeySelect = mock.calls.find((call) => call.table === "api_keys" && call.op === "select");
    assertExists(apiKeySelect);
    assertEquals(apiKeySelect.filters, [
      { type: "eq", column: "key_hash", value: expectedHash },
      { type: "eq", column: "key_prefix", value: apiKey.substring(0, 12) },
    ]);
  });
});

Deno.test("revoked API key returns 403", async () => {
  await withHandler(
    {
      apiKey: {
        id: "api-key-1",
        permissions: ["write"],
        rate_limit_per_minute: null,
        rate_limit_per_day: null,
        total_requests: 0,
        est_active: false,
        expires_at: null,
      },
    },
    async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "x-api-key": "test_api_key_1234567890" },
          body: JSON.stringify({ titre: "Ticket" }),
        }),
      );

      assertEquals(response.status, 403);
      assertEquals(await response.json(), { error: "API key is revoked" });
    },
  );
});

Deno.test("expired API key returns 403", async () => {
  await withHandler(
    {
      apiKey: {
        id: "api-key-1",
        permissions: ["write"],
        rate_limit_per_minute: null,
        rate_limit_per_day: null,
        total_requests: 0,
        est_active: true,
        expires_at: "2000-01-01T00:00:00.000Z",
      },
    },
    async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "X-API-Key": "test_api_key_1234567890" },
          body: JSON.stringify({ titre: "Ticket" }),
        }),
      );

      assertEquals(response.status, 403);
      assertEquals(await response.json(), { error: "API key has expired" });
    },
  );
});

Deno.test("API key without write or admin permission returns 403", async () => {
  await withHandler(
    {
      apiKey: {
        id: "api-key-1",
        permissions: ["read"],
        rate_limit_per_minute: null,
        rate_limit_per_day: null,
        total_requests: 0,
        est_active: true,
        expires_at: null,
      },
    },
    async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "X-API-Key": "test_api_key_1234567890" },
          body: JSON.stringify({ titre: "Ticket" }),
        }),
      );

      assertEquals(response.status, 403);
      assertEquals(await response.json(), { error: "API key lacks 'write' permission" });
    },
  );
});

Deno.test("per-minute rate limit returns 429 with Retry-After header", async () => {
  await withHandler(
    {
      apiKey: {
        id: "api-key-1",
        permissions: ["write"],
        rate_limit_per_minute: 2,
        rate_limit_per_day: null,
        total_requests: 0,
        est_active: true,
        expires_at: null,
      },
      minuteCount: 2,
    },
    async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "X-API-Key": "test_api_key_1234567890" },
          body: JSON.stringify({ titre: "Ticket" }),
        }),
      );

      assertEquals(response.status, 429);
      assertEquals(response.headers.get("Retry-After"), "60");
      assertEquals(await response.json(), { error: "Rate limit exceeded (per minute)" });
    },
  );
});

Deno.test("per-day rate limit returns 429 with Retry-After header after minute check passes", async () => {
  await withHandler(
    {
      apiKey: {
        id: "api-key-1",
        permissions: ["write"],
        rate_limit_per_minute: 10,
        rate_limit_per_day: 20,
        total_requests: 0,
        est_active: true,
        expires_at: null,
      },
      minuteCount: 3,
      dayCount: 20,
    },
    async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "X-API-Key": "test_api_key_1234567890" },
          body: JSON.stringify({ titre: "Ticket" }),
        }),
      );

      assertEquals(response.status, 429);
      assertEquals(response.headers.get("Retry-After"), "3600");
      assertEquals(await response.json(), { error: "Rate limit exceeded (per day)" });
    },
  );
});

Deno.test("blank title returns validation error and does not insert support ticket", async () => {
  await withHandler({}, async (handler, mock) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "X-API-Key": "test_api_key_1234567890" },
        body: JSON.stringify({ titre: "   ", description: "No title" }),
      }),
    );

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: "Field 'titre' is required" });
    assertEquals(mock.calls.some((call) => call.table === "support_tickets"), false);
  });
});

Deno.test("title over 500 characters returns validation error", async () => {
  await withHandler({}, async (handler, mock) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "X-API-Key": "test_api_key_1234567890" },
        body: JSON.stringify({ titre: "x".repeat(501) }),
      }),
    );

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: "Field 'titre' must be under 500 characters" });
    assertEquals(mock.calls.some((call) => call.table === "support_tickets"), false);
  });
});

Deno.test("JSON ticket creation trims fields, normalizes invalid priority/type, logs usage, and increments total_requests", async () => {
  await withHandler({}, async (handler, mock) => {
    const before = Date.now();

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "X-API-Key": "test_api_key_1234567890",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titre: "  Imprimante bloquée  ",
          description: "  Bourrage papier au niveau bac 2  ",
          tags: ["materiel", "imprimante"],
          type_probleme: "type-inconnu",
          priorite: "urgente",
          contact_nom: "Ada Lovelace",
          contact_email: "ada@example.test",
          etablissement_id: "etab-1",
        }),
      }),
    );

    const after = Date.now();
    const body = await response.json();

    assertEquals(response.status, 201);
    assertEquals(body.success, true);
    assertEquals(body.ticket.numero_ticket, "SUP-0001");
    assertEquals(body.ticket.titre, "Imprimante bloquée");
    assertEquals(body.ticket.priorite, "moyenne");
    assertEquals(body.ticket.attachments_count, 0);

    const ticketInsert = mock.calls.find((call) => call.table === "support_tickets" && call.op === "insert");
    assertExists(ticketInsert);

    const payload = ticketInsert.payload as Record<string, unknown>;
    assertEquals(payload.titre, "Imprimante bloquée");
    assertEquals(payload.description, "Bourrage papier au niveau bac 2");
    assertEquals(payload.type_probleme, "autre");
    assertEquals(payload.priorite, "moyenne");
    assertEquals(payload.contact_nom, "Ada Lovelace");
    assertEquals(payload.contact_email, "ada@example.test");
    assertEquals(payload.etablissement_id, "etab-1");
    assertEquals(payload.tags, ["materiel", "imprimante"]);

    const slaTime = new Date(payload.sla_deadline as string).getTime();
    const minExpected = before + 23.9 * 60 * 60 * 1000;
    const maxExpected = after + 24.1 * 60 * 60 * 1000;
    assertEquals(slaTime >= minExpected && slaTime <= maxExpected, true);

    const apiLogInsert = mock.calls.find((call) => call.table === "api_logs" && call.op === "insert");
    assertExists(apiLogInsert);
    assertEquals((apiLogInsert.payload as Record<string, unknown>).status_code, 201);
    assertEquals((apiLogInsert.payload as Record<string, unknown>).endpoint, "/api-v1-tickets");
    assertEquals((apiLogInsert.payload as Record<string, unknown>).method, "POST");

    const updateApiKey = mock.calls.find((call) => call.table === "api_keys" && call.op === "update");
    assertExists(updateApiKey);
    assertEquals((updateApiKey.payload as Record<string, unknown>).total_requests, 8);
  });
});

Deno.test("admin permission can create a critical ticket with four-hour SLA", async () => {
  await withHandler(
    {
      apiKey: {
        id: "api-key-admin",
        permissions: ["admin"],
        rate_limit_per_minute: null,
        rate_limit_per_day: null,
        total_requests: 0,
        est_active: true,
        expires_at: null,
      },
    },
    async (handler, mock) => {
      const before = Date.now();

      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "X-API-Key": "test_api_key_1234567890",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            titre: "Panne totale",
            type_probleme: "bug",
            priorite: "critique",
          }),
        }),
      );

      const after = Date.now();

      assertEquals(response.status, 201);

      const ticketInsert = mock.calls.find((call) => call.table === "support_tickets" && call.op === "insert");
      assertExists(ticketInsert);

      const payload = ticketInsert.payload as Record<string, unknown>;
      assertEquals(payload.priorite, "critique");
      assertEquals(payload.type_probleme, "bug");

      const slaTime = new Date(payload.sla_deadline as string).getTime();
      assertEquals(slaTime >= before + 3.9 * 60 * 60 * 1000, true);
      assertEquals(slaTime <= after + 4.1 * 60 * 60 * 1000, true);
    },
  );
});

Deno.test("multipart request parses comma tags and uploads accepted attachments", async () => {
  await withHandler({}, async (handler, mock) => {
    const formData = new FormData();
    formData.set("titre", "Incident réseau");
    formData.set("description", "Connexion instable");
    formData.set("type_probleme", "bug");
    formData.set("priorite", "haute");
    formData.set("tags", "reseau, urgent, ");
    formData.append("attachments", new File([new Uint8Array([1, 2, 3])], "trace.log", { type: "text/plain" }));
    formData.append("attachments", new File([new Uint8Array([4, 5])], "capture.bin"));

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "X-API-Key": "test_api_key_1234567890" },
        body: formData,
      }),
    );
    const body = await response.json();

    assertEquals(response.status, 201);
    assertEquals(body.ticket.attachments_count, 2);

    const ticketInsert = mock.calls.find((call) => call.table === "support_tickets" && call.op === "insert");
    assertExists(ticketInsert);
    assertEquals((ticketInsert.payload as Record<string, unknown>).tags, ["reseau", "urgent"]);
    assertEquals((ticketInsert.payload as Record<string, unknown>).type_probleme, "bug");
    assertEquals((ticketInsert.payload as Record<string, unknown>).priorite, "haute");

    assertEquals(mock.storageCalls.length, 2);
    assertEquals(mock.storageCalls[0].bucket, "ticket-attachments");
    assertEquals((mock.storageCalls[0].options as Record<string, unknown>).contentType, "text/plain");
    assertEquals((mock.storageCalls[1].options as Record<string, unknown>).contentType, "application/octet-stream");

    const attachmentInsert = mock.calls.find((call) => call.table === "support_ticket_attachments" && call.op === "insert");
    assertExists(attachmentInsert);

    const attachmentRows = attachmentInsert.payload as Array<Record<string, unknown>>;
    assertEquals(attachmentRows.length, 2);
    assertEquals(attachmentRows[0].file_name, "trace.log");
    assertEquals(attachmentRows[0].file_size, 3);
    assertEquals(attachmentRows[0].uploaded_by_api_key_id, "api-key-1");
    assertEquals(attachmentRows[1].file_name, "capture.bin");
    assertEquals(attachmentRows[1].file_size, 2);
  });
});

Deno.test("multipart request parses JSON tags when tags form field contains JSON array", async () => {
  await withHandler({}, async (handler, mock) => {
    const formData = new FormData();
    formData.set("titre", "Besoin aide");
    formData.set("tags", JSON.stringify(["support", "client"]));

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "X-API-Key": "test_api_key_1234567890" },
        body: formData,
      }),
    );

    assertEquals(response.status, 201);

    const ticketInsert = mock.calls.find((call) => call.table === "support_tickets" && call.op === "insert");
    assertExists(ticketInsert);
    assertEquals((ticketInsert.payload as Record<string, unknown>).tags, ["support", "client"]);
  });
});

Deno.test("multipart file larger than 10 MB returns 400 before ticket insert", async () => {
  await withHandler({}, async (handler, mock) => {
    const formData = new FormData();
    formData.set("titre", "Fichier trop volumineux");
    formData.append(
      "attachments",
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "oversized.bin", {
        type: "application/octet-stream",
      }),
    );

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "X-API-Key": "test_api_key_1234567890" },
        body: formData,
      }),
    );

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: 'File "oversized.bin" exceeds 10 MB limit' });
    assertEquals(mock.calls.some((call) => call.table === "support_tickets"), false);
    assertEquals(mock.storageCalls.length, 0);
  });
});

Deno.test("ticket insert failure returns sanitized 500 response and logs error when API key can be found", async () => {
  await withHandler(
    { ticketError: { message: "database unavailable" } },
    async (handler, mock) => {
      const originalConsoleError = console.error;
      console.error = () => {};

      try {
        const response = await handler(
          new Request("http://localhost", {
            method: "POST",
            headers: {
              "X-API-Key": "test_api_key_1234567890",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ titre: "Ticket impossible" }),
          }),
        );

        assertEquals(response.status, 500);
        assertEquals(await response.json(), {
          error: "Internal server error",
          function: "api-v1-tickets",
        });

        const errorLog = mock.calls.find((call) => {
          if (call.table !== "api_logs" || call.op !== "insert") {
            return false;
          }
          const payload = call.payload as Record<string, unknown>;
          return payload.status_code === 500 && payload.error_message === "Internal server error";
        });

        assertExists(errorLog);
      } finally {
        console.error = originalConsoleError;
      }
    },
  );
});