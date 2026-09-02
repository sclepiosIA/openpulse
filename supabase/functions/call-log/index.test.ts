import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CapturedServeHandler = (request: Request) => Response | Promise<Response>;

let capturedHandler: CapturedServeHandler | undefined;
let moduleLoadPromise: Promise<unknown> | undefined;

async function loadModuleAndCaptureHandler(): Promise<CapturedServeHandler> {
  if (!moduleLoadPromise) {
    const originalServe = Deno.serve;

    Object.defineProperty(Deno, "serve", {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        const handler = typeof args[0] === "function" ? args[0] : args[1];
        capturedHandler = handler as CapturedServeHandler;

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
        };
      },
    });

    moduleLoadPromise = import("./index.ts").finally(() => {
      Object.defineProperty(Deno, "serve", {
        configurable: true,
        writable: true,
        value: originalServe,
      });
    });
  }

  await moduleLoadPromise;
  assertExists(capturedHandler);
  return capturedHandler;
}

Deno.test("module loads and registers a Deno.serve handler", async () => {
  const handler = await loadModuleAndCaptureHandler();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS request returns CORS preflight headers without body", async () => {
  const handler = await loadModuleAndCaptureHandler();

  const response = await handler(
    new Request("http://localhost", {
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

Deno.test("POST request without Authorization returns 401 JSON error before reading body", async () => {
  const handler = await loadModuleAndCaptureHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{invalid-json",
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body, { error: "Missing authorization" });
});

Deno.test("GET request without Authorization also returns sanitized 401 JSON error", async () => {
  const handler = await loadModuleAndCaptureHandler();

  const response = await handler(
    new Request("http://localhost", {
      method: "GET",
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.error, "Missing authorization");
});

Deno.test("captured handler is stable across imports and does not start a real server in tests", async () => {
  const firstHandler = await loadModuleAndCaptureHandler();
  const secondHandler = await loadModuleAndCaptureHandler();

  assertEquals(firstHandler, secondHandler);
  assertThrows(() => {
    throw new Error("expected synchronous assertion path");
  });
  await assertRejects(
    () => Promise.reject(new Error("expected asynchronous assertion path")),
    Error,
    "expected asynchronous assertion path",
  );
});