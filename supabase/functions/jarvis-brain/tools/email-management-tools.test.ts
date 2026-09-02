import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeClassifyEmailThread,
  executeManageEmailDraft,
  executeManageEmailFilter,
  executeManageEmailThread,
} from "./email-management-tools.ts";

type MockCall = {
  table: string;
  method: string;
  args: unknown[];
};

type MockResponse = {
  data?: unknown;
  error?: unknown;
};

class MockSupabaseBuilder {
  private operation = "";
  private payload: unknown;
  private filters: Record<string, unknown> = {};

  constructor(
    private readonly table: string,
    private readonly calls: MockCall[],
    private readonly response: MockResponse,
  ) {}

  select(...args: unknown[]) {
    this.calls.push({ table: this.table, method: "select", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ table: this.table, method: "eq", args });
    if (typeof args[0] === "string") {
      this.filters[args[0]] = args[1];
    }
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ table: this.table, method: "order", args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ table: this.table, method: "limit", args });
    return this;
  }

  insert(...args: unknown[]) {
    this.operation = "insert";
    this.payload = args[0];
    this.calls.push({ table: this.table, method: "insert", args });
    return this;
  }

  update(...args: unknown[]) {
    this.operation = "update";
    this.payload = args[0];
    this.calls.push({ table: this.table, method: "update", args });
    return this;
  }

  delete(...args: unknown[]) {
    this.operation = "delete";
    this.calls.push({ table: this.table, method: "delete", args });
    return this;
  }

  single(...args: unknown[]) {
    this.calls.push({ table: this.table, method: "single", args });
    return this;
  }

  get error() {
    return this.response.error ?? null;
  }

  get data() {
    if (Object.prototype.hasOwnProperty.call(this.response, "data")) {
      return this.response.data;
    }

    if (this.operation === "insert" || this.operation === "update") {
      return {
        id: this.filters.id ?? "generated-id",
        ...(typeof this.payload === "object" && this.payload !== null ? this.payload as Record<string, unknown> : {}),
      };
    }

    return this.operation === "delete" ? null : [];
  }
}

function createMockSupabase(response: MockResponse = {}) {
  const calls: MockCall[] = [];
  const supabase = {
    from(table: string) {
      calls.push({ table, method: "from", args: [] });
      return new MockSupabaseBuilder(table, calls, response);
    },
  };

  return { supabase, calls };
}

function createCtx(response: MockResponse = {}, userId = "user-123") {
  const mock = createMockSupabase(response);
  return {
    ctx: {
      supabase: mock.supabase,
      userId,
    } as any,
    calls: mock.calls,
  };
}

Deno.test("executeManageEmailDraft list returns drafts count and queries current user ordered by update date", async () => {
  const drafts = [
    { id: "draft-2", subject: "Second", user_id: "user-123" },
    { id: "draft-1", subject: "First", user_id: "user-123" },
  ];
  const { ctx, calls } = createCtx({ data: drafts });

  const result = await executeManageEmailDraft(ctx, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data, { drafts, count: 2 });
  assertExists(result.execution_time_ms);

  assertEquals(calls, [
    { table: "email_drafts", method: "from", args: [] },
    { table: "email_drafts", method: "select", args: ["*"] },
    { table: "email_drafts", method: "eq", args: ["user_id", "user-123"] },
    { table: "email_drafts", method: "order", args: ["updated_at", { ascending: false }] },
    { table: "email_drafts", method: "limit", args: [50] },
  ]);
});

