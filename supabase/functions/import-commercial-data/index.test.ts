// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CapturedHandler = (req: Request, info?: unknown) => Response | Promise<Response>;

let capturedHandler: CapturedHandler | undefined;
let importPromise: Promise<CapturedHandler> | undefined;

async function loadHandler(): Promise<CapturedHandler> {
  if (capturedHandler) return capturedHandler;
  if (importPromise) return await importPromise;

  importPromise = (async () => {
    const originalServe = Deno.serve;

    try {
      (Deno as unknown as { serve: (...args: unknown[]) => unknown }).serve = (
        ...args: unknown[]
      ) => {
        const maybeHandler = args.find((arg) => typeof arg === "function") as CapturedHandler | undefined;
        capturedHandler = maybeHandler;

        return {
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
          addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
        };
      };

      await import("./index.ts");

      assertExists(capturedHandler);
      assertEquals(typeof capturedHandler, "function");
      return capturedHandler;
    } finally {
      (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
    }
  })();

  return await importPromise;
}

Deno.test("module loads and registers a Deno.serve handler", async () => {
  const handler = await loadHandler();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS preflight returns CORS headers without requiring authentication", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  // Le durcissement CORS a remplace la declaration en ligne de cette fonction
  // par le socle partage ../_shared/cors.ts, dont la liste d'en-tetes acceptes
  // est fixe. Les quatre en-tetes x-supabase-client-* que l'amont declarait ici
  // n'y figurent plus ; aucun appelant du depot ne les emet (voir deno.json,
  // @supabase/supabase-js 2.50.3). L'egalite reste stricte.
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
});

Deno.test("POST without Authorization header returns 401 Unauthorized", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etablissements: [], partenaires: [] }),
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await response.json(), { error: "Unauthorized" });
});

Deno.test("POST with non-Bearer Authorization header returns 401 Unauthorized", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic abc123",
      },
      body: JSON.stringify({ etablissements: [], partenaires: [] }),
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await response.json(), { error: "Unauthorized" });
});

Deno.test("POST with empty Bearer token returns 401 Unauthorized before reading body", async () => {
  const handler = await loadHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "Authorization": "Bearer",
      },
      body: "{invalid-json",
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "Unauthorized" });
});