import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let handlerPromise: Promise<EdgeHandler> | undefined;

const TEST_ENV: Record<string, string> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  EMAIL_ENCRYPTION_KEY: "test-encryption-key",
  META_APP_ID: "test-meta-app-id",
  META_APP_SECRET: "test-meta-app-secret",
  LINKEDIN_CLIENT_ID: "test-linkedin-client-id",
  LINKEDIN_CLIENT_SECRET: "test-linkedin-client-secret",
  TIKTOK_CLIENT_KEY: "test-tiktok-client-key",
  TIKTOK_CLIENT_SECRET: "test-tiktok-client-secret",
};

async function loadHandler(): Promise<EdgeHandler> {
  if (handlerPromise) return handlerPromise;

  handlerPromise = (async () => {
    const previousEnv = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(TEST_ENV)) {
      previousEnv.set(key, Deno.env.get(key));
      Deno.env.set(key, value);
    }

    const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
    const originalFetch = globalThis.fetch;
    let capturedHandler: EdgeHandler | undefined;

    const fakeServer = {
      addr: { hostname: "127.0.0.1", port: 0, transport: "tcp" },
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => fakeServer,
      unref: () => fakeServer,
    };

    const serveStub = (...args: unknown[]) => {
      const handler = args.find((arg) => typeof arg === "function");
      if (!handler) {
        throw new TypeError("Deno.serve stub expected a request handler");
      }
      capturedHandler = handler as EdgeHandler;
      return fakeServer;
    };

    try {
      Object.defineProperty(Deno, "serve", {
        value: serveStub,
        configurable: true,
        writable: true,
      });

      globalThis.fetch = (() => {
        throw new Error("Unexpected network call in offline unit test");
      }) as typeof fetch;

      await import("./index.ts");
    } finally {
      if (serveDescriptor) {
        Object.defineProperty(Deno, "serve", serveDescriptor);
      }
      globalThis.fetch = originalFetch;

      for (const [key, value] of previousEnv.entries()) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }

    assertExists(capturedHandler);
    return capturedHandler;
  })();

  return handlerPromise;
}

Deno.test("module loads and registers an Edge Function handler", async () => {
  const handler = await loadHandler();
  assertExists(handler);
});

Deno.test("OPTIONS request returns CORS preflight response without network access", async () => {
  const handler = await loadHandler();

  const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
  assertExists(response.headers.get("access-control-allow-origin"));
});

Deno.test("missing OAuth parameters returns an HTML error page", async () => {
  const handler = await loadHandler();

  const response = await handler(new Request("http://localhost?code=oauth-code-only"));
  const body = await response.text();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(body.includes("Échec de connexion"), true);
  assertEquals(body.includes("Paramètres OAuth manquants"), true);
  assertEquals(body.includes("https://gestion.exploitant.example.org/parametres/social"), true);
});

Deno.test("provider error is escaped in the generated HTML response", async () => {
  const handler = await loadHandler();
  const providerError = `bad<&>"'`;
  const url = `http://localhost?error=${encodeURIComponent(providerError)}&code=ignored&state=ignored`;

  const response = await handler(new Request(url));
  const body = await response.text();

  assertEquals(response.status, 200);
  assertEquals(body.includes("Provider error: bad&lt;&amp;&gt;&quot;&#39;"), true);
  assertEquals(body.includes(`Provider error: ${providerError}`), false);
  assertEquals(body.includes('<h2 class="err">Échec de connexion</h2>'), true);
});

Deno.test("validation branches do not call fetch", async () => {
  const handler = await loadHandler();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    globalThis.fetch = (() => {
      fetchCalls++;
      return Promise.resolve(new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    }) as typeof fetch;

    const response = await handler(new Request("http://localhost?error=access_denied"));
    const body = await response.text();

    assertEquals(fetchCalls, 0);
    assertEquals(body.includes("Provider error: access_denied"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("test harness assertions are available", async () => {
  assertThrows(() => {
    throw new TypeError("local synchronous failure");
  }, TypeError, "local synchronous failure");

  await assertRejects(
    () => Promise.reject(new RangeError("local asynchronous failure")),
    RangeError,
    "local asynchronous failure",
  );
});