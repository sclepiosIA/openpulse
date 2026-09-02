import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeAssignTicket,
  executeCreateSupportTicket,
  executeGetSupportKpis,
  executeUpdateTicketStatus,
} from "./support-tools.ts";

type RecordedOperation = {
  method: string;
  args: unknown[];
};

type RecordedQuery = {
  table: string;
  operations: RecordedOperation[];
};

function createSupabaseMock(
  resolver: (query: RecordedQuery) => unknown | Promise<unknown>,
) {
  const calls: RecordedQuery[] = [];

  const supabase = {
    from(table: string) {
      const query: RecordedQuery = { table, operations: [] };
      calls.push(query);

      const builder: Record<string, unknown> = {
        insert(payload: unknown) {
          query.operations.push({ method: "insert", args: [payload] });
          return builder;
        },
        update(payload: unknown) {
          query.operations.push({ method: "update", args: [payload] });
          return builder;
        },
        select(columns?: string) {
          query.operations.push({ method: "select", args: [columns] });
          return builder;
        },
        eq(column: string, value: unknown) {
          query.operations.push({ method: "eq", args: [column, value] });
          return builder;
        },
        gte(column: string, value: unknown) {
          query.operations.push({ method: "gte", args: [column, value] });
          return builder;
        },
        single() {
          query.operations.push({ method: "single", args: [] });
          return Promise.resolve().then(() => resolver(query));
        },
        then(onFulfilled: unknown, onRejected: unknown) {
          return Promise.resolve()
            .then(() => resolver(query))
            .then(onFulfilled as never, onRejected as never);
        },
        catch(onRejected: unknown) {
          return Promise.resolve()
            .then(() => resolver(query))
            .catch(onRejected as never);
        },
        finally(onFinally: unknown) {
          return Promise.resolve()
            .then(() => resolver(query))
            .finally(onFinally as never);
        },
      };

      return builder;
    },
  };

  return { supabase, calls };
}

