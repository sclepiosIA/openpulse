// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: EdgeHandler | undefined;

const originalServe = Deno.serve;
const fakeServer = {
  finished: Promise.resolve(),
  shutdown: () => {},
  ref: () => {},
  unref: () => {},
  addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
};

(Deno as any).serve = (...args: unknown[]) => {
  capturedHandler = (typeof args[0] === "function" ? args[0] : args[1]) as EdgeHandler;
  return fakeServer;
};

try {
  await import("./index.ts");
} finally {
  (Deno as any).serve = originalServe;
}

function handler(): EdgeHandler {
  assertExists(capturedHandler);
  return capturedHandler;
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("module loads and registers a Deno.serve handler", () => {
  assertExists(capturedHandler);
  assertEquals(typeof capturedHandler, "function");
});

Deno.test("OPTIONS request returns CORS headers without auth or network access", async () => {
  const response = await handler()(new Request("http://localhost/cleanup", {
    method: "OPTIONS",
  }));

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(await response.text(), "");
});

Deno.test("missing bearer token is rejected with 401 and does not call fetch", async () => {
  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_ANON_KEY: "anon-key-for-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
    CRON_SECRET: "cron-secret-for-test",
  }, async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;

    globalThis.fetch = (() => {
      fetchCalled = true;
      return Promise.reject(new Error("fetch should not be called"));
    }) as typeof fetch;

    try {
      const response = await handler()(new Request("http://localhost/cleanup", {
        method: "POST",
      }));

      assertEquals(response.status, 401);
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
      assertEquals(await response.json(), { error: "Unauthorized" });
      assertEquals(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("valid cron secret runs cleanup offline and returns precise summary", async () => {
  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_ANON_KEY: "anon-key-for-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
    CRON_SECRET: "cron-secret-for-test",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; table: string; url: string; body?: string }> = [];
    const unexpectedCalls: string[] = [];

    globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request?.url ?? String(input));
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? init.body : undefined;
      const pathname = url.pathname;

      const table = pathname.includes("/rest/v1/email_to_etablissement_suggestions")
        ? "email_to_etablissement_suggestions"
        : pathname.includes("/rest/v1/email_domain_mappings")
        ? "email_domain_mappings"
        : pathname.includes("/rest/v1/ai_suggested_actions")
        ? "ai_suggested_actions"
        : "unknown";

      calls.push({ method, table, url: url.toString(), body });

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "DELETE" &&
        url.searchParams.get("status") === "eq.pending" &&
        url.searchParams.get("suggestion_type") === "eq.unmapped_domain" &&
        url.searchParams.get("match_confidence") === "lt.0.6"
      ) {
        return Promise.resolve(jsonResponse([
          { id: "deleted-unmapped-1" },
          { id: "deleted-unmapped-2" },
        ]));
      }

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "PATCH" &&
        url.searchParams.get("status") === "eq.pending" &&
        url.searchParams.get("match_confidence") === "lt.0.5"
      ) {
        return Promise.resolve(jsonResponse([{ id: "rejected-low-confidence-1" }]));
      }

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "GET" &&
        url.searchParams.get("status") === "eq.pending" &&
        url.searchParams.get("limit") === "500"
      ) {
        return Promise.resolve(jsonResponse([
          {
            id: "email-delete-generic-domain",
            email_thread_id: "thread-1",
            match_confidence: 0.92,
            extracted_data: { nom_hint: "Clinique Alpha", ville_hint: "Paris" },
            status: "pending",
            created_at: "2024-01-01T00:00:00.000Z",
            suggestion_type: "domain_match",
            email_thread: {
              id: "thread-1",
              subject: "Demande de rendez-vous",
              messages: [{ from_address: "contact@gmail.com" }],
            },
          },
          {
            id: "email-reject-missing-subject",
            email_thread_id: "thread-2",
            match_confidence: 0.91,
            extracted_data: { nom_hint: "Clinique Beta", ville_hint: "Lyon" },
            status: "pending",
            created_at: "2024-01-02T00:00:00.000Z",
            suggestion_type: "domain_match",
            email_thread: {
              id: "thread-2",
              subject: "(Sans Objet)",
              messages: [{ from_address: "secretariat@clinique-beta.test" }],
            },
          },
        ]));
      }

      if (table === "email_domain_mappings" && method === "GET") {
        return Promise.resolve(jsonResponse([
          {
            domain: "blocked-domain.test",
            is_excluded: true,
            niveau_mapping: null,
            partenaire_id: null,
            groupe_id: null,
          },
          {
            domain: "partner-domain.test",
            is_excluded: false,
            niveau_mapping: "partenaire",
            partenaire_id: "partner-1",
            groupe_id: null,
          },
        ]));
      }

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "DELETE" &&
        url.searchParams.get("id") === "eq.email-delete-generic-domain"
      ) {
        return Promise.resolve(jsonResponse([]));
      }

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "PATCH" &&
        url.searchParams.get("id") === "eq.email-reject-missing-subject"
      ) {
        return Promise.resolve(jsonResponse([]));
      }

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "DELETE" &&
        url.searchParams.get("suggestion_type") === "eq.unmapped_domain" &&
        url.searchParams.has("created_at")
      ) {
        return Promise.resolve(jsonResponse([{ id: "old-unmapped-1" }]));
      }

      if (
        table === "ai_suggested_actions" &&
        method === "GET" &&
        url.searchParams.get("status") === "eq.pending"
      ) {
        return Promise.resolve(jsonResponse([
          {
            id: "ai-duplicate-low",
            etablissement_id: "etab-1",
            partenaire_id: null,
            action_type: "follow_up",
            action_data: { title: "Confirmer rendez vous cardiologie Paris" },
            confidence_score: 0.45,
            created_at: "2024-01-01T00:00:00.000Z",
            status: "pending",
          },
          {
            id: "ai-duplicate-high",
            etablissement_id: "etab-1",
            partenaire_id: null,
            action_type: "follow_up",
            action_data: { title: "Relancer rendez vous cardiologie Paris" },
            confidence_score: 0.93,
            created_at: "2024-01-02T00:00:00.000Z",
            status: "pending",
          },
          {
            id: "ai-unique",
            etablissement_id: "etab-2",
            partenaire_id: null,
            action_type: "follow_up",
            action_data: { title: "Préparer bilan annuel neurologie Marseille" },
            confidence_score: 0.88,
            created_at: "2024-01-03T00:00:00.000Z",
            status: "pending",
          },
        ]));
      }

      if (
        table === "ai_suggested_actions" &&
        method === "PATCH" &&
        body?.includes("Auto-rejected: Duplicate suggestion")
      ) {
        return Promise.resolve(jsonResponse([]));
      }

      if (
        table === "email_to_etablissement_suggestions" &&
        method === "PATCH" &&
        url.searchParams.get("suggestion_type") === "eq.multi_entity" &&
        url.searchParams.get("status") === "eq.pending" &&
        url.searchParams.has("created_at")
      ) {
        return Promise.resolve(jsonResponse([
          { id: "archived-multi-1" },
          { id: "archived-multi-2" },
        ]));
      }

      unexpectedCalls.push(`${method} ${url.toString()} ${body ?? ""}`);
      return Promise.reject(new Error(`Unexpected fetch call: ${method} ${url.toString()}`));
    }) as typeof fetch;

    try {
      const response = await handler()(new Request("http://localhost/cleanup", {
        method: "POST",
        headers: { "X-CRON-Secret": "cron-secret-for-test" },
      }));

      assertEquals(unexpectedCalls, []);
      assertEquals(response.status, 200);
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');

      const body = await response.json();

      assertEquals(body.success, true);
      assertEquals(body.message, "Cleanup completed: 2 deleted, 2 rejected, 2 archived");
      assertEquals(body.results, {
        invalid: { deleted: 1, rejected: 1, processed: 2 },
        duplicates: { rejected: 1, scanned: 3 },
        stale: { archived: 2, deleted: 1 },
        batch: { deletedUnmapped: 2, rejectedLowConf: 1 },
      });

      assertEquals(
        calls.some((call) =>
          call.table === "ai_suggested_actions" &&
          call.method === "PATCH" &&
          call.body?.includes("Duplicate suggestion")
        ),
        true,
      );
      assertEquals(
        calls.some((call) =>
          call.table === "email_to_etablissement_suggestions" &&
          call.method === "DELETE" &&
          call.url.includes("email-delete-generic-domain")
        ),
        true,
      );
      assertEquals(
        calls.some((call) =>
          call.table === "email_to_etablissement_suggestions" &&
          call.method === "PATCH" &&
          call.url.includes("email-reject-missing-subject")
        ),
        true,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});