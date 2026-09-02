import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

function replaceProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const original = target[key];

  Object.defineProperty(target, key, {
    value,
    configurable: true,
    writable: true,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Object.defineProperty(target, key, {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  };
}

function saveEnv(keys: string[]): () => void {
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, Deno.env.get(key));
  }

  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

function createNonNetworkListener(): Deno.Listener {
  let closed = false;

  return {
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 0,
    } as Deno.NetAddr,
    accept(): Promise<Deno.Conn> {
      return new Promise<Deno.Conn>(() => {});
    },
    close(): void {
      closed = true;
    },
    ref(): void {},
    unref(): void {},
    get rid(): number {
      return -1;
    },
    [Symbol.asyncIterator](): AsyncIterableIterator<Deno.Conn> {
      const iterator = {
        async next(): Promise<IteratorResult<Deno.Conn>> {
          if (closed) {
            return { done: true, value: undefined };
          }
          return new Promise<IteratorResult<Deno.Conn>>(() => {});
        },
        [Symbol.asyncIterator]() {
          return iterator;
        },
      };
      return iterator;
    },
  } as Deno.Listener;
}

Deno.test("module loads without opening a real network listener", async () => {
  const restoreEnv = saveEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ]);

  let fetchCalls = 0;
  let listenCalls = 0;
  let listenOptions: Deno.ListenOptions | undefined;

  const restoreFetch = replaceProperty(globalThis, "fetch", (async () => {
    fetchCalls++;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch);

  const restoreListen = replaceProperty(Deno as typeof Deno, "listen", ((options: Deno.ListenOptions) => {
    listenCalls++;
    listenOptions = options;
    return createNonNetworkListener();
  }) as typeof Deno.listen);

  try {
    Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");

    const mod = await import("./index.ts");

    assertExists(mod);
    assertEquals(fetchCalls, 0);
    assertEquals(listenCalls, 1);
    assertExists(listenOptions);
    assertEquals(typeof listenOptions.port, "number");
  } finally {
    restoreListen();
    restoreFetch();
    restoreEnv();
  }
});