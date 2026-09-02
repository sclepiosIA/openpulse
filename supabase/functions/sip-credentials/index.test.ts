import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: EdgeHandler | undefined;
let moduleLoadPromise: Promise<EdgeHandler> | undefined;

async function loadHandler(): Promise<EdgeHandler> {
  if (capturedHandler) return capturedHandler;

  if (!moduleLoadPromise) {
    moduleLoadPromise = (async () => {
      const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");

      Object.defineProperty(Deno, "serve", {
        configurable: true,
        writable: true,
        value: (handler: EdgeHandler) => {
          capturedHandler = handler;
          return {
            finished: Promise.resolve(),
            shutdown: () => {},
            ref: () => {},
            unref: () => {},
          };
        },
      });

      try {
        const module = await import("./index.ts");
        assertExists(module);
      } finally {
        if (originalServeDescriptor) {
          Object.defineProperty(Deno, "serve", originalServeDescriptor);
        }
      }

      assertExists(capturedHandler);
      return capturedHandler;
    })();
  }

  return await moduleLoadPromise;
}

Deno.test("module loads and registers an edge handler", async () => {
  const handler = await loadHandler();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS request returns CORS preflight headers without body", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost/sip-credentials", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type",
  );
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assertEquals(await response.text(), "");
});

Deno.test("POST request without Authorization returns sanitized 401 JSON error", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost/sip-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(await response.json(), { error: "Missing authorization" });
});

Deno.test("non-OPTIONS request without Authorization does not read Supabase environment variables", async () => {
  const handler = await loadHandler();

  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  try {
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_ANON_KEY");

    const response = await handler(
      new Request("http://localhost/sip-credentials", {
        method: "POST",
      }),
    );

    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Missing authorization" });
  } finally {
    if (previousUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousUrl);
    }

    if (previousAnonKey === undefined) {
      Deno.env.delete("SUPABASE_ANON_KEY");
    } else {
      Deno.env.set("SUPABASE_ANON_KEY", previousAnonKey);
    }
  }
});

Deno.test("GET request without Authorization is rejected consistently", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost/sip-credentials", {
      method: "GET",
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await response.json(), { error: "Missing authorization" });
});