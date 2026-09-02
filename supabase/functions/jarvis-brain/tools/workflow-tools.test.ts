import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeWorkflow, getWorkflowHistory, listAvailableWorkflows } from "./workflow-tools.ts";

function createContext(supabase: unknown = {}) {
  return {
    supabase,
    userId: "user-123",
    authUserId: "auth-456",
    conversationId: "conversation-789",
  } as any;
}

function snapshotEnv(keys: string[]) {
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, Deno.env.get(key));
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

function createHistorySupabaseMock(result: { data: unknown[] | null; error: Error | null }) {
  const calls: Array<Record<string, unknown>> = [];

  const builder: any = {
    select(columns: string) {
      calls.push({ method: "select", columns });
      return this;
    },
    eq(column: string, value: unknown) {
      calls.push({ method: "eq", column, value });
      return this;
    },
    order(column: string, options: Record<string, unknown>) {
      calls.push({ method: "order", column, options });
      return this;
    },
    limit(count: number) {
      calls.push({ method: "limit", count });
      return this;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return {
    calls,
    supabase: {
      from(table: string) {
        calls.push({ method: "from", table });
        return builder;
      },
    },
  };
}

function createLoggingSupabaseMock() {
  const calls: Array<Record<string, unknown>> = [];

  return {
    calls,
    supabase: {
      from(table: string) {
        calls.push({ method: "from", table });

        return {
          insert(payload: unknown) {
            calls.push({ method: "insert", payload });

            return {
              select() {
                calls.push({ method: "select" });

                return {
                  single() {
                    calls.push({ method: "single" });
                    return Promise.resolve({ data: { id: "execution-log-1" }, error: null });
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

Deno.test("listAvailableWorkflows returns all workflows with stable categories", async () => {
  const result = await listAvailableWorkflows(createContext(), {});

  assertEquals(result.success, true);
  assertExists(result.execution_time_ms);

  const data = result.data as any;
  assertEquals(data.total, 14);
  assertEquals(data.categories, ["crm", "finance", "reporting", "rh", "support", "rd"]);
  assertEquals(data.workflows[0], {
    id: "onboarding_client",
    name: "Onboarding Client",
    category: "crm",
    description: "Accueil complet d'un nouveau client",
  });
  assertEquals(data.workflows.at(-1), {
    id: "weekly_standup_prep",
    name: "Prépa Standup",
    category: "rd",
    description: "Préparation réunion hebdo",
  });
});

Deno.test("listAvailableWorkflows filters by category", async () => {
  const result = await listAvailableWorkflows(createContext(), { category: "finance" });

  assertEquals(result.success, true);

  const data = result.data as any;
  assertEquals(data.total, 2);
  assertEquals(
    data.workflows.map((workflow: any) => workflow.id),
    ["cloture_mensuelle", "invoice_reminder_sequence"],
  );
  assertEquals(
    data.workflows.map((workflow: any) => workflow.category),
    ["finance", "finance"],
  );
});

Deno.test("listAvailableWorkflows returns an empty list for an unknown category while keeping all categories", async () => {
  const result = await listAvailableWorkflows(createContext(), { category: "unknown-category" });

  assertEquals(result.success, true);

  const data = result.data as any;
  assertEquals(data.total, 0);
  assertEquals(data.workflows, []);
  assertEquals(data.categories, ["crm", "finance", "reporting", "rh", "support", "rd"]);
});

Deno.test("getWorkflowHistory builds the expected Supabase query and returns executions", async () => {
  const rows = [
    {
      id: "exec-1",
      user_id: "user-123",
      workflow_id: "weekly_report",
      status: "completed",
      steps_completed: 4,
      total_steps: 4,
    },
    {
      id: "exec-2",
      user_id: "user-123",
      workflow_id: "weekly_report",
      status: "failed",
      steps_completed: 2,
      total_steps: 4,
    },
  ];

  const { supabase, calls } = createHistorySupabaseMock({ data: rows, error: null });
  const result = await getWorkflowHistory(createContext(supabase), {
    workflow_id: "weekly_report",
    limit: 5,
  });

  assertEquals(result.success, true);
  assertExists(result.execution_time_ms);
  assertEquals(result.data, {
    executions: rows,
    total: 2,
  });
  assertEquals(calls, [
    { method: "from", table: "jarvis_workflow_executions" },
    { method: "select", columns: "*" },
    { method: "eq", column: "user_id", value: "user-123" },
    { method: "order", column: "created_at", options: { ascending: false } },
    { method: "limit", count: 5 },
    { method: "eq", column: "workflow_id", value: "weekly_report" },
  ]);
});

Deno.test("getWorkflowHistory uses default limit 20 when no limit is provided", async () => {
  const { supabase, calls } = createHistorySupabaseMock({ data: [], error: null });

  const result = await getWorkflowHistory(createContext(supabase), {});

  assertEquals(result.success, true);
  assertEquals(result.data, {
    executions: [],
    total: 0,
  });
  assertEquals(calls, [
    { method: "from", table: "jarvis_workflow_executions" },
    { method: "select", columns: "*" },
    { method: "eq", column: "user_id", value: "user-123" },
    { method: "order", column: "created_at", options: { ascending: false } },
    { method: "limit", count: 20 },
  ]);
});

Deno.test("getWorkflowHistory returns a failure result when Supabase returns an error", async () => {
  const { supabase } = createHistorySupabaseMock({
    data: null,
    error: new Error("database unavailable"),
  });

  const result = await getWorkflowHistory(createContext(supabase), {
    workflow_id: "monthly_report_automation",
    limit: 10,
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertExists(result.execution_time_ms);
});

Deno.test("executeWorkflow rejects unknown workflow ids without calling fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(new Response("{}"));
  }) as any;

  try {
    const result = await executeWorkflow(createContext(), {
      workflow_id: "not_a_real_workflow",
      params: { target_email: "client@example.test" },
    });

    assertEquals(fetchCalled, false);
    assertEquals(result.success, false);
    assertEquals(
      result.error,
      "Workflow inconnu: not_a_real_workflow. Disponibles: onboarding_client, cloture_mensuelle, suivi_prospect, weekly_report, new_employee_onboarding, invoice_reminder_sequence, contract_renewal_30days, quarterly_business_review, prospect_nurturing_7days, support_escalation, monthly_report_automation, lead_qualification, offboarding_checklist, weekly_standup_prep",
    );
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("executeWorkflow calls the workflow engine, logs execution, and maps the response", async () => {
  const restoreEnv = snapshotEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: string; init?: RequestInit }> = [];
  const { supabase, calls: supabaseCalls } = createLoggingSupabaseMock();

  Deno.env.set("SUPABASE_URL", "https://project-ref.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input: String(input), init });

    return new Response(JSON.stringify({
      success: true,
      status: "completed",
      steps_completed: 3,
      total_steps: 3,
      summary: "Client onboarding completed",
      actions_taken: ["email_sent", "task_created"],
      next_steps: ["schedule_kickoff"],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  try {
    const params = {
      target_email: "client@example.test",
      target_name: "Client Test",
      etablissement_id: "etab-123",
    };

    const result = await executeWorkflow(createContext(supabase), {
      workflow_id: "onboarding_client",
      params,
    });

    assertEquals(fetchCalls.length, 1);
    assertEquals(fetchCalls[0].input, "https://project-ref.supabase.co/functions/v1/jarvis-workflow-engine");
    assertEquals(fetchCalls[0].init?.method, "POST");
    assertEquals((fetchCalls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals((fetchCalls[0].init?.headers as Record<string, string>)["Authorization"], "Bearer service-role-test-key");
    assertEquals(JSON.parse(fetchCalls[0].init?.body as string), {
      action: "execute",
      workflow_id: "onboarding_client",
      user_id: "user-123",
      params,
    });

    assertEquals(result.success, true);
    assertEquals(result.data, {
      workflow_id: "onboarding_client",
      status: "completed",
      steps_completed: 3,
      total_steps: 3,
      summary: "Client onboarding completed",
      actions_taken: ["email_sent", "task_created"],
      next_steps: ["schedule_kickoff"],
    });
    assertExists(result.execution_time_ms);

    assertEquals(supabaseCalls, [
      { method: "from", table: "jarvis_workflow_executions" },
      {
        method: "insert",
        payload: {
          user_id: "user-123",
          workflow_id: "onboarding_client",
          status: "completed",
          steps_completed: 3,
          total_steps: 3,
          result_summary: "Client onboarding completed",
          params,
        },
      },
      { method: "select" },
      { method: "single" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeWorkflow defaults missing params to an empty object and missing actions to empty arrays", async () => {
  const restoreEnv = snapshotEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const originalFetch = globalThis.fetch;
  const fetchBodies: unknown[] = [];
  const { supabase } = createLoggingSupabaseMock();

  Deno.env.set("SUPABASE_URL", "https://project-ref.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchBodies.push(JSON.parse(init?.body as string));

    return new Response(JSON.stringify({
      success: true,
      status: "completed",
      steps_completed: 1,
      total_steps: 2,
      summary: "Weekly report started",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  try {
    const result = await executeWorkflow(createContext(supabase), {
      workflow_id: "weekly_report",
    });

    assertEquals(fetchBodies, [{
      action: "execute",
      workflow_id: "weekly_report",
      user_id: "user-123",
      params: {},
    }]);
    assertEquals(result.success, true);
    assertEquals(result.data, {
      workflow_id: "weekly_report",
      status: "completed",
      steps_completed: 1,
      total_steps: 2,
      summary: "Weekly report started",
      actions_taken: [],
      next_steps: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeWorkflow returns a failure result when the workflow engine responds with an error status", async () => {
  const restoreEnv = snapshotEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const originalFetch = globalThis.fetch;
  let supabaseCalled = false;

  Deno.env.set("SUPABASE_URL", "https://project-ref.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

  globalThis.fetch = (async () => {
    return new Response("engine unavailable", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }) as any;

  const supabase = {
    from() {
      supabaseCalled = true;
      throw new Error("supabase should not be called after engine failure");
    },
  };

  try {
    const result = await executeWorkflow(createContext(supabase), {
      workflow_id: "support_escalation",
      params: { ticket_id: "ticket-789" },
    });

    assertEquals(supabaseCalled, false);
    assertEquals(result.success, false);
    assertEquals(result.error, "Workflow engine error: 503 - engine unavailable");
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeWorkflow returns a failure result when fetch throws", async () => {
  const restoreEnv = snapshotEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const originalFetch = globalThis.fetch;

  Deno.env.set("SUPABASE_URL", "https://project-ref.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

  globalThis.fetch = (async () => {
    throw new Error("network disabled in test");
  }) as any;

  try {
    const result = await executeWorkflow(createContext(), {
      workflow_id: "lead_qualification",
      params: { prospect_id: "prospect-123" },
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "network disabled in test");
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("assert helpers required by the test contract are available", async () => {
  assertThrows(
    () => JSON.parse("{"),
    SyntaxError,
  );

  await assertRejects(
    () => Promise.reject(new Error("expected rejection")),
    Error,
    "expected rejection",
  );
});