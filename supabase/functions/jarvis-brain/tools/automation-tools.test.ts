import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCreateReminder,
  executeCreateAutomationRule,
  executeListAutomationRules,
  executeToggleAutomationRule,
  executeCreateScheduledTask,
  executeGetAutomationStats,
} from "./automation-tools.ts";

type QueryResult = { data?: unknown; error?: unknown };

function createSupabaseMock(config: {
  insertResults?: Record<string, QueryResult>;
  selectResults?: Record<string, QueryResult>;
  updateResults?: Record<string, QueryResult>;
}) {
  const calls: Array<{
    table: string;
    operation: string;
    values?: unknown;
    eqs?: Array<{ column: string; value: unknown }>;
    likes?: Array<{ column: string; pattern: string }>;
    selectArg?: string;
  }> = [];

  class QueryBuilder {
    table: string;
    operation: string | null = null;
    values: unknown;
    eqs: Array<{ column: string; value: unknown }> = [];
    likes: Array<{ column: string; pattern: string }> = [];
    selectArg?: string;

    constructor(table: string) {
      this.table = table;
    }

    insert(values: unknown) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    update(values: unknown) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    select(arg?: string) {
      if (!this.operation) this.operation = "select";
      this.selectArg = arg;
      return this;
    }

    eq(column: string, value: unknown) {
      this.eqs.push({ column, value });
      return this;
    }

    like(column: string, pattern: string) {
      this.likes.push({ column, pattern });
      return this;
    }

    async single() {
      calls.push({
        table: this.table,
        operation: this.operation || "select",
        values: this.values,
        eqs: [...this.eqs],
        likes: [...this.likes],
        selectArg: this.selectArg,
      });

      if ((this.operation || "select") === "insert") {
        return config.insertResults?.[this.table] ?? { data: { id: "default-insert-id" }, error: null };
      }
      if ((this.operation || "select") === "update") {
        return config.updateResults?.[this.table] ?? { data: null, error: null };
      }
      return config.selectResults?.[this.table] ?? { data: null, error: null };
    }

    then(onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) {
      calls.push({
        table: this.table,
        operation: this.operation || "select",
        values: this.values,
        eqs: [...this.eqs],
        likes: [...this.likes],
        selectArg: this.selectArg,
      });

      let result: QueryResult;
      if ((this.operation || "select") === "insert") {
        result = config.insertResults?.[this.table] ?? { data: [{ id: "default-insert-id" }], error: null };
      } else if ((this.operation || "select") === "update") {
        result = config.updateResults?.[this.table] ?? { data: null, error: null };
      } else {
        result = config.selectResults?.[this.table] ?? { data: [], error: null };
      }

      return Promise.resolve(result).then(onFulfilled, onRejected);
    }
  }

  return {
    client: {
      from(table: string) {
        return new QueryBuilder(table);
      },
    },
    calls,
  };
}

