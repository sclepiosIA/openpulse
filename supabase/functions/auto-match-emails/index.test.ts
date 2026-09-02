// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module loads", async () => {
  const originalServe = Deno.serve;
  const originalEnvGet = Deno.env.get;

  let capturedHandler: ((req: Request) => Response | Promise<Response>) | undefined;

  try {
    (Deno as typeof Deno & {
      serve: typeof Deno.serve;
    }).serve = ((handler: (req: Request) => Response | Promise<Response>) => {
      capturedHandler = handler;
      return {} as Deno.HttpServer;
    }) as typeof Deno.serve;

    Deno.env.get = ((key: string) => {
      if (key === "SUPABASE_URL") return "http://localhost.test";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
      return originalEnvGet.call(Deno.env, key);
    }) as typeof Deno.env.get;

    const mod = await import("./index.ts");
    assertExists(mod);
    assertExists(capturedHandler);
  } finally {
    (Deno as typeof Deno & {
      serve: typeof Deno.serve;
    }).serve = originalServe;
    Deno.env.get = originalEnvGet;
  }
});

Deno.test("OPTIONS request returns CORS headers without throwing", async () => {
  const originalServe = Deno.serve;
  const originalEnvGet = Deno.env.get;

  let capturedHandler: ((req: Request) => Response | Promise<Response>) | undefined;

  try {
    (Deno as typeof Deno & {
      serve: typeof Deno.serve;
    }).serve = ((handler: (req: Request) => Response | Promise<Response>) => {
      capturedHandler = handler;
      return {} as Deno.HttpServer;
    }) as typeof Deno.serve;

    Deno.env.get = ((key: string) => {
      if (key === "SUPABASE_URL") return "http://localhost.test";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
      return originalEnvGet.call(Deno.env, key);
    }) as typeof Deno.env.get;

    await import(`./index.ts?case=options-${crypto.randomUUID()}`);
    assertExists(capturedHandler);

    const response = await capturedHandler!(
      new Request("http://localhost", { method: "OPTIONS" }),
    );

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      response.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
  } finally {
    (Deno as typeof Deno & {
      serve: typeof Deno.serve;
    }).serve = originalServe;
    Deno.env.get = originalEnvGet;
  }
});

Deno.test("importing the module multiple times with a stubbed server does not throw", async () => {
  const originalServe = Deno.serve;
  const originalEnvGet = Deno.env.get;
  const handlers: Array<(req: Request) => Response | Promise<Response>> = [];

  try {
    (Deno as typeof Deno & {
      serve: typeof Deno.serve;
    }).serve = ((handler: (req: Request) => Response | Promise<Response>) => {
      handlers.push(handler);
      return {} as Deno.HttpServer;
    }) as typeof Deno.serve;

    Deno.env.get = ((key: string) => {
      if (key === "SUPABASE_URL") return "http://localhost.test";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
      return originalEnvGet.call(Deno.env, key);
    }) as typeof Deno.env.get;

    await import(`./index.ts?case=reload-a-${crypto.randomUUID()}`);
    await import(`./index.ts?case=reload-b-${crypto.randomUUID()}`);

    assertEquals(handlers.length, 2);

    const response = await handlers[1](
      new Request("http://localhost", { method: "OPTIONS" }),
    );
    assertEquals(response.status, 200);
  } finally {
    (Deno as typeof Deno & {
      serve: typeof Deno.serve;
    }).serve = originalServe;
    Deno.env.get = originalEnvGet;
  }
});