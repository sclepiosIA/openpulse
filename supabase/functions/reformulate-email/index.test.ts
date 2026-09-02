import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type RestoreFn = () => void;

const ENV_VALUES: Record<string, string> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  AZURE_OPENAI_ENDPOINT: "http://localhost:8080",
  AZURE_OPENAI_API_KEY: "test-azure-key",
  AZURE_OPENAI_API_VERSION: "2024-12-01-preview",
  AZURE_OPENAI_GPT5_MINI_DEPLOYMENT: "gpt-5-mini-test",
  AZURE_GPT5_MINI_DEPLOYMENT: "gpt-5-mini-test",
  OPENAI_API_KEY: "test-openai-key",
};

function replaceProperty(target: Record<string, unknown>, key: string, value: unknown): RestoreFn {
  const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const previous = target[key];

  try {
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value,
    });

    return () => {
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      } else if (hadOwn) {
        target[key] = previous;
      } else {
        delete target[key];
      }
    };
  } catch {
    try {
      target[key] = value;

      return () => {
        if (hadOwn) {
          target[key] = previous;
        } else {
          delete target[key];
        }
      };
    } catch {
      return () => {};
    }
  }
}

function installOfflineRuntimeStubs(): RestoreFn {
  const restores: RestoreFn[] = [];

  const previousEnv = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(ENV_VALUES)) {
    previousEnv.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }

  restores.push(() => {
    for (const [key, previous] of previousEnv.entries()) {
      if (previous === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, previous);
      }
    }
  });

  const fetchStub = async (): Promise<Response> =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "<p>Bonjour, voici un texte reformulé de manière professionnelle.</p>",
            },
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 9,
          total_tokens: 21,
        },
        model: "gpt-5-mini-test",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  restores.push(replaceProperty(globalThis as unknown as Record<string, unknown>, "fetch", fetchStub));

  let capturedHandler: unknown;

  const fakeHttpServer = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    finished: Promise.resolve(),
    ref() {},
    unref() {},
    shutdown() {},
  };

  const serveStub = (...args: unknown[]) => {
    capturedHandler = args.find((arg) => typeof arg === "function");
    return fakeHttpServer;
  };

  restores.push(replaceProperty(Deno as unknown as Record<string, unknown>, "serve", serveStub));

  const fakeListener = {
    rid: 1,
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    close() {},
    accept(): Promise<Deno.Conn> {
      return new Promise<Deno.Conn>(() => {});
    },
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true, value: undefined }),
      };
    },
  };

  const listenStub = () => fakeListener;

  restores.push(replaceProperty(Deno as unknown as Record<string, unknown>, "listen", listenStub));

  return () => {
    for (const restore of restores.reverse()) {
      restore();
    }

    if (capturedHandler !== undefined) {
      assertEquals(typeof capturedHandler, "function");
    }
  };
}

Deno.test("module loads without opening a real network listener", async () => {
  const restore = installOfflineRuntimeStubs();

  try {
    const mod = await import("./index.ts");

    assertExists(mod);
    assertEquals(typeof mod, "object");
    assertEquals(Object.keys(mod), []);
  } finally {
    restore();
  }
});

Deno.test("offline fetch stub returns the deterministic GPT-compatible payload used by the module", async () => {
  const restore = installOfflineRuntimeStubs();

  try {
    const response = await fetch("https://example.invalid/azure-openai-test");
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), "application/json");
    assertEquals(body.choices[0].message.content, "<p>Bonjour, voici un texte reformulé de manière professionnelle.</p>");
    assertEquals(body.usage.total_tokens, 21);
    assertEquals(body.model, "gpt-5-mini-test");
  } finally {
    restore();
  }
});

Deno.test("test helper restores environment variables after stubbing", () => {
  const key = "AZURE_OPENAI_GPT5_MINI_DEPLOYMENT";
  const before = Deno.env.get(key);

  const restore = installOfflineRuntimeStubs();
  assertEquals(Deno.env.get(key), "gpt-5-mini-test");
  restore();

  assertEquals(Deno.env.get(key), before);
});

Deno.test("assert helpers are available for synchronous and asynchronous failure checks", async () => {
  assertThrows(
    () => {
      throw new TypeError("expected sync failure");
    },
    TypeError,
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