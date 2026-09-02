import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type ListenCall = {
  hostname?: string;
  port: number;
};

function stubDenoListen() {
  const originalListen = Deno.listen;
  const calls: ListenCall[] = [];

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: (options: Deno.ListenOptions) => {
      calls.push({
        hostname: "hostname" in options ? options.hostname : undefined,
        port: options.port,
      });

      return {
        addr: {
          transport: "tcp",
          hostname: "hostname" in options && options.hostname ? options.hostname : "0.0.0.0",
          port: options.port,
        },
        accept: () => new Promise<Deno.Conn>(() => {}),
        close: () => {},
        ref: () => {},
        unref: () => {},
      } as unknown as Deno.Listener;
    },
  });

  return {
    calls,
    restore: () => {
      Object.defineProperty(Deno, "listen", {
        configurable: true,
        writable: true,
        value: originalListen,
      });
    },
  };
}

Deno.test("module loads and registers the Supabase Edge Function listener without opening a real socket", async () => {
  const listenStub = stubDenoListen();

  try {
    const mod = await import(`./index.ts?test=${crypto.randomUUID()}`);

    assertExists(mod);
    assertEquals(listenStub.calls.length, 1);
    assertEquals(listenStub.calls[0].port, 8000);
    assertEquals(listenStub.calls[0].hostname ?? "0.0.0.0", "0.0.0.0");
  } finally {
    listenStub.restore();
  }
});

Deno.test("module exposes no testable pure helpers and only performs listener registration on import", async () => {
  const listenStub = stubDenoListen();

  try {
    const mod = await import(`./index.ts?test=${crypto.randomUUID()}`);

    assertEquals(Object.keys(mod), []);
    assertEquals(listenStub.calls.length, 1);
    assertEquals(listenStub.calls[0].port, 8000);
  } finally {
    listenStub.restore();
  }
});