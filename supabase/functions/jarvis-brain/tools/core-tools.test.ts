import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeGetUserContext,
  executeManageMemory,
  executeQueryDatabase,
  executeUpdateEntityStatus,
  getDefaultCategorieId,
} from "./core-tools.ts";

class QueryBuilderStub {
  table: string;
  operations: Array<{ method: string; args: unknown[] }> = [];
  response: { data?: unknown; error?: unknown };
  throwOnAwait?: Error;

  constructor(
    table: string,
    response: { data?: unknown; error?: unknown } = {},
    throwOnAwait?: Error,
  ) {
    this.table = table;
    this.response = response;
    this.throwOnAwait = throwOnAwait;
  }

  select(...args: unknown[]) {
    this.operations.push({ method: "select", args });
    return this;
  }
  eq(...args: unknown[]) {
    this.operations.push({ method: "eq", args });
    return this;
  }
  neq(...args: unknown[]) {
    this.operations.push({ method: "neq", args });
    return this;
  }
  gt(...args: unknown[]) {
    this.operations.push({ method: "gt", args });
    return this;
  }
  lt(...args: unknown[]) {
    this.operations.push({ method: "lt", args });
    return this;
  }
  gte(...args: unknown[]) {
    this.operations.push({ method: "gte", args });
    return this;
  }
  lte(...args: unknown[]) {
    this.operations.push({ method: "lte", args });
    return this;
  }
  like(...args: unknown[]) {
    this.operations.push({ method: "like", args });
    return this;
  }
  ilike(...args: unknown[]) {
    this.operations.push({ method: "ilike", args });
    return this;
  }
  in(...args: unknown[]) {
    this.operations.push({ method: "in", args });
    return this;
  }
  is(...args: unknown[]) {
    this.operations.push({ method: "is", args });
    return this;
  }
  contains(...args: unknown[]) {
    this.operations.push({ method: "contains", args });
    return this;
  }
  order(...args: unknown[]) {
    this.operations.push({ method: "order", args });
    return this;
  }
  limit(...args: unknown[]) {
    this.operations.push({ method: "limit", args });
    return this;
  }
  upsert(...args: unknown[]) {
    this.operations.push({ method: "upsert", args });
    return this;
  }
  single(...args: unknown[]) {
    this.operations.push({ method: "single", args });
    return this;
  }
  delete(...args: unknown[]) {
    this.operations.push({ method: "delete", args });
    return this;
  }
  update(...args: unknown[]) {
    this.operations.push({ method: "update", args });
    return this;
  }
  insert(...args: unknown[]) {
    this.operations.push({ method: "insert", args });
    return this;
  }

  then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
    if (this.throwOnAwait) {
      return Promise.reject(this.throwOnAwait).then(onFulfilled, onRejected);
    }
    return Promise.resolve(this.response).then(onFulfilled, onRejected);
  }
}

class SupabaseStub {
  builders: Record<string, QueryBuilderStub[]> = {};
  queue: Record<string, Array<{ data?: unknown; error?: unknown; throwOnAwait?: Error }>> = {};

  when(
    table: string,
    ...responses: Array<{ data?: unknown; error?: unknown; throwOnAwait?: Error }>
  ) {
    this.queue[table] = responses.slice();
    return this;
  }

  from(table: string) {
    const next = this.queue[table]?.shift() ?? {};
    const builder = new QueryBuilderStub(table, { data: next.data, error: next.error }, next.throwOnAwait);
    if (!this.builders[table]) this.builders[table] = [];
    this.builders[table].push(builder);
    return builder;
  }

  last(table: string) {
    const list = this.builders[table] ?? [];
    return list[list.length - 1];
  }

  all(table: string) {
    return this.builders[table] ?? [];
  }
}

function makeCtx(supabase: SupabaseStub) {
  return {
    supabase: supabase as unknown,
    userId: "user-123",
  } as Parameters<typeof executeQueryDatabase>[0];
}

