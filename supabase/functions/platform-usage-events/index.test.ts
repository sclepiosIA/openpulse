import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

function replaceDenoServe(onHandler: (handler: (req: Request) => Response | Promise<Response>) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  const original = Deno.serve;

  const stub = ((arg1: unknown, arg2?: unknown) => {
    const handler = typeof arg1 === "function" ? arg1 : arg2;
    onHandler(handler as (req: Request) => Response | Promise<Response>);

    return {
      addr: { hostname: "127.0.0.1", port: 0, transport: "tcp" },
      finished: Promise.resolve(),
      shutdown() {},
      ref() {},
      unref() {},
    };
  }) as typeof Deno.serve;

  Object.defineProperty(Deno, "serve", {
    configurable: true,
    writable: true,
    value: stub,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, "serve", descriptor);
    } else {
      Object.defineProperty(Deno, "serve", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    ctx: { scope: "platform:product:write" },
    checks: [],
    stores: [],
    inserts: [],
    fromCalls: [],
    insertResult: { error: null },
    idempotency: { key: null, cached: null },
    ...overrides,
  };
}

async function jsonOf(response: Response) {
  const text = await response.text();
  return text.length ? JSON.parse(text) : null;
}

async function loadIsolatedHandler(state = makeState()) {
  const root = await Deno.makeTempDir();
  const functionDir = `${root}/platform-usage-events`;
  const sharedDir = `${root}/_shared`;

  await Deno.mkdir(functionDir, { recursive: true });
  await Deno.mkdir(sharedDir, { recursive: true });

  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  await Deno.writeTextFile(`${functionDir}/index.ts`, source);

  await Deno.writeTextFile(
    `${sharedDir}/platform-auth.ts`,
    `
export async function withApiKey(req, handler) {
  const state = globalThis.__platformAuthMockState;
  if (state.authResponse) return state.authResponse;
  return await handler(state.ctx ?? { scope: "platform:product:write" });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(message, status = 500, code = "error") {
  return new Response(JSON.stringify({ error: { message, code } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function serviceClient() {
  const state = globalThis.__platformAuthMockState;
  return {
    from(table) {
      state.fromCalls.push(table);
      return {
        async insert(rows) {
          state.inserts.push({ table, rows });
          return state.insertResult ?? { error: null };
        },
      };
    },
  };
}

export async function checkIdempotency(req, namespace) {
  const state = globalThis.__platformAuthMockState;
  state.checks.push({ method: req.method, namespace });
  return state.idempotency ?? { key: null, cached: null };
}

export async function storeIdempotency(key, namespace, result, status) {
  const state = globalThis.__platformAuthMockState;
  state.stores.push({ key, namespace, result, status });
}
`,
  );

  let capturedHandler: ((req: Request) => Response | Promise<Response>) | undefined;
  const restoreServe = replaceDenoServe((handler) => {
    capturedHandler = handler;
  });

  globalThis.__platformAuthMockState = state;

  try {
    await import(`file://${functionDir}/index.ts?case=${crypto.randomUUID()}`);
  } finally {
    restoreServe();
  }

  assertExists(capturedHandler);

  return {
    handler: capturedHandler,
    state,
    async cleanup() {
      delete globalThis.__platformAuthMockState;
      await Deno.remove(root, { recursive: true });
    },
  };
}

Deno.test("module loads from ./index.ts and registers a Deno.serve handler without opening a real server", async () => {
  let registered = false;
  const restoreServe = replaceDenoServe((handler) => {
    registered = typeof handler === "function";
  });

  try {
    await import("./index.ts");
    assertEquals(registered, true);
  } finally {
    restoreServe();
  }
});

Deno.test("rejects non-POST requests before idempotency and database work", async () => {
  const loaded = await loadIsolatedHandler();

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "GET",
    }));

    assertEquals(response.status, 405);
    assertEquals(await jsonOf(response), {
      error: { message: "Method not allowed", code: "method" },
    });
    assertEquals(loaded.state.checks, []);
    assertEquals(loaded.state.inserts, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("rejects requests whose API key scope is not a product platform scope", async () => {
  const loaded = await loadIsolatedHandler(makeState({
    ctx: { scope: "platform:billing:write" },
  }));

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: JSON.stringify({ events: [] }),
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 403);
    assertEquals(await jsonOf(response), {
      error: { message: "Forbidden — product scope required", code: "forbidden_scope" },
    });
    assertEquals(loaded.state.checks, []);
    assertEquals(loaded.state.inserts, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("returns cached idempotency response before reading the request body", async () => {
  const loaded = await loadIsolatedHandler(makeState({
    idempotency: {
      key: "idem-cached",
      cached: new Response(JSON.stringify({ accepted: 12, rejected: 3 }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    },
  }));

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: "{ invalid json",
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 202);
    assertEquals(await jsonOf(response), { accepted: 12, rejected: 3 });
    assertEquals(loaded.state.checks, [{ method: "POST", namespace: "usage-events" }]);
    assertEquals(loaded.state.inserts, []);
    assertEquals(loaded.state.stores, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("rejects invalid JSON bodies", async () => {
  const loaded = await loadIsolatedHandler();

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: "{ not-json",
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 400);
    assertEquals(await jsonOf(response), {
      error: { message: "Invalid JSON", code: "invalid_body" },
    });
    assertEquals(loaded.state.checks, [{ method: "POST", namespace: "usage-events" }]);
    assertEquals(loaded.state.inserts, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("rejects bodies whose events property is not an array", async () => {
  const loaded = await loadIsolatedHandler();

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: JSON.stringify({ events: { event_name: "opened" } }),
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 400);
    assertEquals(await jsonOf(response), {
      error: { message: "events must be array", code: "invalid_events" },
    });
    assertEquals(loaded.state.inserts, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("accepts an empty event batch without inserting rows or storing idempotency", async () => {
  const loaded = await loadIsolatedHandler(makeState({
    idempotency: { key: "idem-empty", cached: null },
  }));

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: JSON.stringify({ events: [] }),
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 202);
    assertEquals(await jsonOf(response), { accepted: 0, rejected: 0 });
    assertEquals(loaded.state.inserts, []);
    assertEquals(loaded.state.stores, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("rejects batches larger than 500 events", async () => {
  const loaded = await loadIsolatedHandler();
  const events = Array.from({ length: 501 }, (_, index) => ({
    etablissement_id: VALID_UUID,
    event_name: `event_${index}`,
    occurred_at: "2024-01-02T03:04:05.000Z",
  }));

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: JSON.stringify({ events }),
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 400);
    assertEquals(await jsonOf(response), {
      error: { message: "Max 500 events per batch", code: "batch_too_large" },
    });
    assertEquals(loaded.state.inserts, []);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("validates, transforms, inserts valid events and counts rejected events", async () => {
  const loaded = await loadIsolatedHandler(makeState({
    idempotency: { key: "idem-valid-batch", cached: null },
  }));

  const body = {
    events: [
      {
        etablissement_id: VALID_UUID,
        user_external_id: "user-42",
        event_name: "dashboard.opened",
        module: "analytics",
        occurred_at: "2024-01-02T03:04:05.000Z",
        metadata: { source: "unit-test", count: 2 },
      },
      {
        etablissement_id: "abcdefab-1234-5678-9abc-abcdefabcdef",
        event_name: "profile.updated",
        occurred_at: "2024-02-03T04:05:06.000Z",
      },
      {
        etablissement_id: "not-a-uuid",
        event_name: "invalid.uuid",
        occurred_at: "2024-03-04T05:06:07.000Z",
      },
      {
        etablissement_id: VALID_UUID,
        occurred_at: "2024-04-05T06:07:08.000Z",
      },
    ],
  };

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 202);
    assertEquals(await jsonOf(response), { accepted: 2, rejected: 2 });

    assertEquals(loaded.state.fromCalls, ["platform_usage_events"]);
    assertEquals(loaded.state.inserts, [{
      table: "platform_usage_events",
      rows: [
        {
          etablissement_id: VALID_UUID,
          user_external_id: "user-42",
          event_name: "dashboard.opened",
          module: "analytics",
          occurred_at: "2024-01-02T03:04:05.000Z",
          metadata: { source: "unit-test", count: 2 },
        },
        {
          etablissement_id: "abcdefab-1234-5678-9abc-abcdefabcdef",
          user_external_id: null,
          event_name: "profile.updated",
          module: null,
          occurred_at: "2024-02-03T04:05:06.000Z",
          metadata: {},
        },
      ],
    }]);

    assertEquals(loaded.state.stores, [{
      key: "idem-valid-batch",
      namespace: "usage-events",
      result: { accepted: 2, rejected: 2 },
      status: 202,
    }]);
  } finally {
    await loaded.cleanup();
  }
});

Deno.test("returns db_error and does not store idempotency when insertion fails", async () => {
  const loaded = await loadIsolatedHandler(makeState({
    idempotency: { key: "idem-db-error", cached: null },
    insertResult: { error: { message: "insert failed" } },
  }));

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = await loaded.handler(new Request("http://localhost/platform-usage-events", {
      method: "POST",
      body: JSON.stringify({
        events: [{
          etablissement_id: VALID_UUID,
          event_name: "dashboard.opened",
          occurred_at: "2024-01-02T03:04:05.000Z",
        }],
      }),
      headers: { "content-type": "application/json" },
    }));

    assertEquals(response.status, 500);
    assertEquals(await jsonOf(response), {
      error: { message: "Ingestion failed", code: "db_error" },
    });
    assertEquals(loaded.state.inserts.length, 1);
    assertEquals(loaded.state.stores, []);
  } finally {
    console.error = originalConsoleError;
    await loaded.cleanup();
  }
});