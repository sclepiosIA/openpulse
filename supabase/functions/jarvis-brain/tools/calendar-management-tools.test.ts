import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeDeleteCalendarEvent,
  executeManageBooking,
  executeManageEventAttendees,
  executeManageEventReminder,
  executeUpdateCalendarEvent,
} from "./calendar-management-tools.ts";

type QueueItem = { data?: unknown; error?: unknown };

function createSupabaseStub(queue: QueueItem[] = []) {
  const calls: Array<{
    table: string;
    operation: string;
    payload?: unknown;
    filters: Array<{ type: string; column?: string; value?: unknown; options?: unknown }>;
  }> = [];

  function nextResult() {
    const item = queue.shift() ?? {};
    return Promise.resolve({
      data: item.data ?? null,
      error: item.error ?? null,
    });
  }

  function builder(table: string, operation = "select", payload?: unknown) {
    const call = {
      table,
      operation,
      payload,
      filters: [] as Array<{ type: string; column?: string; value?: unknown; options?: unknown }>,
    };
    calls.push(call);

    const chain = {
      select(selection?: string) {
        call.operation = call.operation === "insert" || call.operation === "update" ? call.operation : "select";
        call.filters.push({ type: "select", value: selection });
        return chain;
      },
      update(data: unknown) {
        call.operation = "update";
        call.payload = data;
        return chain;
      },
      insert(data: unknown) {
        call.operation = "insert";
        call.payload = data;
        return chain;
      },
      delete() {
        call.operation = "delete";
        return chain;
      },
      eq(column: string, value: unknown) {
        call.filters.push({ type: "eq", column, value });
        return chain;
      },
      order(column: string, options?: unknown) {
        call.filters.push({ type: "order", column, options });
        return chain;
      },
      limit(value: number) {
        call.filters.push({ type: "limit", value });
        return chain;
      },
      single() {
        call.filters.push({ type: "single" });
        return nextResult();
      },
      then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return nextResult().then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  return {
    client: {
      from(table: string) {
        return builder(table);
      },
    },
    calls,
  };
}

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

Deno.test("executeUpdateCalendarEvent met à jour un événement avec UUID valide", async () => {
  const { client, calls } = createSupabaseStub([
    { data: { id: validUuid, title: "Réunion produit", location: "Salle A" } },
  ]);
  const ctx = { supabase: client as never, userId: "user-1", authUserId: "auth-1" };

  const result = await executeUpdateCalendarEvent(ctx, {
    event_id: validUuid,
    data: { title: "Réunion produit", location: "Salle A" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, 'Événement "Réunion produit" mis à jour');
  assertExists(result.data?.event);
  assertEquals((result.data?.event as Record<string, unknown>).id, validUuid);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "calendar_events");
  assertEquals(calls[0].operation, "update");
  assertEquals(calls[0].payload, { title: "Réunion produit", location: "Salle A" });
  assertEquals(
    calls[0].filters.find((f) => f.type === "eq"),
    { type: "eq", column: "id", value: validUuid },
  );
});

Deno.test("executeUpdateCalendarEvent échoue si event_id est invalide", async () => {
  const { client, calls } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeUpdateCalendarEvent(ctx, {
    event_id: "not-a-uuid",
    data: { title: "X" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, 'event_id invalide ou manquant: "not-a-uuid"');
  assertEquals(calls.length, 0);
});

Deno.test("executeUpdateCalendarEvent échoue si aucune donnée de mise à jour n'est fournie", async () => {
  const { client, calls } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeUpdateCalendarEvent(ctx, {
    event_id: validUuid,
    data: {},
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Aucune donnée de mise à jour fournie");
  assertEquals(calls.length, 0);
});

Deno.test("executeDeleteCalendarEvent supprime un événement et réutilise son titre", async () => {
  const { client, calls } = createSupabaseStub([
    { data: { title: "Standup équipe" } },
    { data: null },
  ]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeDeleteCalendarEvent(ctx, { event_id: validUuid });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, 'Événement "Standup équipe" supprimé');
  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "calendar_events");
  assertEquals(calls[0].operation, "select");
  assertEquals(calls[1].table, "calendar_events");
  assertEquals(calls[1].operation, "delete");
  assertEquals(
    calls[1].filters.find((f) => f.type === "eq"),
    { type: "eq", column: "id", value: validUuid },
  );
});

Deno.test("executeDeleteCalendarEvent échoue si event_id est invalide", async () => {
  const { client, calls } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeDeleteCalendarEvent(ctx, { event_id: "bad-id" });

  assertEquals(result.success, false);
  assertEquals(result.error, 'event_id invalide ou manquant: "bad-id"');
  assertEquals(calls.length, 0);
});

Deno.test("executeManageEventAttendees list retourne les participants et le count", async () => {
  const attendees = [
    { id: "a1", event_id: validUuid, email: "a@example.com" },
    { id: "a2", event_id: validUuid, email: "b@example.com" },
  ];
  const { client, calls } = createSupabaseStub([{ data: attendees }]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventAttendees(ctx, {
    action: "list",
    event_id: validUuid,
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.count, 2);
  assertEquals(result.data?.attendees, attendees);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "event_attendees");
  assertEquals(calls[0].operation, "select");
  assertEquals(
    calls[0].filters.find((f) => f.type === "eq"),
    { type: "eq", column: "event_id", value: validUuid },
  );
});

Deno.test("executeManageEventAttendees add insère un participant", async () => {
  const inserted = { id: "att-1", event_id: validUuid, email: "new@example.com" };
  const { client, calls } = createSupabaseStub([{ data: inserted }]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventAttendees(ctx, {
    action: "add",
    event_id: validUuid,
    data: { email: "new@example.com", status: "pending" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Participant ajouté");
  assertEquals(result.data?.attendee, inserted);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "event_attendees");
  assertEquals(calls[0].operation, "insert");
  assertEquals(calls[0].payload, {
    event_id: validUuid,
    email: "new@example.com",
    status: "pending",
  });
});

Deno.test("executeManageEventAttendees remove échoue sans attendee_id", async () => {
  const { client, calls } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventAttendees(ctx, {
    action: "remove",
    event_id: validUuid,
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "attendee_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageEventAttendees action inconnue retourne not implemented", async () => {
  const { client } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventAttendees(ctx, {
    action: "sync",
    event_id: validUuid,
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Action sync not implemented");
});

Deno.test("executeManageEventReminder list exige event_id", async () => {
  const { client, calls } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventReminder(ctx, {
    action: "list",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "event_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageEventReminder create crée un rappel", async () => {
  const reminder = { id: "r1", event_id: validUuid, minutes_before: 15 };
  const { client, calls } = createSupabaseStub([{ data: reminder }]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventReminder(ctx, {
    action: "create",
    event_id: validUuid,
    data: { minutes_before: 15, channel: "email" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Rappel créé");
  assertEquals(result.data?.reminder, reminder);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "event_reminders");
  assertEquals(calls[0].operation, "insert");
  assertEquals(calls[0].payload, {
    event_id: validUuid,
    minutes_before: 15,
    channel: "email",
  });
});

Deno.test("executeManageEventReminder delete supprime un rappel", async () => {
  const { client, calls } = createSupabaseStub([{ data: null }]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageEventReminder(ctx, {
    action: "delete",
    reminder_id: "rem-123",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Rappel supprimé");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "event_reminders");
  assertEquals(calls[0].operation, "delete");
  assertEquals(
    calls[0].filters.find((f) => f.type === "eq"),
    { type: "eq", column: "id", value: "rem-123" },
  );
});

Deno.test("executeManageBooking list utilise authUserId en priorité et applique order/limit", async () => {
  const bookings = [
    { id: "b1", status: "confirmed" },
    { id: "b2", status: "pending" },
  ];
  const { client, calls } = createSupabaseStub([{ data: bookings }]);
  const ctx = { supabase: client as never, userId: "user-1", authUserId: "auth-99" };

  const result = await executeManageBooking(ctx, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data?.count, 2);
  assertEquals(result.data?.bookings, bookings);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "bookings");
  assertEquals(calls[0].operation, "select");
  assertEquals(
    calls[0].filters.find((f) => f.type === "eq"),
    { type: "eq", column: "host_user_id", value: "auth-99" },
  );
  assertEquals(
    calls[0].filters.find((f) => f.type === "order"),
    { type: "order", column: "start_time", options: { ascending: false } },
  );
  assertEquals(
    calls[0].filters.find((f) => f.type === "limit"),
    { type: "limit", value: 50 },
  );
});

Deno.test("executeManageBooking cancel échoue sans booking_id", async () => {
  const { client, calls } = createSupabaseStub();
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageBooking(ctx, {
    action: "cancel",
    data: { reason: "Conflit d'agenda" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "booking_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageBooking cancel met à jour le statut, la raison et cancelled_by", async () => {
  const booking = { id: "book-1", status: "cancelled", cancellation_reason: "Indisponible" };
  const { client, calls } = createSupabaseStub([{ data: booking }]);
  const ctx = { supabase: client as never, userId: "user-1", authUserId: "auth-55" };

  const result = await executeManageBooking(ctx, {
    action: "cancel",
    booking_id: "book-1",
    data: { reason: "Indisponible" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Réservation annulée");
  assertEquals(result.data?.booking, booking);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "bookings");
  assertEquals(calls[0].operation, "update");
  const payload = calls[0].payload as Record<string, unknown>;
  assertEquals(payload.status, "cancelled");
  assertEquals(payload.cancellation_reason, "Indisponible");
  assertEquals(payload.cancelled_by, "auth-55");
  assertExists(payload.cancelled_at);
  assertEquals(typeof payload.cancelled_at, "string");
  assertEquals(
    calls[0].filters.find((f) => f.type === "eq"),
    { type: "eq", column: "id", value: "book-1" },
  );
});

Deno.test("executeManageBooking confirm met à jour le statut confirmé", async () => {
  const booking = { id: "book-2", status: "confirmed" };
  const { client, calls } = createSupabaseStub([{ data: booking }]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageBooking(ctx, {
    action: "confirm",
    booking_id: "book-2",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Réservation confirmée");
  assertEquals(result.data?.booking, booking);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "bookings");
  assertEquals(calls[0].operation, "update");
  const payload = calls[0].payload as Record<string, unknown>;
  assertEquals(payload.status, "confirmed");
  assertExists(payload.confirmed_at);
  assertEquals(typeof payload.confirmed_at, "string");
});

Deno.test("executeManageBooking retourne une erreur métier si Supabase renvoie une erreur", async () => {
  const { client } = createSupabaseStub([{ error: new Error("db exploded") }]);
  const ctx = { supabase: client as never, userId: "user-1" };

  const result = await executeManageBooking(ctx, { action: "list" });

  assertEquals(result.success, false);
  assertEquals(result.error, "db exploded");
});

Deno.test("imports d'assert disponibles", async () => {
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