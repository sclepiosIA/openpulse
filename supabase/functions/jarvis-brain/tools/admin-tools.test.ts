import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeExportDataRgpd,
  executeGetAiUsageStats,
  executeGetSystemLogs,
  executeManageUser,
  executeManageUserRole,
} from "./admin-tools.ts";

type QueryState = {
  table: string;
  operation: string;
  selected?: string;
  payload?: unknown;
  filters: Array<{ column: string; value: unknown }>;
  gteFilters: Array<{ column: string; value: unknown }>;
  orders: Array<{ column: string; options: unknown }>;
  limitValue?: number;
  single: boolean;
};

type HandlerResult = { data?: unknown; error?: unknown };
type QueryHandler = (state: QueryState) => HandlerResult;

function createSupabaseMock(handler: QueryHandler) {
  const calls: Array<Record<string, unknown>> = [];

  class QueryBuilder {
    table: string;
    operation = "select";
    selected?: string;
    payload?: unknown;
    filters: Array<{ column: string; value: unknown }> = [];
    gteFilters: Array<{ column: string; value: unknown }> = [];
    orders: Array<{ column: string; options: unknown }> = [];
    limitValue?: number;
    singleCalled = false;
    private resolved = false;
    private result: HandlerResult = {};

    constructor(table: string) {
      this.table = table;
    }

    select(columns?: string) {
      if (this.operation !== "update") {
        this.operation = "select";
      }
      this.selected = columns;
      calls.push({ table: this.table, method: "select", columns });
      return this;
    }

    update(payload: unknown) {
      this.operation = "update";
      this.payload = payload;
      calls.push({ table: this.table, method: "update", payload });
      return this;
    }

    insert(payload: unknown) {
      this.operation = "insert";
      this.payload = payload;
      calls.push({ table: this.table, method: "insert", payload });
      return this;
    }

    delete() {
      this.operation = "delete";
      calls.push({ table: this.table, method: "delete" });
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      calls.push({ table: this.table, method: "eq", column, value });
      return this;
    }

    gte(column: string, value: unknown) {
      this.gteFilters.push({ column, value });
      calls.push({ table: this.table, method: "gte", column, value });
      return this;
    }

    order(column: string, options: unknown) {
      this.orders.push({ column, options });
      calls.push({ table: this.table, method: "order", column, options });
      return this;
    }

    limit(value: number) {
      this.limitValue = value;
      calls.push({ table: this.table, method: "limit", value });
      return this;
    }

    single() {
      this.singleCalled = true;
      calls.push({ table: this.table, method: "single" });
      return this;
    }

    private resolve() {
      if (!this.resolved) {
        this.result = handler({
          table: this.table,
          operation: this.operation,
          selected: this.selected,
          payload: this.payload,
          filters: this.filters,
          gteFilters: this.gteFilters,
          orders: this.orders,
          limitValue: this.limitValue,
          single: this.singleCalled,
        }) ?? {};
        this.resolved = true;
      }
      return this.result;
    }

    get data() {
      return this.resolve().data;
    }

    get error() {
      return this.resolve().error;
    }
  }

  const supabase = {
    from(table: string) {
      calls.push({ method: "from", table });
      return new QueryBuilder(table);
    },
  };

  return { supabase, calls };
}

Deno.test("admin-tools exports expected functions", () => {
  assertExists(executeManageUser);
  assertExists(executeManageUserRole);
  assertExists(executeGetSystemLogs);
  assertExists(executeExportDataRgpd);
  assertExists(executeGetAiUsageStats);

  assertThrows(() => {
    throw new Error("sanity");
  }, Error, "sanity");
});

Deno.test("executeManageUser list returns latest users with count", async () => {
  const users = [
    { id: "u2", nom: "Durand", prenom: "Zoé", email: "zoe@example.test", est_actif: true, created_at: "2024-02-01" },
    { id: "u1", nom: "Martin", prenom: "Ada", email: "ada@example.test", est_actif: false, created_at: "2024-01-01" },
  ];

  const { supabase, calls } = createSupabaseMock((state) => {
    assertEquals(state.table, "profiles");
    assertEquals(state.operation, "select");
    assertEquals(state.selected, "id, nom, prenom, email, est_actif, created_at");
    assertEquals(state.orders, [{ column: "created_at", options: { ascending: false } }]);
    assertEquals(state.limitValue, 100);
    return { data: users, error: null };
  });

  const result = await executeManageUser({ supabase, userId: "admin-1" } as any, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data.users, users);
  assertEquals(result.data.count, 2);
  assertEquals(calls.map((c) => c.method), ["from", "select", "order", "limit"]);
});

