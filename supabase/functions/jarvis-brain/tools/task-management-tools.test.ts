import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeUpdateTask,
  executeDeleteTask,
  executeManageSubtask,
  executeLogTimeEntry,
  executeManageTaskRecurrence,
} from "./task-management-tools.ts";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const USER_ID = "999e4567-e89b-12d3-a456-426614174999";

function createSupabaseStub(config: {
  responses?: Record<string, { data?: unknown; error?: unknown }>;
  throwOn?: string[];
} = {}) {
  const calls: Array<{
    table: string;
    operation: string;
    values?: unknown;
    column?: string;
    value?: unknown;
    fields?: unknown;
    options?: unknown;
  }> = [];

  const responses = config.responses ?? {};
  const throwOn = new Set(config.throwOn ?? []);

  function key(table: string, operation: string) {
    return `${table}:${operation}`;
  }

  function resultFor(table: string, operation: string) {
    return responses[key(table, operation)] ?? { data: null, error: null };
  }

  function makeBuilder(table: string) {
    const state = {
      table,
      operation: "",
      payload: undefined as unknown,
      filters: [] as Array<{ column: string; value: unknown }>,
      orderBy: undefined as unknown,
      limitValue: undefined as unknown,
      selectFields: undefined as unknown,
      singleMode: false,
    };

    const builder: Record<string, unknown> = {
      select(fields?: unknown) {
        state.selectFields = fields;
        calls.push({ table, operation: "select", fields });
        state.operation = state.operation || "select";
        return builder;
      },
      update(values: unknown) {
        state.operation = "update";
        state.payload = values;
        calls.push({ table, operation: "update", values });
        return builder;
      },
      insert(values: unknown) {
        state.operation = "insert";
        state.payload = values;
        calls.push({ table, operation: "insert", values });
        return builder;
      },
      delete() {
        state.operation = "delete";
        calls.push({ table, operation: "delete" });
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push({ column, value });
        calls.push({ table, operation: "eq", column, value });
        return builder;
      },
      order(column: string, options?: unknown) {
        state.orderBy = { column, options };
        calls.push({ table, operation: "order", column, options });
        return builder;
      },
      limit(value: number) {
        state.limitValue = value;
        calls.push({ table, operation: "limit", value });
        return builder;
      },
      single() {
        state.singleMode = true;
        calls.push({ table, operation: "single" });
        if (throwOn.has(key(table, state.operation || "select"))) {
          return Promise.reject(new Error(`forced throw ${table}:${state.operation || "select"}`));
        }
        const res = resultFor(table, state.operation || "select");
        return Promise.resolve({ data: res.data ?? null, error: res.error ?? null });
      },
      then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        if (throwOn.has(key(table, state.operation || "select"))) {
          return Promise.reject(new Error(`forced throw ${table}:${state.operation || "select"}`)).then(onFulfilled, onRejected);
        }
        const res = resultFor(table, state.operation || "select");
        return Promise.resolve({ data: res.data ?? null, error: res.error ?? null }).then(onFulfilled, onRejected);
      },
      catch(onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve().catch(onRejected);
      },
    };

    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ table, operation: "from" });
      return makeBuilder(table);
    },
  };

  return { supabase, calls };
}

function createCtx(stub: { supabase: unknown }) {
  return { supabase: stub.supabase as never, userId: USER_ID };
}

Deno.test("executeUpdateTask met à jour une tâche avec UUID valide et retourne un message métier", async () => {
  const stub = createSupabaseStub({
    responses: {
      "taches:update": {
        data: { id: VALID_UUID, titre: "Préparer le rapport", statut: "done" },
      },
    },
  });

  const result = await executeUpdateTask(createCtx(stub), {
    task_id: VALID_UUID,
    data: { statut: "done" },
  });

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals((result.data as Record<string, unknown>).message, 'Tâche "Préparer le rapport" mise à jour');
  assertEquals(((result.data as Record<string, unknown>).task as Record<string, unknown>).statut, "done");

  const updateCall = stub.calls.find((c) => c.table === "taches" && c.operation === "update");
  assertExists(updateCall);
  assertEquals(updateCall.values, { statut: "done" });

  const eqCall = stub.calls.find((c) => c.table === "taches" && c.operation === "eq");
  assertExists(eqCall);
  assertEquals(eqCall.column, "id");
  assertEquals(eqCall.value, VALID_UUID);
});

