import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CapturedHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: CapturedHandler | undefined;
let loadPromise: Promise<void> | undefined;

function replaceDenoServe(serve: typeof Deno.serve) {
  Object.defineProperty(Deno, "serve", {
    value: serve,
    configurable: true,
    writable: true,
  });
}

async function ensureModuleLoaded(): Promise<CapturedHandler> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const originalServe = Deno.serve;

      const serveStub = ((handlerOrOptions: unknown, maybeHandler?: unknown) => {
        const handler = typeof handlerOrOptions === "function" ? handlerOrOptions : maybeHandler;

        if (typeof handler !== "function") {
          throw new TypeError("Deno.serve was called without a request handler");
        }

        capturedHandler = handler as CapturedHandler;

        return {
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
          addr: {
            transport: "tcp",
            hostname: "127.0.0.1",
            port: 0,
          },
        } as unknown as Deno.HttpServer;
      }) as typeof Deno.serve;

      replaceDenoServe(serveStub);
      try {
        await import("./index.ts");
      } finally {
        replaceDenoServe(originalServe);
      }
    })();
  }

  await loadPromise;
  assertExists(capturedHandler);
  return capturedHandler;
}

Deno.test("module loads and registers an HTTP handler with Deno.serve", async () => {
  const handler = await ensureModuleLoaded();

  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS preflight returns expected CORS headers without calling external services", async () => {
  const handler = await ensureModuleLoaded();

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = (() => {
    fetchCalls++;
    return Promise.resolve(
      new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const response = await handler(
      new Request("http://localhost/meeting-notes-process", {
        method: "OPTIONS",
      }),
    );

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      response.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    );
    assertEquals(await response.text(), "");
    assertEquals(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("unauthorized non-OPTIONS request returns JSON 401 before processing multipart data", async () => {
  const handler = await ensureModuleLoaded();

  const originalFetch = globalThis.fetch;
  const previousSupabaseUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let fetchCalls = 0;

  Deno.env.set("SUPABASE_URL", "http://localhost.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  globalThis.fetch = (() => {
    fetchCalls++;
    return Promise.resolve(
      new Response(JSON.stringify({ error: "network disabled in tests" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const formData = new FormData();
    formData.set("userId", "user-test-1");
    formData.set("title", "Réunion test");
    formData.set(
      "file",
      new File(["audio"], "meeting.webm", { type: "audio/webm" }),
    );

    const response = await handler(
      new Request("http://localhost/meeting-notes-process", {
        method: "POST",
        body: formData,
      }),
    );

    assertEquals(response.status, 401);
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(await response.json(), { error: "Unauthorized" });
    assertEquals(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;

    if (previousSupabaseUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousSupabaseUrl);
    }

    if (previousServiceKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
    }
  }
});