Deno.test("executeManageUser list returns empty count when database data is null", async () => {
  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "profiles");
    assertEquals(state.operation, "select");
    return { data: null, error: null };
  });

  const result = await executeManageUser({ supabase, userId: "admin-1" } as any, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data.users, null);
  assertEquals(result.data.count, 0);
});

Deno.test("executeManageUser update requires user_id and does not query database", async () => {
  const { supabase, calls } = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeManageUser(
    { supabase, userId: "admin-1" } as any,
    { action: "update", data: { est_actif: true } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "user_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageUser update writes provided profile data and returns updated user", async () => {
  const updatedUser = { id: "user-123", nom: "Nouveau", est_actif: true };

  const { supabase, calls } = createSupabaseMock((state) => {
    assertEquals(state.table, "profiles");
    assertEquals(state.operation, "update");
    assertEquals(state.payload, { nom: "Nouveau", est_actif: true });
    assertEquals(state.filters, [{ column: "id", value: "user-123" }]);
    assertEquals(state.single, true);
    return { data: updatedUser, error: null };
  });

  const result = await executeManageUser(
    { supabase, userId: "admin-1" } as any,
    { action: "update", user_id: "user-123", data: { nom: "Nouveau", est_actif: true } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Utilisateur mis à jour");
  assertEquals(result.data.user, updatedUser);
  assertEquals(calls.map((c) => c.method), ["from", "update", "eq", "select", "single"]);
});

Deno.test("executeManageUser update sends empty object when data is omitted", async () => {
  const updatedUser = { id: "user-empty" };

  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "profiles");
    assertEquals(state.operation, "update");
    assertEquals(state.payload, {});
    assertEquals(state.filters, [{ column: "id", value: "user-empty" }]);
    assertEquals(state.single, true);
    return { data: updatedUser, error: null };
  });

  const result = await executeManageUser(
    { supabase, userId: "admin-1" } as any,
    { action: "update", user_id: "user-empty" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.user, updatedUser);
});

Deno.test("executeManageUser deactivate requires user_id and does not query database", async () => {
  const { supabase, calls } = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeManageUser(
    { supabase, userId: "admin-1" } as any,
    { action: "deactivate" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "user_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageUser deactivate sets est_actif to false", async () => {
  const deactivated = { id: "user-456", est_actif: false };

  const { supabase, calls } = createSupabaseMock((state) => {
    assertEquals(state.table, "profiles");
    assertEquals(state.operation, "update");
    assertEquals(state.payload, { est_actif: false });
    assertEquals(state.filters, [{ column: "id", value: "user-456" }]);
    assertEquals(state.single, true);
    return { data: deactivated, error: null };
  });

  const result = await executeManageUser(
    { supabase, userId: "admin-1" } as any,
    { action: "deactivate", user_id: "user-456" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Utilisateur désactivé");
  assertEquals(result.data.user, deactivated);
  assertEquals(calls.map((c) => c.method), ["from", "update", "eq", "select", "single"]);
});

Deno.test("executeManageUser returns explicit fallback for unsupported action", async () => {
  const { supabase, calls } = createSupabaseMock(() => ({ data: [], error: null }));

  const result = await executeManageUser(
    { supabase, userId: "admin-1" } as any,
    { action: "create", data: { email: "new@example.test" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "User creation requires Supabase Auth dashboard");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageUser converts database errors to failed ToolResult", async () => {
  const { supabase } = createSupabaseMock(() => ({
    data: null,
    error: new Error("profiles unavailable"),
  }));

  const result = await executeManageUser({ supabase, userId: "admin-1" } as any, { action: "list" });

  assertEquals(result.success, false);
  assertEquals(result.error, "profiles unavailable");
});

Deno.test("executeManageUser converts non-Error thrown values to generic failure", async () => {
  const { supabase } = createSupabaseMock(() => {
    throw "boom";
  });

  const result = await executeManageUser({ supabase, userId: "admin-1" } as any, { action: "list" });

  assertEquals(result.success, false);
  assertEquals(result.error, "User operation failed");
});

Deno.test("executeManageUserRole add skips insert when role already exists", async () => {
  const { supabase, calls } = createSupabaseMock((state) => {
    assertEquals(state.table, "user_roles");
    assertEquals(state.operation, "select");
    assertEquals(state.selected, "id");
    assertEquals(state.filters, [
      { column: "user_id", value: "user-1" },
      { column: "role", value: "admin" },
    ]);
    assertEquals(state.single, true);
    return { data: { id: "role-row-1" }, error: null };
  });

  const result = await executeManageUserRole(
    { supabase, userId: "admin-1" } as any,
    { action: "add", user_id: "user-1", role: "admin" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "L'utilisateur a déjà le rôle admin");
  assertEquals(calls.some((c) => c.method === "insert"), false);
});

Deno.test("executeManageUserRole add inserts role when it does not exist", async () => {
  const { supabase, calls } = createSupabaseMock((state) => {
    if (state.operation === "select") {
      assertEquals(state.table, "user_roles");
      assertEquals(state.selected, "id");
      assertEquals(state.filters, [
        { column: "user_id", value: "user-2" },
        { column: "role", value: "manager" },
      ]);
      assertEquals(state.single, true);
      return { data: null, error: null };
    }

    assertEquals(state.table, "user_roles");
    assertEquals(state.operation, "insert");
    assertEquals(state.payload, { user_id: "user-2", role: "manager" });
    return { data: null, error: null };
  });

  const result = await executeManageUserRole(
    { supabase, userId: "admin-1" } as any,
    { action: "add", user_id: "user-2", role: "manager" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Rôle manager ajouté");
  assertEquals(calls.filter((c) => c.method === "insert").length, 1);
});

Deno.test("executeManageUserRole add converts insert error to failed ToolResult", async () => {
  const { supabase } = createSupabaseMock((state) => {
    if (state.operation === "select") {
      return { data: null, error: null };
    }
    return { data: null, error: new Error("role insert denied") };
  });

  const result = await executeManageUserRole(
    { supabase, userId: "admin-1" } as any,
    { action: "add", user_id: "user-2", role: "admin" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "role insert denied");
});

Deno.test("executeManageUserRole non-add action deletes matching role", async () => {
  const { supabase, calls } = createSupabaseMock((state) => {
    assertEquals(state.table, "user_roles");
    assertEquals(state.operation, "delete");
    assertEquals(state.filters, [
      { column: "user_id", value: "user-3" },
      { column: "role", value: "viewer" },
    ]);
    return { data: null, error: null };
  });

  const result = await executeManageUserRole(
    { supabase, userId: "admin-1" } as any,
    { action: "remove", user_id: "user-3", role: "viewer" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Rôle viewer retiré");
  assertEquals(calls.map((c) => c.method), ["from", "delete", "eq", "eq"]);
});

Deno.test("executeManageUserRole converts delete error to failed ToolResult", async () => {
  const { supabase } = createSupabaseMock(() => ({
    data: null,
    error: new Error("role delete denied"),
  }));

  const result = await executeManageUserRole(
    { supabase, userId: "admin-1" } as any,
    { action: "remove", user_id: "user-3", role: "viewer" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "role delete denied");
});

Deno.test("executeGetSystemLogs reads ai_processing logs with provided limit", async () => {
  const logs = [
    { id: "log-2", processing_type: "summary", processed_at: "2024-04-02T10:00:00Z" },
    { id: "log-1", processing_type: "email", processed_at: "2024-04-01T10:00:00Z" },
  ];

  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "ai_processing_log");
    assertEquals(state.operation, "select");
    assertEquals(state.selected, "*");
    assertEquals(state.orders, [{ column: "processed_at", options: { ascending: false } }]);
    assertEquals(state.limitValue, 2);
    return { data: logs, error: null };
  });

  const result = await executeGetSystemLogs(
    { supabase, userId: "admin-1" } as any,
    { log_type: "ai_processing", limit: 2 },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.log_type, "ai_processing");
  assertEquals(result.data.logs, logs);
  assertEquals(result.data.count, 2);
});

Deno.test("executeGetSystemLogs reads email sync logs", async () => {
  const logs = [
    { id: "acc-1", email: "sync@example.test", last_sync_status: "ok", sync_error: null },
  ];

  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "user_email_accounts");
    assertEquals(state.operation, "select");
    assertEquals(state.selected, "id, email, last_sync_at, last_sync_status, sync_error");
    assertEquals(state.orders, [{ column: "last_sync_at", options: { ascending: false } }]);
    assertEquals(state.limitValue, 10);
    return { data: logs, error: null };
  });

  const result = await executeGetSystemLogs(
    { supabase, userId: "admin-1" } as any,
    { log_type: "email_sync", limit: 10 },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.log_type, "email_sync");
  assertEquals(result.data.logs, logs);
  assertEquals(result.data.count, 1);
});

Deno.test("executeGetSystemLogs defaults to ai_processing and limit 50", async () => {
  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "ai_processing_log");
    assertEquals(state.operation, "select");
    assertEquals(state.selected, "*");
    assertEquals(state.limitValue, 50);
    return { data: [], error: null };
  });

  const result = await executeGetSystemLogs({ supabase, userId: "admin-1" } as any, {});

  assertEquals(result.success, true);
  assertEquals(result.data.log_type, "ai_processing");
  assertEquals(result.data.logs, []);
  assertEquals(result.data.count, 0);
});

Deno.test("executeGetSystemLogs treats null data as empty logs", async () => {
  const { supabase } = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeGetSystemLogs(
    { supabase, userId: "admin-1" } as any,
    { log_type: "email_sync", limit: 5 },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.log_type, "email_sync");
  assertEquals(result.data.logs, []);
  assertEquals(result.data.count, 0);
});

Deno.test("executeGetSystemLogs converts thrown query failures to failed ToolResult", async () => {
  const { supabase } = createSupabaseMock(() => {
    throw new Error("logs query failed");
  });

  const result = await executeGetSystemLogs(
    { supabase, userId: "admin-1" } as any,
    { log_type: "ai_processing", limit: 1 },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "logs query failed");
});

Deno.test("executeExportDataRgpd aggregates profile, roles, tasks and conversations", async () => {
  const profile = { id: "user-rgpd", email: "person@example.test", nom: "Personne" };
  const roles = [{ role: "admin" }, { role: "viewer" }];
  const tasks = [{ id: "task-1", titre: "Préparer export", created_at: "2024-01-10" }];
  const conversations = [{ id: "conv-1", title: "Aide", created_at: "2024-01-11" }];

  const { supabase, calls } = createSupabaseMock((state) => {
    if (state.table === "profiles") {
      assertEquals(state.operation, "select");
      assertEquals(state.selected, "*");
      assertEquals(state.filters, [{ column: "id", value: "user-rgpd" }]);
      assertEquals(state.single, true);
      return { data: profile, error: null };
    }

    if (state.table === "user_roles") {
      assertEquals(state.operation, "select");
      assertEquals(state.selected, "role");
      assertEquals(state.filters, [{ column: "user_id", value: "user-rgpd" }]);
      assertEquals(state.single, false);
      return { data: roles, error: null };
    }

    if (state.table === "taches") {
      assertEquals(state.operation, "select");
      assertEquals(state.selected, "id, titre, created_at");
      assertEquals(state.filters, [{ column: "created_by", value: "user-rgpd" }]);
      return { data: tasks, error: null };
    }

    if (state.table === "jarvis_conversations") {
      assertEquals(state.operation, "select");
      assertEquals(state.selected, "id, title, created_at");
      assertEquals(state.filters, [{ column: "user_id", value: "user-rgpd" }]);
      return { data: conversations, error: null };
    }

    return { data: null, error: new Error(`unexpected table ${state.table}`) };
  });

  const result = await executeExportDataRgpd(
    { supabase, userId: "admin-1" } as any,
    { user_id: "user-rgpd" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Export RGPD généré");
  assertEquals(result.data.user_id, "user-rgpd");
  assertExists(result.data.export_date);
  assertEquals(result.data.data.profile, profile);
  assertEquals(result.data.data.roles, roles);
  assertEquals(result.data.data.tasks_created, tasks);
  assertEquals(result.data.data.jarvis_conversations, conversations);
  assertEquals(calls.filter((c) => c.method === "from").map((c) => c.table), [
    "profiles",
    "user_roles",
    "taches",
    "jarvis_conversations",
  ]);
});

Deno.test("executeExportDataRgpd converts thrown query failures to failed ToolResult", async () => {
  const { supabase } = createSupabaseMock((state) => {
    if (state.table === "profiles") {
      return { data: { id: "user-rgpd" }, error: null };
    }
    throw new Error("rgpd export query failed");
  });

  const result = await executeExportDataRgpd(
    { supabase, userId: "admin-1" } as any,
    { user_id: "user-rgpd" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "rgpd export query failed");
});

Deno.test("executeGetAiUsageStats computes calls, success count, token total and average duration", async () => {
  const logs = [
    { processing_type: "email", total_tokens: 100, success: true, processing_duration_ms: 1200 },
    { processing_type: "summary", total_tokens: 50, success: false, processing_duration_ms: 800 },
    { processing_type: "chat", total_tokens: null, success: true, processing_duration_ms: 1000 },
  ];

  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "ai_processing_log");
    assertEquals(state.operation, "select");
    assertEquals(state.selected, "processing_type, total_tokens, success, processing_duration_ms");
    assertEquals(state.gteFilters, [{ column: "processed_at", value: "2024-01-01T00:00:00.000Z" }]);
    return { data: logs, error: null };
  });

  const result = await executeGetAiUsageStats(
    { supabase, userId: "admin-1" } as any,
    { period: "2024-01-01T00:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.period_start, "2024-01-01T00:00:00.000Z");
  assertEquals(result.data.total_calls, 3);
  assertEquals(result.data.successful_calls, 2);
  assertEquals(result.data.failed_calls, 1);
  assertEquals(result.data.total_tokens, 150);
  assertEquals(result.data.avg_duration_ms, 1000);
});

Deno.test("executeGetAiUsageStats returns zero average for empty logs", async () => {
  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "ai_processing_log");
    assertEquals(state.gteFilters, [{ column: "processed_at", value: "2024-02-01T00:00:00.000Z" }]);
    return { data: [], error: null };
  });

  const result = await executeGetAiUsageStats(
    { supabase, userId: "admin-1" } as any,
    { period: "2024-02-01T00:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total_calls, 0);
  assertEquals(result.data.successful_calls, 0);
  assertEquals(result.data.failed_calls, 0);
  assertEquals(result.data.total_tokens, 0);
  assertEquals(result.data.avg_duration_ms, 0);
});

Deno.test("executeGetAiUsageStats returns no-data message when logs are null", async () => {
  const { supabase } = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeGetAiUsageStats(
    { supabase, userId: "admin-1" } as any,
    { period: "2024-02-01T00:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "No AI usage data found");
});

Deno.test("executeGetAiUsageStats uses a default period and queries processed_at", async () => {
  const before = Date.now();

  const { supabase } = createSupabaseMock((state) => {
    assertEquals(state.table, "ai_processing_log");
    assertEquals(state.gteFilters.length, 1);
    assertEquals(state.gteFilters[0].column, "processed_at");

    const periodDate = new Date(state.gteFilters[0].value as string);
    const lowerBound = before - 31 * 24 * 60 * 60 * 1000;
    const upperBound = Date.now() - 29 * 24 * 60 * 60 * 1000;

    assertEquals(periodDate.getTime() >= lowerBound, true);
    assertEquals(periodDate.getTime() <= upperBound, true);

    return { data: [{ total_tokens: 25, success: true, processing_duration_ms: 200 }], error: null };
  });

  const result = await executeGetAiUsageStats({ supabase, userId: "admin-1" } as any, {});

  assertEquals(result.success, true);
  assertEquals(result.data.total_calls, 1);
  assertEquals(result.data.successful_calls, 1);
  assertEquals(result.data.failed_calls, 0);
  assertEquals(result.data.total_tokens, 25);
  assertEquals(result.data.avg_duration_ms, 200);
});

Deno.test("executeGetAiUsageStats converts thrown query failures to failed ToolResult", async () => {
  const { supabase } = createSupabaseMock(() => {
    throw new Error("ai logs query failed");
  });

  const result = await executeGetAiUsageStats(
    { supabase, userId: "admin-1" } as any,
    { period: "2024-03-01T00:00:00.000Z" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "ai logs query failed");

  await assertRejects(
    async () => {
      throw new Error("reject sanity");
    },
    Error,
    "reject sanity",
  );
});