Deno.test("executeUpdateTask retourne une erreur si task_id est invalide", async () => {
  const stub = createSupabaseStub();

  const result = await executeUpdateTask(createCtx(stub), {
    task_id: "not-a-uuid",
    data: { titre: "X" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, 'task_id invalide ou manquant: "not-a-uuid"');
});

Deno.test("executeUpdateTask retourne une erreur si aucune donnée de mise à jour n'est fournie", async () => {
  const stub = createSupabaseStub();

  const result = await executeUpdateTask(createCtx(stub), {
    task_id: VALID_UUID,
    data: {},
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Aucune donnée de mise à jour fournie");
});

Deno.test("executeDeleteTask supprime une tâche après lecture de son titre", async () => {
  const stub = createSupabaseStub({
    responses: {
      "taches:select": { data: { titre: "Tâche critique" } },
      "taches:delete": { data: null, error: null },
    },
  });

  const result = await executeDeleteTask(createCtx(stub), {
    task_id: VALID_UUID,
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, 'Tâche "Tâche critique" supprimée');

  const deleteCall = stub.calls.find((c) => c.table === "taches" && c.operation === "delete");
  assertExists(deleteCall);
});

Deno.test("executeDeleteTask utilise l'id si le titre n'existe pas", async () => {
  const stub = createSupabaseStub({
    responses: {
      "taches:select": { data: null },
      "taches:delete": { data: null, error: null },
    },
  });

  const result = await executeDeleteTask(createCtx(stub), {
    task_id: VALID_UUID,
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, `Tâche "${VALID_UUID}" supprimée`);
});

Deno.test("executeManageSubtask list retourne les sous-tâches triées et le count", async () => {
  const subtasks = [
    { id: "s1", titre: "A", ordre: 1 },
    { id: "s2", titre: "B", ordre: 2 },
  ];
  const stub = createSupabaseStub({
    responses: {
      "tache_sous_taches:select": { data: subtasks },
    },
  });

  const result = await executeManageSubtask(createCtx(stub), {
    action: "list",
    task_id: VALID_UUID,
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).count, 2);
  assertEquals((result.data as Record<string, unknown>).subtasks, subtasks);

  const orderCall = stub.calls.find((c) => c.table === "tache_sous_taches" && c.operation === "order");
  assertExists(orderCall);
  assertEquals(orderCall.column, "ordre");
  assertEquals(orderCall.options, { ascending: true });
});

Deno.test("executeManageSubtask create insère la sous-tâche avec tache_id fusionné", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_sous_taches:insert": {
        data: { id: "sub-1", tache_id: VALID_UUID, titre: "Relire", ordre: 3 },
      },
    },
  });

  const result = await executeManageSubtask(createCtx(stub), {
    action: "create",
    task_id: VALID_UUID,
    data: { titre: "Relire", ordre: 3 },
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Sous-tâche créée");

  const insertCall = stub.calls.find((c) => c.table === "tache_sous_taches" && c.operation === "insert");
  assertExists(insertCall);
  assertEquals(insertCall.values, { tache_id: VALID_UUID, titre: "Relire", ordre: 3 });
});

Deno.test("executeManageSubtask update met à jour une sous-tâche", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_sous_taches:update": {
        data: { id: "sub-2", titre: "Corrigée", completed: true },
      },
    },
  });

  const result = await executeManageSubtask(createCtx(stub), {
    action: "update",
    subtask_id: "sub-2",
    data: { completed: true },
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Sous-tâche mise à jour");
  assertEquals((((result.data as Record<string, unknown>).subtask) as Record<string, unknown>).completed, true);
});

Deno.test("executeManageSubtask delete supprime une sous-tâche", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_sous_taches:delete": { data: null, error: null },
    },
  });

  const result = await executeManageSubtask(createCtx(stub), {
    action: "delete",
    subtask_id: "sub-3",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Sous-tâche supprimée");
});

Deno.test("executeManageSubtask retourne une erreur claire si task_id manquant pour list", async () => {
  const stub = createSupabaseStub();

  const result = await executeManageSubtask(createCtx(stub), {
    action: "list",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "task_id required");
});

Deno.test("executeManageSubtask retourne un message not implemented pour action inconnue", async () => {
  const stub = createSupabaseStub();

  const result = await executeManageSubtask(createCtx(stub), {
    action: "archive",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Action archive not implemented");
});

Deno.test("executeLogTimeEntry insère une entrée de temps avec user_id et date explicite", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_time_entries:insert": {
        data: {
          id: "te-1",
          tache_id: VALID_UUID,
          user_id: USER_ID,
          duration_minutes: 45,
          description: "Analyse",
          date: "2025-02-03",
        },
      },
    },
  });

  const result = await executeLogTimeEntry(createCtx(stub), {
    task_id: VALID_UUID,
    duration_minutes: 45,
    description: "Analyse",
    date: "2025-02-03",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "45 min enregistrées");

  const insertCall = stub.calls.find((c) => c.table === "tache_time_entries" && c.operation === "insert");
  assertExists(insertCall);
  assertEquals(insertCall.values, {
    tache_id: VALID_UUID,
    user_id: USER_ID,
    duration_minutes: 45,
    description: "Analyse",
    date: "2025-02-03",
  });
});

