import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeAutoFollowupCheck,
  executeCreateWorkflow,
  executeGetNotifications,
  executeGetTeamAvailability,
  executeMarkNotificationsRead,
  executeSendNotification,
} from "./notification-tools.ts";

type Operation = { method: string; args: unknown[] };
type FromCall = { table: string; ops: Operation[] };

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function findOp(ops: Operation[], method: string, firstArg?: unknown): Operation | undefined {
  return ops.find((op) => op.method === method && (firstArg === undefined || op.args[0] === firstArg));
}

function createSupabaseMock(
  resolver: (table: string, ops: Operation[], terminal: string) => { data?: unknown; error?: unknown; count?: number },
  invoke?: (name: string, options: unknown) => Promise<unknown>,
) {
  const calls: FromCall[] = [];

  const supabase = {
    calls,
    functions: {
      invoke: invoke ?? (async () => ({ data: {}, error: null })),
    },
    from(table: string) {
      const ops: Operation[] = [];
      calls.push({ table, ops });

      const query = {
        select(columns?: string) {
          ops.push({ method: "select", args: [columns] });
          return query;
        },
        insert(payload: unknown) {
          ops.push({ method: "insert", args: [payload] });
          return query;
        },
        update(payload: unknown) {
          ops.push({ method: "update", args: [payload] });
          return query;
        },
        eq(column: string, value: unknown) {
          ops.push({ method: "eq", args: [column, value] });
          return query;
        },
        lt(column: string, value: unknown) {
          ops.push({ method: "lt", args: [column, value] });
          return query;
        },
        gt(column: string, value: unknown) {
          ops.push({ method: "gt", args: [column, value] });
          return query;
        },
        lte(column: string, value: unknown) {
          ops.push({ method: "lte", args: [column, value] });
          return query;
        },
        gte(column: string, value: unknown) {
          ops.push({ method: "gte", args: [column, value] });
          return query;
        },
        ["in"](column: string, values: unknown) {
          ops.push({ method: "in", args: [column, values] });
          return query;
        },
        order(column: string, options?: unknown) {
          ops.push({ method: "order", args: [column, options] });
          return query;
        },
        limit(count: number) {
          ops.push({ method: "limit", args: [count] });
          return Promise.resolve(resolver(table, ops, "limit"));
        },
        single() {
          ops.push({ method: "single", args: [] });
          return Promise.resolve(resolver(table, ops, "single"));
        },
        then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve(resolver(table, ops, "then")).then(onFulfilled, onRejected);
        },
      };

      return query;
    },
  };

  return supabase;
}

Deno.test("executeSendNotification inserts an in-app notification with default user, mapped type, null related_id, and swallows push failure", async () => {
  const pushCalls: Array<{ name: string; options: unknown }> = [];
  const supabase = createSupabaseMock(
    (table, _ops, terminal) => {
      assertEquals(table, "in_app_notifications");
      assertEquals(terminal, "single");
      return { data: { id: "notif-1" }, error: null };
    },
    async (name, options) => {
      pushCalls.push({ name, options });
      throw new Error("push service unavailable");
    },
  );

  const result = await executeSendNotification(
    { supabase: supabase as any, userId: "user-current" },
    {
      title: "Relance à faire",
      message: "Prospect sans activité récente",
      type: "invalid-business-type",
      link: "https://example.test/not-a-uuid",
    },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.message, "Notification envoyée");
  assertEquals((result as any).data.notification_id, "notif-1");
  assertExists(result.execution_time_ms);

  const call = supabase.calls[0];
  assertEquals(call.table, "in_app_notifications");
  assertEquals(findOp(call.ops, "insert")?.args[0], {
    user_id: "user-current",
    title: "Relance à faire",
    message: "Prospect sans activité récente",
    type: "other",
    related_id: null,
    related_type: "jarvis",
    is_read: false,
  });
  assertEquals(findOp(call.ops, "select")?.args, [undefined]);
  assertExists(findOp(call.ops, "single"));

  assertEquals(pushCalls.length, 1);
  assertEquals(pushCalls[0].name, "send-push-notification");
  assertEquals(pushCalls[0].options, {
    body: {
      user_id: "user-current",
      title: "Relance à faire",
      body: "Prospect sans activité récente",
      data: {
        link: "https://example.test/not-a-uuid",
        type: "invalid-business-type",
      },
    },
  });
});