Deno.test("executeQueryDatabase returns error for non-allowed table", async () => {
  const supabase = new SupabaseStub();
  const ctx = makeCtx(supabase);

  const result = await executeQueryDatabase(ctx, {
    table: "__forbidden_table__",
    select: "*",
  });

  assertEquals(result.success, false);
  assertExists(result.error);
  assertEquals(supabase.all("__forbidden_table__").length, 0);
});

Deno.test("executeQueryDatabase resolves aliases, normalizes ilike, parses contains and caps limit", async () => {
  const supabase = new SupabaseStub().when("email_messages", {
    data: [{ id: 1, subject: "Hello" }],
    error: null,
  });
  const ctx = makeCtx(supabase);

  const result = await executeQueryDatabase(ctx, {
    table: "email_messages",
    select: "id,subject",
    filters: [
      { column: "to_email", operator: "eq", value: "alice@example.com" },
      { column: "snippet", operator: "ilike", value: "%urgent%" },
      { column: "labels", operator: "contains", value: '["vip"]' },
      { column: "status", operator: "is", value: "null" },
    ],
    order_by: "created_at",
    ascending: true,
    limit: 1000,
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    records: [{ id: 1, subject: "Hello" }],
    count: 1,
    table: "email_messages",
  });

  const builder = supabase.last("email_messages");
  assertExists(builder);

  const eqOp = builder.operations.find((op) => op.method === "eq" && op.args[0] === "to_addresses");
  assertExists(eqOp);
  assertEquals(eqOp?.args, ["to_addresses", "alice@example.com"]);

  const ilikeOp = builder.operations.find((op) => op.method === "ilike");
  assertExists(ilikeOp);
  assertEquals(ilikeOp?.args, ["body_text", "%urgent%"]);

  const containsOp = builder.operations.find((op) => op.method === "contains");
  assertExists(containsOp);
  assertEquals(containsOp?.args, ["labels", ["vip"]]);

  const isOp = builder.operations.find((op) => op.method === "is");
  assertExists(isOp);
  assertEquals(isOp?.args, ["is_draft", null]);

  const orderOp = builder.operations.find((op) => op.method === "order");
  assertExists(orderOp);
  assertEquals(orderOp?.args, ["received_date", { ascending: true }]);

  const limitOp = builder.operations.find((op) => op.method === "limit");
  assertExists(limitOp);
  assertEquals(limitOp?.args, [100]);
});

Deno.test("executeQueryDatabase skips unsupported aliased column instead of applying filter", async () => {
  const supabase = new SupabaseStub().when("calendar_events", {
    data: [],
    error: null,
  });
  const ctx = makeCtx(supabase);

  const result = await executeQueryDatabase(ctx, {
    table: "calendar_events",
    filters: [
      { column: "attendees", operator: "eq", value: "x" },
      { column: "organizer_email", operator: "eq", value: "owner@example.com" },
      { column: "video_link", operator: "eq", value: "https://meet.example.com/abc" },
    ],
  });

  assertEquals(result.success, true);

  const builder = supabase.last("calendar_events");
  assertExists(builder);

  const unsupportedAttendees = builder.operations.find(
    (op) => op.method === "eq" && op.args[0] === "attendees",
  );
  const unsupportedOrganizer = builder.operations.find(
    (op) => op.method === "eq" && op.args[0] === "organizer_email",
  );
  assertEquals(unsupportedAttendees, undefined);
  assertEquals(unsupportedOrganizer, undefined);

  const supportedAlias = builder.operations.find(
    (op) => op.method === "eq" && op.args[0] === "video_conference_url",
  );
  assertExists(supportedAlias);
  assertEquals(supportedAlias?.args, ["video_conference_url", "https://meet.example.com/abc"]);
});

