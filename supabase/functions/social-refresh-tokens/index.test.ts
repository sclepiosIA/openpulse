// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Handler = (request: Request) => Response | Promise<Response>;

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EMAIL_ENCRYPTION_KEY",
  "CRON_SECRET",
  "META_APP_ID",
  "META_APP_SECRET",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
];

function snapshotEnv(keys: string[]): Map<string, string | undefined> {
  const snapshot = new Map<string, string | undefined>();
  for (const key of keys) snapshot.set(key, Deno.env.get(key));
  return snapshot;
}

function restoreEnv(snapshot: Map<string, string | undefined>) {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
}

function setRequiredEnv(cronSecret: string) {
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-placeholder");
  Deno.env.set("EMAIL_ENCRYPTION_KEY", "test-encryption-key-placeholder");
  Deno.env.set("CRON_SECRET", cronSecret);
  Deno.env.set("META_APP_ID", "test-meta-app-id");
  Deno.env.set("META_APP_SECRET", "test-meta-app-secret");
  Deno.env.set("TIKTOK_CLIENT_KEY", "test-tiktok-client-key");
  Deno.env.set("TIKTOK_CLIENT_SECRET", "test-tiktok-client-secret");
}

function stubDenoServe(onHandler: (handler: Handler) => void): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  const originalServe = Deno.serve;

  const serveStub = ((...args: unknown[]) => {
    const handler = args.find((arg) => typeof arg === "function") as Handler | undefined;
    assertExists(handler);
    onHandler(handler);

    return {
      addr: { hostname: "127.0.0.1", port: 0, transport: "tcp" },
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
    };
  }) as typeof Deno.serve;

  try {
    Object.defineProperty(Deno, "serve", {
      configurable: true,
      writable: true,
      value: serveStub,
    });
  } catch {
    (Deno as unknown as { serve: typeof Deno.serve }).serve = serveStub;
  }

  return () => {
    try {
      if (originalDescriptor) Object.defineProperty(Deno, "serve", originalDescriptor);
      else delete (Deno as unknown as { serve?: typeof Deno.serve }).serve;
    } catch {
      (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
    }
  };
}

async function withLoadedHandler(
  testFn: (
    handler: Handler,
    context: { fetchCalls: () => number; cronSecret: string },
  ) => Promise<void> | void,
) {
  const cronSecret = `cron-${crypto.randomUUID()}`;
  const envSnapshot = snapshotEnv(ENV_KEYS);
  const originalFetch = globalThis.fetch;
  let capturedHandler: Handler | undefined;
  let fetchCallCount = 0;

  const restoreServe = stubDenoServe((handler) => {
    capturedHandler = handler;
  });

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  setRequiredEnv(cronSecret);

  try {
    await import(`./index.ts?deno-test=${crypto.randomUUID()}`);
    assertExists(capturedHandler);
    assertEquals(typeof capturedHandler, "function");
    await testFn(capturedHandler, {
      fetchCalls: () => fetchCallCount,
      cronSecret,
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreServe();
    restoreEnv(envSnapshot);
  }
}

Deno.test("module loads and registers a Deno.serve handler without calling fetch", async () => {
  await withLoadedHandler((_handler, context) => {
    assertEquals(context.fetchCalls(), 0);
  });
});

Deno.test("OPTIONS preflight returns ok with CORS headers", async () => {
  await withLoadedHandler(async (handler, context) => {
    const response = await handler(
      new Request("http://localhost/social-refresh-tokens", {
        method: "OPTIONS",
      }),
    );

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "ok");
    assertExists(response.headers.get("access-control-allow-origin"));
    assertEquals(context.fetchCalls(), 0);
  });
});

Deno.test("POST without cron secret is rejected with JSON 403 and no outbound fetch", async () => {
  await withLoadedHandler(async (handler, context) => {
    const response = await handler(
      new Request("http://localhost/social-refresh-tokens", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 403);
    assertEquals(response.headers.get("content-type"), "application/json");
    assertEquals(await response.json(), { error: "Forbidden" });
    assertEquals(context.fetchCalls(), 0);
  });
});

Deno.test("POST with wrong cron secret of same length is rejected", async () => {
  await withLoadedHandler(async (handler, context) => {
    const wrongSecret = "x".repeat(context.cronSecret.length);

    const response = await handler(
      new Request("http://localhost/social-refresh-tokens", {
        method: "POST",
        headers: { "x-cron-secret": wrongSecret },
        body: JSON.stringify({ trigger: "cron" }),
      }),
    );

    assertEquals(response.status, 403);
    assertEquals(await response.json(), { error: "Forbidden" });
    assertEquals(context.fetchCalls(), 0);
  });
});