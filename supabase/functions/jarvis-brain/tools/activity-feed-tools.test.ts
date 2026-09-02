import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeGetActivityFeed, executePinActivityEvent } from "./activity-feed-tools.ts";

function createRpcSupabaseStub(result: {
  data?: unknown;
  error?: unknown;
}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        return Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
        });
      },
    },
  };
}

function createPinSupabaseStub(options?: {
  deleteError?: unknown;
  upsertError?: unknown;
  upsertData?: unknown;
}) {
  const state = {
    fromTable: "",
    deleteEqCalls: [] as Array<{ column: string; value: unknown }>,
    upsertArgs: undefined as unknown,
    upsertOptions: undefined as unknown,
    selectCalled: false,
    singleCalled: false,
  };

  const deleteChain = {
    eq(column: string, value: unknown) {
      state.deleteEqCalls.push({ column, value });
      if (state.deleteEqCalls.length >= 2) {
        return Promise.resolve({ error: options?.deleteError ?? null });
      }
      return deleteChain;
    },
  };

  const upsertChain = {
    select() {
      state.selectCalled = true;
      return {
        single() {
          state.singleCalled = true;
          return Promise.resolve({
            data: options?.upsertData ?? null,
            error: options?.upsertError ?? null,
          });
        },
      };
    },
  };

  const client = {
    from(table: string) {
      state.fromTable = table;
      return {
        delete() {
          return deleteChain;
        },
        upsert(payload: unknown, upsertOptions: unknown) {
          state.upsertArgs = payload;
          state.upsertOptions = upsertOptions;
          return upsertChain;
        },
      };
    },
  };

  return { client, state };
}