Deno.test("executeCreateReminder refuse une date passée", async () => {
  const { client, calls } = createSupabaseMock({});
  const result = await executeCreateReminder(
    { supabase: client as never, userId: "user-1" },
    {
      title: "Payer facture",
      remind_at: "2000-01-01T10:00:00.000Z",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "La date de rappel doit être dans le futur");
  assertEquals(calls.length, 0);
  assertExists(result.execution_time_ms);
});

Deno.test("executeCreateReminder crée une notification avec métadonnées et lien", async () => {
  const { client, calls } = createSupabaseMock({
    insertResults: {
      notifications: {
        data: { id: "notif-1", titre: "⏰ Rappel: Relancer client" },
        error: null,
      },
    },
  });

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = await executeCreateReminder(
    { supabase: client as never, userId: "user-42" },
    {
      title: "Relancer client",
      remind_at: future,
      entity_type: "ticket",
      entity_id: "abc123",
      repeat: "weekly",
      notify_via: ["app", "email"],
    },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals((result.data as Record<string, unknown>).remind_at, future);
  assertEquals(calls.length, 1);

  const call = calls[0];
  assertEquals(call.table, "notifications");
  assertEquals(call.operation, "insert");

  const payload = call.values as Record<string, unknown>;
  assertEquals(payload.user_id, "user-42");
  assertEquals(payload.type, "reminder");
  assertEquals(payload.titre, "⏰ Rappel: Relancer client");
  assertEquals(payload.message, "Concernant: ticket abc123");
  assertEquals(payload.lien, "/tickets/abc123");
  assertEquals(payload.est_lu, false);

  const metadata = payload.metadata as Record<string, unknown>;
  assertEquals(metadata.remind_at, future);
  assertEquals(metadata.repeat, "weekly");
  assertEquals(metadata.entity_type, "ticket");
  assertEquals(metadata.entity_id, "abc123");
  assertEquals(metadata.notify_via, ["app", "email"]);
  assertEquals(metadata.created_by_jarvis, true);
});

Deno.test("executeCreateAutomationRule valide trigger et action", async () => {
  const { client } = createSupabaseMock({});

  const invalidTrigger = await executeCreateAutomationRule(
    { supabase: client as never, userId: "user-1" },
    {
      name: "Rule A",
      trigger_type: "bad_trigger",
      trigger_config: {},
      action_type: "send_notification",
      action_config: {},
    },
  );

  assertEquals(invalidTrigger.success, false);
  assertEquals(
    invalidTrigger.error,
    "Trigger invalide. Valides: new_email, task_overdue, ticket_created, status_changed, time_based",
  );

  const invalidAction = await executeCreateAutomationRule(
    { supabase: client as never, userId: "user-1" },
    {
      name: "Rule B",
      trigger_type: "new_email",
      trigger_config: {},
      action_type: "bad_action",
      action_config: {},
    },
  );

  assertEquals(invalidAction.success, false);
  assertEquals(
    invalidAction.error,
    "Action invalide. Valides: send_notification, create_task, send_email, update_status, assign_to",
  );
});

Deno.test("executeCreateAutomationRule stocke la règle avec is_active par défaut à true", async () => {
  const { client, calls } = createSupabaseMock({
    insertResults: {
      user_preferences: {
        data: { id: "rule-1" },
        error: null,
      },
    },
  });

  const result = await executeCreateAutomationRule(
    { supabase: client as never, userId: "user-99" },
    {
      name: "Notifier sur nouveaux emails",
      trigger_type: "new_email",
      trigger_config: { mailbox: "support" },
      action_type: "send_notification",
      action_config: { channel: "app" },
    },
  );

  assertEquals(result.success, true);
  assertExists(result.data);

  const data = result.data as Record<string, unknown>;
  const rule = data.rule as Record<string, unknown>;
  assertEquals(rule.id, "rule-1");
  assertEquals(rule.name, "Notifier sur nouveaux emails");
  assertEquals(rule.trigger, "new_email");
  assertEquals(rule.action, "send_notification");
  assertEquals(rule.is_active, true);

  assertEquals(calls.length, 1);
  const insertCall = calls[0];
  assertEquals(insertCall.table, "user_preferences");
  assertEquals(insertCall.operation, "insert");

  const payload = insertCall.values as Record<string, unknown>;
  assertEquals(payload.user_id, "user-99");

  const preferenceKey = payload.preference_key as string;
  assertEquals(preferenceKey.startsWith("automation_rule_"), true);

  const parsed = JSON.parse(String(payload.preference_value));
  assertEquals(parsed.name, "Notifier sur nouveaux emails");
  assertEquals(parsed.trigger.type, "new_email");
  assertEquals(parsed.trigger.config.mailbox, "support");
  assertEquals(parsed.action.type, "send_notification");
  assertEquals(parsed.action.config.channel, "app");
  assertEquals(parsed.is_active, true);
  assertEquals(parsed.created_by, "user-99");
  assertExists(parsed.created_at);
});

Deno.test("executeListAutomationRules parse les règles, ignore le JSON invalide et filtre active_only", async () => {
  const { client, calls } = createSupabaseMock({
    selectResults: {
      user_preferences: {
        data: [
          {
            id: "1",
            preference_value: JSON.stringify({
              name: "Rule 1",
              trigger: { type: "new_email" },
              action: { type: "send_notification" },
              is_active: true,
            }),
          },
          {
            id: "2",
            preference_value: JSON.stringify({
              name: "Rule 2",
              trigger: { type: "task_overdue" },
              action: { type: "create_task" },
              is_active: false,
            }),
          },
          {
            id: "3",
            preference_value: "{invalid-json",
          },
        ],
        error: null,
      },
    },
  });

  const result = await executeListAutomationRules(
    { supabase: client as never, userId: "user-abc" },
    { active_only: true },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  const rules = data.rules as Array<Record<string, unknown>>;

  assertEquals(rules.length, 1);
  assertEquals(rules[0].id, "1");
  assertEquals(rules[0].name, "Rule 1");
  assertEquals(data.count, 1);
  assertEquals(data.active_count, 1);

  assertEquals(calls.length, 1);
  const call = calls[0];
  assertEquals(call.table, "user_preferences");
  assertEquals(call.operation, "select");
  assertEquals(call.selectArg, "*");
  assertEquals(call.eqs, [{ column: "user_id", value: "user-abc" }]);
  assertEquals(call.likes, [{ column: "preference_key", pattern: "automation_rule_%" }]);
});

Deno.test("executeToggleAutomationRule retourne erreur si règle introuvable", async () => {
  const { client } = createSupabaseMock({
    selectResults: {
      user_preferences: {
        data: null,
        error: { message: "not found" },
      },
    },
  });

  const result = await executeToggleAutomationRule(
    { supabase: client as never, userId: "user-1" },
    { rule_id: "missing", is_active: false },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Règle non trouvée");
});

Deno.test("executeToggleAutomationRule met à jour is_active et updated_at", async () => {
  const existingRule = {
    id: "rule-55",
    preference_value: JSON.stringify({
      name: "Weekly digest",
      is_active: true,
      trigger: { type: "time_based" },
      action: { type: "send_email" },
    }),
  };

  const { client, calls } = createSupabaseMock({
    selectResults: {
      user_preferences: {
        data: existingRule,
        error: null,
      },
    },
    updateResults: {
      user_preferences: {
        data: null,
        error: null,
      },
    },
  });

  const result = await executeToggleAutomationRule(
    { supabase: client as never, userId: "user-7" },
    { rule_id: "rule-55", is_active: false },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.rule_id, "rule-55");
  assertEquals(data.is_active, false);
  assertEquals(data.message, 'Règle "Weekly digest" désactivée');

  assertEquals(calls.length, 2);

  const updateCall = calls[1];
  assertEquals(updateCall.table, "user_preferences");
  assertEquals(updateCall.operation, "update");
  assertEquals(updateCall.eqs, [{ column: "id", value: "rule-55" }]);

  const updatedPayload = updateCall.values as Record<string, unknown>;
  const parsed = JSON.parse(String(updatedPayload.preference_value));
  assertEquals(parsed.name, "Weekly digest");
  assertEquals(parsed.is_active, false);
  assertExists(parsed.updated_at);
});

Deno.test("executeCreateScheduledTask calcule next_run pour daily", async () => {
  const { client, calls } = createSupabaseMock({
    insertResults: {
      user_preferences: {
        data: { id: "sched-1" },
        error: null,
      },
    },
  });

  const before = new Date();
  const result = await executeCreateScheduledTask(
    { supabase: client as never, userId: "user-daily" },
    {
      title: "Backup quotidien",
      description: "Créer une tâche de backup",
      schedule: "daily",
      task_template: { priority: "high" },
    },
  );
  const after = new Date();

  assertEquals(result.success, true);

  const call = calls[0];
  const payload = call.values as Record<string, unknown>;
  const parsed = JSON.parse(String(payload.preference_value));
  const nextRun = new Date(parsed.next_run);

  assertEquals(parsed.title, "Backup quotidien");
  assertEquals(parsed.description, "Créer une tâche de backup");
  assertEquals(parsed.schedule, "daily");
  assertEquals(parsed.task_template.priority, "high");
  assertEquals(parsed.is_active, true);
  assertEquals(parsed.last_run, null);
  assertEquals(parsed.run_count, 0);
  assertEquals(nextRun.getHours(), 9);
  assertEquals(nextRun.getMinutes(), 0);

  const minExpected = new Date(before);
  minExpected.setDate(minExpected.getDate() + 1);
  minExpected.setHours(9, 0, 0, 0);

  const maxExpected = new Date(after);
  maxExpected.setDate(maxExpected.getDate() + 1);
  maxExpected.setHours(9, 0, 0, 0);

  assertEquals(nextRun.toISOString() >= minExpected.toISOString(), true);
  assertEquals(nextRun.toISOString() <= maxExpected.toISOString(), true);
});

Deno.test("executeCreateScheduledTask respecte next_run fourni", async () => {
  const { client, calls } = createSupabaseMock({
    insertResults: {
      user_preferences: {
        data: { id: "sched-2" },
        error: null,
      },
    },
  });

  const explicitNextRun = "2030-05-20T15:30:00.000Z";

  const result = await executeCreateScheduledTask(
    { supabase: client as never, userId: "user-manual" },
    {
      title: "Audit manuel",
      schedule: "monthly",
      next_run: explicitNextRun,
    },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  const scheduledTask = data.scheduled_task as Record<string, unknown>;
  assertEquals(scheduledTask.next_run, explicitNextRun);

  const call = calls[0];
  const payload = call.values as Record<string, unknown>;
  const parsed = JSON.parse(String(payload.preference_value));
  assertEquals(parsed.next_run, explicitNextRun);
});

Deno.test("executeGetAutomationStats agrège règles, déclencheurs et rappels", async () => {
  const { client, calls } = createSupabaseMock({
    selectResults: {
      user_preferences: {
        data: [
          {
            id: "r1",
            preference_value: JSON.stringify({
              name: "Rule 1",
              is_active: true,
              trigger: { type: "new_email" },
            }),
          },
          {
            id: "r2",
            preference_value: JSON.stringify({
              name: "Rule 2",
              is_active: false,
              trigger: { type: "new_email" },
            }),
          },
          {
            id: "r3",
            preference_value: JSON.stringify({
              name: "Rule 3",
              is_active: true,
              trigger: { type: "task_overdue" },
            }),
          },
          {
            id: "broken",
            preference_value: "not-json",
          },
        ],
        error: null,
      },
      notifications: {
        data: [
          { id: "n1", metadata: { remind_at: "2030-01-01T09:00:00.000Z" } },
          { id: "n2", metadata: { remind_at: "2030-01-02T09:00:00.000Z" } },
        ],
        error: null,
      },
    },
  });

  const result = await executeGetAutomationStats(
    { supabase: client as never, userId: "user-stats" },
    {},
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.total_rules, 3);
  assertEquals(data.active_rules, 2);
  assertEquals(data.pending_reminders, 2);
  assertEquals(data.automation_health, "configured");
  assertEquals(data.rules_by_trigger, {
    new_email: 2,
    task_overdue: 1,
  });

  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "user_preferences");
  assertEquals(calls[1].table, "notifications");
});

Deno.test("executeGetAutomationStats retourne no_rules sans règles", async () => {
  const { client } = createSupabaseMock({
    selectResults: {
      user_preferences: { data: [], error: null },
      notifications: { data: [], error: null },
    },
  });

  const result = await executeGetAutomationStats(
    { supabase: client as never, userId: "user-empty" },
    {},
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.total_rules, 0);
  assertEquals(data.active_rules, 0);
  assertEquals(data.pending_reminders, 0);
  assertEquals(data.automation_health, "no_rules");
  assertEquals(data.rules_by_trigger, {});
});