Deno.test("executeQueryDatabase handles in and contains non-JSON fallback array", async () => {
  const supabase = new SupabaseStub().when("calendar_events", {
    data: [],
    error: null,
  });
  const ctx = makeCtx(supabase);

  const result = await executeQueryDatabase(ctx, {
    table: "calendar_events",
    filters: [
      { column: "title", operator: "in", value: "A,B,C" },
      { column: "video_conference_url", operator: "contains", value: "meet@example.com" },
    ],
    limit: 5,
  });

  assertEquals(result.success, true);

  const builder = supabase.last("calendar_events");
  const inOp = builder.operations.find((op) => op.method === "in");
  const containsOp = builder.operations.find((op) => op.method === "contains");

  assertExists(inOp);
  assertEquals(inOp?.args, ["title", ["A", "B", "C"]]);

  assertExists(containsOp);
  assertEquals(containsOp?.args, ["video_conference_url", ["meet@example.com"]]);
});

Deno.test("executeQueryDatabase formats PostgREST-like error details", async () => {
  const supabase = new SupabaseStub().when("profiles", {
    data: null,
    error: {
      message: "column does not exist",
      code: "42703",
      details: "missing column foo",
      hint: "Did you mean bar?",
    },
  });
  const ctx = makeCtx(supabase);

  const result = await executeQueryDatabase(ctx, {
    table: "profiles",
    select: "*",
  });

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Query on 'profiles' failed: column does not exist | [code=42703] | details=missing column foo | hint=Did you mean bar?",
  );
});

Deno.test("executeQueryDatabase catches thrown exceptions", async () => {
  const supabase = new SupabaseStub().when("profiles", {
    throwOnAwait: new Error("boom"),
  });
  const ctx = makeCtx(supabase);

  const result = await executeQueryDatabase(ctx, {
    table: "profiles",
    select: "*",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "boom");
});

Deno.test("executeManageMemory add validates required fields", async () => {
  const supabase = new SupabaseStub();
  const ctx = makeCtx(supabase);

  const result = await executeManageMemory(ctx, {
    action: "add",
    key: "langue",
  });

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    'Les paramètres "key" et "value" sont requis pour ajouter une mémoire',
  );
});

Deno.test("executeManageMemory add upserts default category and importance", async () => {
  const supabase = new SupabaseStub().when("jarvis_user_memory", {
    data: {
      id: "mem-1",
      user_id: "user-123",
      category: "fact",
      key: "langue",
      value: "français",
      importance: 3,
    },
    error: null,
  });
  const ctx = makeCtx(supabase);

  const result = await executeManageMemory(ctx, {
    action: "add",
    key: "langue",
    value: "français",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: 'Mémorisé: "langue" = "français"',
    memory: {
      id: "mem-1",
      user_id: "user-123",
      category: "fact",
      key: "langue",
      value: "français",
      importance: 3,
    },
  });

  const builder = supabase.last("jarvis_user_memory");
  const upsertOp = builder.operations.find((op) => op.method === "upsert");
  assertExists(upsertOp);

  const payload = upsertOp?.args[0] as Record<string, unknown>;
  assertEquals(payload.user_id, "user-123");
  assertEquals(payload.category, "fact");
  assertEquals(payload.key, "langue");
  assertEquals(payload.value, "français");
  assertEquals(payload.importance, 3);
  assertExists(payload.updated_at);
  assertEquals(upsertOp?.args[1], { onConflict: "user_id,category,key" });
});

Deno.test("executeManageMemory get returns not found message when no data", async () => {
  const supabase = new SupabaseStub().when("jarvis_user_memory", {
    data: null,
    error: { message: "not found" },
  });
  const ctx = makeCtx(supabase);

  const result = await executeManageMemory(ctx, {
    action: "get",
    key: "timezone",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: 'Aucune mémoire trouvée pour la clé "timezone"',
    found: false,
  });
});