Deno.test("executeGetActivityFeed appelle le RPC avec filtres et limite plafonnée à 100", async () => {
  const rpc = createRpcSupabaseStub({
    data: [
      { type: "appointment", occurred_at: "2024-01-03T10:00:00.000Z" },
      { type: "message", occurred_at: "2024-01-02T10:00:00.000Z" },
      { type: "appointment", occurred_at: "2024-01-01T10:00:00.000Z" },
    ],
  });

  const result = await executeGetActivityFeed(
    {
      supabase: rpc.client as never,
      userId: "user-1",
    },
    {
      limit: 150,
      cursor: "2024-01-04T00:00:00.000Z",
      types: ["appointment", "message"],
      user_ids: ["u1", "u2"],
      etablissement_ids: ["e1"],
      date_from: "2024-01-01",
      date_to: "2024-01-31",
      search: "dupont",
    },
  );

  assertEquals(rpc.calls.length, 1);
  assertEquals(rpc.calls[0].fn, "get_global_activity_feed");
  assertEquals(rpc.calls[0].args, {
    p_limit: 100,
    p_cursor: "2024-01-04T00:00:00.000Z",
    p_filters: {
      types: ["appointment", "message"],
      user_ids: ["u1", "u2"],
      etablissement_ids: ["e1"],
      date_from: "2024-01-01",
      date_to: "2024-01-31",
      search: "dupont",
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.count, 3);
  assertEquals(result.data?.items, [
    { type: "appointment", occurred_at: "2024-01-03T10:00:00.000Z" },
    { type: "message", occurred_at: "2024-01-02T10:00:00.000Z" },
    { type: "appointment", occurred_at: "2024-01-01T10:00:00.000Z" },
  ]);
  assertEquals(result.data?.by_type, {
    appointment: 2,
    message: 1,
  });
  assertEquals(result.data?.next_cursor, null);
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetActivityFeed construit un filtre vide quand aucun argument optionnel n'est fourni", async () => {
  const rpc = createRpcSupabaseStub({
    data: [],
  });

  const result = await executeGetActivityFeed(
    {
      supabase: rpc.client as never,
      userId: "user-1",
    },
    {},
  );

  assertEquals(rpc.calls.length, 1);
  assertEquals(rpc.calls[0].args, {
    p_limit: 30,
    p_cursor: null,
    p_filters: {},
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.items, []);
  assertEquals(result.data?.count, 0);
  assertEquals(result.data?.by_type, {});
  assertEquals(result.data?.next_cursor, null);
});

Deno.test("executeGetActivityFeed calcule next_cursor quand le nombre d'éléments égale la limite demandée", async () => {
  const rpc = createRpcSupabaseStub({
    data: [
      { type: "task", occurred_at: "2024-02-02T10:00:00.000Z" },
      { type: "task", occurred_at: "2024-02-01T10:00:00.000Z" },
    ],
  });

  const result = await executeGetActivityFeed(
    {
      supabase: rpc.client as never,
      userId: "user-1",
    },
    { limit: 2 },
  );

  assertEquals(result.success, true);
  assertEquals(result.data?.count, 2);
  assertEquals(result.data?.next_cursor, "2024-02-01T10:00:00.000Z");
  assertEquals(result.data?.by_type, { task: 2 });
});

Deno.test("executeGetActivityFeed retourne success false quand le RPC renvoie une erreur", async () => {
  const rpc = createRpcSupabaseStub({
    error: new Error("rpc failed"),
  });

  const result = await executeGetActivityFeed(
    {
      supabase: rpc.client as never,
      userId: "user-1",
    },
    { limit: 10 },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "rpc failed");
  assertExists(result.execution_time_ms);
});

Deno.test("executePinActivityEvent refuse un activity_key vide", async () => {
  const supabase = createPinSupabaseStub();

  const result = await executePinActivityEvent(
    {
      supabase: supabase.client as never,
      userId: "user-42",
    },
    { activity_key: "", action: "pin" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "activity_key requis");
});

Deno.test("executePinActivityEvent désépingle un événement avec les bons filtres", async () => {
  const supabase = createPinSupabaseStub();

  const result = await executePinActivityEvent(
    {
      supabase: supabase.client as never,
      userId: "user-42",
    },
    { activity_key: "evt-123", action: "unpin" },
  );

  assertEquals(supabase.state.fromTable, "activity_feed_pins");
  assertEquals(supabase.state.deleteEqCalls, [
    { column: "user_id", value: "user-42" },
    { column: "activity_key", value: "evt-123" },
  ]);

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Événement désépinglé" });
  assertExists(result.execution_time_ms);
});

Deno.test("executePinActivityEvent retourne une erreur si le delete échoue", async () => {
  const supabase = createPinSupabaseStub({
    deleteError: new Error("delete failed"),
  });

  const result = await executePinActivityEvent(
    {
      supabase: supabase.client as never,
      userId: "user-42",
    },
    { activity_key: "evt-123", action: "unpin" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "delete failed");
});

Deno.test("executePinActivityEvent épingle un événement avec note et onConflict attendu", async () => {
  const supabase = createPinSupabaseStub({
    upsertData: {
      id: 1,
      user_id: "user-42",
      activity_key: "evt-555",
      note: "À suivre",
    },
  });

  const result = await executePinActivityEvent(
    {
      supabase: supabase.client as never,
      userId: "user-42",
    },
    { activity_key: "evt-555", action: "pin", note: "À suivre" },
  );

  assertEquals(supabase.state.fromTable, "activity_feed_pins");
  assertEquals(supabase.state.upsertOptions, { onConflict: "user_id,activity_key" });
  assertEquals(supabase.state.selectCalled, true);
  assertEquals(supabase.state.singleCalled, true);

  const payload = supabase.state.upsertArgs as Record<string, unknown>;
  assertEquals(payload.user_id, "user-42");
  assertEquals(payload.activity_key, "evt-555");
  assertEquals(payload.note, "À suivre");
  assertExists(payload.pinned_at);

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Événement épinglé",
    pin: {
      id: 1,
      user_id: "user-42",
      activity_key: "evt-555",
      note: "À suivre",
    },
  });
});

Deno.test("executePinActivityEvent convertit une note absente en null", async () => {
  const supabase = createPinSupabaseStub({
    upsertData: {
      id: 2,
      user_id: "user-42",
      activity_key: "evt-777",
      note: null,
    },
  });

  const result = await executePinActivityEvent(
    {
      supabase: supabase.client as never,
      userId: "user-42",
    },
    { activity_key: "evt-777", action: "pin" },
  );

  const payload = supabase.state.upsertArgs as Record<string, unknown>;
  assertEquals(payload.note, null);
  assertEquals(result.success, true);
  assertEquals(result.data?.pin, {
    id: 2,
    user_id: "user-42",
    activity_key: "evt-777",
    note: null,
  });
});

Deno.test("executePinActivityEvent retourne une erreur si le upsert échoue", async () => {
  const supabase = createPinSupabaseStub({
    upsertError: new Error("upsert failed"),
  });

  const result = await executePinActivityEvent(
    {
      supabase: supabase.client as never,
      userId: "user-42",
    },
    { activity_key: "evt-999", action: "pin" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "upsert failed");
});

Deno.test("sanity: les helpers de test sont utilisables", async () => {
  assertThrows(() => {
    throw new Error("boom");
  }, Error, "boom");

  await assertRejects(
    async () => {
      throw new Error("async boom");
    },
    Error,
    "async boom",
  );
});