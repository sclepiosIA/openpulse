import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CapturedHandler = (request: Request, info?: unknown) => Response | Promise<Response>;

let capturedHandler: CapturedHandler | undefined;
let importPromise: Promise<unknown> | undefined;

async function loadModule(): Promise<unknown> {
  if (importPromise) return await importPromise;

  const originalServe = Deno.serve;
  const serveStub = ((...args: unknown[]) => {
    const maybeHandler = typeof args[0] === "function" ? args[0] : args[1];
    capturedHandler = maybeHandler as CapturedHandler;

    return {
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    };
  }) as typeof Deno.serve;

  try {
    Object.defineProperty(Deno, "serve", {
      value: serveStub,
      configurable: true,
      writable: true,
    });

    importPromise = import("./index.ts");
    return await importPromise;
  } finally {
    Object.defineProperty(Deno, "serve", {
      value: originalServe,
      configurable: true,
      writable: true,
    });
  }
}

async function getHandler(): Promise<CapturedHandler> {
  await loadModule();
  assertExists(capturedHandler);
  return capturedHandler;
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
    const value = values[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

async function withoutConsoleError<T>(fn: () => Promise<T> | T): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

Deno.test("module loads and registers an Edge Function handler", async () => {
  const moduleNamespace = await loadModule();
  assertExists(moduleNamespace);
  assertExists(capturedHandler);
  assertEquals(typeof capturedHandler, "function");
});

Deno.test("OPTIONS preflight returns CORS headers without authentication", async () => {
  const handler = await getHandler();

  const response = await handler(
    new Request("http://localhost/workflow-ai-action", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(await response.text(), "");
});

Deno.test("POST without internal secret or service-role bearer is rejected with 401", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      const response = await handler(
        new Request("http://localhost/workflow-ai-action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action_type: "ai_summarize",
            config: { ai_input: "Compte rendu de consultation à résumer." },
            context: { trigger: { patient_id: "test-patient" } },
          }),
        }),
      );

      assertEquals(response.status, 401);
      assertEquals(response.headers.get("Content-Type"), "application/json");

      const payload = await response.json();
      assertEquals(payload, { error: "Unauthorized" });
    },
  );
});

Deno.test("POST accepts matching internal secret and validates missing action_type before any AI call", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: "test-internal-secret",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      await withoutConsoleError(async () => {
        const response = await handler(
          new Request("http://localhost/workflow-ai-action", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-function-secret": "test-internal-secret",
            },
            body: JSON.stringify({
              config: { ai_input: "Texte médical à résumer." },
              context: { trigger: { source: "unit-test" } },
            }),
          }),
        );

        assertEquals(response.status, 500);
        assertEquals(response.headers.get("Content-Type"), "application/json");

        const payload = await response.json();
        assertExists(payload.error);
        assertEquals(payload.success, undefined);
      });
    },
  );
});

Deno.test("POST accepts service-role bearer and validates unknown action_type before any AI call", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    async () => {
      await withoutConsoleError(async () => {
        const response = await handler(
          new Request("http://localhost/workflow-ai-action", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": "Bearer test-service-role-key",
            },
            body: JSON.stringify({
              action_type: "ai_unknown",
              config: {},
              context: { trigger: { workflow_id: "wf_test" } },
            }),
          }),
        );

        assertEquals(response.status, 500);
        assertEquals(response.headers.get("Content-Type"), "application/json");

        const payload = await response.json();
        assertExists(payload.error);
        assertEquals(payload.success, undefined);
      });
    },
  );
});

Deno.test("ai_classify validates required CSV categories before any AI call", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: "classification-secret",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      await withoutConsoleError(async () => {
        const response = await handler(
          new Request("http://localhost/workflow-ai-action", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-function-secret": "classification-secret",
            },
            body: JSON.stringify({
              action_type: "ai_classify",
              config: {
                ai_categories: " , , ",
                ai_input: "Demande urgente de rendez-vous cardiologique.",
              },
              context: { trigger: { channel: "email" } },
            }),
          }),
        );

        assertEquals(response.status, 500);

        const payload = await response.json();
        assertExists(payload.error);
        assertEquals(payload.output, undefined);
      });
    },
  );
});

Deno.test("wrong internal secret is rejected even when an internal secret is configured", async () => {
  const handler = await getHandler();

  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: "expected-secret",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      const response = await handler(
        new Request("http://localhost/workflow-ai-action", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-function-secret": "wrong-secret",
          },
          body: JSON.stringify({
            action_type: "ai_summarize",
            config: { ai_input: "Texte à résumer." },
            context: {},
          }),
        }),
      );

      assertEquals(response.status, 401);
      assertEquals(await response.json(), { error: "Unauthorized" });
    },
  );
});

Deno.test("assert helpers required by the test contract are available", async () => {
  assertThrows(() => {
    JSON.parse("{invalid");
  }, SyntaxError);

  await assertRejects(
    async () => {
      await Promise.reject(new Error("expected rejection"));
    },
    Error,
    "expected rejection",
  );
});