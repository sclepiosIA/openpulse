import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type QueryLogEntry = {
  table: string;
  method: string;
  selected?: string;
  filters: Record<string, unknown>;
  payload?: unknown;
};

type MockSupabaseScenario = {
  personalAccount?: Record<string, unknown> | null;
  sharedAccount?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  accountError?: Record<string, unknown> | null;
  profileError?: Record<string, unknown> | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMockSupabase(scenario: MockSupabaseScenario) {
  const log: QueryLogEntry[] = [];

  const resolveSingle = (table: string, filters: Record<string, unknown>) => {
    if (table === "profiles") {
      return {
        data: scenario.profile ?? null,
        error: scenario.profileError ?? null,
      };
    }

    return { data: null, error: null };
  };

  const resolveMaybeSingle = (table: string, filters: Record<string, unknown>) => {
    if (table === "user_email_accounts") {
      if (Object.prototype.hasOwnProperty.call(filters, "profile_id")) {
        return {
          data: scenario.personalAccount ?? null,
          error: scenario.accountError ?? null,
        };
      }

      if (filters.is_shared === true) {
        return {
          data: scenario.sharedAccount ?? null,
          error: null,
        };
      }
    }

    return { data: null, error: null };
  };

  const makeBuilder = (table: string) => {
    const state: {
      selected?: string;
      filters: Record<string, unknown>;
      payload?: unknown;
    } = {
      filters: {},
    };

    const builder: Record<string, unknown> = {
      select(columns: string) {
        state.selected = columns;
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters[column] = value;
        return builder;
      },
      neq(column: string, value: unknown) {
        state.filters[`neq:${column}`] = value;
        return builder;
      },
      in(column: string, value: unknown) {
        state.filters[`in:${column}`] = value;
        return builder;
      },
      contains(column: string, value: unknown) {
        state.filters[`contains:${column}`] = value;
        return builder;
      },
      gte(column: string, value: unknown) {
        state.filters[`gte:${column}`] = value;
        return builder;
      },
      lte(column: string, value: unknown) {
        state.filters[`lte:${column}`] = value;
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      range() {
        return builder;
      },
      insert(payload: unknown) {
        state.payload = payload;
        return builder;
      },
      update(payload: unknown) {
        state.payload = payload;
        return builder;
      },
      upsert(payload: unknown) {
        state.payload = payload;
        return builder;
      },
      delete() {
        return builder;
      },
      maybeSingle() {
        log.push({
          table,
          method: "maybeSingle",
          selected: state.selected,
          filters: { ...state.filters },
          payload: state.payload,
        });
        return Promise.resolve(resolveMaybeSingle(table, state.filters));
      },
      single() {
        log.push({
          table,
          method: "single",
          selected: state.selected,
          filters: { ...state.filters },
          payload: state.payload,
        });
        return Promise.resolve(resolveSingle(table, state.filters));
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        log.push({
          table,
          method: "then",
          selected: state.selected,
          filters: { ...state.filters },
          payload: state.payload,
        });
        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  return {
    client: {
      from(table: string) {
        return makeBuilder(table);
      },
    },
    log,
  };
}

function getHeader(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const expected = name.toLowerCase();

  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === expected);
    return found ? found[1] : null;
  }

  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((candidate) => candidate.toLowerCase() === expected);
  return key ? String(record[key]) : null;
}

async function withEnvAndFetch(
  env: Record<string, string | undefined>,
  fetchStub: typeof fetch,
  fn: () => Promise<void>,
): Promise<void> {
  const keys = new Set([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    ...Object.keys(env),
  ]);

  const previousEnv = new Map<string, string | undefined>();
  for (const key of keys) {
    previousEnv.set(key, Deno.env.get(key));
  }

  const originalFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchStub;

  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }

    await fn();
  } finally {
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }

    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  }
}

function extractPayloadBody(payload: Record<string, unknown>): string {
  const candidates = [
    payload.body,
    payload.html,
    payload.html_body,
    payload.content,
    payload.message,
  ];

  const found = candidates.find((value) => typeof value === "string" && String(value).includes("<!DOCTYPE html>"));
  return String(found ?? payload.body ?? "");
}

