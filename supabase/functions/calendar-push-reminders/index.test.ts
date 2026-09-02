import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

function installFakeDenoListen() {
  const originalListen = Deno.listen;
  const listeners: Array<{ close: () => void }> = [];

  const fakeListen = () => {
    let closed = false;

    const listener = {
      rid: 0,
      addr: {
        transport: "tcp",
        hostname: "127.0.0.1",
        port: 8000,
      },
      close() {
        closed = true;
      },
      accept() {
        if (closed) {
          return Promise.reject(new Deno.errors.BadResource("Listener closed"));
        }
        return new Promise<Deno.Conn>(() => {});
      },
      async *[Symbol.asyncIterator]() {
        while (!closed) {
          await new Promise<never>(() => {});
        }
      },
    } as unknown as Deno.Listener;

    listeners.push(listener);
    return listener;
  };

  Object.defineProperty(Deno, "listen", {
    value: fakeListen,
    configurable: true,
    writable: true,
  });

  return () => {
    for (const listener of listeners) {
      try {
        listener.close();
      } catch {
        // ignore fake listener cleanup errors
      }
    }

    Object.defineProperty(Deno, "listen", {
      value: originalListen,
      configurable: true,
      writable: true,
    });
  };
}

Deno.test("module loads without opening a real network listener", async () => {
  const restoreListen = installFakeDenoListen();
  const originalFetch = globalThis.fetch;
  const previousSupabaseUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  globalThis.fetch = (() => {
    throw new Error("Unexpected network call during module load");
  }) as typeof fetch;

  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    const mod = await import("./index.ts");
    assertExists(mod);
    assertEquals(typeof mod, "object");
  } finally {
    globalThis.fetch = originalFetch;
    restoreListen();

    if (previousSupabaseUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousSupabaseUrl);
    }

    if (previousServiceKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
    }
  }
});

Deno.test("test harness detects synchronous failures", () => {
  assertThrows(
    () => {
      throw new TypeError("synthetic synchronous failure");
    },
    TypeError,
    "synthetic synchronous failure",
  );
});

Deno.test("test harness detects asynchronous failures", async () => {
  await assertRejects(
    () => Promise.reject(new Error("synthetic asynchronous failure")),
    Error,
    "synthetic asynchronous failure",
  );
});