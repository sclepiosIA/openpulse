import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateServiceOrUser, validateUserAuth } from "./auth-helpers.ts";

const ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "INTERNAL_FUNCTION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
] as const;

async function withEnv<T>(
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
    previous.set(key, Deno.env.get(key));
  }

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }

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

Deno.test("module exports authentication helper functions", () => {
  assertExists(validateUserAuth);
  assertExists(validateServiceOrUser);
  assertEquals(typeof validateUserAuth, "function");
  assertEquals(typeof validateServiceOrUser, "function");
});

Deno.test("validateUserAuth returns an explicit error when Authorization header is missing", async () => {
  const req = new Request("http://localhost/test");

  const result = await validateUserAuth(req);

  assertEquals(result, { error: "Missing authorization header" });
});

Deno.test("validateUserAuth returns an explicit error when Authorization header is not Bearer", async () => {
  const req = new Request("http://localhost/test", {
    headers: {
      Authorization: "Basic abc123",
    },
  });

  const result = await validateUserAuth(req);

  assertEquals(result, { error: "Missing authorization header" });
});

Deno.test("validateServiceOrUser authorizes a valid internal function secret as a service call", async () => {
  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: "test-internal-secret",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          "x-function-secret": "test-internal-secret",
        },
      });

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: true,
        isServiceCall: true,
      });
    },
  );
});

Deno.test("validateServiceOrUser rejects an invalid internal function secret when no other credential is present", async () => {
  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: "expected-secret",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          "x-function-secret": "wrong-secret",
        },
      });

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: false,
        isServiceCall: false,
      });
    },
  );
});

Deno.test("validateServiceOrUser authorizes an exact service role Bearer token as a service call", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
      INTERNAL_FUNCTION_SECRET: undefined,
    },
    async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Bearer service-role-key-for-test",
        },
      });

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: true,
        isServiceCall: true,
      });
    },
  );
});

Deno.test("validateServiceOrUser does not authorize a service role key without the Bearer prefix", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
      INTERNAL_FUNCTION_SECRET: undefined,
    },
    async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "service-role-key-for-test",
        },
      });

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: false,
        isServiceCall: false,
      });
    },
  );
});

Deno.test("validateServiceOrUser gives priority to a valid internal secret and does not require a valid JWT", async () => {
  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: "priority-secret",
      SUPABASE_SERVICE_ROLE_KEY: "different-service-role-key",
    },
    async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Bearer not-the-service-role-key",
          "x-function-secret": "priority-secret",
        },
      });

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: true,
        isServiceCall: true,
      });
    },
  );
});

Deno.test("validateServiceOrUser rejects a request with no credentials", async () => {
  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      const req = new Request("http://localhost/test");

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: false,
        isServiceCall: false,
      });
    },
  );
});

Deno.test("validateServiceOrUser rejects non-Bearer Authorization headers that are not service calls", async () => {
  await withEnv(
    {
      INTERNAL_FUNCTION_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
    },
    async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Basic service-role-key-for-test",
        },
      });

      const result = await validateServiceOrUser(req);

      assertEquals(result, {
        authorized: false,
        isServiceCall: false,
      });
    },
  );
});

Deno.test("test harness sanity checks use throwing assertions without network access", async () => {
  assertThrows(
    () => {
      throw new Error("sync failure");
    },
    Error,
    "sync failure",
  );

  await assertRejects(
    async () => {
      throw new Error("async failure");
    },
    Error,
    "async failure",
  );
});