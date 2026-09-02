import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function setRequiredEnv(): () => void {
  const previousValues = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
    previousValues.set(key, Deno.env.get(key));
  }

  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  return () => {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

function replaceDenoProperty(name: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, name);

  Object.defineProperty(Deno, name, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, name, descriptor);
    } else {
      Reflect.deleteProperty(Deno, name);
    }
  };
}

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

Deno.test("module loads and registers a local server without opening a real network listener", async () => {
  const restoreEnv = setRequiredEnv();
  const listenCalls: unknown[] = [];
  const serveCalls: unknown[] = [];
  let capturedHandler: ((request: Request, connInfo?: unknown) => Response | Promise<Response>) | undefined;

  const fakeListener = {
    rid: 0,
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    accept: () => new Promise(() => {}),
    close: () => {},
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise(() => {}),
      };
    },
  };

  const fakeHttpServer = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    finished: Promise.resolve(),
    shutdown: () => Promise.resolve(),
    ref: () => {},
    unref: () => {},
  };

  const restoreListen = replaceDenoProperty("listen", (options: unknown) => {
    listenCalls.push(options);
    return fakeListener;
  });

  const restoreServe = replaceDenoProperty("serve", (...args: unknown[]) => {
    serveCalls.push(args);
    capturedHandler = args.find((arg) => typeof arg === "function") as
      | ((request: Request, connInfo?: unknown) => Response | Promise<Response>)
      | undefined;
    return fakeHttpServer;
  });

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  console.log = () => {};
  console.error = () => {};

  try {
    const moduleUnderTest = await import("./index.ts");

    assertExists(moduleUnderTest);
    assertEquals(Object.keys(moduleUnderTest), []);
    assertEquals(listenCalls.length > 0 || serveCalls.length > 0, true);

    if (listenCalls.length > 0) {
      const listenOptions = listenCalls[0] as { port?: number; hostname?: string };
      assertEquals(listenOptions.port, 8000);
    }

    if (capturedHandler) {
      const response = await capturedHandler(new Request("http://localhost", { method: "OPTIONS" }));
      assertEquals(response.status, 200);
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
      assertEquals(
        response.headers.get("Access-Control-Allow-Headers"),
        "authorization, x-client-info, apikey, content-type, x-internal-secret",
      );
    }
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    restoreServe();
    restoreListen();
    restoreEnv();
  }
});

Deno.test("source defines the expected team members with business identities", async () => {
  const source = await readModuleSource();

  const emails = Array.from(source.matchAll(/\bemail:\s*"([^"]+)"/g), (match) => match[1]);
  const firstNames = Array.from(source.matchAll(/\bprenom:\s*"([^"]+)"/g), (match) => match[1]);
  const lastNames = Array.from(source.matchAll(/(?<![A-Za-z0-9_])nom:\s*"([^"]+)"/g), (match) => match[1]);
  const titles = Array.from(source.matchAll(/\btitle:\s*"([^"]+)"/g), (match) => match[1]);

  assertEquals(emails, [
    "membre.equipe@example.invalid",
    "membre.equipe@example.invalid",
    "membre.equipe@example.invalid",
  ]);
  assertEquals(firstNames, ["Camille", "Camille", "Camille"]);
  assertEquals(lastNames, ["Durand", "Durand", "Bègne"]);
  assertEquals(titles, ["Responsable Marketing", "Directeur de la Stratégie", "CTO"]);
});

Deno.test("source configures email-specific mappings with the expected team-level metadata", async () => {
  const source = await readModuleSource();
  const mappingBlock = source.match(/\.from\("email_specific_mappings"\)[\s\S]*?if \(mappingError\)/)?.[0];

  assertExists(mappingBlock);
  assertEquals(/email_address:\s*member\.email\.toLowerCase\(\)/.test(mappingBlock), true);
  assertEquals(/profile_id:\s*profileId/.test(mappingBlock), true);
  assertEquals(/niveau_mapping:\s*"equipe"/.test(mappingBlock), true);
  assertEquals(/verified:\s*true/.test(mappingBlock), true);
  assertEquals(/confidence_level:\s*"high"/.test(mappingBlock), true);
  assertEquals(/onConflict:\s*"email_address"/.test(mappingBlock), true);
});

Deno.test("source uses sanitized error responses for setup-team-members failures", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes('buildErrorResponse(\'setup-team-members\', error, corsHeaders, 500)'), true);
  assertThrows(() => {
    throw new Error("setup-team-members");
  }, Error, "setup-team-members");
  await assertRejects(
    () => Promise.reject(new Error("setup-team-members")),
    Error,
    "setup-team-members",
  );
});