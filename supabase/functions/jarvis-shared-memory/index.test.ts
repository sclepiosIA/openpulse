import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Restore = () => void;

const fakeAddr = {
  transport: "tcp",
  hostname: "127.0.0.1",
  port: 0,
} as const;

function patchProperty(target: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);

  try {
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value,
    });
  } catch {
    target[key] = value;
  }

  return () => {
    if (descriptor) {
      try {
        Object.defineProperty(target, key, descriptor);
      } catch {
        target[key] = descriptor.value;
      }
    } else {
      try {
        delete target[key];
      } catch {
        target[key] = undefined;
      }
    }
  };
}

function createNeverResolvingPromise<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function createFakeServer() {
  return {
    addr: fakeAddr,
    finished: createNeverResolvingPromise<void>(),
    shutdown: () => Promise.resolve(),
    ref: () => {},
    unref: () => {},
  };
}

function createIdleListener() {
  return {
    addr: fakeAddr,
    close: () => {},
    ref: () => {},
    unref: () => {},
    accept: () => createNeverResolvingPromise<unknown>(),
  };
}

async function importModuleOffline() {
  const restorers: Restore[] = [];
  let fetchCalls = 0;
  let listenCalls = 0;
  let serveCalls = 0;
  let serveHttpCalls = 0;

  restorers.push(
    patchProperty(Deno as unknown as Record<PropertyKey, unknown>, "listen", () => {
      listenCalls++;
      return createIdleListener();
    }),
  );

  restorers.push(
    patchProperty(Deno as unknown as Record<PropertyKey, unknown>, "serve", () => {
      serveCalls++;
      return createFakeServer();
    }),
  );

  restorers.push(
    patchProperty(Deno as unknown as Record<PropertyKey, unknown>, "serveHttp", () => {
      serveHttpCalls++;
      return {
        close: () => {},
        async *[Symbol.asyncIterator]() {
          yield* [];
        },
      };
    }),
  );

  restorers.push(
    patchProperty(globalThis as unknown as Record<PropertyKey, unknown>, "fetch", () => {
      fetchCalls++;
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  );

  try {
    const mod = await import(`./index.ts?offline=${crypto.randomUUID()}`);
    await Promise.resolve();
    return { mod, fetchCalls, listenCalls, serveCalls, serveHttpCalls };
  } finally {
    for (const restore of restorers.reverse()) restore();
  }
}

function restoreEnv(key: string, previous: string | undefined) {
  if (previous === undefined) {
    Deno.env.delete(key);
  } else {
    Deno.env.set(key, previous);
  }
}

Deno.test("module loads offline without Supabase environment variables", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const { mod, fetchCalls, serveHttpCalls } = await importModuleOffline();

    assertExists(mod);
    assertEquals(Object.keys(mod), []);
    assertEquals(fetchCalls, 0);
    assertEquals(serveHttpCalls, 0);
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
  }
});

Deno.test("module import registers an HTTP server stub without real network or database calls", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    const { mod, fetchCalls, listenCalls, serveCalls, serveHttpCalls } = await importModuleOffline();

    assertExists(mod);
    assertEquals(Object.keys(mod), []);
    assertEquals(fetchCalls, 0);
    assertEquals(serveHttpCalls, 0);
    assertEquals(listenCalls + serveCalls >= 1, true);
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
  }
});

Deno.test("assertion helpers are available for synchronous and asynchronous failures", async () => {
  assertThrows(
    () => {
      throw new TypeError("expected sync failure");
    },
    TypeError,
    "expected sync failure",
  );

  await assertRejects(
    () => Promise.reject(new Error("expected async failure")),
    Error,
    "expected async failure",
  );
});