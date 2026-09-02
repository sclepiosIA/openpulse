// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module loads", async () => {
  const originalServe = Deno.serve;
  const originalEnvGet = Deno.env.get;
  const originalFetch = globalThis.fetch;

  try {
    Deno.serve = ((_handler: Deno.ServeHandler) => {
      return { shutdown() {} } as Deno.HttpServer;
    }) as typeof Deno.serve;

    Deno.env.get = ((_key: string) => "") as typeof Deno.env.get;

    globalThis.fetch = (async (_input: Request | URL | string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const mod = await import("./index.ts");
    assertExists(mod);
  } finally {
    Deno.serve = originalServe;
    Deno.env.get = originalEnvGet;
    globalThis.fetch = originalFetch;
  }
});