Deno.test("executeManageMemory list applies category filter and limit", async () => {
  const memories = [
    { key: "timezone", value: "Europe/Paris", importance: 5 },
    { key: "langue", value: "français", importance: 4 },
  ];
  const supabase = new SupabaseStub().when("jarvis_user_memory", {
    data: memories,
    error: null,
  });
  const ctx = makeCtx(supabase);

  const result = await executeManageMemory(ctx, {
    action: "list",
    category: "preference",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    memories,
    count: 2,
  });

  const builder = supabase.last("jarvis_user_memory");
  const categoryEq = builder.operations.find((op) => op.method === "eq" && op.args[0] === "category");
  const limitOp = builder.operations.find((op) => op.method === "limit" && op.args[0] === 50);
  assertExists(categoryEq);
  assertEquals(categoryEq?.args, ["category", "preference"]);
  assertExists(limitOp);
});

Deno.test("executeManageMemory delete requires key and deletes by user_id + key", async () => {
  const supabase = new SupabaseStub().when("jarvis_user_memory", {
    data: null,
    error: null,
  });
  const ctx = makeCtx(supabase);

  const missing = await executeManageMemory(ctx, {
    action: "delete",
  });
  assertEquals(missing.success, false);
  assertEquals(
    missing.error,
    'Le paramètre "key" est requis pour supprimer une mémoire',
  );

  const result = await executeManageMemory(ctx, {
    action: "delete",
    key: "timezone",
  });
  assertEquals(result.success, true);
  assertEquals(result.data, { message: 'Oublié: "timezone"' });

  const builder = supabase.last("jarvis_user_memory");
  const deleteOp = builder.operations.find((op) => op.method === "delete");
  const eqUser = builder.operations.find((op) => op.method === "eq" && op.args[0] === "user_id");
  const eqKey = builder.operations.find((op) => op.method === "eq" && op.args[0] === "key");
  assertExists(deleteOp);
  assertExists(eqUser);
  assertExists(eqKey);
  assertEquals(eqUser?.args, ["user_id", "user-123"]);
  assertEquals(eqKey?.args, ["key", "timezone"]);
});