Deno.test("module loads and exposes the email executor", async () => {
  await withEnvAndFetch(
    {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_test_key",
      SUPABASE_ANON_KEY: "anon_test_key",
    },
    (() => jsonResponse({ success: true })) as typeof fetch,
    async () => {
      const mod = await import("./tools-executor.ts");

      assertEquals(typeof mod.executeSendEmail, "function");
      assertExists(mod.executeQueryDatabase);
    },
  );
});

Deno.test("executeSendEmail returns a business error and does not call fetch when no email account exists", async () => {
  let fetchCalls = 0;

  await withEnvAndFetch(
    {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_test_key",
      SUPABASE_ANON_KEY: "anon_test_key",
    },
    ((() => {
      fetchCalls += 1;
      return jsonResponse({ success: true });
    }) as unknown) as typeof fetch,
    async () => {
      const { executeSendEmail } = await import("./tools-executor.ts");
      const mock = createMockSupabase({
        personalAccount: null,
        sharedAccount: null,
      });

      const result = await executeSendEmail(
        {
          supabase: mock.client,
          userId: "profile-no-email",
          conversationId: "conv-1",
        } as never,
        {
          to: "client@example.com",
          subject: "Compte rendu",
          body: "Bonjour,\nVoici le compte rendu.",
        },
      );

      assertEquals(result.success, false);
      assertEquals(String(result.error).includes("Aucun compte email configuré"), true);
      assertEquals(String(result.error).includes("profile-no-email"), true);
      assertEquals(typeof result.execution_time_ms, "number");
      assertEquals(fetchCalls, 0);
      assertEquals(mock.log[0].table, "user_email_accounts");
      assertEquals(mock.log[0].filters.profile_id, "profile-no-email");
      assertEquals(mock.log[0].filters.is_active, true);
      assertEquals(mock.log[1].table, "user_email_accounts");
      assertEquals(mock.log[1].filters.is_shared, true);
      assertEquals(mock.log[1].filters.is_active, true);
    },
  );
});

Deno.test("executeSendEmail sends through the edge function with escaped text body and decoded signature", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  await withEnvAndFetch(
    {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_test_key",
      SUPABASE_ANON_KEY: "anon_test_key",
    },
    (((url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Promise.resolve(jsonResponse({
        success: true,
        message_id: "msg_123",
        provider: "mock",
      }));
    }) as unknown) as typeof fetch,
    async () => {
      const { executeSendEmail } = await import("./tools-executor.ts");
      const mock = createMockSupabase({
        personalAccount: {
          id: "personal-account-1",
          email_address: "alice@example.com",
        },
        profile: {
          email_signature: "&lt;strong&gt;Alice Martin&lt;/strong&gt; &amp;amp; Co",
          prenom: "Alice",
          nom: "Martin",
        },
      });

      const result = await executeSendEmail(
        {
          supabase: mock.client,
          userId: "profile-alice",
          conversationId: "conv-2",
        } as never,
        {
          to: "client@example.com",
          subject: "Proposition commerciale",
          body: "Bonjour <client> & équipe\nDeuxième ligne",
          cc: ["manager@example.com"],
          thread_id: "thread-42",
        },
      );

      assertEquals(result.success, true);
      assertEquals(capturedUrl, "https://supabase.test/functions/v1/send-email");
      assertEquals(getHeader(capturedInit?.headers, "authorization"), "Bearer service_role_test_key");
      assertEquals(getHeader(capturedInit?.headers, "content-type"), "application/json");

      const payload = JSON.parse(String(capturedInit?.body ?? "{}"));
      const emailBody = extractPayloadBody(payload);

      assertEquals(payload.to, "client@example.com");
      assertEquals(payload.subject, "Proposition commerciale");
      assertEquals(payload.thread_id, "thread-42");
      assertEquals(payload.cc, ["manager@example.com"]);
      assertEquals(JSON.stringify(payload).includes("personal-account-1"), true);
      assertEquals(emailBody.includes("Bonjour &lt;client&gt; &amp; équipe<br>Deuxième ligne"), true);
      assertEquals(emailBody.includes("<strong>Alice Martin</strong> & Co"), true);
      assertEquals(emailBody.includes("<!DOCTYPE html>"), true);
      assertEquals(emailBody.includes("background-color:#f4f4f5"), true);

      assertEquals(mock.log[0].table, "user_email_accounts");
      assertEquals(mock.log[0].filters.profile_id, "profile-alice");
      assertEquals(mock.log[1].table, "profiles");
      assertEquals(mock.log[1].filters.id, "profile-alice");
    },
  );
});

