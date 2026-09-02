import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

let signatureToolsModulePromise: Promise<any> | undefined;

async function importSignatureTools() {
  if (signatureToolsModulePromise) {
    return await signatureToolsModulePromise;
  }

  const previousSupabaseUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.set("SUPABASE_URL", "https://unit-test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "unit-test-service-role-key");

  try {
    signatureToolsModulePromise = import("./signature-tools.ts");
    return await signatureToolsModulePromise;
  } finally {
    if (previousSupabaseUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousSupabaseUrl);
    }

    if (previousServiceKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
    }
  }
}

class MockSupabaseQuery {
  selectedColumns: string | undefined;
  orderedBy: { column: string; options: unknown } | undefined;
  limitedTo: number | undefined;
  filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly rows: any[],
    private readonly queryError: Error | null = null,
  ) {}

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  order(column: string, options: unknown) {
    this.orderedBy = { column, options };
    return this;
  }

  limit(value: number) {
    this.limitedTo = value;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
    const result = this.queryError
      ? { data: null, error: this.queryError }
      : {
        data: this.rows
          .filter((row) => this.filters.every((filter) => row[filter.column] === filter.value))
          .slice(0, this.limitedTo ?? this.rows.length),
        error: null,
      };

    return Promise.resolve(result).then(resolve, reject);
  }
}

class MockSupabaseClient {
  lastTable: string | undefined;
  readonly query: MockSupabaseQuery;

  constructor(rows: any[], error: Error | null = null) {
    this.query = new MockSupabaseQuery(rows, error);
  }

  from(table: string) {
    this.lastTable = table;
    return this.query;
  }
}

Deno.test("module loads without throwing when required environment variables are provided", async () => {
  const mod = await importSignatureTools();

  assertExists(mod.executeListSignatureRequests);
  assertExists(mod.executeRemindSignature);
  assertExists(mod.executeCancelSignature);
  assertEquals(typeof mod.executeListSignatureRequests, "function");
  assertEquals(typeof mod.executeRemindSignature, "function");
  assertEquals(typeof mod.executeCancelSignature, "function");
});

Deno.test("executeListSignatureRequests lists requests, applies filters, caps limit to 100 and aggregates by status", async () => {
  const { executeListSignatureRequests } = await importSignatureTools();

  const supabase = new MockSupabaseClient([
    { id: "req-1", contrat_id: "contrat-1", status: "pending", created_at: "2024-01-03T00:00:00Z" },
    { id: "req-2", contrat_id: "contrat-1", status: "signed", created_at: "2024-01-02T00:00:00Z" },
    { id: "req-3", contrat_id: "contrat-1", status: "pending", created_at: "2024-01-01T00:00:00Z" },
    { id: "req-4", contrat_id: "contrat-2", status: "pending", created_at: "2024-01-04T00:00:00Z" },
  ]);

  const result = await executeListSignatureRequests(
    { supabase, userId: "user-1" },
    { status: "pending", contrat_id: "contrat-1", limit: 250 },
  );

  assertEquals(result.success, true);
  assertEquals(supabase.lastTable, "signature_requests");
  assertExists(supabase.query.selectedColumns);
  assertEquals(
    supabase.query.selectedColumns,
    "id, contrat_id, provider, status, signers, expire_at, reminders_sent, last_reminder_at, created_at, completed_at, cancelled_at",
  );
  assertEquals(supabase.query.orderedBy, { column: "created_at", options: { ascending: false } });
  assertEquals(supabase.query.limitedTo, 100);
  assertEquals(supabase.query.filters, [
    { column: "status", value: "pending" },
    { column: "contrat_id", value: "contrat-1" },
  ]);
  assertEquals(result.data.total, 2);
  assertEquals(result.data.by_status, { pending: 2 });
  assertEquals(result.data.requests.map((request: any) => request.id), ["req-1", "req-3"]);
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeListSignatureRequests uses default limit 30 and computes status distribution without optional filters", async () => {
  const { executeListSignatureRequests } = await importSignatureTools();

  const supabase = new MockSupabaseClient([
    { id: "req-1", contrat_id: "contrat-1", status: "pending" },
    { id: "req-2", contrat_id: "contrat-2", status: "signed" },
    { id: "req-3", contrat_id: "contrat-3", status: "signed" },
    { id: "req-4", contrat_id: "contrat-4", status: "cancelled" },
  ]);

  const result = await executeListSignatureRequests(
    { supabase, userId: "user-1" },
    {},
  );

  assertEquals(result.success, true);
  assertEquals(supabase.query.limitedTo, 30);
  assertEquals(supabase.query.filters, []);
  assertEquals(result.data.total, 4);
  assertEquals(result.data.by_status, {
    pending: 1,
    signed: 2,
    cancelled: 1,
  });
});

