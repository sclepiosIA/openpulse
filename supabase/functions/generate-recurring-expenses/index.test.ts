// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module loads", async () => {
  const originalServe = Deno.serve;
  const originalEnvGet = Deno.env.get;
  const originalFetch = globalThis.fetch;

  try {
    let capturedHandler: ((req: Request) => Response | Promise<Response>) | undefined;

    (Deno as unknown as { serve: typeof Deno.serve }).serve = ((handler: (req: Request) => Response | Promise<Response>) => {
      capturedHandler = handler;
      return {} as Deno.HttpServer;
    }) as typeof Deno.serve;

    globalThis.fetch = ((_input: Request | URL | string, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )) as typeof fetch;

    Deno.env.get = ((key: string) => {
      if (key === "SUPABASE_URL") return "https://example.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
      if (key === "INTERNAL_SECRET") return "test-secret";
      return originalEnvGet.call(Deno.env, key);
    }) as typeof Deno.env.get;

    const mod = await import("./index.ts");
    assertExists(mod);
    assertExists(capturedHandler);

    const optionsRes = await capturedHandler!(new Request("http://localhost", { method: "OPTIONS" }));
    assertEquals(optionsRes.status, 200);
    assertNotEquals(optionsRes.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      optionsRes.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
  } finally {
    (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
    Deno.env.get = originalEnvGet;
    globalThis.fetch = originalFetch;
  }
});