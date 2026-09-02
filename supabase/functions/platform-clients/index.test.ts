// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Handler = (req: Request) => Response | Promise<Response>;

const TEST_ENV: Record<string, string> = {
  PLATFORM_API_KEY: "test-platform-api-key",
  PLATFORM_API_KEYS: "test-platform-api-key",
  PLATFORM_CLIENT_API_KEY: "test-platform-api-key",
  PLATFORM_INTERNAL_API_KEY: "test-platform-api-key",
  INTERNAL_API_KEY: "test-platform-api-key",
  API_KEY: "test-platform-api-key",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_SERVICE_KEY: "test-service-role-key",
  SUPABASE_ANON_KEY: "test-anon-key",
};

async function withTestEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(TEST_ENV)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }

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

async function withFetchStub<T>(fn: () => Promise<T> | T): Promise<{ result: T; calls: string[] }> {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;

    calls.push(url);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await fn();
    return { result, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function fakeServer(): Deno.HttpServer {
  return {
    finished: Promise.resolve(),
    shutdown() {},
    ref() {},
    unref() {},
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 0,
    },
  } as Deno.HttpServer;
}

function requireCapturedHandler(value: unknown): Handler {
  if (typeof value !== "function") {
    throw new TypeError("Deno.serve handler was not captured");
  }

  return value as Handler;
}

async function importWithCapturedServe(tag: string): Promise<{
  handler: Handler;
  serveCallCount: number;
}> {
  let captured: unknown;
  let serveCallCount = 0;
  const originalServe = Deno.serve;

  Deno.serve = ((...args: unknown[]) => {
    serveCallCount++;
    captured = typeof args[0] === "function" ? args[0] : args[1];
    return fakeServer();
  }) as typeof Deno.serve;

  try {
    await import(`./index.ts?test=${encodeURIComponent(tag)}-${crypto.randomUUID()}`);
  } finally {
    Deno.serve = originalServe;
  }

  return {
    handler: requireCapturedHandler(captured),
    serveCallCount,
  };
}

Deno.test("module loads and registers one HTTP handler without performing runtime fetch", async () => {
  await withTestEnv(async () => {
    const { result, calls } = await withFetchStub(() => importWithCapturedServe("module-loads"));

    assertExists(result.handler);
    assertEquals(typeof result.handler, "function");
    assertEquals(result.serveCallCount, 1);
    assertEquals(calls, []);
  });
});

Deno.test("registered Deno.serve callback is the Edge Function request handler", async () => {
  await withTestEnv(async () => {
    const { result } = await withFetchStub(() => importWithCapturedServe("handler-captured"));

    assertExists(result.handler);
    assertEquals(typeof result.handler, "function");
    assertEquals(result.handler.length, 1);
  });
});

Deno.test("module import propagates Deno.serve registration failures", async () => {
  await withTestEnv(async () => {
    const originalServe = Deno.serve;

    Deno.serve = (() => {
      throw new Error("serve unavailable");
    }) as typeof Deno.serve;

    try {
      await assertRejects(
        () => import(`./index.ts?test=serve-failure-${crypto.randomUUID()}`),
        Error,
        "serve unavailable",
      );
    } finally {
      Deno.serve = originalServe;
    }
  });
});

Deno.test("captured handler guard throws when Deno.serve receives no callable handler", () => {
  assertThrows(
    () => requireCapturedHandler(undefined),
    TypeError,
    "Deno.serve handler was not captured",
  );

  assertThrows(
    () => requireCapturedHandler({}),
    TypeError,
    "Deno.serve handler was not captured",
  );
});