import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ENV_KEYS = [
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_DEPLOYMENT_GPT5_MINI",
  "AZURE_GPT5_MINI_DEPLOYMENT",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
];

function withTestEnv() {
  const previous = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
    previous.set(key, Deno.env.get(key));
  }

  Deno.env.set("AZURE_OPENAI_API_KEY", "test-api-key");
  Deno.env.set("AZURE_OPENAI_ENDPOINT", "https://example.invalid");
  Deno.env.set("AZURE_OPENAI_DEPLOYMENT_GPT5_MINI", "test-gpt5-mini");
  Deno.env.set("AZURE_GPT5_MINI_DEPLOYMENT", "test-gpt5-mini");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

function installFetchStub() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "<p>Bonjour</p>" } }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
          model: "test-gpt5-mini",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function installFakeDenoListen() {
  const originalListen = Deno.listen;
  const listenCalls: Array<Record<string, unknown>> = [];

  const pendingConnection = new Promise<Deno.Conn>(() => {});
  const iterator = {
    next: () => pendingConnection.then((value) => ({ value, done: false })),
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  const fakeListener = {
    rid: 9001,
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 8000,
    },
    accept: () => pendingConnection,
    close: () => {},
    [Symbol.asyncIterator]() {
      return iterator;
    },
  } as unknown as Deno.Listener;

  const fakeListen = ((options: Deno.ListenOptions) => {
    listenCalls.push(options as unknown as Record<string, unknown>);
    return fakeListener;
  }) as typeof Deno.listen;

  Object.defineProperty(Deno, "listen", {
    value: fakeListen,
    configurable: true,
    writable: true,
  });

  return {
    listenCalls,
    restore: () => {
      Object.defineProperty(Deno, "listen", {
        value: originalListen,
        configurable: true,
        writable: true,
      });
    },
  };
}

Deno.test("module loads without opening a real network listener", async () => {
  const restoreEnv = withTestEnv();
  const restoreFetch = installFetchStub();
  const fakeListen = installFakeDenoListen();
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = () => {};
  console.error = () => {};

  try {
    const mod = await import("./index.ts");

    assertExists(mod);
    assertEquals(Object.keys(mod), []);
    assertEquals(fakeListen.listenCalls.length, 1);
    assertEquals(fakeListen.listenCalls[0].port, 8000);
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    fakeListen.restore();
    restoreFetch();
    restoreEnv();
  }
});