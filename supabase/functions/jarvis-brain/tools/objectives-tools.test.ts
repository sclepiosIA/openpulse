import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

let cachedModule: any;

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    Deno.env.delete(key);
  } else {
    Deno.env.set(key, value);
  }
}

async function withSupabaseEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.set("SUPABASE_URL", "https://local-test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    return await fn();
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
}

async function loadModule() {
  return await withSupabaseEnv(async () => {
    if (!cachedModule) {
      cachedModule = await import("./objectives-tools.ts");
    }
    return cachedModule;
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type FetchCall = {
  url: string;
  method: string;
  bodyText: string;
  body: any;
  headers: Record<string, string>;
};

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const bodyText = await request.clone().text();

    let body: any = undefined;
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }
    }

    const call: FetchCall = {
      url: request.url,
      method: request.method,
      bodyText,
      body,
      headers: Object.fromEntries(request.headers.entries()),
    };

    calls.push(call);
    return await handler(call);
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function dateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

Deno.test("module loads and exports objectives functions and tool definitions", async () => {
  const mod = await loadModule();

  assertEquals(typeof mod.createObjective, "function");
  assertEquals(typeof mod.updateObjectiveProgress, "function");
  assertEquals(typeof mod.listObjectives, "function");
  assertEquals(typeof mod.analyzeObjectivesProgress, "function");
  assertExists(mod.OBJECTIVES_TOOL_DEFINITIONS);
  assertEquals(mod.OBJECTIVES_TOOL_DEFINITIONS.length, 4);
});

Deno.test("OBJECTIVES_TOOL_DEFINITIONS exposes expected tool names", async () => {
  const { OBJECTIVES_TOOL_DEFINITIONS } = await loadModule();

  assertEquals(
    OBJECTIVES_TOOL_DEFINITIONS.map((definition: any) => definition.name),
    [
      "create_objective",
      "update_objective_progress",
      "list_objectives",
      "analyze_objectives",
    ],
  );
});

Deno.test("OBJECTIVES_TOOL_DEFINITIONS exposes expected schemas and security levels", async () => {
  const { OBJECTIVES_TOOL_DEFINITIONS } = await loadModule();

  const createDefinition = OBJECTIVES_TOOL_DEFINITIONS.find((definition: any) =>
    definition.name === "create_objective"
  );
  const updateDefinition = OBJECTIVES_TOOL_DEFINITIONS.find((definition: any) =>
    definition.name === "update_objective_progress"
  );
  const listDefinition = OBJECTIVES_TOOL_DEFINITIONS.find((definition: any) =>
    definition.name === "list_objectives"
  );
  const analyzeDefinition = OBJECTIVES_TOOL_DEFINITIONS.find((definition: any) =>
    definition.name === "analyze_objectives"
  );

  assertExists(createDefinition);
  assertExists(updateDefinition);
  assertExists(listDefinition);
  assertExists(analyzeDefinition);

  assertEquals(createDefinition.security_level, "moderate");
  assertEquals(updateDefinition.security_level, "safe");
  assertEquals(listDefinition.security_level, "safe");
  assertEquals(analyzeDefinition.security_level, "safe");

  assertEquals(createDefinition.parameters.type, "object");
  assertEquals(createDefinition.parameters.required, [
    "title",
    "category",
    "target_metric",
    "target_value",
    "end_date",
  ]);
  assertEquals(createDefinition.parameters.properties.category.enum, [
    "revenue",
    "productivity",
    "quality",
    "growth",
    "custom",
  ]);
  assertEquals(createDefinition.parameters.properties.priority.enum, [
    "low",
    "medium",
    "high",
    "critical",
  ]);

  assertEquals(updateDefinition.parameters.required, ["objective_id", "new_value"]);
  assertEquals(listDefinition.parameters.required, []);
  assertEquals(listDefinition.parameters.properties.status.enum, [
    "active",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ]);
  assertEquals(analyzeDefinition.parameters.properties, {});
  assertEquals(analyzeDefinition.parameters.required, []);
});

Deno.test("createObjective inserts an active objective with defaults and generated milestones", async () => {
  const { createObjective } = await loadModule();

  const fetchMock = stubFetch((call) => {
    if (call.method === "POST" && new URL(call.url).pathname === "/rest/v1/jarvis_objectives") {
      return jsonResponse({ id: "objective-1", created_at: "2026-01-01T00:00:00Z", ...call.body });
    }
    return jsonResponse({ message: `unexpected request: ${call.method} ${call.url}` }, 500);
  });

  try {
    const result = await createObjective("user-123", {
      title: "Atteindre 100k€ de CA",
      category: "revenue",
      target_metric: "ca_annuel",
      target_value: 100000,
      end_date: "2026-12-31",
    });

    assertEquals(result.success, true);
    assertExists(result.objective);
    assertEquals(result.objective.id, "objective-1");

    assertEquals(fetchMock.calls.length, 1);

    const insertCall = fetchMock.calls[0];
    const insertUrl = new URL(insertCall.url);

    assertEquals(insertCall.method, "POST");
    assertEquals(insertUrl.pathname, "/rest/v1/jarvis_objectives");
    assertEquals(insertCall.body.user_id, "user-123");
    assertEquals(insertCall.body.title, "Atteindre 100k€ de CA");
    assertEquals(insertCall.body.description, null);
    assertEquals(insertCall.body.category, "revenue");
    assertEquals(insertCall.body.target_metric, "ca_annuel");
    assertEquals(insertCall.body.target_value, 100000);
    assertEquals(insertCall.body.current_value, 0);
    assertEquals(insertCall.body.unit, "");
    assertEquals(insertCall.body.end_date, "2026-12-31");
    assertEquals(insertCall.body.status, "active");
    assertEquals(insertCall.body.priority, "medium");
    assertEquals(insertCall.body.progress_history, []);
    assertEquals(insertCall.body.start_date, new Date().toISOString().split("T")[0]);
    assertEquals(insertCall.body.milestones, [
      { value: 25000, label: "25%", achieved: false, achieved_at: null },
      { value: 50000, label: "50%", achieved: false, achieved_at: null },
      { value: 75000, label: "75%", achieved: false, achieved_at: null },
      { value: 100000, label: "100%", achieved: false, achieved_at: null },
    ]);
  } finally {
    fetchMock.restore();
  }
});

Deno.test("createObjective preserves optional description, unit and priority", async () => {
  const { createObjective } = await loadModule();

  const fetchMock = stubFetch((call) => {
    if (call.method === "POST") {
      return jsonResponse({ id: "objective-quality-1", ...call.body });
    }
    return jsonResponse({ message: "unexpected request" }, 500);
  });

  try {
    const result = await createObjective("user-quality", {
      title: "Satisfaction client",
      description: "Maintenir un score de satisfaction élevé",
      category: "quality",
      target_metric: "satisfaction_moyenne",
      target_value: 95,
      unit: "%",
      end_date: "2026-06-30",
      priority: "critical",
    });

    assertEquals(result.success, true);
    assertEquals(result.objective.description, "Maintenir un score de satisfaction élevé");
    assertEquals(result.objective.unit, "%");
    assertEquals(result.objective.priority, "critical");
    assertEquals(fetchMock.calls[0].body.milestones.map((milestone: any) => milestone.value), [
      23.75,
      47.5,
      71.25,
      95,
    ]);
  } finally {
    fetchMock.restore();
  }
});

Deno.test("createObjective returns a structured failure when Supabase insert fails", async () => {
  const { createObjective } = await loadModule();

  const fetchMock = stubFetch(() =>
    jsonResponse({
      message: "insert failed",
      details: "invalid objective payload",
      hint: null,
      code: "PGRST_TEST",
    }, 400)
  );

  try {
    const result = await createObjective("user-123", {
      title: "Objectif invalide",
      category: "custom",
      target_metric: "metric",
      target_value: 10,
      end_date: "2026-01-31",
    });

    assertEquals(result.success, false);
    assertExists(result.error);
    assertEquals(typeof result.error, "string");
  } finally {
    fetchMock.restore();
  }
});

Deno.test("updateObjectiveProgress appends history, achieves milestones and completes objective at target", async () => {
  const { updateObjectiveProgress } = await loadModule();

  const existingObjective = {
    id: "objective-42",
    user_id: "user-42",
    title: "100 ventes",
    status: "active",
    target_value: 100,
    current_value: 40,
    progress_history: [
      {
        date: "2026-01-01T00:00:00.000Z",
        value: 40,
        delta: 40,
        note: "démarrage",
      },
    ],
    milestones: [
      { value: 25, label: "25%", achieved: true, achieved_at: "2026-01-01T00:00:00.000Z" },
      { value: 50, label: "50%", achieved: false, achieved_at: null },
      { value: 75, label: "75%", achieved: false, achieved_at: null },
      { value: 100, label: "100%", achieved: false, achieved_at: null },
    ],
  };

  const fetchMock = stubFetch((call) => {
    if (call.method === "GET") {
      return jsonResponse(existingObjective);
    }

    if (call.method === "PATCH") {
      return jsonResponse({ ...existingObjective, ...call.body });
    }

    return jsonResponse({ message: `unexpected request: ${call.method}` }, 500);
  });

  try {
    const result = await updateObjectiveProgress(
      "user-42",
      "objective-42",
      100,
      "Objectif atteint",
    );

    assertEquals(result.success, true);
    assertExists(result.objective);
    assertEquals(fetchMock.calls.length, 2);

    const selectCall = fetchMock.calls[0];
    const selectUrl = new URL(selectCall.url);
    assertEquals(selectCall.method, "GET");
    assertEquals(selectUrl.pathname, "/rest/v1/jarvis_objectives");
    assertEquals(selectUrl.searchParams.get("id"), "eq.objective-42");
    assertEquals(selectUrl.searchParams.get("user_id"), "eq.user-42");

    const updateCall = fetchMock.calls[1];
    const updateUrl = new URL(updateCall.url);
    assertEquals(updateCall.method, "PATCH");
    assertEquals(updateUrl.searchParams.get("id"), "eq.objective-42");
    assertEquals(updateCall.body.current_value, 100);
    assertEquals(updateCall.body.status, "completed");

    assertEquals(updateCall.body.progress_history.length, 2);
    assertEquals(updateCall.body.progress_history[1].value, 100);
    assertEquals(updateCall.body.progress_history[1].delta, 60);
    assertEquals(updateCall.body.progress_history[1].note, "Objectif atteint");
    assertExists(updateCall.body.progress_history[1].date);

    assertEquals(updateCall.body.milestones.map((milestone: any) => milestone.achieved), [
      true,
      true,
      true,
      true,
    ]);
    assertExists(updateCall.body.milestones[1].achieved_at);
    assertExists(updateCall.body.milestones[2].achieved_at);
    assertExists(updateCall.body.milestones[3].achieved_at);
  } finally {
    fetchMock.restore();
  }
});

Deno.test("updateObjectiveProgress stores null note and keeps active status below target", async () => {
  const { updateObjectiveProgress } = await loadModule();

  const existingObjective = {
    id: "objective-active",
    user_id: "user-active",
    title: "Progression partielle",
    status: "active",
    target_value: 200,
    current_value: 50,
    progress_history: [],
    milestones: [
      { value: 50, label: "25%", achieved: true, achieved_at: "2026-01-01T00:00:00.000Z" },
      { value: 100, label: "50%", achieved: false, achieved_at: null },
      { value: 150, label: "75%", achieved: false, achieved_at: null },
      { value: 200, label: "100%", achieved: false, achieved_at: null },
    ],
  };

  const fetchMock = stubFetch((call) => {
    if (call.method === "GET") return jsonResponse(existingObjective);
    if (call.method === "PATCH") return jsonResponse({ ...existingObjective, ...call.body });
    return jsonResponse({ message: "unexpected request" }, 500);
  });

  try {
    const result = await updateObjectiveProgress("user-active", "objective-active", 120);

    assertEquals(result.success, true);
    assertEquals(fetchMock.calls[1].body.status, "active");
    assertEquals(fetchMock.calls[1].body.progress_history[0].value, 120);
    assertEquals(fetchMock.calls[1].body.progress_history[0].delta, 70);
    assertEquals(fetchMock.calls[1].body.progress_history[0].note, null);
    assertEquals(fetchMock.calls[1].body.milestones.map((milestone: any) => milestone.achieved), [
      true,
      true,
      false,
      false,
    ]);
  } finally {
    fetchMock.restore();
  }
});

Deno.test("updateObjectiveProgress returns failure when current objective fetch fails", async () => {
  const { updateObjectiveProgress } = await loadModule();

  const fetchMock = stubFetch(() =>
    jsonResponse({
      message: "objective fetch failed",
      details: "not found",
      hint: null,
      code: "PGRST_TEST",
    }, 404)
  );

  try {
    const result = await updateObjectiveProgress("user-missing", "objective-missing", 10);

    assertEquals(result.success, false);
    assertExists(result.error);
    assertEquals(typeof result.error, "string");
  } finally {
    fetchMock.restore();
  }
});

Deno.test("updateObjectiveProgress returns explicit failure when no current objective is returned", async () => {
  const { updateObjectiveProgress } = await loadModule();

  const fetchMock = stubFetch((call) => {
    if (call.method === "GET") {
      return jsonResponse(null);
    }
    return jsonResponse({ message: "unexpected update" }, 500);
  });

  try {
    const result = await updateObjectiveProgress("user-missing", "objective-missing", 10);

    assertEquals(result.success, false);
    assertEquals(result.error, "Objectif non trouvé");
    assertEquals(fetchMock.calls.length, 1);
  } finally {
    fetchMock.restore();
  }
});

Deno.test("listObjectives selects user objectives and applies status filter", async () => {
  const { listObjectives } = await loadModule();

  const rows = [
    { id: "objective-a", user_id: "user-list", status: "active", title: "A" },
    { id: "objective-b", user_id: "user-list", status: "active", title: "B" },
  ];

  const fetchMock = stubFetch((call) => {
    if (call.method === "GET") {
      return jsonResponse(rows);
    }
    return jsonResponse({ message: "unexpected request" }, 500);
  });

  try {
    const result = await listObjectives("user-list", "active");

    assertEquals(result.success, true);
    assertEquals(result.objectives, rows);
    assertEquals(fetchMock.calls.length, 1);

    const url = new URL(fetchMock.calls[0].url);
    assertEquals(url.pathname, "/rest/v1/jarvis_objectives");
    assertEquals(url.searchParams.get("select"), "*");
    assertEquals(url.searchParams.get("user_id"), "eq.user-list");
    assertEquals(url.searchParams.get("status"), "eq.active");
    assertEquals(url.searchParams.get("order"), "created_at.desc");
  } finally {
    fetchMock.restore();
  }
});

Deno.test("listObjectives omits status filter when status is not provided", async () => {
  const { listObjectives } = await loadModule();

  const fetchMock = stubFetch(() => jsonResponse([]));

  try {
    const result = await listObjectives("user-without-filter");

    assertEquals(result.success, true);
    assertEquals(result.objectives, []);

    const url = new URL(fetchMock.calls[0].url);
    assertEquals(url.searchParams.get("user_id"), "eq.user-without-filter");
    assertEquals(url.searchParams.has("status"), false);
    assertEquals(url.searchParams.get("order"), "created_at.desc");
  } finally {
    fetchMock.restore();
  }
});

Deno.test("listObjectives returns structured failure on select error", async () => {
  const { listObjectives } = await loadModule();

  const fetchMock = stubFetch(() =>
    jsonResponse({
      message: "select failed",
      details: "database unavailable",
      hint: null,
      code: "PGRST_TEST",
    }, 503)
  );

  try {
    const result = await listObjectives("user-error");

    assertEquals(result.success, false);
    assertExists(result.error);
    assertEquals(typeof result.error, "string");
  } finally {
    fetchMock.restore();
  }
});

Deno.test("analyzeObjectivesProgress summarizes active, completed, on-track and behind objectives", async () => {
  const { analyzeObjectivesProgress } = await loadModule();

  const objectives = [
    {
      id: "on-track",
      title: "Objectif dans les temps",
      status: "active",
      start_date: dateDaysFromNow(-10),
      end_date: dateDaysFromNow(10),
      target_value: 100,
      current_value: 70,
    },
    {
      id: "behind",
      title: "Objectif très en retard",
      status: "active",
      start_date: dateDaysFromNow(-40),
      end_date: dateDaysFromNow(10),
      target_value: 100,
      current_value: 5,
    },
    {
      id: "completed",
      title: "Objectif terminé",
      status: "completed",
      start_date: dateDaysFromNow(-30),
      end_date: dateDaysFromNow(-1),
      target_value: 50,
      current_value: 50,
    },
  ];

  const fetchMock = stubFetch((call) => {
    if (call.method === "GET") return jsonResponse(objectives);
    return jsonResponse({ message: "unexpected request" }, 500);
  });

  try {
    const result = await analyzeObjectivesProgress("user-analysis");

    assertEquals(result.success, true);
    assertExists(result.summary);
    assertEquals(result.summary.total, 3);
    assertEquals(result.summary.active, 2);
    assertEquals(result.summary.completed, 1);
    assertEquals(result.summary.onTrack, 1);
    assertEquals(result.summary.behind, 1);
    assertEquals(result.summary.recommendations.length, 1);
    assertEquals(
      result.summary.recommendations[0].includes("\"Objectif très en retard\" est en retard"),
      true,
    );

    const url = new URL(fetchMock.calls[0].url);
    assertEquals(url.pathname, "/rest/v1/jarvis_objectives");
    assertEquals(url.searchParams.get("select"), "*");
    assertEquals(url.searchParams.get("user_id"), "eq.user-analysis");
  } finally {
    fetchMock.restore();
  }
});

Deno.test("analyzeObjectivesProgress handles empty objective list", async () => {
  const { analyzeObjectivesProgress } = await loadModule();

  const fetchMock = stubFetch(() => jsonResponse([]));

  try {
    const result = await analyzeObjectivesProgress("user-empty");

    assertEquals(result.success, true);
    assertEquals(result.summary, {
      total: 0,
      active: 0,
      completed: 0,
      onTrack: 0,
      behind: 0,
      recommendations: [],
    });
  } finally {
    fetchMock.restore();
  }
});

Deno.test("analyzeObjectivesProgress counts target_value zero active objective as behind", async () => {
  const { analyzeObjectivesProgress } = await loadModule();

  const objectives = [
    {
      id: "zero-target",
      title: "Objectif sans cible positive",
      status: "active",
      start_date: dateDaysFromNow(-10),
      end_date: dateDaysFromNow(10),
      target_value: 0,
      current_value: 0,
    },
  ];

  const fetchMock = stubFetch(() => jsonResponse(objectives));

  try {
    const result = await analyzeObjectivesProgress("user-zero-target");

    assertEquals(result.success, true);
    assertEquals(result.summary?.total, 1);
    assertEquals(result.summary?.active, 1);
    assertEquals(result.summary?.completed, 0);
    assertEquals(result.summary?.onTrack, 0);
    assertEquals(result.summary?.behind, 1);
    assertEquals(result.summary?.recommendations.length, 1);
  } finally {
    fetchMock.restore();
  }
});

Deno.test("analyzeObjectivesProgress returns structured failure on query error", async () => {
  const { analyzeObjectivesProgress } = await loadModule();

  const fetchMock = stubFetch(() =>
    jsonResponse({
      message: "analysis query failed",
      details: "permission denied",
      hint: null,
      code: "PGRST_TEST",
    }, 403)
  );

  try {
    const result = await analyzeObjectivesProgress("user-forbidden");

    assertEquals(result.success, false);
    assertExists(result.error);
    assertEquals(typeof result.error, "string");
  } finally {
    fetchMock.restore();
  }
});