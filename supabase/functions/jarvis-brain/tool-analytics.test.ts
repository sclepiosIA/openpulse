import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  flushAnalyticsToDB,
  getAnalyticsSnapshot,
  getAnalyticsSummaryText,
  recordCircuitTrip,
  recordToolAnalytics,
} from "./tool-analytics.ts";

function uniqueToolName(label: string): string {
  return `deno_test_${label}_${crypto.randomUUID()}`;
}

Deno.test("initial analytics snapshot has sane empty defaults", () => {
  const snapshot = getAnalyticsSnapshot();

  assertEquals(snapshot.totalCalls, 0);
  assertEquals(snapshot.successRate, 100);
  assertEquals(snapshot.avgLatencyMs, 0);
  assertEquals(snapshot.topTools, []);
  assertExists(snapshot.circuitBreakers);
  assertExists(snapshot.toolHealth);
  assertEquals(getAnalyticsSummaryText(), "Aucune donnée d'utilisation disponible.");
});

Deno.test("recordToolAnalytics aggregates calls, success rate and average latency per tool", () => {
  const toolName = uniqueToolName("aggregation");

  recordToolAnalytics(toolName, true, 100);
  recordToolAnalytics(toolName, false, 300, true);
  recordToolAnalytics(toolName, true, 200);

  const snapshot = getAnalyticsSnapshot();
  const tool = snapshot.topTools.find((entry) => entry.name === toolName);

  assertExists(tool);
  assertEquals(tool.calls, 3);
  assertEquals(tool.successRate, 67);
  assertEquals(tool.avgLatencyMs, 200);
  assertEquals(snapshot.totalCalls >= 3, true);
});

Deno.test("getAnalyticsSnapshot sorts top tools by descending call count", () => {
  const lowVolumeTool = uniqueToolName("low_volume");
  const highVolumeTool = uniqueToolName("high_volume");

  for (let i = 0; i < 2; i++) {
    recordToolAnalytics(lowVolumeTool, true, 50);
  }

  for (let i = 0; i < 8; i++) {
    recordToolAnalytics(highVolumeTool, true, 120);
  }

  const ownTools = getAnalyticsSnapshot().topTools
    .filter((entry) => entry.name === lowVolumeTool || entry.name === highVolumeTool);

  assertEquals(ownTools.length, 2);
  assertEquals(ownTools[0].name, highVolumeTool);
  assertEquals(ownTools[0].calls, 8);
  assertEquals(ownTools[1].name, lowVolumeTool);
  assertEquals(ownTools[1].calls, 2);
});

Deno.test("getAnalyticsSummaryText renders business thresholds with green, yellow and red status markers", () => {
  const greenTool = uniqueToolName("green");
  const yellowTool = uniqueToolName("yellow");
  const redTool = uniqueToolName("red");

  for (let i = 0; i < 30; i++) {
    recordToolAnalytics(greenTool, true, 90);
  }

  for (let i = 0; i < 21; i++) {
    recordToolAnalytics(yellowTool, true, 150);
  }
  for (let i = 0; i < 9; i++) {
    recordToolAnalytics(yellowTool, false, 150);
  }

  for (let i = 0; i < 20; i++) {
    recordToolAnalytics(redTool, true, 250);
  }
  for (let i = 0; i < 10; i++) {
    recordToolAnalytics(redTool, false, 250);
  }

  const summary = getAnalyticsSummaryText();

  assertEquals(summary.includes("## 📊 Analytics Jarvis (session en cours)"), true);
  assertEquals(summary.includes(`🟢 **${greenTool}**: 30x | 100% | 90ms`), true);
  assertEquals(summary.includes(`🟡 **${yellowTool}**: 30x | 70% | 150ms`), true);
  assertEquals(summary.includes(`🔴 **${redTool}**: 30x | 67% | 250ms`), true);
});

Deno.test("recordCircuitTrip creates a tool analytics record without changing call totals", () => {
  const toolName = uniqueToolName("circuit_trip");
  const before = getAnalyticsSnapshot().totalCalls;

  recordCircuitTrip(toolName);
  recordCircuitTrip(toolName);

  const after = getAnalyticsSnapshot();
  const tool = after.topTools.find((entry) => entry.name === toolName);

  assertEquals(after.totalCalls, before);
  assertExists(tool);
  assertEquals(tool.calls, 0);
  assertEquals(tool.successRate, 0);
  assertEquals(tool.avgLatencyMs, 0);
});

Deno.test("flushAnalyticsToDB returns without network or database call when Supabase env is missing", async () => {
  const toolName = uniqueToolName("flush_no_env");
  recordToolAnalytics(toolName, true, 42);

  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  globalThis.fetch = (async () => {
    throw new Error("unexpected network call");
  }) as typeof fetch;

  Date.now = () => originalNow() + 61_000;
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const result = await flushAnalyticsToDB();
    assertEquals(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;

    if (previousUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousUrl);
    }

    if (previousServiceKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
    }
  }
});