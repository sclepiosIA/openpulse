import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CapturedHandler = (request: Request, info?: Deno.ServeHandlerInfo) => Response | Promise<Response>;

let capturedHandler: CapturedHandler | undefined;
let subjectLoaded = false;

async function loadSubjectWithServeStub(): Promise<CapturedHandler> {
  if (subjectLoaded) {
    assertExists(capturedHandler);
    return capturedHandler;
  }

  const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  let handlerFromServe: CapturedHandler | undefined;

  const fakeServer = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    finished: Promise.resolve(),
    shutdown: () => {},
    ref: () => {},
    unref: () => {},
  };

  const fakeServe = ((...args: unknown[]) => {
    for (const arg of args) {
      if (typeof arg === "function") {
        handlerFromServe = arg as CapturedHandler;
      }
    }

    if (!handlerFromServe) {
      const maybeOptions = args[0] as { handler?: unknown } | undefined;
      if (typeof maybeOptions?.handler === "function") {
        handlerFromServe = maybeOptions.handler as CapturedHandler;
      }
    }

    return fakeServer;
  }) as typeof Deno.serve;

  Object.defineProperty(Deno, "serve", {
    value: fakeServe,
    configurable: true,
    writable: true,
  });

  try {
    await import("./index.ts");
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(Deno, "serve", originalDescriptor);
    }
  }

  assertExists(handlerFromServe);
  capturedHandler = handlerFromServe;
  subjectLoaded = true;
  return handlerFromServe;
}

Deno.test("module registers a Deno.serve HTTP handler without opening a real server", async () => {
  const handler = await loadSubjectWithServeStub();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("GET request returns the expected health payload", async () => {
  const handler = await loadSubjectWithServeStub();
  const before = Date.now();

  const response = await handler(
    new Request("http://localhost/", {
      method: "GET",
      headers: { accept: "application/json" },
    }),
  );

  const after = Date.now();

  assertEquals(response.status, 200);
  assertEquals((response.headers.get("content-type") ?? "").includes("application/json"), true);

  const body = await response.json();

  assertEquals(body.status, "ok");
  assertEquals(body.version, "1.0.0");
  assertExists(body.time);

  const parsedTime = Date.parse(body.time);
  assertEquals(Number.isNaN(parsedTime), false);
  assertEquals(parsedTime >= before - 1_000, true);
  assertEquals(parsedTime <= after + 1_000, true);
});

Deno.test("POST request also returns the same health contract", async () => {
  const handler = await loadSubjectWithServeStub();

  const response = await handler(
    new Request("http://localhost/status", {
      method: "POST",
      body: JSON.stringify({ ignored: true }),
      headers: { "content-type": "application/json" },
    }),
  );

  assertEquals(response.status, 200);

  const body = await response.json();

  assertEquals(body.status, "ok");
  assertEquals(body.version, "1.0.0");
  assertExists(body.time);
});

Deno.test("OPTIONS preflight is handled before the health JSON response", async () => {
  const handler = await loadSubjectWithServeStub();

  const response = await handler(
    new Request("http://localhost/", {
      method: "OPTIONS",
      headers: {
        origin: "https://example.test",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization, content-type",
      },
    }),
  );

  assertEquals(response.status === 200 || response.status === 204, true);
  assertExists(response.headers.get("access-control-allow-origin"));

  const text = await response.text();
  assertEquals(text.includes('"status":"ok"'), false);
});