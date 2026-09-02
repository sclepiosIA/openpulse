// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: EdgeHandler | undefined;
let loadedModule: unknown | undefined;
let moduleLoadPromise: Promise<void> | undefined;

function installServeStub() {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  const originalServe = Deno.serve;

  const serveStub = (...args: unknown[]) => {
    const handler = args.find((arg) => typeof arg === "function") as EdgeHandler | undefined;
    assertExists(handler);
    capturedHandler = handler;

    return {
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
      finished: Promise.resolve(),
      ref() {},
      unref() {},
      shutdown() {},
    };
  };

  try {
    Object.defineProperty(Deno, "serve", {
      value: serveStub,
      configurable: true,
      writable: true,
    });
  } catch {
    (Deno as unknown as { serve: typeof serveStub }).serve = serveStub;
  }

  return () => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(Deno, "serve", originalDescriptor);
      } else {
        (Deno as unknown as { serve: typeof originalServe }).serve = originalServe;
      }
    } catch {
      (Deno as unknown as { serve: typeof originalServe }).serve = originalServe;
    }
  };
}

async function ensureModuleLoaded(): Promise<{ module: unknown; handler: EdgeHandler }> {
  if (!moduleLoadPromise) {
    moduleLoadPromise = (async () => {
      const restoreServe = installServeStub();
      try {
        loadedModule = await import("./index.ts");
      } finally {
        restoreServe();
      }
    })();
  }

  await moduleLoadPromise;
  assertExists(loadedModule);
  assertExists(capturedHandler);
  return { module: loadedModule, handler: capturedHandler };
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("module loads and registers a Deno.serve handler", async () => {
  const { module, handler } = await ensureModuleLoaded();

  assertExists(module);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS request returns CORS preflight response without reading a body", async () => {
  const { handler } = await ensureModuleLoaded();

  const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret, x-scheduled-export-id",
  );
});

Deno.test("rejects invalid export params before authentication", async () => {
  const { handler } = await ensureModuleLoaded();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dashboard_id: "dashboard-123",
        format: "csv",
        filters: { region: "EU" },
      }),
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await jsonOf(response), { error: "Invalid params" });
});

Deno.test("rejects missing dashboard_id before authentication", async () => {
  const { handler } = await ensureModuleLoaded();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        format: "pdf",
        filters: { period: "2024-Q1" },
      }),
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(await jsonOf(response), { error: "Invalid params" });
});

Deno.test("rejects valid export request without bearer token or cron secret", async () => {
  const { handler } = await ensureModuleLoaded();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dashboard_id: "dashboard-123",
        format: "pdf",
        filters: { region: "EU", year: 2024 },
      }),
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(await jsonOf(response), { error: "Unauthorized" });
});

Deno.test("rejects valid xlsx export request without bearer token", async () => {
  const { handler } = await ensureModuleLoaded();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dashboard_id: "dashboard-xlsx",
        format: "xlsx",
        filters: {},
      }),
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await jsonOf(response), { error: "Unauthorized" });
});

Deno.test("returns generic failure response when request body is not valid JSON", async () => {
  const { handler } = await ensureModuleLoaded();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );

    assertEquals(response.status, 500);
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertEquals(await jsonOf(response), { error: "Export failed" });
  } finally {
    console.error = originalConsoleError;
  }
});