import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TEST_SUPABASE_URL = "https://test-project.supabase.co";
const TEST_SERVICE_KEY = "test-service-role-key";
const MODULE_PATH = "./automation-builder-tools.ts";

async function withTestEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.set("SUPABASE_URL", TEST_SUPABASE_URL);
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", TEST_SERVICE_KEY);

  try {
    return await fn();
  } finally {
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);

    if (previousKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
}

async function importTools() {
  return await import(MODULE_PATH);
}

type QueryCall = {
  method: string;
  args: unknown[];
};

function createSupabaseMock(result: { data?: unknown; error?: unknown }) {
  const state: { calls: QueryCall[] } = { calls: [] };

  const createQuery = () => {
    const query: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        state.calls.push({ method: "select", args });
        return query;
      },
      order: (...args: unknown[]) => {
        state.calls.push({ method: "order", args });
        return query;
      },
      limit: (...args: unknown[]) => {
        state.calls.push({ method: "limit", args });
        return query;
      },
      eq: (...args: unknown[]) => {
        state.calls.push({ method: "eq", args });
        return query;
      },
      ilike: (...args: unknown[]) => {
        state.calls.push({ method: "ilike", args });
        return query;
      },
      update: (...args: unknown[]) => {
        state.calls.push({ method: "update", args });
        return query;
      },
      single: (...args: unknown[]) => {
        state.calls.push({ method: "single", args });
        return query;
      },
      then: (onFulfilled: unknown, onRejected: unknown) => {
        return Promise.resolve({ data: result.data, error: result.error }).then(
          onFulfilled as never,
          onRejected as never,
        );
      },
    };

    return query;
  };

  return {
    supabase: {
      from: (table: string) => {
        state.calls.push({ method: "from", args: [table] });
        return createQuery();
      },
    },
    state,
  };
}

async function withFetchStub<T>(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response,
  fn: (calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>) => Promise<T> | T,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return Promise.resolve(handler(input, init));
  }) as typeof fetch;

  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("module loads without throwing", async () => {
  await withTestEnv(async () => {
    const mod = await importTools();
    assertExists(mod.executeListWorkflows);
    assertExists(mod.executeGetWorkflowRuns);
    assertExists(mod.executeCreateWorkflowFromPrompt);
    assertExists(mod.executeToggleWorkflow);
    assertExists(mod.executeRunWorkflowNow);
  });
});

