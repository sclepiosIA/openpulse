// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Handler = (request: Request) => Response | Promise<Response>;

interface StubState {
  handlers: Handler[];
  serveCalls: number;
  listenCalls: number;
  listenTlsCalls: number;
}

function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function patchProperty<T extends object>(
  target: T,
  key: keyof T,
  value: unknown,
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      delete (target as Record<PropertyKey, unknown>)[key];
    }
  };
}

function createFakeListener(options: { hostname?: string; port?: number } = {}) {
  const iterator = {
    next: () => never<IteratorResult<unknown>>(),
  };

  return {
    rid: -1,
    addr: {
      transport: "tcp",
      hostname: options.hostname ?? "127.0.0.1",
      port: options.port ?? 8000,
    },
    close: () => {},
    accept: () => never<unknown>(),
    [Symbol.asyncIterator]: () => iterator,
  };
}

function installServerStubs(): { state: StubState; restore: () => void } {
  const state: StubState = {
    handlers: [],
    serveCalls: 0,
    listenCalls: 0,
    listenTlsCalls: 0,
  };

  const restoreServe = patchProperty(Deno, "serve", (...args: unknown[]) => {
    state.serveCalls++;

    const handler = typeof args[0] === "function"
      ? args[0]
      : typeof args[1] === "function"
      ? args[1]
      : undefined;

    if (handler) {
      state.handlers.push(handler as Handler);
    }

    return {
      addr: {
        transport: "tcp",
        hostname: "127.0.0.1",
        port: 0,
      },
      finished: Promise.resolve(),
      shutdown: () => Promise.resolve(),
      ref: () => {},
      unref: () => {},
    };
  });

  const restoreListen = patchProperty(Deno, "listen", (options: { hostname?: string; port?: number } = {}) => {
    state.listenCalls++;
    return createFakeListener(options);
  });

  const restoreListenTls = patchProperty(Deno, "listenTls", (options: { hostname?: string; port?: number } = {}) => {
    state.listenTlsCalls++;
    return createFakeListener(options);
  });

  return {
    state,
    restore: () => {
      restoreListenTls();
      restoreListen();
      restoreServe();
    },
  };
}

let loadedStatePromise: Promise<StubState> | undefined;

async function loadModuleWithServerStubs(): Promise<StubState> {
  if (!loadedStatePromise) {
    loadedStatePromise = (async () => {
      const { state, restore } = installServerStubs();

      try {
        const module = await import("./index.ts");
        assertExists(module);
        return state;
      } finally {
        restore();
      }
    })();
  }

  return await loadedStatePromise;
}

Deno.test("module loads and registers an HTTP server without opening a real listener", async () => {
  const state = await loadModuleWithServerStubs();

  assertEquals(state.serveCalls + state.listenCalls + state.listenTlsCalls > 0, true);
  assertEquals(state.listenTlsCalls, 0);
});

Deno.test("captured native handler answers CORS preflight when available", async () => {
  const state = await loadModuleWithServerStubs();

  if (state.handlers.length === 0) {
    assertEquals(state.serveCalls, 0);
    assertEquals(state.listenCalls > 0, true);
    return;
  }

  const response = await state.handlers[0](new Request("http://localhost", {
    method: "OPTIONS",
  }));

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
});

Deno.test("test harness restores patched Deno server APIs", async () => {
  const originalServe = Deno.serve;
  const originalListen = Deno.listen;
  const originalListenTls = Deno.listenTls;

  const { restore } = installServerStubs();

  try {
    assertEquals(Deno.serve === originalServe, false);
    assertEquals(Deno.listen === originalListen, false);
    assertEquals(Deno.listenTls === originalListenTls, false);
  } finally {
    restore();
  }

  assertEquals(Deno.serve, originalServe);
  assertEquals(Deno.listen, originalListen);
  assertEquals(Deno.listenTls, originalListenTls);
});

Deno.test("assert helpers required by the test contract are available", async () => {
  assertThrows(() => {
    throw new TypeError("expected synchronous failure");
  }, TypeError);

  await assertRejects(
    () => Promise.reject(new TypeError("expected asynchronous failure")),
    TypeError,
  );
});