Deno.test("executeManageMemory returns error when underlying DB throws", async () => {
  const supabase = new SupabaseStub().when("jarvis_user_memory", {
    throwOnAwait: new Error("db down"),
  });
  const ctx = makeCtx(supabase);

  const result = await executeManageMemory(ctx, {
    action: "list",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "db down");
});

Deno.test("executeGetUserContext fetches enabled sections and profile", async () => {
  const supabase = new SupabaseStub()
    .when("email_threads", {
      data: [{ id: "e1", subject: "Projet", category: "work" }],
      error: null,
    })
    .when("taches", {
      data: [{ id: "t1", titre: "Relancer", statut: "A faire" }],
      error: null,
    })
    .when("calendar_events", {
      data: [{ id: "c1", title: "Daily", location: "Meet" }],
      error: null,
    })
    .when("support_tickets", {
      data: [{ id: "s1", titre: "Bug", status: "open" }],
      error: null,
    })
    .when("profiles", {
      data: { id: "user-123", nom: "Doe", prenom: "Jane", email: "jane@example.com" },
      error: null,
    });
  const ctx = makeCtx(supabase);

  const result = await executeGetUserContext(ctx, {});

  assertEquals(result.success, true);
  assertEquals(result.data, {
    recent_emails: [{ id: "e1", subject: "Projet", category: "work" }],
    pending_tasks: [{ id: "t1", titre: "Relancer", statut: "A faire" }],
    upcoming_events: [{ id: "c1", title: "Daily", location: "Meet" }],
    open_tickets: [{ id: "s1", titre: "Bug", status: "open" }],
    user: { id: "user-123", nom: "Doe", prenom: "Jane", email: "jane@example.com" },
  });
});

Deno.test("executeGetUserContext respects include flags", async () => {
  const supabase = new SupabaseStub()
    .when("taches", {
      data: [{ id: "t1" }],
      error: null,
    })
    .when("profiles", {
      data: { id: "user-123" },
      error: null,
    });
  const ctx = makeCtx(supabase);

  const result = await executeGetUserContext(ctx, {
    include_emails: false,
    include_calendar: false,
    include_tickets: false,
    include_tasks: true,
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    pending_tasks: [{ id: "t1" }],
    user: { id: "user-123" },
  });
  assertEquals(supabase.all("email_threads").length, 0);
  assertEquals(supabase.all("calendar_events").length, 0);
  assertEquals(supabase.all("support_tickets").length, 0);
  assertEquals(supabase.all("taches").length, 1);
  assertEquals(supabase.all("profiles").length, 1);
});

Deno.test("executeGetUserContext returns failure when one query rejects", async () => {
  const supabase = new SupabaseStub()
    .when("email_threads", {
      throwOnAwait: new Error("emails broken"),
    })
    .when("taches", {
      data: [],
      error: null,
    })
    .when("calendar_events", {
      data: [],
      error: null,
    })
    .when("support_tickets", {
      data: [],
      error: null,
    })
    .when("profiles", {
      data: { id: "user-123" },
      error: null,
    });
  const ctx = makeCtx(supabase);

  const result = await executeGetUserContext(ctx, {});

  assertEquals(result.success, false);
  assertEquals(result.error, "emails broken");
});

Deno.test("executeUpdateEntityStatus updates mapped table and status column", async () => {
  const supabase = new SupabaseStub().when("support_tickets", {
    data: { id: "ticket-1", status: "in_progress" },
    error: null,
  });
  const ctx = makeCtx(supabase);

  const result = await executeUpdateEntityStatus(ctx, {
    entity_type: "ticket",
    entity_id: "ticket-1",
    new_status: "in_progress",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Statut mis à jour: in_progress",
    entity: { id: "ticket-1", status: "in_progress" },
  });

  const builder = supabase.last("support_tickets");
  const updateOp = builder.operations.find((op) => op.method === "update");
  const eqOp = builder.operations.find((op) => op.method === "eq");
  assertExists(updateOp);
  assertEquals(updateOp?.args, [{ status: "in_progress" }]);
  assertExists(eqOp);
  assertEquals(eqOp?.args, ["id", "ticket-1"]);
});

Deno.test("executeUpdateEntityStatus rejects unknown entity type", async () => {
  const supabase = new SupabaseStub();
  const ctx = makeCtx(supabase);

  const result = await executeUpdateEntityStatus(ctx, {
    entity_type: "unknown",
    entity_id: "1",
    new_status: "done",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Unknown entity type: unknown");
});

Deno.test("getDefaultCategorieId returns existing category id when found", async () => {
  const supabase = new SupabaseStub().when("tache_categories", {
    data: { id: "cat-existing" },
    error: null,
  });

  const id = await getDefaultCategorieId(supabase as unknown);

  assertEquals(id, "cat-existing");

  const builders = supabase.all("tache_categories");
  assertEquals(builders.length, 1);
  const builder = builders[0];
  const eqOp = builder.operations.find((op) => op.method === "eq");
  assertExists(eqOp);
  assertEquals(eqOp?.args, ["nom", "Jarvis"]);
});

Deno.test("getDefaultCategorieId inserts category when none exists", async () => {
  const supabase = new SupabaseStub()
    .when("tache_categories", {
      data: null,
      error: null,
    }, {
      data: { id: "cat-created" },
      error: null,
    });

  const id = await getDefaultCategorieId(supabase as unknown);

  assertEquals(id, "cat-created");

  const builders = supabase.all("tache_categories");
  assertEquals(builders.length, 2);

  const insertBuilder = builders[1];
  const insertOp = insertBuilder.operations.find((op) => op.method === "insert");
  assertExists(insertOp);
  assertEquals(insertOp?.args, [{
    nom: "Jarvis",
    couleur: "#6366f1",
    description: "Tâches créées par Jarvis",
  }]);
});