Deno.test("executeSendEmail falls back to a shared active email account and adds a profile-name signature", async () => {
  let capturedPayload: Record<string, unknown> = {};

  await withEnvAndFetch(
    {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_test_key",
      SUPABASE_ANON_KEY: "anon_test_key",
    },
    (((_url: string | URL | Request, init?: RequestInit) => {
      capturedPayload = JSON.parse(String(init?.body ?? "{}"));
      return Promise.resolve(jsonResponse({
        success: true,
        message_id: "msg_shared_1",
      }));
    }) as unknown) as typeof fetch,
    async () => {
      const { executeSendEmail } = await import("./tools-executor.ts");
      const mock = createMockSupabase({
        personalAccount: null,
        sharedAccount: {
          id: "shared-account-1",
          email_address: "shared@example.com",
        },
        profile: {
          email_signature: null,
          prenom: "Bob",
          nom: "Martin",
        },
      });

      const result = await executeSendEmail(
        {
          supabase: mock.client,
          userId: "profile-shared",
        } as never,
        {
          to: "prospect@example.com",
          subject: "Relance",
          body: "<p>Bonjour,</p><p>Merci pour votre retour.</p>",
        },
      );

      const emailBody = extractPayloadBody(capturedPayload);

      assertEquals(result.success, true);
      assertEquals(JSON.stringify(capturedPayload).includes("shared-account-1"), true);
      assertEquals(emailBody.includes("--<br>Bob Martin"), true);
      assertEquals(emailBody.includes("Bonjour,"), true);
      assertEquals(emailBody.includes("Merci pour votre retour."), true);
      assertEquals(emailBody.includes("margin:0 0 12px 0"), true);
      assertEquals(emailBody.includes("<!DOCTYPE html>"), true);

      const emailAccountQueries = mock.log.filter((entry) => entry.table === "user_email_accounts");
      assertEquals(emailAccountQueries.length, 2);
      assertEquals(emailAccountQueries[0].filters.profile_id, "profile-shared");
      assertEquals(emailAccountQueries[0].filters.is_active, true);
      assertEquals(emailAccountQueries[1].filters.is_shared, true);
      assertEquals(emailAccountQueries[1].filters.is_active, true);
    },
  );
});

Deno.test("executeSendEmail returns an error result when the send-email function responds with HTTP error", async () => {
  await withEnvAndFetch(
    {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_test_key",
      SUPABASE_ANON_KEY: "anon_test_key",
    },
    ((() => Promise.resolve(jsonResponse({
      success: false,
      error: "provider rejected recipient",
    }, 400))) as unknown) as typeof fetch,
    async () => {
      const { executeSendEmail } = await import("./tools-executor.ts");
      const mock = createMockSupabase({
        personalAccount: {
          id: "personal-account-error",
          email_address: "sender@example.com",
        },
        profile: {
          email_signature: null,
          prenom: "Claire",
          nom: "Durand",
        },
      });

      const result = await executeSendEmail(
        {
          supabase: mock.client,
          userId: "profile-error",
        } as never,
        {
          to: "invalid@example.com",
          subject: "Test erreur",
          body: "Message de test",
        },
      );

      assertEquals(result.success, false);
      assertEquals(String(result.error).includes("provider rejected recipient") || String(result.error).includes("400"), true);
      assertEquals(typeof result.execution_time_ms, "number");
    },
  );
});

Deno.test("assert helpers are available for synchronous and asynchronous failures", async () => {
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