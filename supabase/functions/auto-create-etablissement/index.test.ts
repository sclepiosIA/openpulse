// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: EdgeHandler | undefined;
let moduleLoaded = false;

const originalServe = Deno.serve;

async function getHandler(): Promise<EdgeHandler> {
  if (!moduleLoaded) {
    capturedHandler = undefined;

    (Deno as unknown as { serve: unknown }).serve = ((handler: EdgeHandler) => {
      capturedHandler = handler;
      return {
        addr: { hostname: "127.0.0.1", port: 0, transport: "tcp" },
        finished: Promise.resolve(),
        shutdown: () => Promise.resolve(),
        ref: () => {},
        unref: () => {},
      };
    }) as unknown;

    try {
      await import("./index.ts");
      moduleLoaded = true;
    } finally {
      (Deno as unknown as { serve: unknown }).serve = originalServe;
    }
  }

  assertExists(capturedHandler);
  return capturedHandler;
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
    const value = values[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
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

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("module registers an Edge Function handler via Deno.serve", async () => {
  const handler = await getHandler();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS preflight returns configured CORS headers", async () => {
  const handler = await getHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://gestion-marque-ia.apercu.example.org",
  );
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-function-secret",
  );
  assertEquals(await response.text(), "");
});

Deno.test("POST without internal secret or admin JWT is rejected with 403", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "expected-secret",
    },
    async () => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ suggestion_id: "suggestion-123" }),
        }),
      );

      const body = await readJson(response);

      assertEquals(response.status, 403);
      assertEquals(response.headers.get("Content-Type"), "application/json");
      assertEquals(
        response.headers.get("Access-Control-Allow-Origin"),
        "https://gestion-marque-ia.apercu.example.org",
      );
      assertEquals(body, { error: "Unauthorized" });
    },
  );
});

Deno.test("POST with wrong internal secret is rejected with 403", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "expected-secret",
    },
    async () => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-function-secret": "wrong-secret",
          },
          body: JSON.stringify({ suggestion_id: "suggestion-123" }),
        }),
      );

      const body = await readJson(response);

      assertEquals(response.status, 403);
      assertEquals(body, { error: "Unauthorized" });
    },
  );
});

Deno.test("authorized POST without suggestion_id returns validation error", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "expected-secret",
    },
    async () => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-function-secret": "expected-secret",
          },
          body: JSON.stringify({}),
        }),
      );

      const body = await readJson(response);

      assertEquals(response.status, 400);
      assertEquals(body, { error: "suggestion_id is required" });
      assertEquals(
        response.headers.get("Access-Control-Allow-Headers"),
        "authorization, x-client-info, apikey, content-type, x-function-secret",
      );
    },
  );
});

Deno.test("authorized POST with null suggestion_id returns validation error", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "expected-secret",
    },
    async () => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-function-secret": "expected-secret",
          },
          body: JSON.stringify({ suggestion_id: null }),
        }),
      );

      const body = await readJson(response);

      assertEquals(response.status, 400);
      assertEquals(body, { error: "suggestion_id is required" });
    },
  );
});

Deno.test("authorized POST with malformed JSON is converted to sanitized 500 response", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "expected-secret",
    },
    async () => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-function-secret": "expected-secret",
          },
          body: "{not-valid-json",
        }),
      );

      const body = await readJson(response);

      assertEquals(response.status, 500);
      assertEquals(body.error, "Internal server error");
      assertExists(body.details);
      assertEquals(
        response.headers.get("Access-Control-Allow-Origin"),
        "https://gestion-marque-ia.apercu.example.org",
      );
    },
  );
});

Deno.test("Request constructor validates invalid HTTP method locally", () => {
  assertThrows(
    () => new Request("http://localhost", { method: "INVALID METHOD" }),
    TypeError,
  );
});

Deno.test("handler promise rejects when request body stream is already consumed", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "expected-secret",
    },
    async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-function-secret": "expected-secret",
        },
        body: JSON.stringify({}),
      });

      await request.text();

      const response = await handler(request);
      const body = await readJson(response);

      assertEquals(response.status, 500);
      assertEquals(body.error, "Internal server error");

      await assertRejects(
        () => request.json(),
        TypeError,
      );
    },
  );
});