Deno.test("executeManageEmailDraft create inserts provided data with user_id and returns created draft", async () => {
  const createdDraft = {
    id: "draft-1",
    to: "client@example.test",
    subject: "Bonjour",
    body: "Contenu",
    user_id: "user-123",
  };
  const { ctx, calls } = createCtx({ data: createdDraft });

  const result = await executeManageEmailDraft(ctx, {
    action: "create",
    data: {
      to: "client@example.test",
      subject: "Bonjour",
      body: "Contenu",
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Brouillon créé",
    draft: createdDraft,
  });

  assertEquals(calls[0], { table: "email_drafts", method: "from", args: [] });
  assertEquals(calls[1], {
    table: "email_drafts",
    method: "insert",
    args: [{
      to: "client@example.test",
      subject: "Bonjour",
      body: "Contenu",
      user_id: "user-123",
    }],
  });
  assertEquals(calls[2], { table: "email_drafts", method: "select", args: [] });
  assertEquals(calls[3], { table: "email_drafts", method: "single", args: [] });
});

Deno.test("executeManageEmailDraft update requires draft_id and does not query Supabase when missing", async () => {
  const { ctx, calls } = createCtx();

  const result = await executeManageEmailDraft(ctx, {
    action: "update",
    data: { subject: "Nouveau sujet" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "draft_id required");
  assertEquals(calls, []);
});

Deno.test("executeManageEmailDraft update adds updated_at timestamp and filters by draft id", async () => {
  const updatedDraft = {
    id: "draft-123",
    subject: "Sujet mis à jour",
    updated_at: "server-value",
  };
  const { ctx, calls } = createCtx({ data: updatedDraft });

  const result = await executeManageEmailDraft(ctx, {
    action: "update",
    draft_id: "draft-123",
    data: { subject: "Sujet mis à jour" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Brouillon mis à jour",
    draft: updatedDraft,
  });

  const updateCall = calls.find((call) => call.method === "update");
  assertExists(updateCall);
  const updatePayload = updateCall.args[0] as Record<string, unknown>;
  assertEquals(updatePayload.subject, "Sujet mis à jour");
  assertExists(updatePayload.updated_at);
  assertEquals(Number.isNaN(Date.parse(updatePayload.updated_at as string)), false);

  assertEquals(calls.find((call) => call.method === "eq"), {
    table: "email_drafts",
    method: "eq",
    args: ["id", "draft-123"],
  });
});

Deno.test("executeManageEmailDraft delete returns Supabase error message on failure", async () => {
  const { ctx, calls } = createCtx({ error: new Error("delete denied") });

  const result = await executeManageEmailDraft(ctx, {
    action: "delete",
    draft_id: "draft-locked",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "delete denied");
  assertEquals(calls, [
    { table: "email_drafts", method: "from", args: [] },
    { table: "email_drafts", method: "delete", args: [] },
    { table: "email_drafts", method: "eq", args: ["id", "draft-locked"] },
  ]);
});

Deno.test("executeManageEmailDraft unknown action returns not implemented message without database call", async () => {
  const { ctx, calls } = createCtx();

  const result = await executeManageEmailDraft(ctx, {
    action: "send",
    draft_id: "draft-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action send not implemented" });
  assertEquals(calls, []);
});

Deno.test("executeManageEmailFilter list returns filters and orders by creation date descending", async () => {
  const filters = [
    { id: "filter-2", name: "VIP", user_id: "user-123" },
    { id: "filter-1", name: "Factures", user_id: "user-123" },
  ];
  const { ctx, calls } = createCtx({ data: filters });

  const result = await executeManageEmailFilter(ctx, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data, { filters, count: 2 });
  assertEquals(calls, [
    { table: "email_filters", method: "from", args: [] },
    { table: "email_filters", method: "select", args: ["*"] },
    { table: "email_filters", method: "eq", args: ["user_id", "user-123"] },
    { table: "email_filters", method: "order", args: ["created_at", { ascending: false }] },
  ]);
});

Deno.test("executeManageEmailFilter create inserts rule data with user_id", async () => {
  const createdFilter = {
    id: "filter-1",
    name: "Urgent",
    criteria: { from: "boss@example.test" },
    action: "star",
    user_id: "user-123",
  };
  const { ctx, calls } = createCtx({ data: createdFilter });

  const result = await executeManageEmailFilter(ctx, {
    action: "create",
    data: {
      name: "Urgent",
      criteria: { from: "boss@example.test" },
      action: "star",
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Filtre créé",
    filter: createdFilter,
  });
  assertEquals(calls[1], {
    table: "email_filters",
    method: "insert",
    args: [{
      name: "Urgent",
      criteria: { from: "boss@example.test" },
      action: "star",
      user_id: "user-123",
    }],
  });
});

Deno.test("executeManageEmailFilter update requires filter_id", async () => {
  const { ctx, calls } = createCtx();

  const result = await executeManageEmailFilter(ctx, {
    action: "update",
    data: { name: "Renommé" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "filter_id required");
  assertEquals(calls, []);
});

Deno.test("executeManageEmailFilter update sends empty object when data is absent", async () => {
  const updatedFilter = { id: "filter-9", name: "Sans changement" };
  const { ctx, calls } = createCtx({ data: updatedFilter });

  const result = await executeManageEmailFilter(ctx, {
    action: "update",
    filter_id: "filter-9",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Filtre mis à jour",
    filter: updatedFilter,
  });
  assertEquals(calls[1], {
    table: "email_filters",
    method: "update",
    args: [{}],
  });
  assertEquals(calls[2], {
    table: "email_filters",
    method: "eq",
    args: ["id", "filter-9"],
  });
});

Deno.test("executeManageEmailFilter delete removes filter by id", async () => {
  const { ctx, calls } = createCtx();

  const result = await executeManageEmailFilter(ctx, {
    action: "delete",
    filter_id: "filter-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Filtre supprimé" });
  assertEquals(calls, [
    { table: "email_filters", method: "from", args: [] },
    { table: "email_filters", method: "delete", args: [] },
    { table: "email_filters", method: "eq", args: ["id", "filter-1"] },
  ]);
});

for (
  const testCase of [
    {
      action: "archive",
      update: { is_archived: true },
      message: "Thread archivé",
    },
    {
      action: "unarchive",
      update: { is_archived: false },
      message: "Thread désarchivé",
    },
    {
      action: "mark_read",
      update: { unread_count: 0 },
      message: "Thread marqué comme lu",
    },
    {
      action: "star",
      update: { is_starred: true },
      message: "Thread mis en favori",
    },
  ]
) {
  Deno.test(`executeManageEmailThread ${testCase.action} updates thread state`, async () => {
    const thread = {
      id: "thread-123",
      ...testCase.update,
    };
    const { ctx, calls } = createCtx({ data: thread });

    const result = await executeManageEmailThread(ctx, {
      action: testCase.action,
      thread_id: "thread-123",
    });

    assertEquals(result.success, true);
    assertEquals(result.data, {
      message: testCase.message,
      thread,
    });
    assertEquals(calls, [
      { table: "email_threads", method: "from", args: [] },
      { table: "email_threads", method: "update", args: [testCase.update] },
      { table: "email_threads", method: "eq", args: ["id", "thread-123"] },
      { table: "email_threads", method: "select", args: [] },
      { table: "email_threads", method: "single", args: [] },
    ]);
  });
}

Deno.test("executeManageEmailThread unknown action returns not implemented message", async () => {
  const { ctx, calls } = createCtx();

  const result = await executeManageEmailThread(ctx, {
    action: "snooze",
    thread_id: "thread-123",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action snooze not implemented" });
  assertEquals(calls, []);
});

Deno.test("executeManageEmailThread returns Supabase error message", async () => {
  const { ctx } = createCtx({ error: new Error("thread update rejected") });

  const result = await executeManageEmailThread(ctx, {
    action: "archive",
    thread_id: "thread-123",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "thread update rejected");
});

Deno.test("executeClassifyEmailThread updates only provided classification fields", async () => {
  const classifiedThread = {
    id: "thread-abc",
    category: "commercial",
    tags: ["prospect", "important"],
  };
  const { ctx, calls } = createCtx({ data: classifiedThread });

  const result = await executeClassifyEmailThread(ctx, {
    thread_id: "thread-abc",
    category: "commercial",
    tags: ["prospect", "important"],
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Thread classifié",
    thread: classifiedThread,
  });
  assertEquals(calls, [
    { table: "email_threads", method: "from", args: [] },
    {
      table: "email_threads",
      method: "update",
      args: [{
        category: "commercial",
        tags: ["prospect", "important"],
      }],
    },
    { table: "email_threads", method: "eq", args: ["id", "thread-abc"] },
    { table: "email_threads", method: "select", args: [] },
    { table: "email_threads", method: "single", args: [] },
  ]);
});

Deno.test("executeClassifyEmailThread can update category, etablissement_id and tags together", async () => {
  const classifiedThread = {
    id: "thread-full",
    category: "support",
    etablissement_id: "etab-42",
    tags: ["sav", "prioritaire"],
  };
  const { ctx, calls } = createCtx({ data: classifiedThread });

  const result = await executeClassifyEmailThread(ctx, {
    thread_id: "thread-full",
    category: "support",
    etablissement_id: "etab-42",
    tags: ["sav", "prioritaire"],
  });

  assertEquals(result.success, true);
  assertEquals(calls[1], {
    table: "email_threads",
    method: "update",
    args: [{
      category: "support",
      etablissement_id: "etab-42",
      tags: ["sav", "prioritaire"],
    }],
  });
});

Deno.test("executeClassifyEmailThread returns classification failure when Supabase errors", async () => {
  const { ctx, calls } = createCtx({ error: new Error("classification denied") });

  const result = await executeClassifyEmailThread(ctx, {
    thread_id: "thread-denied",
    category: "finance",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "classification denied");
  assertEquals(calls[1], {
    table: "email_threads",
    method: "update",
    args: [{ category: "finance" }],
  });
});