Deno.test("executeLogTimeEntry utilise la date du jour si absente", async () => {
  const realDate = Date;
  class FakeDate extends Date {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super("2026-01-15T10:20:30.000Z");
      } else {
        super(...args);
      }
    }
    static override now() {
      return new realDate("2026-01-15T10:20:30.000Z").getTime();
    }
  }
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Date = FakeDate;

  try {
    const stub = createSupabaseStub({
      responses: {
        "tache_time_entries:insert": {
          data: { id: "te-2", date: "2026-01-15" },
        },
      },
    });

    const result = await executeLogTimeEntry(createCtx(stub), {
      task_id: VALID_UUID,
      duration_minutes: 15,
    });

    assertEquals(result.success, true);

    const insertCall = stub.calls.find((c) => c.table === "tache_time_entries" && c.operation === "insert");
    assertExists(insertCall);
    assertEquals(insertCall.values, {
      tache_id: VALID_UUID,
      user_id: USER_ID,
      duration_minutes: 15,
      description: undefined,
      date: "2026-01-15",
    });
  } finally {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).Date = realDate;
  }
});

Deno.test("executeManageTaskRecurrence create ajoute created_by", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_recurrences:insert": {
        data: { id: "rec-1", tache_id: VALID_UUID, frequence: "weekly", created_by: USER_ID },
      },
    },
  });

  const result = await executeManageTaskRecurrence(createCtx(stub), {
    action: "create",
    task_id: VALID_UUID,
    data: { frequence: "weekly", interval: 1 },
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Récurrence créée");

  const insertCall = stub.calls.find((c) => c.table === "tache_recurrences" && c.operation === "insert");
  assertExists(insertCall);
  assertEquals(insertCall.values, {
    tache_id: VALID_UUID,
    frequence: "weekly",
    interval: 1,
    created_by: USER_ID,
  });
});

Deno.test("executeManageTaskRecurrence delete supprime une récurrence", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_recurrences:delete": { data: null, error: null },
    },
  });

  const result = await executeManageTaskRecurrence(createCtx(stub), {
    action: "delete",
    recurrence_id: "rec-2",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Récurrence supprimée");
});

Deno.test("executeManageTaskRecurrence list avec task_id applique filtre, tri desc et limite 50", async () => {
  const recurrences = [
    { id: "r2", tache_id: VALID_UUID },
    { id: "r1", tache_id: VALID_UUID },
  ];
  const stub = createSupabaseStub({
    responses: {
      "tache_recurrences:select": { data: recurrences },
    },
  });

  const result = await executeManageTaskRecurrence(createCtx(stub), {
    action: "list",
    task_id: VALID_UUID,
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).count, 2);
  assertEquals((result.data as Record<string, unknown>).recurrences, recurrences);

  const eqCall = stub.calls.find((c) => c.table === "tache_recurrences" && c.operation === "eq");
  assertExists(eqCall);
  assertEquals(eqCall.column, "tache_id");
  assertEquals(eqCall.value, VALID_UUID);

  const orderCall = stub.calls.find((c) => c.table === "tache_recurrences" && c.operation === "order");
  assertExists(orderCall);
  assertEquals(orderCall.column, "created_at");
  assertEquals(orderCall.options, { ascending: false });

  const limitCall = stub.calls.find((c) => c.table === "tache_recurrences" && c.operation === "limit");
  assertExists(limitCall);
  assertEquals(limitCall.value, 50);
});

Deno.test("executeManageTaskRecurrence list sans task_id ne filtre pas par tache_id", async () => {
  const stub = createSupabaseStub({
    responses: {
      "tache_recurrences:select": { data: [] },
    },
  });

  const result = await executeManageTaskRecurrence(createCtx(stub), {
    action: "list",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).count, 0);

  const eqCall = stub.calls.find((c) => c.table === "tache_recurrences" && c.operation === "eq");
  assertEquals(eqCall, undefined);
});

Deno.test("executeManageTaskRecurrence retourne une erreur si recurrence_id manquant pour delete", async () => {
  const stub = createSupabaseStub();

  const result = await executeManageTaskRecurrence(createCtx(stub), {
    action: "delete",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "recurrence_id required");
});

Deno.test("executeManageTaskRecurrence retourne not implemented pour action inconnue", async () => {
  const stub = createSupabaseStub();

  const result = await executeManageTaskRecurrence(createCtx(stub), {
    action: "pause",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Action pause not implemented");
});

Deno.test("le module expose des fonctions importées testables", () => {
  assertExists(executeUpdateTask);
  assertExists(executeDeleteTask);
  assertExists(executeManageSubtask);
  assertExists(executeLogTimeEntry);
  assertExists(executeManageTaskRecurrence);
  assertThrows(() => {
    throw new Error("probe");
  }, Error, "probe");
});

Deno.test("assert helpers importés sont disponibles en contexte de test", async () => {
  await assertRejects(
    async () => {
      throw new Error("expected");
    },
    Error,
    "expected",
  );
});