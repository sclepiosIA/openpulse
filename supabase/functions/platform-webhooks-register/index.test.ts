import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

Deno.test("module loads and registers a Deno.serve handler without opening a real server", async () => {
  const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
  const envSnapshot = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    PLATFORM_API_KEYS: Deno.env.get("PLATFORM_API_KEYS"),
  };

  let capturedHandler: unknown;

  try {
    Deno.env.set("SUPABASE_URL", "http://localhost:54321");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
    Deno.env.set("PLATFORM_API_KEYS", JSON.stringify([
      { key: "test-api-key", scope: ["site_web", "product"] },
    ]));

    Object.defineProperty(Deno, "serve", {
      configurable: true,
      writable: true,
      value: (handlerOrOptions: unknown, maybeHandler?: unknown) => {
        capturedHandler = typeof handlerOrOptions === "function" ? handlerOrOptions : maybeHandler;
        return {
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
          addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
        };
      },
    });

    await import("./index.ts");

    assertExists(capturedHandler);
    assertEquals(typeof capturedHandler, "function");
  } finally {
    if (originalServeDescriptor) {
      Object.defineProperty(Deno, "serve", originalServeDescriptor);
    }
    restoreEnv(envSnapshot);
  }
});

Deno.test("test harness assertions are available", async () => {
  assertEquals(201, 201);
  assertExists({ ok: true });

  assertThrows(() => {
    throw new Error("expected sync failure");
  }, Error, "expected sync failure");

  await assertRejects(
    async () => {
      throw new Error("expected async failure");
    },
    Error,
    "expected async failure",
  );
});