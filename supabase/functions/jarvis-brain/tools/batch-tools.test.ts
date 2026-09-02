import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeBatchUpdateTasks,
  executeBatchSendEmails,
  executeBatchCreateTasks,
  executeBatchAssignTasks,
  executeBatchCloseTickets,
  executeBulkEmailClassification,
  executeExportData,
  executeCleanupOldData,
} from "./batch-tools.ts";

function makeCtx(supabase: any, userId = "user-123") {
  return { supabase, userId } as any;
}

Deno.test("executeBatchUpdateTasks returns validation errors without calling database", async () => {
  let dbCalled = false;
  const ctx = makeCtx({
    from() {
      dbCalled = true;
      throw new Error("database should not be called");
    },
  });

  const emptyResult = await executeBatchUpdateTasks(ctx, { task_ids: [], updates: { statut: "Terminé" } });
  assertEquals(emptyResult.success, false);
  assertEquals(emptyResult.error, "task_ids array is required");
  assertExists(emptyResult.execution_time_ms);

  const tooManyResult = await executeBatchUpdateTasks(ctx, {
    task_ids: Array.from({ length: 51 }, (_, i) => `task-${i}`),
    updates: { priorite: "haute" },
  });
  assertEquals(tooManyResult.success, false);
  assertEquals(tooManyResult.error, "Maximum 50 tasks per batch");
  assertEquals(dbCalled, false);
});

