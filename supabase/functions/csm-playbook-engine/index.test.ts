// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Handler = (req: Request) => Response | Promise<Response>;

async function withCapturedHandler(
  envOverrides: Record<string, string | undefined>,
  fn: (handler: Handler) => void | Promise<void>,
): Promise<void> {
  const envToApply: Record<string, string | undefined> = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    INTERNAL_FUNCTION_SECRET: undefined,
    ...envOverrides,
  };

  const previousEnv = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(envToApply)) {
    previousEnv.set(key, Deno.env.get(key));
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }

  let capturedHandler: Handler | undefined;
  const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  const originalServe = Deno.serve;

  const serveStub = ((arg1: unknown, arg2?: unknown) => {
    const handler = typeof arg1 === "function"
      ? arg1
      : typeof arg2 === "function"
      ? arg2
      : undefined;

    if (!handler) {
      throw new TypeError("Deno.serve called without a handler");
    }

    capturedHandler = handler as Handler;

    return {
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    };
  }) as typeof Deno.serve;

  try {
    Object.defineProperty(Deno, "serve", {
      value: serveStub,
      configurable: true,
      writable: true,
    });
  } catch {
    (Deno as unknown as { serve: typeof Deno.serve }).serve = serveStub;
  }

  try {
    await import(`./index.ts?test=${crypto.randomUUID()}`);
    assertExists(capturedHandler);
    await fn(capturedHandler as Handler);
  } finally {
    if (originalServeDescriptor) {
      try {
        Object.defineProperty(Deno, "serve", originalServeDescriptor);
      } catch {
        (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
      }
    } else {
      (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
    }

    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

Deno.test("module loads and registers an HTTP handler through Deno.serve", async () => {
  await withCapturedHandler({}, (handler) => {
    assertExists(handler);
    assertEquals(typeof handler, "function");
  });
});

Deno.test("OPTIONS preflight returns CORS headers without authorization", async () => {
  await withCapturedHandler({}, async (handler) => {
    const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      response.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
    assertEquals(await response.text(), "");
  });
});

Deno.test("rejects request when neither service role bearer nor shared secret is provided", async () => {
  await withCapturedHandler({ INTERNAL_FUNCTION_SECRET: undefined }, async (handler) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 401);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertEquals(await response.json(), { error: "Unauthorized" });
  });
});

Deno.test("rejects request when shared secret is configured but header is missing", async () => {
  await withCapturedHandler({ INTERNAL_FUNCTION_SECRET: "expected-secret" }, async (handler) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
  });
});

Deno.test("rejects request when shared secret header does not match configured secret", async () => {
  await withCapturedHandler({ INTERNAL_FUNCTION_SECRET: "expected-secret" }, async (handler) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-function-secret": "wrong-secret",
        },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
  });
});

Deno.test("rejects authorization header that is not the exact service-role bearer token", async () => {
  await withCapturedHandler({ INTERNAL_FUNCTION_SECRET: undefined }, async (handler) => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "bearer test-service-role",
        },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
  });
});