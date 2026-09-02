import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCreateRecurringEvent,
  executeDetectCalendarConflicts,
  executeGetMyCalendar,
  executeImportIcsCalendar,
  executeSyncExternalCalendar,
} from "./calendar-tools.ts";

type MockQueryResult = { data?: unknown; error?: unknown };

class MockSupabaseQuery {
  call: { table: string; operations: Array<Record<string, unknown>> };
  queue: MockQueryResult[];

  constructor(
    call: { table: string; operations: Array<Record<string, unknown>> },
    queue: MockQueryResult[],
  ) {
    this.call = call;
    this.queue = queue;
  }

  select(columns?: string) {
    this.call.operations.push({ op: "select", columns });
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.operations.push({ op: "eq", column, value });
    return this;
  }

  ["in"](column: string, value: unknown) {
    this.call.operations.push({ op: "in", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.call.operations.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.call.operations.push({ op: "lte", column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.call.operations.push({ op: "order", column, options });
    return this;
  }

  limit(count: number) {
    this.call.operations.push({ op: "limit", count });
    return this;
  }

  insert(values: unknown) {
    this.call.operations.push({ op: "insert", values });
    return this;
  }

  single() {
    this.call.operations.push({ op: "single" });
    return this;
  }

  then(onFulfilled?: (value: MockQueryResult) => unknown, onRejected?: (reason: unknown) => unknown) {
    const result = this.queue.length > 0 ? this.queue.shift()! : { data: null, error: null };
    return Promise.resolve(result).then(onFulfilled, onRejected);
  }
}

function createSupabaseMock(
  responses: Record<string, MockQueryResult[]> = {},
  functionInvokeResult: MockQueryResult = { data: null, error: null },
) {
  const queues = new Map<string, MockQueryResult[]>(
    Object.entries(responses).map(([table, queue]) => [table, [...queue]]),
  );
  const calls: Array<Record<string, unknown>> = [];

  const supabase = {
    from(table: string) {
      const call = { table, operations: [] as Array<Record<string, unknown>> };
      calls.push(call);
      if (!queues.has(table)) queues.set(table, []);
      return new MockSupabaseQuery(call, queues.get(table)!);
    },
    functions: {
      async invoke(name: string, options?: unknown) {
        calls.push({ type: "function.invoke", name, options });
        return functionInvokeResult;
      },
    },
  };

  return { supabase, calls };
}

Deno.test("module exports expected calendar tool functions", () => {
  assertExists(executeGetMyCalendar);
  assertExists(executeCreateRecurringEvent);
  assertExists(executeDetectCalendarConflicts);
  assertExists(executeImportIcsCalendar);
  assertExists(executeSyncExternalCalendar);

  assertThrows(() => {
    throw new Error("local assertion check");
  }, Error, "local assertion check");
});

Deno.test("executeImportIcsCalendar returns deterministic content length without I/O", async () => {
  await assertRejects(
    () => Promise.reject(new Error("local async assertion check")),
    Error,
    "local async assertion check",
  );

  const { supabase } = createSupabaseMock();
  const result = await executeImportIcsCalendar(
    { supabase: supabase as never, userId: "user-1" },
    { ics_content: "BEGIN:VCALENDAR\nEND:VCALENDAR", calendar_id: "cal-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "ICS import requires ICS parser integration",
    content_length: 29,
  });
  assertExists(result.execution_time_ms);
});

Deno.test("executeDetectCalendarConflicts detects overlapping events and uses requested target user", async () => {
  const { supabase, calls } = createSupabaseMock({
    calendar_events: [{
      data: [
        {
          id: "evt-a",
          title: "Maths",
          start_time: "2025-03-10T09:00:00.000Z",
          end_time: "2025-03-10T10:00:00.000Z",
        },
        {
          id: "evt-b",
          title: "Réunion parents",
          start_time: "2025-03-10T09:30:00.000Z",
          end_time: "2025-03-10T11:00:00.000Z",
        },
        {
          id: "evt-c",
          title: "Pause déjeuner",
          start_time: "2025-03-10T11:00:00.000Z",
          end_time: "2025-03-10T12:00:00.000Z",
        },
      ],
      error: null,
    }],
  });

  const result = await executeDetectCalendarConflicts(
    { supabase: supabase as never, userId: "ctx-user" },
    {
      user_id: "target-user",
      date_from: "2025-03-10T00:00:00.000Z",
      date_to: "2025-03-10T23:59:59.999Z",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    has_conflicts: true,
    conflicts: [{
      event1: { id: "evt-a", title: "Maths" },
      event2: { id: "evt-b", title: "Réunion parents" },
    }],
    events_checked: 3,
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "calendar_events");
  const createdByFilter = (calls[0].operations as Array<Record<string, unknown>>)
    .find((op) => op.op === "eq" && op.column === "created_by");
  assertEquals(createdByFilter, { op: "eq", column: "created_by", value: "target-user" });
});

Deno.test("executeDetectCalendarConflicts reports no conflict with adjacent or single events", async () => {
  const { supabase } = createSupabaseMock({
    calendar_events: [{
      data: [
        {
          id: "evt-a",
          title: "Cours A",
          start_time: "2025-03-11T08:00:00.000Z",
          end_time: "2025-03-11T09:00:00.000Z",
        },
        {
          id: "evt-b",
          title: "Cours B",
          start_time: "2025-03-11T09:00:00.000Z",
          end_time: "2025-03-11T10:00:00.000Z",
        },
      ],
      error: null,
    }],
  });

  const result = await executeDetectCalendarConflicts(
    { supabase: supabase as never, userId: "user-1" },
    {
      date_from: "2025-03-11T00:00:00.000Z",
      date_to: "2025-03-11T23:59:59.999Z",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    has_conflicts: false,
    conflicts: [],
    events_checked: 2,
  });
});

Deno.test("executeGetMyCalendar fetches visible calendars, merges shared events, deduplicates and groups by day", async () => {
  const { supabase, calls } = createSupabaseMock({
    calendars: [{
      data: [{ id: "cal-work", name: "Travail", color: "#ff0000" }],
      error: null,
    }],
    calendar_events: [
      {
        data: [{
          id: "evt-late",
          title: "Réunion équipe",
          start_time: "2025-01-15T14:00:00.000Z",
          end_time: "2025-01-15T15:00:00.000Z",
          location: "Salle A",
          description: "Point hebdo",
          video_conference_url: null,
          all_day: false,
          status: "confirmed",
          color: null,
          calendar_id: "cal-work",
          etablissement_id: "etab-1",
          recurrence_rule: null,
          etablissements: { id: "etab-1", nom: "Lycée Nord" },
        }],
        error: null,
      },
      {
        data: [
          {
            id: "evt-shared",
            title: "Conseil",
            start_time: "2025-01-15T09:00:00.000Z",
            end_time: "2025-01-15T10:00:00.000Z",
            location: null,
            description: null,
            video_conference_url: "https://meet.example/abc",
            all_day: false,
            status: "confirmed",
            color: "#00ff00",
            calendar_id: "cal-shared",
            etablissement_id: null,
            recurrence_rule: "FREQ=WEEKLY",
            etablissements: null,
          },
          {
            id: "evt-late",
            title: "Doublon partagé",
            start_time: "2025-01-15T14:00:00.000Z",
            end_time: "2025-01-15T15:00:00.000Z",
            location: "Autre salle",
            description: null,
            video_conference_url: null,
            all_day: false,
            status: "confirmed",
            color: "#123456",
            calendar_id: "cal-shared",
            etablissement_id: null,
            recurrence_rule: null,
            etablissements: null,
          },
        ],
        error: null,
      },
    ],
    calendar_shares: [{
      data: [{
        calendar_id: "cal-shared",
        permission: "read",
        calendars: { id: "cal-shared", name: "Partagé", color: "#0000ff" },
      }],
      error: null,
    }],
  });

  const result = await executeGetMyCalendar(
    { supabase: supabase as never, userId: "user-1" },
    {
      date_from: "2025-01-15T00:00:00.000Z",
      date_to: "2025-01-15T23:59:59.999Z",
      include_all_day: false,
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total, 2);
  assertEquals(result.data.period, {
    from: "2025-01-15T00:00:00.000Z",
    to: "2025-01-15T23:59:59.999Z",
  });
  assertEquals(result.data.calendars_used, [
    { id: "cal-work", name: "Travail", color: "#ff0000" },
  ]);
  assertEquals(result.data.events.map((event: { title: string }) => event.title), [
    "Conseil",
    "Réunion équipe",
  ]);
  assertEquals(result.data.events[0], {
    id: "evt-shared",
    title: "Conseil",
    start_time: "2025-01-15T09:00:00.000Z",
    end_time: "2025-01-15T10:00:00.000Z",
    all_day: false,
    location: null,
    description: null,
    video_conference_url: "https://meet.example/abc",
    recurrence_rule: "FREQ=WEEKLY",
    color: "#00ff00",
    calendar: { name: "Partagé", color: "#0000ff" },
    etablissement: null,
  });
  assertEquals(result.data.events[1].color, "#ff0000");
  assertEquals(result.data.events[1].calendar, { name: "Travail", color: "#ff0000" });
  assertEquals(result.data.events[1].etablissement, { id: "etab-1", nom: "Lycée Nord" });
  assertEquals(result.data.by_day["2025-01-15"].map((event: { id: string }) => event.id), [
    "evt-shared",
    "evt-late",
  ]);

  const ownCalendarCall = calls.find((call) => call.table === "calendars")!;
  const visibleFilter = (ownCalendarCall.operations as Array<Record<string, unknown>>)
    .find((op) => op.op === "eq" && op.column === "is_visible");
  assertEquals(visibleFilter, { op: "eq", column: "is_visible", value: true });

  const ownEventsCall = calls.filter((call) => call.table === "calendar_events")[0];
  const calendarIdFilter = (ownEventsCall.operations as Array<Record<string, unknown>>)
    .find((op) => op.op === "in" && op.column === "calendar_id");
  const allDayFilter = (ownEventsCall.operations as Array<Record<string, unknown>>)
    .find((op) => op.op === "eq" && op.column === "all_day");
  assertEquals(calendarIdFilter, { op: "in", column: "calendar_id", value: ["cal-work"] });
  assertEquals(allDayFilter, { op: "eq", column: "all_day", value: false });
});

Deno.test("executeGetMyCalendar returns empty result and message when user has no calendar", async () => {
  const { supabase, calls } = createSupabaseMock({
    calendars: [{ data: [], error: null }],
  });

  const result = await executeGetMyCalendar(
    { supabase: supabase as never, userId: "user-empty" },
    {
      date_from: "2025-02-01T00:00:00.000Z",
      date_to: "2025-02-02T00:00:00.000Z",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    events: [],
    total: 0,
    period: {
      from: "2025-02-01T00:00:00.000Z",
      to: "2025-02-02T00:00:00.000Z",
    },
    message: "Aucun calendrier trouvé",
  });
  assertEquals(calls.filter((call) => call.table === "calendar_events").length, 0);
});

Deno.test("executeGetMyCalendar returns failure when calendar query fails", async () => {
  const { supabase } = createSupabaseMock({
    calendars: [{ data: null, error: new Error("permission denied") }],
  });

  const result = await executeGetMyCalendar(
    { supabase: supabase as never, userId: "user-1" },
    {
      date_from: "2025-02-01T00:00:00.000Z",
      date_to: "2025-02-02T00:00:00.000Z",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "permission denied");
});

Deno.test("executeCreateRecurringEvent inserts into default calendar with confirmed status", async () => {
  const { supabase, calls } = createSupabaseMock({
    calendars: [{ data: { id: "cal-default" }, error: null }],
    calendar_events: [{
      data: {
        id: "evt-rec",
        calendar_id: "cal-default",
        title: "Cours récurrent",
        recurrence_rule: "FREQ=WEEKLY;COUNT=4",
      },
      error: null,
    }],
  });

  const result = await executeCreateRecurringEvent(
    { supabase: supabase as never, userId: "user-1" },
    {
      title: "Cours récurrent",
      start_time: "2025-04-01T08:00:00.000Z",
      end_time: "2025-04-01T09:00:00.000Z",
      recurrence_rule: "FREQ=WEEKLY;COUNT=4",
      location: "Salle 101",
      description: "Séquence algèbre",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Événement récurrent créé: Cours récurrent");
  assertEquals(result.data.event, {
    id: "evt-rec",
    calendar_id: "cal-default",
    title: "Cours récurrent",
    recurrence_rule: "FREQ=WEEKLY;COUNT=4",
  });

  const insertCall = calls.find((call) => call.table === "calendar_events")!;
  const insertOperation = (insertCall.operations as Array<Record<string, unknown>>)
    .find((op) => op.op === "insert");
  assertEquals(insertOperation, {
    op: "insert",
    values: {
      calendar_id: "cal-default",
      title: "Cours récurrent",
      start_time: "2025-04-01T08:00:00.000Z",
      end_time: "2025-04-01T09:00:00.000Z",
      recurrence_rule: "FREQ=WEEKLY;COUNT=4",
      location: "Salle 101",
      description: "Séquence algèbre",
      created_by: "user-1",
      status: "confirmed",
    },
  });
});

Deno.test("executeCreateRecurringEvent returns failure when no default calendar exists", async () => {
  const { supabase, calls } = createSupabaseMock({
    calendars: [{ data: null, error: null }],
  });

  const result = await executeCreateRecurringEvent(
    { supabase: supabase as never, userId: "user-1" },
    {
      title: "Sans calendrier",
      start_time: "2025-04-01T08:00:00.000Z",
      end_time: "2025-04-01T09:00:00.000Z",
      recurrence_rule: "FREQ=DAILY;COUNT=2",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "No default calendar found");
  assertEquals(calls.filter((call) => call.table === "calendar_events").length, 0);
});

Deno.test("executeSyncExternalCalendar list_subscriptions returns subscriptions and count", async () => {
  const subscriptions = [
    {
      id: "sub-1",
      name: "Vacances scolaires",
      url: "https://example.invalid/vacances.ics",
      is_active: true,
      last_sync_at: "2025-05-01T10:00:00.000Z",
      last_sync_status: "success",
    },
    {
      id: "sub-2",
      name: "Examens",
      url: "https://example.invalid/examens.ics",
      is_active: false,
      last_sync_at: null,
      last_sync_status: null,
    },
  ];
  const { supabase, calls } = createSupabaseMock({
    calendar_subscriptions: [{ data: subscriptions, error: null }],
  });

  const result = await executeSyncExternalCalendar(
    { supabase: supabase as never, userId: "user-1" },
    { provider: "ics", action: "list_subscriptions" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { subscriptions, count: 2 });

  const userFilter = (calls[0].operations as Array<Record<string, unknown>>)
    .find((op) => op.op === "eq" && op.column === "user_id");
  assertEquals(userFilter, { op: "eq", column: "user_id", value: "user-1" });
});

Deno.test("executeSyncExternalCalendar sync_now invokes edge function with current user id", async () => {
  const { supabase, calls } = createSupabaseMock(
    {},
    { data: { queued: 3, processed: 0 }, error: null },
  );

  const result = await executeSyncExternalCalendar(
    { supabase: supabase as never, userId: "user-sync" },
    { provider: "ics", action: "sync_now" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Synchronisation lancée",
    result: { queued: 3, processed: 0 },
  });
  assertEquals(calls, [{
    type: "function.invoke",
    name: "sync-calendar-subscriptions",
    options: { body: { user_id: "user-sync" } },
  }]);
});

Deno.test("executeSyncExternalCalendar check_status formats recent sync status", async () => {
  const recentSyncs = [{
    name: "Vacances scolaires",
    last_sync_at: "2025-05-01T10:00:00.000Z",
    last_sync_status: "success",
  }];
  const { supabase } = createSupabaseMock({
    calendar_subscriptions: [{ data: recentSyncs, error: null }],
  });

  const result = await executeSyncExternalCalendar(
    { supabase: supabase as never, userId: "user-1" },
    { provider: "ics", action: "check_status" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "1 abonnement(s) configuré(s)",
    recent_syncs: recentSyncs,
  });
});

Deno.test("executeSyncExternalCalendar returns guidance for unknown action", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeSyncExternalCalendar(
    { supabase: supabase as never, userId: "user-1" },
    { provider: "ics", action: "unknown_action" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message:
      "Action 'unknown_action' non reconnue. Actions disponibles: list_subscriptions, sync_now, check_status",
  });
  assertEquals(calls.length, 0);
});

Deno.test("executeSyncExternalCalendar returns failure when subscription query fails", async () => {
  const { supabase } = createSupabaseMock({
    calendar_subscriptions: [{ data: null, error: new Error("db unavailable") }],
  });

  const result = await executeSyncExternalCalendar(
    { supabase: supabase as never, userId: "user-1" },
    { provider: "ics", action: "list_subscriptions" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db unavailable");
});