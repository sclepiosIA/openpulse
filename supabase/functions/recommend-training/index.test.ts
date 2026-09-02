import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MODULE_PATH = "./index.ts";

const REQUIRED_ENV: Record<string, string> = {
  AZURE_OPENAI_ENDPOINT: "https://example.invalid/azure-openai-test",
  AZURE_OPENAI_API_KEY: "test-api-key-not-a-secret",
  SUPABASE_URL: "https://example.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-not-a-secret",
};

type ImportResult = {
  module: Record<string, unknown>;
  listenCalls: unknown[];
  listenTlsCalls: unknown[];
  nativeServeCalls: unknown[];
  fetchCalls: RequestInfo[];
};

function snapshotEnv(keys: string[]): Map<string, string | undefined> {
  const snapshot = new Map<string, string | undefined>();
  for (const key of keys) {
    snapshot.set(key, Deno.env.get(key));
  }
  return snapshot;
}

function restoreEnv(snapshot: Map<string, string | undefined>) {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

function setRequiredEnv() {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    Deno.env.set(key, value);
  }
}

function createFakeListener() {
  return {
    rid: -1,
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 0,
    },
    accept(): Promise<Deno.Conn> {
      return new Promise(() => {});
    },
    close() {},
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true, value: undefined }),
      };
    },
  };
}

function replaceProperty(target: object, name: string, value: unknown): PropertyDescriptor | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, {
    configurable: true,
    writable: true,
    value,
  });
  return descriptor;
}

function restoreProperty(target: object, name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(target, name, descriptor);
  } else {
    delete (target as Record<string, unknown>)[name];
  }
}

async function importModuleWithIsolatedRuntime(): Promise<ImportResult> {
  const envSnapshot = snapshotEnv(Object.keys(REQUIRED_ENV));
  const listenCalls: unknown[] = [];
  const listenTlsCalls: unknown[] = [];
  const nativeServeCalls: unknown[] = [];
  const fetchCalls: RequestInfo[] = [];

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  const denoListenDescriptor = replaceProperty(Deno, "listen", (options: unknown) => {
    listenCalls.push(options);
    return createFakeListener();
  });

  const denoListenTlsDescriptor = Object.prototype.hasOwnProperty.call(Deno, "listenTls")
    ? replaceProperty(Deno, "listenTls", (options: unknown) => {
      listenTlsCalls.push(options);
      return createFakeListener();
    })
    : undefined;

  const denoServeDescriptor = Object.prototype.hasOwnProperty.call(Deno, "serve")
    ? replaceProperty(Deno, "serve", (...args: unknown[]) => {
      nativeServeCalls.push(args);
      return {
        finished: Promise.resolve(),
        shutdown: () => Promise.resolve(),
        ref() {},
        unref() {},
      };
    })
    : undefined;

  const fetchDescriptor = replaceProperty(globalThis, "fetch", (input: RequestInfo) => {
    fetchCalls.push(input);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ recommendations: [] }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  });

  console.log = () => {};
  console.error = () => {};

  try {
    setRequiredEnv();
    const module = await import(MODULE_PATH) as Record<string, unknown>;
    return { module, listenCalls, listenTlsCalls, nativeServeCalls, fetchCalls };
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    restoreProperty(globalThis, "fetch", fetchDescriptor);
    restoreProperty(Deno, "serve", denoServeDescriptor);
    restoreProperty(Deno, "listenTls", denoListenTlsDescriptor);
    restoreProperty(Deno, "listen", denoListenDescriptor);
    restoreEnv(envSnapshot);
  }
}

Deno.test("module loads without external network or database calls", async () => {
  const result = await importModuleWithIsolatedRuntime();

  assertExists(result.module);
  assertEquals(typeof result.module, "object");
  assertEquals(result.fetchCalls.length, 0);

  const serverStartCalls = result.listenCalls.length + result.listenTlsCalls.length + result.nativeServeCalls.length;
  assertEquals(serverStartCalls >= 1, true);
});

Deno.test("module currently exposes no pure helper API to test directly", async () => {
  const result = await importModuleWithIsolatedRuntime();

  assertEquals(Object.keys(result.module).sort(), []);
});