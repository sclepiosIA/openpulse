import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type RestoreFn = () => void;

function replaceProperty(target: Record<string, unknown>, key: string, value: unknown): RestoreFn {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);

  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      delete target[key];
    }
  };
}

function createNonBlockingListener(state: {
  acceptCalls: number;
  closeCalls: number;
}) {
  return {
    rid: -1,
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 8000,
    },
    close: () => {
      state.closeCalls += 1;
    },
    ref: () => {},
    unref: () => {},
    accept: () => {
      state.acceptCalls += 1;
      return new Promise<Deno.Conn>(() => {});
    },
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise<IteratorResult<Deno.Conn>>(() => {}),
      };
    },
  };
}

Deno.test("module loads without opening a real network listener or performing fetch", async () => {
  const state = {
    listenCalls: 0,
    listenTlsCalls: 0,
    acceptCalls: 0,
    closeCalls: 0,
    fetchCalls: 0,
    lastListenOptions: undefined as unknown,
  };

  const originalFetch = globalThis.fetch;

  const restoreFetch = replaceProperty(globalThis as unknown as Record<string, unknown>, "fetch", () => {
    state.fetchCalls += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  const restoreListen = replaceProperty(Deno as unknown as Record<string, unknown>, "listen", (options: unknown) => {
    state.listenCalls += 1;
    state.lastListenOptions = options;
    return createNonBlockingListener(state);
  });

  const restoreListenTls = replaceProperty(Deno as unknown as Record<string, unknown>, "listenTls", () => {
    state.listenTlsCalls += 1;
    return createNonBlockingListener(state);
  });

  try {
    const module = await import("./index.ts");

    assertExists(module);
    assertEquals(Object.keys(module), []);
    assertEquals(state.listenCalls, 1);
    assertEquals(state.listenTlsCalls, 0);
    assertEquals(state.acceptCalls, 1);
    assertEquals(state.fetchCalls, 0);
    assertExists(state.lastListenOptions);
  } finally {
    restoreListenTls();
    restoreListen();
    restoreFetch();
    globalThis.fetch = originalFetch;
  }
});

Deno.test("test harness assertions catch synchronous and asynchronous failures", async () => {
  assertThrows(
    () => {
      throw new Error("expected sync failure");
    },
    Error,
    "expected sync failure",
  );

  await assertRejects(
    async () => {
      throw new Error("expected async failure");
    },
    Error,
    "expected async failure",
  );
});