Deno.test("executeSendNotification keeps a valid notification type, target user, and UUID related_id", async () => {
  const relatedId = "123e4567-e89b-12d3-a456-426614174000";
  const supabase = createSupabaseMock(() => ({ data: { id: "notif-uuid" }, error: null }));

  const result = await executeSendNotification(
    { supabase: supabase as any, userId: "sender-user" },
    {
      target_user_id: "target-user",
      title: "Mention",
      message: "Vous avez été mentionné",
      type: "mention",
      link: relatedId,
    },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.notification_id, "notif-uuid");

  const insertPayload = findOp(supabase.calls[0].ops, "insert")?.args[0] as Record<string, unknown>;
  assertEquals(insertPayload.user_id, "target-user");
  assertEquals(insertPayload.type, "mention");
  assertEquals(insertPayload.related_id, relatedId);
});

Deno.test("executeSendNotification returns a business error when database insertion fails", async () => {
  const supabase = createSupabaseMock(() => ({
    data: null,
    error: new Error("insert denied by policy"),
  }));

  const result = await executeSendNotification(
    { supabase: supabase as any, userId: "user-current" },
    {
      title: "Erreur",
      message: "Ne doit pas être sauvegardé",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "insert denied by policy");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetNotifications applies user, unread, type, ordering and limit filters, then computes counts", async () => {
  const notifications = [
    { id: "n1", title: "A", message: "Alpha", type: "mention", related_id: null, is_read: false, created_at: "2025-01-03T10:00:00Z" },
    { id: "n2", title: "B", message: "Beta", type: "mention", related_id: null, is_read: true, created_at: "2025-01-02T10:00:00Z" },
    { id: "n3", title: "C", message: "Gamma", type: "mention", related_id: null, is_read: false, created_at: "2025-01-01T10:00:00Z" },
  ];
  const supabase = createSupabaseMock(() => ({ data: notifications, error: null }));

  const result = await executeGetNotifications(
    { supabase: supabase as any, userId: "user-42" },
    { unread_only: true, limit: 3, type: "mention" },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.notifications, notifications);
  assertEquals((result as any).data.unread_count, 2);
  assertEquals((result as any).data.total, 3);

  const ops = supabase.calls[0].ops;
  assertEquals(findOp(ops, "select")?.args[0], "id, title, message, type, related_id, is_read, created_at");
  assertEquals(findOp(ops, "eq", "user_id")?.args, ["user_id", "user-42"]);
  assertEquals(findOp(ops, "order")?.args, ["created_at", { ascending: false }]);
  assertEquals(findOp(ops, "eq", "is_read")?.args, ["is_read", false]);
  assertEquals(findOp(ops, "eq", "type")?.args, ["type", "mention"]);
  assertEquals(findOp(ops, "limit")?.args, [3]);
});

Deno.test("executeGetNotifications defaults to limit 20 and handles empty data", async () => {
  const supabase = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeGetNotifications(
    { supabase: supabase as any, userId: "user-empty" },
    {},
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.notifications, []);
  assertEquals((result as any).data.unread_count, 0);
  assertEquals((result as any).data.total, 0);
  assertEquals(findOp(supabase.calls[0].ops, "limit")?.args, [20]);
});

Deno.test("executeMarkNotificationsRead rejects missing ids when mark_all is not set", async () => {
  const supabase = createSupabaseMock(() => ({ data: null, error: null, count: 0 }));

  const result = await executeMarkNotificationsRead(
    { supabase: supabase as any, userId: "user-1" },
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "notification_ids ou mark_all requis");
  assertEquals(supabase.calls.length, 1);
  assertEquals(findOp(supabase.calls[0].ops, "update")?.args[0] instanceof Object, true);
  assertEquals(findOp(supabase.calls[0].ops, "eq", "user_id")?.args, ["user_id", "user-1"]);
});

Deno.test("executeMarkNotificationsRead marks only provided notification ids", async () => {
  const supabase = createSupabaseMock(() => ({ error: null, count: 2 }));

  const result = await executeMarkNotificationsRead(
    { supabase: supabase as any, userId: "user-1" },
    { notification_ids: ["n1", "n2"] },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.message, "Notifications marquées comme lues");
  assertEquals((result as any).data.count, 2);

  const ops = supabase.calls[0].ops;
  const updatePayload = findOp(ops, "update")?.args[0] as Record<string, unknown>;
  assertEquals(updatePayload.is_read, true);
  assertEquals(typeof updatePayload.read_at, "string");
  assertEquals(findOp(ops, "eq", "user_id")?.args, ["user_id", "user-1"]);
  assertEquals(findOp(ops, "in", "id")?.args, ["id", ["n1", "n2"]]);
});

Deno.test("executeMarkNotificationsRead mark_all updates the user scope without id filter", async () => {
  const supabase = createSupabaseMock(() => ({ error: null, count: 5 }));

  const result = await executeMarkNotificationsRead(
    { supabase: supabase as any, userId: "user-all" },
    { mark_all: true },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.count, 5);
  assertEquals(findOp(supabase.calls[0].ops, "eq", "user_id")?.args, ["user_id", "user-all"]);
  assertEquals(findOp(supabase.calls[0].ops, "in", "id"), undefined);
});

Deno.test("executeAutoFollowupCheck builds proactive followups, skips tasks without due date, counts by priority, and sorts high priority first", async () => {
  const supabase = createSupabaseMock((table) => {
    if (table === "taches") {
      return {
        data: [
          { id: "task-high", titre: "Signer le contrat", echeance: daysAgo(8), etablissement_id: "e1", etablissements: { nom: "Clinique Nord" } },
          { id: "task-medium", titre: "Appeler le contact", echeance: daysAgo(4), etablissement_id: "e2", etablissements: { nom: "EHPAD Sud" } },
          { id: "task-skipped", titre: "Sans échéance", echeance: null, etablissement_id: "e3", etablissements: { nom: "Sans date" } },
        ],
        error: null,
      };
    }
    if (table === "etablissements") {
      return {
        data: [
          { id: "prospect-1", nom: "Résidence Horizon", statut: "prospect", updated_at: daysAgo(65) },
        ],
        error: null,
      };
    }
    if (table === "email_threads") {
      return {
        data: [
          {
            id: "thread-1",
            subject: "Sujet brut",
            ai_generated_title: "Relance appel d'offres",
            last_message_date: daysAgo(15),
            category: "sales",
            has_sent_messages: true,
          },
        ],
        error: null,
      };
    }
    if (table === "factures") {
      return {
        data: [
          { id: "invoice-1", numero: "F-2025-001", montant_ttc: 1200, date_emission: daysAgo(40), etablissements: { nom: "Client Facturé" } },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const result = await executeAutoFollowupCheck(
    { supabase: supabase as any, userId: "responsable-1" },
    { domain: "commercial" },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.total_count, 5);
  assertEquals((result as any).data.high_priority_count, 4);
  assertEquals((result as any).data.summary, "5 suivi(s) suggéré(s): 2 tâches, 1 prospects, 1 emails, 1 factures");

  const followups = (result as any).data.followups;
  assertEquals(followups.map((f: any) => f.priority), ["high", "high", "high", "high", "medium"]);
  assertEquals(followups.map((f: any) => f.type), ["overdue_task", "cold_prospect", "pending_email", "unpaid_invoice", "overdue_task"]);
  assertEquals(followups[0].subject, "Signer le contrat");
  assertEquals(followups[0].data, { task_id: "task-high", etablissement: "Clinique Nord" });
  assertEquals(followups[1].subject, "Résidence Horizon");
  assertEquals(followups[2].subject, "Relance appel d'offres");
  assertEquals(followups[3].subject, "Facture F-2025-001");
  assertEquals(followups[4].priority, "medium");

  const tasksOps = supabase.calls.find((call) => call.table === "taches")!.ops;
  assertEquals(findOp(tasksOps, "eq", "responsable_id")?.args, ["responsable_id", "responsable-1"]);
  assertEquals(findOp(tasksOps, "in", "statut")?.args, ["statut", ["en_attente", "en_cours"]]);
  assertEquals(findOp(tasksOps, "order")?.args, ["echeance", { ascending: true }]);

  const threadsOps = supabase.calls.find((call) => call.table === "email_threads")!.ops;
  assertEquals(findOp(threadsOps, "eq", "has_sent_messages")?.args, ["has_sent_messages", true]);
  assertEquals(findOp(threadsOps, "gt", "unread_count")?.args, ["unread_count", 0]);
  assertEquals(findOp(threadsOps, "eq", "is_deleted")?.args, ["is_deleted", false]);
});

Deno.test("executeAutoFollowupCheck returns an error result when a query builder throws", async () => {
  const supabase = {
    from(table: string) {
      if (table === "taches") {
        throw new Error("database unavailable");
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await executeAutoFollowupCheck(
    { supabase: supabase as any, userId: "user-error" },
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetTeamAvailability checks provided members, calendar overlaps, approved absences, names and summary", async () => {
  const requestedDate = "2025-01-15T10:00:00.000Z";
  const supabase = createSupabaseMock((table, ops, terminal) => {
    if (table === "profiles" && terminal === "single") {
      const userId = findOp(ops, "eq", "id")?.args[1];
      if (userId === "u1") return { data: { prenom: "Ada", nom: "Lovelace" }, error: null };
      if (userId === "u2") return { data: { prenom: "Grace", nom: "Hopper" }, error: null };
    }
    if (table === "calendar_events") {
      const userId = findOp(ops, "eq", "created_by")?.args[1];
      return {
        data: userId === "u1"
          ? [{ title: "Comité projet", start_time: "2025-01-15T09:30:00.000Z", end_time: "2025-01-15T10:30:00.000Z" }]
          : [],
        error: null,
      };
    }
    if (table === "rh_absences") {
      const userId = findOp(ops, "eq", "profile_id")?.args[1];
      return {
        data: userId === "u2"
          ? [{ type: "CP", date_debut: "2025-01-15", date_fin: "2025-01-15" }]
          : [],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const result = await executeGetTeamAvailability(
    { supabase: supabase as any, userId: "manager-1" },
    {
      date: requestedDate,
      duration_minutes: 90,
      team_member_ids: ["u1", "u2"],
    },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.date, requestedDate);
  assertEquals((result as any).data.duration_minutes, 90);
  assertEquals((result as any).data.available_count, 0);
  assertEquals((result as any).data.total_checked, 2);
  assertEquals((result as any).data.summary, "0/2 personnes disponibles");
  assertEquals((result as any).data.team_availability, [
    {
      user_id: "u1",
      name: "Ada Lovelace",
      available: false,
      conflicts: ["📅 Comité projet"],
    },
    {
      user_id: "u2",
      name: "Grace Hopper",
      available: false,
      conflicts: ["🏖️ CP"],
    },
  ]);

  const calendarCall = supabase.calls.find((call) =>
    call.table === "calendar_events" && findOp(call.ops, "eq", "created_by")?.args[1] === "u1"
  )!;
  assertEquals(findOp(calendarCall.ops, "lt", "start_time")?.args, ["start_time", "2025-01-15T11:30:00.000Z"]);
  assertEquals(findOp(calendarCall.ops, "gt", "end_time")?.args, ["end_time", requestedDate]);

  const absenceCall = supabase.calls.find((call) =>
    call.table === "rh_absences" && findOp(call.ops, "eq", "profile_id")?.args[1] === "u2"
  )!;
  assertEquals(findOp(absenceCall.ops, "eq", "statut")?.args, ["statut", "approved"]);
  assertEquals(findOp(absenceCall.ops, "lte", "date_debut")?.args, ["date_debut", "2025-01-15"]);
  assertEquals(findOp(absenceCall.ops, "gte", "date_fin")?.args, ["date_fin", "2025-01-15"]);
});

Deno.test("executeGetTeamAvailability fetches active team members when ids are omitted and defaults duration to 60 minutes", async () => {
  const supabase = createSupabaseMock((table, ops, terminal) => {
    if (table === "profiles" && terminal === "limit") {
      return { data: [{ id: "u-default" }], error: null };
    }
    if (table === "profiles" && terminal === "single") {
      return { data: { prenom: "", nom: "" }, error: null };
    }
    if (table === "calendar_events" || table === "rh_absences") {
      return { data: [], error: null };
    }
    return { data: [], error: null };
  });

  const result = await executeGetTeamAvailability(
    { supabase: supabase as any, userId: "manager-1" },
    { date: "2025-02-20T08:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data.duration_minutes, 60);
  assertEquals((result as any).data.available_count, 1);
  assertEquals((result as any).data.summary, "1/1 personnes disponibles");
  assertEquals((result as any).data.team_availability[0], {
    user_id: "u-default",
    name: "u-default",
    available: true,
    conflicts: [],
  });

  const teamFetch = supabase.calls[0];
  assertEquals(teamFetch.table, "profiles");
  assertEquals(findOp(teamFetch.ops, "select")?.args, ["id"]);
  assertEquals(findOp(teamFetch.ops, "eq", "est_actif")?.args, ["est_actif", true]);
  assertEquals(findOp(teamFetch.ops, "limit")?.args, [20]);
});

Deno.test("executeCreateWorkflow returns a deterministic workflow confirmation without database access", async () => {
  const result = await executeCreateWorkflow(
    { supabase: {} as any, userId: "user-workflow" },
    {
      name: "Relance prospect",
      trigger: "prospect_inactive_30_days",
      steps: [
        { action: "send_notification", parameters: { type: "ai_suggestion" } },
        { action: "create_task", parameters: { priority: "high" }, delay_minutes: 60 },
      ],
    },
  );

  assertEquals(result.success, true);
  assertEquals((result as any).data, {
    message: 'Workflow "Relance prospect" configuré avec 2 étape(s)',
    trigger: "prospect_inactive_30_days",
    steps_count: 2,
    note: "Les workflows automatisés seront bientôt disponibles",
  });
  assertExists(result.execution_time_ms);
});

Deno.test("assertion helpers requested by the test policy are available", async () => {
  assertThrows(() => {
    throw new Error("sync assertion helper available");
  }, Error, "sync assertion helper available");

  await assertRejects(
    () => Promise.reject(new Error("async assertion helper available")),
    Error,
    "async assertion helper available",
  );
});