Deno.test("executeListSignatureRequests returns a failure result when Supabase query returns an error", async () => {
  const { executeListSignatureRequests } = await importSignatureTools();

  const supabase = new MockSupabaseClient([], new Error("database unavailable"));

  const result = await executeListSignatureRequests(
    { supabase, userId: "user-1" },
    { limit: 5 },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeRemindSignature posts to signature-remind with expected payload and authorization header", async () => {
  const { executeRemindSignature } = await importSignatureTools();

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return Promise.resolve(
      new Response(JSON.stringify({ request_id: "sig-1", reminders_sent: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const result = await executeRemindSignature(
      { supabase: {} as any, userId: "user-42" },
      { request_id: "sig-1", message: "Merci de signer le document." },
    );

    assertEquals(result.success, true);
    assertEquals(result.data, {
      message: "Relance envoyée aux signataires",
      request_id: "sig-1",
      reminders_sent: 3,
    });
    assertEquals(calls.length, 1);
    assertEquals(String(calls[0].input), "https://unit-test.supabase.co/functions/v1/signature-remind");
    assertEquals(calls[0].init?.method, "POST");
    assertEquals((calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals(
      (calls[0].init?.headers as Record<string, string>).Authorization,
      "Bearer unit-test-service-role-key",
    );
    assertEquals(JSON.parse(calls[0].init?.body as string), {
      request_id: "sig-1",
      message: "Merci de signer le document.",
      triggered_by: "user-42",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeRemindSignature rejects empty request_id before calling fetch", async () => {
  const { executeRemindSignature } = await importSignatureTools();

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;

  try {
    const result = await executeRemindSignature(
      { supabase: {} as any, userId: "user-42" },
      { request_id: "", message: "Relance" },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "request_id requis");
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeRemindSignature returns API error message when reminder endpoint fails", async () => {
  const { executeRemindSignature } = await importSignatureTools();

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (() => {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "signature request already completed" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const result = await executeRemindSignature(
      { supabase: {} as any, userId: "user-42" },
      { request_id: "sig-completed" },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "signature request already completed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeCancelSignature posts to signature-cancel with expected payload and returns merged response data", async () => {
  const { executeCancelSignature } = await importSignatureTools();

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return Promise.resolve(
      new Response(JSON.stringify({ request_id: "sig-2", status: "cancelled" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const result = await executeCancelSignature(
      { supabase: {} as any, userId: "admin-7" },
      { request_id: "sig-2", reason: "Contrat remplacé" },
    );

    assertEquals(result.success, true);
    assertEquals(result.data, {
      message: "Demande de signature annulée",
      request_id: "sig-2",
      status: "cancelled",
    });
    assertEquals(calls.length, 1);
    assertEquals(String(calls[0].input), "https://unit-test.supabase.co/functions/v1/signature-cancel");
    assertEquals(calls[0].init?.method, "POST");
    assertEquals((calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals(
      (calls[0].init?.headers as Record<string, string>).Authorization,
      "Bearer unit-test-service-role-key",
    );
    assertEquals(JSON.parse(calls[0].init?.body as string), {
      request_id: "sig-2",
      reason: "Contrat remplacé",
      triggered_by: "admin-7",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeCancelSignature rejects empty request_id before calling fetch", async () => {
  const { executeCancelSignature } = await importSignatureTools();

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;

  try {
    const result = await executeCancelSignature(
      { supabase: {} as any, userId: "admin-7" },
      { request_id: "", reason: "Erreur" },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "request_id requis");
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeCancelSignature returns HTTP status when endpoint fails with non JSON body", async () => {
  const { executeCancelSignature } = await importSignatureTools();

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (() => {
    return Promise.resolve(
      new Response("internal server error", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    );
  }) as typeof fetch;

  try {
    const result = await executeCancelSignature(
      { supabase: {} as any, userId: "admin-7" },
      { request_id: "sig-500", reason: "Annulation demandée" },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "HTTP 500");
  } finally {
    globalThis.fetch = originalFetch;
  }
});