Deno.test("executeBatchUpdateTasks updates each task and reports partial failures", async () => {
  const calls: Array<{ table: string; updates: any; column: string; value: string }> = [];
  const ctx = makeCtx({
    from(table: string) {
      return {
        update(updates: any) {
          return {
            eq(column: string, value: string) {
              calls.push({ table, updates, column, value });
              return Promise.resolve({
                error: value === "task-2" ? { message: "task locked" } : null,
              });
            },
          };
        },
      };
    },
  });

  const result = await executeBatchUpdateTasks(ctx, {
    task_ids: ["task-1", "task-2", "task-3"],
    updates: { statut: "En cours", priorite: "haute" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "2/3 tâches mises à jour");
  assertEquals(result.data.total, 3);
  assertEquals(result.data.successful, 2);
  assertEquals(result.data.failed, 1);
  assertEquals(result.data.results, [
    { id: "task-1", success: true, error: undefined },
    { id: "task-2", success: false, error: "task locked" },
    { id: "task-3", success: true, error: undefined },
  ]);
  assertEquals(calls, [
    { table: "taches", updates: { statut: "En cours", priorite: "haute" }, column: "id", value: "task-1" },
    { table: "taches", updates: { statut: "En cours", priorite: "haute" }, column: "id", value: "task-2" },
    { table: "taches", updates: { statut: "En cours", priorite: "haute" }, column: "id", value: "task-3" },
  ]);
  assertExists(result.execution_time_ms);
});

Deno.test("executeBatchSendEmails validates limits and invokes Supabase function with expected payload", async () => {
  const invocations: Array<{ name: string; options: any }> = [];
  const ctx = makeCtx({
    functions: {
      invoke(name: string, options: any) {
        invocations.push({ name, options });
        return Promise.resolve({
          error: options.body.to === "fail@example.test" ? { message: "SMTP unavailable" } : null,
        });
      },
    },
  }, "sender-456");

  const tooManyResult = await executeBatchSendEmails(ctx, {
    emails: Array.from({ length: 21 }, (_, i) => ({
      to: `user-${i}@example.test`,
      subject: "Sujet",
      body: "<p>Message</p>",
    })),
  });
  assertEquals(tooManyResult.success, false);
  assertEquals(tooManyResult.error, "Maximum 20 emails per batch");
  assertEquals(invocations.length, 0);

  const result = await executeBatchSendEmails(ctx, {
    emails: [
      { to: "ok@example.test", subject: "Bonjour", body: "<strong>OK</strong>" },
      { to: "fail@example.test", subject: "Erreur", body: "<strong>KO</strong>" },
    ],
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "1/2 emails envoyés");
  assertEquals(result.data.total, 2);
  assertEquals(result.data.successful, 1);
  assertEquals(result.data.failed, 1);
  assertEquals(result.data.results, [
    { to: "ok@example.test", success: true, error: undefined },
    { to: "fail@example.test", success: false, error: "SMTP unavailable" },
  ]);
  assertEquals(invocations, [
    {
      name: "send-email",
      options: {
        body: {
          to: "ok@example.test",
          subject: "Bonjour",
          html_body: "<strong>OK</strong>",
          user_id: "sender-456",
        },
      },
    },
    {
      name: "send-email",
      options: {
        body: {
          to: "fail@example.test",
          subject: "Erreur",
          html_body: "<strong>KO</strong>",
          user_id: "sender-456",
        },
      },
    },
  ]);
});

Deno.test("executeBatchCreateTasks maps input tasks to insert payload with defaults", async () => {
  let insertedRows: any[] | undefined;
  let selectedColumns: string | undefined;

  const ctx = makeCtx({
    from(table: string) {
      assertEquals(table, "taches");
      return {
        insert(rows: any[]) {
          insertedRows = rows;
          return {
            select(columns: string) {
              selectedColumns = columns;
              return Promise.resolve({
                data: [
                  { id: "created-1", titre: "Appeler client" },
                  { id: "created-2", titre: "Préparer devis" },
                ],
                error: null,
              });
            },
          };
        },
      };
    },
  }, "creator-789");

  const result = await executeBatchCreateTasks(ctx, {
    tasks: [
      {
        titre: "Appeler client",
        description: "Relance commerciale",
        etablissement_id: "etab-1",
        date_echeance: "2026-01-15",
      },
      {
        titre: "Préparer devis",
        priorite: "haute",
      },
    ],
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "2 tâches créées");
  assertEquals(result.data.total, 2);
  assertEquals(result.data.tasks, [
    { id: "created-1", titre: "Appeler client" },
    { id: "created-2", titre: "Préparer devis" },
  ]);
  assertEquals(selectedColumns, "id, titre");
  assertEquals(insertedRows, [
    {
      titre: "Appeler client",
      description: "Relance commerciale",
      priorite: "moyenne",
      etablissement_id: "etab-1",
      echeance: "2026-01-15",
      statut: "A faire",
      responsable_id: "creator-789",
      created_by: "creator-789",
    },
    {
      titre: "Préparer devis",
      description: undefined,
      priorite: "haute",
      etablissement_id: undefined,
      echeance: undefined,
      statut: "A faire",
      responsable_id: "creator-789",
      created_by: "creator-789",
    },
  ]);
});

Deno.test("executeBatchCreateTasks returns insert error from database", async () => {
  const ctx = makeCtx({
    from() {
      return {
        insert() {
          return {
            select() {
              return Promise.resolve({
                data: null,
                error: new Error("insert denied"),
              });
            },
          };
        },
      };
    },
  });

  const result = await executeBatchCreateTasks(ctx, {
    tasks: [{ titre: "Tâche impossible" }],
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "insert denied");
});

Deno.test("executeBatchAssignTasks validates assignee and updates selected tasks", async () => {
  const updates: any[] = [];

  const ctx = makeCtx({
    from(table: string) {
      if (table === "profiles") {
        return {
          select(columns: string) {
            assertEquals(columns, "id, nom, prenom");
            return {
              eq(column: string, value: string) {
                assertEquals(column, "id");
                assertEquals(value, "assignee-1");
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: "assignee-1", nom: "Dupont", prenom: "Alice" },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      assertEquals(table, "taches");
      return {
        update(payload: any) {
          return {
            in(column: string, values: string[]) {
              updates.push({ payload, column, values });
              return Promise.resolve({ error: null, count: values.length });
            },
          };
        },
      };
    },
  });

  const result = await executeBatchAssignTasks(ctx, {
    task_ids: ["task-a", "task-b"],
    assignee_id: "assignee-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "2 tâches assignées à Alice Dupont");
  assertEquals(result.data.assignee, { id: "assignee-1", name: "Alice Dupont" });
  assertEquals(result.data.task_count, 2);
  assertEquals(updates, [
    {
      payload: { responsable_id: "assignee-1" },
      column: "id",
      values: ["task-a", "task-b"],
    },
  ]);
});

Deno.test("executeBatchAssignTasks returns explicit error when assignee is missing", async () => {
  const ctx = makeCtx({
    from(table: string) {
      assertEquals(table, "profiles");
      return {
        select() {
          return {
            eq() {
              return {
                single() {
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
          };
        },
      };
    },
  });

  const result = await executeBatchAssignTasks(ctx, {
    task_ids: ["task-a"],
    assignee_id: "missing-user",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Assignee not found");
});

Deno.test("executeBatchCloseTickets closes tickets with default resolution note", async () => {
  let updatePayload: any;
  let inFilter: any;

  const ctx = makeCtx({
    from(table: string) {
      assertEquals(table, "support_tickets");
      return {
        update(payload: any) {
          updatePayload = payload;
          return {
            in(column: string, values: string[]) {
              inFilter = { column, values };
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  }, "resolver-123");

  const result = await executeBatchCloseTickets(ctx, {
    ticket_ids: ["ticket-1", "ticket-2", "ticket-3"],
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "3 tickets fermés");
  assertEquals(result.data.ticket_count, 3);
  assertEquals(updatePayload.status, "closed");
  assertEquals(updatePayload.resolved_by, "resolver-123");
  assertEquals(updatePayload.resolution_note, "Fermé en masse");
  assertExists(updatePayload.resolved_at);
  assertEquals(inFilter, { column: "id", values: ["ticket-1", "ticket-2", "ticket-3"] });
});

Deno.test("executeBulkEmailClassification validates required updates and applies provided fields", async () => {
  let dbCalled = false;
  const invalidCtx = makeCtx({
    from() {
      dbCalled = true;
      throw new Error("database should not be called");
    },
  });

  const invalidResult = await executeBulkEmailClassification(invalidCtx, {
    thread_ids: ["thread-1"],
  });
  assertEquals(invalidResult.success, false);
  assertEquals(invalidResult.error, "At least one of etablissement_id or category required");
  assertEquals(dbCalled, false);

  let updatePayload: any;
  let inFilter: any;
  const ctx = makeCtx({
    from(table: string) {
      assertEquals(table, "email_threads");
      return {
        update(payload: any) {
          updatePayload = payload;
          return {
            in(column: string, values: string[]) {
              inFilter = { column, values };
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  });

  const result = await executeBulkEmailClassification(ctx, {
    thread_ids: ["thread-1", "thread-2"],
    etablissement_id: "etab-42",
    category: "facturation",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "2 threads classifiés");
  assertEquals(result.data.thread_count, 2);
  assertEquals(result.data.updates_applied, {
    etablissement_id: "etab-42",
    category: "facturation",
  });
  assertEquals(updatePayload, {
    etablissement_id: "etab-42",
    category: "facturation",
  });
  assertEquals(inFilter, { column: "id", values: ["thread-1", "thread-2"] });
});

Deno.test("executeExportData rejects forbidden tables before building query", async () => {
  let dbCalled = false;
  const ctx = makeCtx({
    from() {
      dbCalled = true;
      throw new Error("database should not be called");
    },
  });

  const result = await executeExportData(ctx, {
    table: "profiles",
  });

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Table 'profiles' not allowed for export. Allowed: etablissements, contacts, taches, factures, support_tickets",
  );
  assertEquals(dbCalled, false);
});

Deno.test("executeExportData applies supported filters and limits export to 1000 rows", async () => {
  const filters: any[] = [];
  let selectedTable: string | undefined;
  let selectedColumns: string | undefined;
  let requestedLimit: number | undefined;

  const records = [
    { id: "task-1", statut: "A faire", priorite: "haute" },
    { id: "task-2", statut: "A faire", priorite: "moyenne" },
  ];

  const query = {
    select(columns: string) {
      selectedColumns = columns;
      return query;
    },
    eq(column: string, value: string) {
      filters.push({ operator: "eq", column, value });
      return query;
    },
    neq(column: string, value: string) {
      filters.push({ operator: "neq", column, value });
      return query;
    },
    gt(column: string, value: string) {
      filters.push({ operator: "gt", column, value });
      return query;
    },
    lt(column: string, value: string) {
      filters.push({ operator: "lt", column, value });
      return query;
    },
    gte(column: string, value: string) {
      filters.push({ operator: "gte", column, value });
      return query;
    },
    lte(column: string, value: string) {
      filters.push({ operator: "lte", column, value });
      return query;
    },
    ilike(column: string, value: string) {
      filters.push({ operator: "ilike", column, value });
      return query;
    },
    limit(limit: number) {
      requestedLimit = limit;
      return Promise.resolve({ data: records, error: null });
    },
  };

  const ctx = makeCtx({
    from(table: string) {
      selectedTable = table;
      return query;
    },
  });

  const result = await executeExportData(ctx, {
    table: "taches",
    format: "json",
    filters: [
      { column: "statut", operator: "eq", value: "A faire" },
      { column: "priorite", operator: "neq", value: "basse" },
      { column: "score", operator: "gt", value: "10" },
      { column: "created_at", operator: "lt", value: "2026-01-01" },
      { column: "updated_at", operator: "gte", value: "2025-01-01" },
      { column: "echeance", operator: "lte", value: "2026-12-31" },
      { column: "titre", operator: "ilike", value: "client" },
    ],
  });

  assertEquals(result.success, true);
  assertEquals(selectedTable, "taches");
  assertEquals(selectedColumns, "*");
  assertEquals(requestedLimit, 1000);
  assertEquals(filters, [
    { operator: "eq", column: "statut", value: "A faire" },
    { operator: "neq", column: "priorite", value: "basse" },
    { operator: "gt", column: "score", value: "10" },
    { operator: "lt", column: "created_at", value: "2026-01-01" },
    { operator: "gte", column: "updated_at", value: "2025-01-01" },
    { operator: "lte", column: "echeance", value: "2026-12-31" },
    { operator: "ilike", column: "titre", value: "%client%" },
  ]);
  assertEquals(result.data.table, "taches");
  assertEquals(result.data.record_count, 2);
  assertEquals(result.data.format, "json");
  assertEquals(result.data.records, records);
  assertExists(result.data.exported_at);
});

Deno.test("executeCleanupOldData deletes read notifications older than cutoff", async () => {
  const operations: any[] = [];

  const ctx = makeCtx({
    from(table: string) {
      operations.push({ step: "from", table });
      return {
        delete() {
          operations.push({ step: "delete" });
          return {
            lt(column: string, value: string) {
              operations.push({ step: "lt", column, value });
              return {
                eq(column2: string, value2: boolean) {
                  operations.push({ step: "eq", column: column2, value: value2 });
                  return Promise.resolve({ count: 7, error: null });
                },
              };
            },
          };
        },
      };
    },
  });

  const result = await executeCleanupOldData(ctx, {
    data_type: "notifications",
    days_old: 30,
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Nettoyage terminé: 7 entrées supprimées");
  assertEquals(result.data.data_type, "notifications");
  assertEquals(result.data.deleted_count, 7);
  assertExists(result.data.cutoff_date);
  assertEquals(operations[0], { step: "from", table: "notifications" });
  assertEquals(operations[1], { step: "delete" });
  assertEquals(operations[2].step, "lt");
  assertEquals(operations[2].column, "created_at");
  assertEquals(operations[3], { step: "eq", column: "read", value: true });
});

Deno.test("executeCleanupOldData clears email sync errors through chained update query", async () => {
  const operations: any[] = [];

  const ctx = makeCtx({
    from(table: string) {
      operations.push({ step: "from", table });
      return {
        update(payload: any) {
          operations.push({ step: "update", payload });
          return {
            is(column: string, value: unknown) {
              operations.push({ step: "is", column, value });
              return {
                not(column2: string, operator: string, value2: unknown) {
                  operations.push({ step: "not", column: column2, operator, value: value2 });
                  return Promise.resolve({ count: 4, error: null });
                },
              };
            },
          };
        },
      };
    },
  });

  const result = await executeCleanupOldData(ctx, {
    data_type: "email_sync_errors",
    days_old: 10,
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Nettoyage terminé: 4 entrées supprimées");
  assertEquals(result.data.data_type, "email_sync_errors");
  assertEquals(result.data.deleted_count, 4);
  assertEquals(operations, [
    { step: "from", table: "user_email_accounts" },
    { step: "update", payload: { sync_error: null } },
    { step: "is", column: "sync_error", value: null },
    { step: "not", column: "id", operator: "is", value: null },
  ]);
});