Deno.test("executeCreateSupportTicket creates an open ticket with medium priority by default", async () => {
  const createdTicket = {
    id: "abcdef12-3456-7890-abcd-ef1234567890",
    titre: "Connexion impossible",
    description: "L'utilisateur ne peut plus se connecter.",
    priority: "medium",
    status: "open",
    created_by: "user-123",
  };

  const mock = createSupabaseMock((query) => {
    assertEquals(query.table, "support_tickets");
    return { data: createdTicket, error: null };
  });

  const result = await executeCreateSupportTicket(
    { supabase: mock.supabase as never, userId: "user-123" },
    {
      titre: "Connexion impossible",
      description: "L'utilisateur ne peut plus se connecter.",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Ticket #abcdef12 créé");
  assertEquals(result.data.ticket, createdTicket);
  assertExists(result.execution_time_ms);

  assertEquals(mock.calls.length, 1);
  assertEquals(mock.calls[0].table, "support_tickets");
  assertEquals(mock.calls[0].operations, [
    {
      method: "insert",
      args: [{
        titre: "Connexion impossible",
        description: "L'utilisateur ne peut plus se connecter.",
        priority: "medium",
        etablissement_id: undefined,
        status: "open",
        created_by: "user-123",
      }],
    },
    { method: "select", args: [undefined] },
    { method: "single", args: [] },
  ]);
});

Deno.test("executeCreateSupportTicket preserves explicit priority and establishment id", async () => {
  const mock = createSupabaseMock((query) => {
    const insertOperation = query.operations.find((op) => op.method === "insert");
    assertEquals(insertOperation?.args[0], {
      titre: "Incident critique",
      description: "Le portail est indisponible.",
      priority: "high",
      etablissement_id: "etab-42",
      status: "open",
      created_by: "admin-1",
    });

    return {
      data: {
        id: "12345678-ticket",
        titre: "Incident critique",
        priority: "high",
        etablissement_id: "etab-42",
      },
      error: null,
    };
  });

  const result = await executeCreateSupportTicket(
    { supabase: mock.supabase as never, userId: "admin-1" },
    {
      titre: "Incident critique",
      description: "Le portail est indisponible.",
      priority: "high",
      etablissement_id: "etab-42",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Ticket #12345678 créé");
});

Deno.test("executeCreateSupportTicket returns a failure result when insert fails", async () => {
  const mock = createSupabaseMock(() => ({
    data: null,
    error: new Error("insert failed"),
  }));

  const result = await executeCreateSupportTicket(
    { supabase: mock.supabase as never, userId: "user-123" },
    {
      titre: "Ticket invalide",
      description: "Création impossible.",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "insert failed");
  assertExists(result.execution_time_ms);
});

Deno.test("executeUpdateTicketStatus adds resolution metadata for resolved tickets", async () => {
  const updatedTicket = {
    id: "ticket-1",
    status: "resolved",
    resolution_note: "Compte réactivé.",
    resolved_by: "agent-7",
  };

  const mock = createSupabaseMock((query) => {
    assertEquals(query.table, "support_tickets");
    return { data: updatedTicket, error: null };
  });

  const result = await executeUpdateTicketStatus(
    { supabase: mock.supabase as never, userId: "agent-7" },
    {
      ticket_id: "ticket-1",
      status: "resolved",
      resolution_note: "Compte réactivé.",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Ticket mis à jour: resolved");
  assertEquals(result.data.ticket, updatedTicket);

  const updatePayload = mock.calls[0].operations.find((op) => op.method === "update")
    ?.args[0] as Record<string, unknown>;

  assertEquals(updatePayload.status, "resolved");
  assertEquals(updatePayload.resolved_by, "agent-7");
  assertEquals(updatePayload.resolution_note, "Compte réactivé.");
  assertExists(updatePayload.resolved_at);
  assertEquals(Number.isNaN(new Date(updatePayload.resolved_at as string).getTime()), false);

  assertEquals(mock.calls[0].operations.filter((op) => op.method === "eq"), [
    { method: "eq", args: ["id", "ticket-1"] },
  ]);
});

Deno.test("executeUpdateTicketStatus does not add resolution metadata for in_progress tickets", async () => {
  const mock = createSupabaseMock(() => ({
    data: { id: "ticket-2", status: "in_progress" },
    error: null,
  }));

  const result = await executeUpdateTicketStatus(
    { supabase: mock.supabase as never, userId: "agent-7" },
    {
      ticket_id: "ticket-2",
      status: "in_progress",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Ticket mis à jour: in_progress");

  const updatePayload = mock.calls[0].operations.find((op) => op.method === "update")
    ?.args[0] as Record<string, unknown>;

  assertEquals(updatePayload, { status: "in_progress" });
});

Deno.test("executeUpdateTicketStatus returns a failure result when update fails", async () => {
  const mock = createSupabaseMock(() => ({
    data: null,
    error: new Error("ticket not found"),
  }));

  const result = await executeUpdateTicketStatus(
    { supabase: mock.supabase as never, userId: "agent-7" },
    {
      ticket_id: "missing-ticket",
      status: "closed",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "ticket not found");
});

Deno.test("executeAssignTicket loads agent profile and assigns ticket in progress", async () => {
  const assignedTicket = {
    id: "ticket-3",
    assigned_to: "agent-9",
    status: "in_progress",
  };

  const mock = createSupabaseMock((query) => {
    if (query.table === "profiles") {
      assertEquals(query.operations, [
        { method: "select", args: ["nom, prenom"] },
        { method: "eq", args: ["id", "agent-9"] },
        { method: "single", args: [] },
      ]);
      return { data: { prenom: "Ada", nom: "Lovelace" }, error: null };
    }

    if (query.table === "support_tickets") {
      assertEquals(query.operations, [
        {
          method: "update",
          args: [{ assigned_to: "agent-9", status: "in_progress" }],
        },
        { method: "eq", args: ["id", "ticket-3"] },
        { method: "select", args: [undefined] },
        { method: "single", args: [] },
      ]);
      return { data: assignedTicket, error: null };
    }

    throw new Error(`Unexpected table: ${query.table}`);
  });

  const result = await executeAssignTicket(
    { supabase: mock.supabase as never, userId: "manager-1" },
    {
      ticket_id: "ticket-3",
      agent_id: "agent-9",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Ticket assigné à Ada Lovelace");
  assertEquals(result.data.ticket, assignedTicket);
  assertEquals(mock.calls.map((call) => call.table), ["profiles", "support_tickets"]);
});

Deno.test("executeAssignTicket still succeeds with an empty agent name when profile is missing", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.table === "profiles") {
      return { data: null, error: null };
    }

    return {
      data: { id: "ticket-4", assigned_to: "agent-missing", status: "in_progress" },
      error: null,
    };
  });

  const result = await executeAssignTicket(
    { supabase: mock.supabase as never, userId: "manager-1" },
    {
      ticket_id: "ticket-4",
      agent_id: "agent-missing",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Ticket assigné à  ");
});

Deno.test("executeAssignTicket returns a failure result when ticket assignment fails", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.table === "profiles") {
      return { data: { prenom: "Grace", nom: "Hopper" }, error: null };
    }

    return {
      data: null,
      error: new Error("assignment rejected"),
    };
  });

  const result = await executeAssignTicket(
    { supabase: mock.supabase as never, userId: "manager-1" },
    {
      ticket_id: "ticket-5",
      agent_id: "agent-5",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "assignment rejected");
});

Deno.test("executeGetSupportKpis computes total, resolution rate and average resolution time", async () => {
  const tickets = [
    {
      id: "t1",
      status: "resolved",
      priority: "high",
      created_at: "2024-03-01T08:00:00.000Z",
      resolved_at: "2024-03-01T12:00:00.000Z",
    },
    {
      id: "t2",
      status: "closed",
      priority: "medium",
      created_at: "2024-03-02T10:00:00.000Z",
      resolved_at: "2024-03-02T11:30:00.000Z",
    },
    {
      id: "t3",
      status: "open",
      priority: "low",
      created_at: "2024-03-03T09:00:00.000Z",
      resolved_at: null,
    },
    {
      id: "t4",
      status: "in_progress",
      priority: "high",
      created_at: "2024-03-04T09:00:00.000Z",
      resolved_at: null,
    },
  ];

  const mock = createSupabaseMock((query) => {
    assertEquals(query.table, "support_tickets");
    return { data: tickets, error: null };
  });

  const result = await executeGetSupportKpis(
    { supabase: mock.supabase as never, userId: "agent-1" },
    { period: "2024-03-01T00:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total_tickets, 4);
  assertEquals(result.data.resolved_tickets, 2);
  assertEquals(result.data.resolution_rate, 50);
  assertEquals(result.data.avg_resolution_time_hours, 2.8);

  assertEquals(mock.calls[0].operations, [
    {
      method: "select",
      args: ["id, status, priority, created_at, resolved_at"],
    },
    {
      method: "gte",
      args: ["created_at", "2024-03-01T00:00:00.000Z"],
    },
  ]);
});

Deno.test("executeGetSupportKpis returns no tickets message when query data is null", async () => {
  const mock = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeGetSupportKpis(
    { supabase: mock.supabase as never, userId: "agent-1" },
    { period: "2024-04-01T00:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "No tickets found");
});

Deno.test("executeGetSupportKpis returns zeroed metrics for an empty ticket list", async () => {
  const mock = createSupabaseMock(() => ({ data: [], error: null }));

  const result = await executeGetSupportKpis(
    { supabase: mock.supabase as never, userId: "agent-1" },
    { period: "2024-05-01T00:00:00.000Z" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total_tickets, 0);
  assertEquals(result.data.resolved_tickets, 0);
  assertEquals(result.data.resolution_rate, 0);
  assertEquals(result.data.avg_resolution_time_hours, 0);
});

Deno.test("executeGetSupportKpis returns a failure result when the query throws", async () => {
  const mock = createSupabaseMock(() => {
    throw new Error("kpi query failed");
  });

  const result = await executeGetSupportKpis(
    { supabase: mock.supabase as never, userId: "agent-1" },
    { period: "2024-06-01T00:00:00.000Z" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "kpi query failed");
});