Deno.test("executeListWorkflows applies active/search filters, caps limit to 100 and returns total", async () => {
  await withTestEnv(async () => {
    const { executeListWorkflows } = await importTools();
    const workflows = [
      {
        id: "wf-1",
        name: "Relance facture",
        description: "Relance automatique",
        is_active: true,
        trigger_type: "schedule",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
      {
        id: "wf-2",
        name: "Facture validée",
        description: "Notification interne",
        is_active: true,
        trigger_type: "webhook",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
    ];
    const mock = createSupabaseMock({ data: workflows, error: null });

    const result = await executeListWorkflows(
      { supabase: mock.supabase, userId: "user-1" },
      { active_only: true, search: "facture", limit: 250 },
    );

    assertEquals(result.success, true);
    assertEquals(result.data.workflows, workflows);
    assertEquals(result.data.total, 2);
    assertExists(result.execution_time_ms);

    assertEquals(mock.state.calls.map((call) => call.method), [
      "from",
      "select",
      "order",
      "limit",
      "eq",
      "ilike",
    ]);
    assertEquals(mock.state.calls[0].args, ["workflows"]);
    assertEquals(mock.state.calls[1].args, [
      "id, name, description, is_active, trigger_type, created_at, updated_at, last_run_at, last_run_status",
    ]);
    assertEquals(mock.state.calls[2].args, ["updated_at", { ascending: false }]);
    assertEquals(mock.state.calls[3].args, [100]);
    assertEquals(mock.state.calls[4].args, ["is_active", true]);
    assertEquals(mock.state.calls[5].args, ["name", "%facture%"]);
  });
});

Deno.test("executeListWorkflows returns a failure result when Supabase returns an error", async () => {
  await withTestEnv(async () => {
    const { executeListWorkflows } = await importTools();
    const mock = createSupabaseMock({ data: null, error: new Error("database unavailable") });

    const result = await executeListWorkflows(
      { supabase: mock.supabase, userId: "user-1" },
      { limit: 10 },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "database unavailable");
    assertExists(result.execution_time_ms);
  });
});

Deno.test("executeGetWorkflowRuns filters runs and computes summary with rounded error rate", async () => {
  await withTestEnv(async () => {
    const { executeGetWorkflowRuns } = await importTools();
    const runs = [
      { id: "run-1", workflow_id: "wf-1", status: "success", duration_ms: 120 },
      { id: "run-2", workflow_id: "wf-1", status: "error", duration_ms: 50 },
      { id: "run-3", workflow_id: "wf-1", status: "error", duration_ms: 80 },
      { id: "run-4", workflow_id: "wf-1", status: "running", duration_ms: null },
    ];
    const mock = createSupabaseMock({ data: runs, error: null });

    const result = await executeGetWorkflowRuns(
      { supabase: mock.supabase, userId: "user-1" },
      { workflow_id: "wf-1", status: "error", limit: 500 },
    );

    assertEquals(result.success, true);
    assertEquals(result.data.runs, runs);
    assertEquals(result.data.summary, {
      total: 4,
      success: 1,
      errors: 2,
      error_rate: 50,
    });
    assertExists(result.execution_time_ms);

    assertEquals(mock.state.calls.map((call) => call.method), [
      "from",
      "select",
      "order",
      "limit",
      "eq",
      "eq",
    ]);
    assertEquals(mock.state.calls[0].args, ["workflow_runs"]);
    assertEquals(mock.state.calls[2].args, ["started_at", { ascending: false }]);
    assertEquals(mock.state.calls[3].args, [100]);
    assertEquals(mock.state.calls[4].args, ["workflow_id", "wf-1"]);
    assertEquals(mock.state.calls[5].args, ["status", "error"]);
  });
});

Deno.test("executeGetWorkflowRuns returns zero summary for an empty history", async () => {
  await withTestEnv(async () => {
    const { executeGetWorkflowRuns } = await importTools();
    const mock = createSupabaseMock({ data: [], error: null });

    const result = await executeGetWorkflowRuns(
      { supabase: mock.supabase, userId: "user-1" },
      {},
    );

    assertEquals(result.success, true);
    assertEquals(result.data.runs, []);
    assertEquals(result.data.summary, {
      total: 0,
      success: 0,
      errors: 0,
      error_rate: 0,
    });
  });
});

Deno.test("executeCreateWorkflowFromPrompt rejects prompts shorter than 8 characters without calling fetch", async () => {
  await withTestEnv(async () => {
    const { executeCreateWorkflowFromPrompt } = await importTools();

    await withFetchStub(
      () => {
        throw new Error("fetch should not be called for invalid prompt");
      },
      async () => {
        const result = await executeCreateWorkflowFromPrompt(
          { supabase: {}, userId: "user-42" },
          { prompt: "court", activate: true },
        );

        assertEquals(result.success, false);
        assertEquals(result.error, "Le prompt doit décrire le workflow souhaité (8 caractères minimum)");
        assertExists(result.execution_time_ms);
      },
    );
  });
});

Deno.test("executeCreateWorkflowFromPrompt calls the generation edge function with user id and auto activation", async () => {
  await withTestEnv(async () => {
    const { executeCreateWorkflowFromPrompt } = await importTools();

    await withFetchStub(
      () =>
        jsonResponse({
          workflow: {
            id: "wf-generated",
            name: "Relancer les devis",
            is_active: true,
          },
        }),
      async (calls) => {
        const result = await executeCreateWorkflowFromPrompt(
          { supabase: {}, userId: "user-42" },
          { prompt: "Créer un workflow qui relance les devis ouverts après 7 jours", activate: true },
        );

        assertEquals(result.success, true);
        assertEquals(result.data.message, "Workflow généré et activé");
        assertEquals(result.data.workflow_id, "wf-generated");
        assertEquals(result.data.workflow, {
          id: "wf-generated",
          name: "Relancer les devis",
          is_active: true,
        });

        assertEquals(calls.length, 1);
        assertEquals(String(calls[0].input), `${TEST_SUPABASE_URL}/functions/v1/generate-workflow-from-prompt`);
        assertEquals(calls[0].init?.method, "POST");
        assertEquals((calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
        assertEquals((calls[0].init?.headers as Record<string, string>).Authorization, `Bearer ${TEST_SERVICE_KEY}`);
        assertEquals(JSON.parse(calls[0].init?.body as string), {
          prompt: "Créer un workflow qui relance les devis ouverts après 7 jours",
          user_id: "user-42",
          auto_activate: true,
        });
      },
    );
  });
});

Deno.test("executeCreateWorkflowFromPrompt surfaces edge function errors", async () => {
  await withTestEnv(async () => {
    const { executeCreateWorkflowFromPrompt } = await importTools();

    await withFetchStub(
      () => jsonResponse({ error: "prompt impossible à transformer" }, 422),
      async () => {
        const result = await executeCreateWorkflowFromPrompt(
          { supabase: {}, userId: "user-42" },
          { prompt: "Créer un workflow incompréhensible mais suffisamment long", activate: false },
        );

        assertEquals(result.success, false);
        assertEquals(result.error, "prompt impossible à transformer");
      },
    );
  });
});

Deno.test("executeToggleWorkflow requires workflow_id before calling Supabase", async () => {
  await withTestEnv(async () => {
    const { executeToggleWorkflow } = await importTools();
    const mock = createSupabaseMock({
      data: { id: "wf-unused", name: "Unused", is_active: true },
      error: null,
    });

    const result = await executeToggleWorkflow(
      { supabase: mock.supabase, userId: "user-1" },
      { workflow_id: "", is_active: true },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "workflow_id requis");
    assertEquals(mock.state.calls, []);
  });
});

Deno.test("executeToggleWorkflow updates workflow activation and formats the returned message", async () => {
  await withTestEnv(async () => {
    const { executeToggleWorkflow } = await importTools();
    const mock = createSupabaseMock({
      data: { id: "wf-3", name: "Relance clients", is_active: false },
      error: null,
    });

    const result = await executeToggleWorkflow(
      { supabase: mock.supabase, userId: "user-1" },
      { workflow_id: "wf-3", is_active: false },
    );

    assertEquals(result.success, true);
    assertEquals(result.data.message, 'Workflow "Relance clients" désactivé');
    assertEquals(result.data.workflow, { id: "wf-3", name: "Relance clients", is_active: false });

    assertEquals(mock.state.calls.map((call) => call.method), [
      "from",
      "update",
      "eq",
      "select",
      "single",
    ]);
    assertEquals(mock.state.calls[0].args, ["workflows"]);

    const updatePayload = mock.state.calls[1].args[0] as Record<string, unknown>;
    assertEquals(updatePayload.is_active, false);
    assertExists(updatePayload.updated_at);
    assertEquals(Number.isNaN(Date.parse(updatePayload.updated_at as string)), false);

    assertEquals(mock.state.calls[2].args, ["id", "wf-3"]);
    assertEquals(mock.state.calls[3].args, ["id, name, is_active"]);
  });
});

Deno.test("executeRunWorkflowNow requires workflow_id before dispatching", async () => {
  await withTestEnv(async () => {
    const { executeRunWorkflowNow } = await importTools();

    await withFetchStub(
      () => {
        throw new Error("fetch should not be called without workflow_id");
      },
      async (calls) => {
        const result = await executeRunWorkflowNow(
          { supabase: {}, userId: "user-1" },
          { workflow_id: "", payload: { source: "test" } },
        );

        assertEquals(result.success, false);
        assertEquals(result.error, "workflow_id requis");
        assertEquals(calls.length, 0);
      },
    );
  });
});

Deno.test("executeRunWorkflowNow dispatches a manual workflow run and normalizes runId/status", async () => {
  await withTestEnv(async () => {
    const { executeRunWorkflowNow } = await importTools();

    await withFetchStub(
      () => jsonResponse({ runId: "run-123", status: "running" }),
      async (calls) => {
        const result = await executeRunWorkflowNow(
          { supabase: {}, userId: "user-99" },
          { workflow_id: "wf-99", payload: { invoice_id: "inv-1", amount: 1200 } },
        );

        assertEquals(result.success, true);
        assertEquals(result.data, {
          message: "Workflow déclenché",
          run_id: "run-123",
          status: "running",
        });

        assertEquals(calls.length, 1);
        assertEquals(String(calls[0].input), `${TEST_SUPABASE_URL}/functions/v1/workflow-dispatcher`);
        assertEquals(calls[0].init?.method, "POST");
        assertEquals((calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
        assertEquals((calls[0].init?.headers as Record<string, string>).Authorization, `Bearer ${TEST_SERVICE_KEY}`);
        assertEquals(JSON.parse(calls[0].init?.body as string), {
          workflow_id: "wf-99",
          trigger_type: "manual",
          triggered_by: "user-99",
          payload: { invoice_id: "inv-1", amount: 1200 },
        });
      },
    );
  });
});

Deno.test("executeRunWorkflowNow returns a failure result when dispatcher returns an error", async () => {
  await withTestEnv(async () => {
    const { executeRunWorkflowNow } = await importTools();

    await withFetchStub(
      () => jsonResponse({ error: "workflow introuvable" }, 404),
      async () => {
        const result = await executeRunWorkflowNow(
          { supabase: {}, userId: "user-99" },
          { workflow_id: "wf-missing" },
        );

        assertEquals(result.success, false);
        assertEquals(result.error, "workflow introuvable");
      },
    );
  });
});