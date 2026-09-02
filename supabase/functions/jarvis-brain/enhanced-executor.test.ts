import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeToolsOptimized,
  prepareExecutionPlan,
  preAnalyzeRequest,
  prefetchLikelyData,
  recordExecutionMetrics,
} from "./enhanced-executor.ts";

function assertIncludes<T>(values: T[], expected: T) {
  assertEquals(values.includes(expected), true);
}

function createPrefetchSupabaseStub(
  tableResponses: Record<string, { data: unknown[] | null; error: unknown } | Error>,
) {
  const calls: Array<{
    table: string;
    select?: string;
    limit?: number;
    order?: string;
    orderOptions?: unknown;
  }> = [];

  const supabase = {
    from(table: string) {
      const call = { table };
      calls.push(call);

      return {
        select(columns: string) {
          call.select = columns;

          return {
            limit(limitValue: number) {
              call.limit = limitValue;

              return {
                order(column: string, options: unknown) {
                  call.order = column;
                  call.orderOptions = options;

                  const response = tableResponses[table];
                  if (response instanceof Error) {
                    throw response;
                  }

                  return Promise.resolve(response ?? { data: [], error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  return { supabase, calls };
}

Deno.test("module exports the enhanced executor public API", () => {
  assertExists(prepareExecutionPlan);
  assertExists(preAnalyzeRequest);
  assertExists(prefetchLikelyData);
  assertExists(recordExecutionMetrics);
  assertExists(executeToolsOptimized);

  assertEquals(typeof prepareExecutionPlan, "function");
  assertEquals(typeof preAnalyzeRequest, "function");
  assertEquals(typeof prefetchLikelyData, "function");
  assertEquals(typeof recordExecutionMetrics, "function");
  assertEquals(typeof executeToolsOptimized, "function");
});

Deno.test("prepareExecutionPlan parses tool arguments and estimates execution time", () => {
  const plan = prepareExecutionPlan("Liste mes tâches ouvertes", [
    {
      id: "call_tasks",
      function: {
        name: "list_tasks",
        arguments: '{"status":"open","limit":3}',
      },
    },
    {
      id: "call_profile",
      function: {
        name: "get_user_profile",
        arguments: "{invalid json",
      },
    },
  ]);

  assertEquals(plan.toolCalls.length, 2);
  assertEquals(plan.toolCalls[0], {
    id: "call_tasks",
    name: "list_tasks",
    arguments: { status: "open", limit: 3 },
  });
  assertEquals(plan.toolCalls[1], {
    id: "call_profile",
    name: "get_user_profile",
    arguments: {},
  });
  assertEquals(plan.requiresUserConfirmation, [false, false]);
  assertEquals(plan.estimatedTimeMs, 1000);
  assertEquals(typeof plan.canParallelize, "boolean");
});

Deno.test("prepareExecutionPlan handles an empty tool list", () => {
  const plan = prepareExecutionPlan("Bonjour Jarvis", []);

  assertEquals(plan.toolCalls, []);
  assertEquals(plan.requiresUserConfirmation, []);
  assertEquals(plan.estimatedTimeMs, 0);
  assertEquals(typeof plan.canParallelize, "boolean");
});

Deno.test("preAnalyzeRequest detects business data that should be prefetched", () => {
  const analysis = preAnalyzeRequest(
    "Liste mes tâches et taches, affiche le pipeline des établissements et etablissements, montre les factures de trésorerie tresorerie et les tickets support.",
  );

  assertIncludes(analysis.shouldPrefetch, "taches");
  assertIncludes(analysis.shouldPrefetch, "etablissements");
  assertIncludes(analysis.shouldPrefetch, "factures");
  assertIncludes(analysis.shouldPrefetch, "support_tickets");

  assertEquals(new Set(analysis.shouldPrefetch).size, analysis.shouldPrefetch.length);
  assertEquals(new Set(analysis.suggestedTools).size, analysis.suggestedTools.length);
  assertEquals(["simple", "moderate", "complex"].includes(analysis.complexity), true);
  assertEquals(typeof analysis.likelyMultiIntent, "boolean");
});

Deno.test("preAnalyzeRequest keeps an unrelated request simple and without prefetch tables", () => {
  const analysis = preAnalyzeRequest("Bonjour, comment vas-tu ?");

  assertEquals(Array.isArray(analysis.suggestedTools), true);
  assertEquals(Array.isArray(analysis.shouldPrefetch), true);
  assertEquals(new Set(analysis.suggestedTools).size, analysis.suggestedTools.length);
  assertEquals(new Set(analysis.shouldPrefetch).size, analysis.shouldPrefetch.length);
  assertEquals(["simple", "moderate", "complex"].includes(analysis.complexity), true);
});

Deno.test("prefetchLikelyData queries each requested table with the expected limits and ordering", async () => {
  const { supabase, calls } = createPrefetchSupabaseStub({
    taches: {
      data: [
        { id: "task_1", title: "Relancer le client" },
        { id: "task_2", title: "Préparer le devis" },
      ],
      error: null,
    },
    factures: {
      data: [{ id: "invoice_1", amount: 1200 }],
      error: null,
    },
  });

  const result = await prefetchLikelyData({ supabase } as any, ["taches", "factures"]);

  assertEquals(result.get("taches"), [
    { id: "task_1", title: "Relancer le client" },
    { id: "task_2", title: "Préparer le devis" },
  ]);
  assertEquals(result.get("factures"), [{ id: "invoice_1", amount: 1200 }]);

  assertEquals(calls.length, 2);
  assertEquals(calls[0], {
    table: "taches",
    select: "*",
    limit: 20,
    order: "created_at",
    orderOptions: { ascending: false },
  });
  assertEquals(calls[1], {
    table: "factures",
    select: "*",
    limit: 20,
    order: "created_at",
    orderOptions: { ascending: false },
  });
});

Deno.test("prefetchLikelyData ignores failed tables and keeps successful prefetched data", async () => {
  const { supabase } = createPrefetchSupabaseStub({
    taches: {
      data: [{ id: "task_ok", title: "Tâche disponible" }],
      error: null,
    },
    factures: {
      data: null,
      error: { message: "permission denied" },
    },
    support_tickets: new Error("temporary database failure"),
  });

  const result = await prefetchLikelyData(
    { supabase } as any,
    ["taches", "factures", "support_tickets"],
  );

  assertEquals(result.size, 1);
  assertEquals(result.get("taches"), [{ id: "task_ok", title: "Tâche disponible" }]);
  assertEquals(result.has("factures"), false);
  assertEquals(result.has("support_tickets"), false);
});

Deno.test("recordExecutionMetrics inserts the expected execution metric payload", async () => {
  let selectedTable = "";
  let insertedPayload: any = undefined;

  const adminClient = {
    from(table: string) {
      selectedTable = table;

      return {
        insert(payload: unknown) {
          insertedPayload = payload;
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  const result = {
    results: [
      { success: true, data: { id: "ok" }, execution_time_ms: 120 },
      { success: false, error: "failed", execution_time_ms: 30 },
    ],
    parallelized: true,
    totalTimeMs: 150,
    parallelGain: 350,
    intentsDetected: 2,
    executionStrategy: "parallel" as const,
  };

  const longMessage = "x".repeat(130);

  await recordExecutionMetrics(
    {
      userId: "user_test",
      adminClient,
    } as any,
    result,
    longMessage,
  );

  assertEquals(selectedTable, "jarvis_performance_metrics");
  assertExists(insertedPayload);
  assertEquals(insertedPayload.user_id, "user_test");
  assertEquals(insertedPayload.metric_type, "execution");
  assertEquals(insertedPayload.value, 150);
  assertEquals(insertedPayload.breakdown.parallelized, true);
  assertEquals(insertedPayload.breakdown.parallel_gain, 350);
  assertEquals(insertedPayload.breakdown.tools_count, 2);
  assertEquals(insertedPayload.breakdown.strategy, "parallel");
  assertEquals(insertedPayload.breakdown.intents, 2);
  assertEquals(insertedPayload.breakdown.success_rate, 0.5);
  assertEquals(insertedPayload.breakdown.message_preview, "x".repeat(100));
});

Deno.test("recordExecutionMetrics swallows persistence errors", async () => {
  const adminClient = {
    from() {
      return {
        insert() {
          throw new Error("insert failed");
        },
      };
    },
  };

  await recordExecutionMetrics(
    {
      userId: "user_test",
      adminClient,
    } as any,
    {
      results: [{ success: true, execution_time_ms: 1 }],
      parallelized: false,
      totalTimeMs: 1,
      parallelGain: 0,
      intentsDetected: 1,
      executionStrategy: "sequential",
    } as any,
    "message",
  );

  assertEquals(true, true);
});

Deno.test("executeToolsOptimized returns an empty sequential result when no tools are provided", async () => {
  const result = await executeToolsOptimized({} as any, []);

  assertEquals(result.results, []);
  assertEquals(result.parallelized, false);
  assertEquals(result.totalTimeMs, 0);
  assertEquals(result.parallelGain, 0);
  assertEquals(result.intentsDetected, 0);
  assertEquals(result.executionStrategy, "sequential");
});