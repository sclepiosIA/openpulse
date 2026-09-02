/**
 * JARVIS 16.0 - Tool Analytics & Observability
 * 
 * Tracks tool usage patterns, costs, response times, and success rates.
 * Persists metrics to database for dashboard consumption.
 */

import { createClient } from "@supabase/supabase-js";
import { getAllToolHealth, type ToolHealthMetrics } from "./tool-health.ts";
import { getAllCircuitStates } from "./smart-retry.ts";

// ============================================================
// In-Memory Aggregation (persisted periodically)
// ============================================================
interface ToolUsageRecord {
  toolName: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  lastCalledAt: number;
  retryCount: number;
  circuitBreakerTrips: number;
}

const usageRecords = new Map<string, ToolUsageRecord>();
let lastFlushTime = Date.now();
const FLUSH_INTERVAL_MS = 60_000; // Flush every 60s

function getOrCreateRecord(toolName: string): ToolUsageRecord {
  if (!usageRecords.has(toolName)) {
    usageRecords.set(toolName, {
      toolName,
      callCount: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      maxLatencyMs: 0,
      minLatencyMs: Infinity,
      lastCalledAt: 0,
      retryCount: 0,
      circuitBreakerTrips: 0,
    });
  }
  return usageRecords.get(toolName)!;
}

// ============================================================
// Recording Functions
// ============================================================

/**
 * Record a tool execution for analytics
 */
export function recordToolAnalytics(
  toolName: string,
  success: boolean,
  latencyMs: number,
  wasRetry: boolean = false
): void {
  const record = getOrCreateRecord(toolName);
  record.callCount++;
  if (success) record.successCount++;
  else record.failureCount++;
  record.totalLatencyMs += latencyMs;
  record.maxLatencyMs = Math.max(record.maxLatencyMs, latencyMs);
  record.minLatencyMs = Math.min(record.minLatencyMs, latencyMs);
  record.lastCalledAt = Date.now();
  if (wasRetry) record.retryCount++;
}

/**
 * Record a circuit breaker trip
 */
export function recordCircuitTrip(toolName: string): void {
  const record = getOrCreateRecord(toolName);
  record.circuitBreakerTrips++;
}

// ============================================================
// Analytics Queries
// ============================================================

/**
 * Get real-time analytics snapshot
 */
export function getAnalyticsSnapshot(): {
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  topTools: Array<{ name: string; calls: number; successRate: number; avgLatencyMs: number }>;
  circuitBreakers: Record<string, { state: string; failures: number }>;
  toolHealth: Record<string, ToolHealthMetrics>;
} {
  let totalCalls = 0;
  let totalSuccess = 0;
  let totalLatency = 0;

  const toolStats: Array<{ name: string; calls: number; successRate: number; avgLatencyMs: number }> = [];

  usageRecords.forEach((record) => {
    totalCalls += record.callCount;
    totalSuccess += record.successCount;
    totalLatency += record.totalLatencyMs;

    toolStats.push({
      name: record.toolName,
      calls: record.callCount,
      successRate: record.callCount > 0 ? Math.round((record.successCount / record.callCount) * 100) : 0,
      avgLatencyMs: record.callCount > 0 ? Math.round(record.totalLatencyMs / record.callCount) : 0,
    });
  });

  // Sort by call count descending
  toolStats.sort((a, b) => b.calls - a.calls);

  return {
    totalCalls,
    successRate: totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 100,
    avgLatencyMs: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
    topTools: toolStats.slice(0, 20),
    circuitBreakers: getAllCircuitStates(),
    toolHealth: getAllToolHealth(),
  };
}

// ============================================================
// Persistence (flush to database)
// ============================================================

/**
 * Flush aggregated metrics to the database
 * Call this periodically or at the end of a request
 */
export async function flushAnalyticsToDB(): Promise<void> {
  const now = Date.now();
  if (now - lastFlushTime < FLUSH_INTERVAL_MS) return;
  lastFlushTime = now;

  if (usageRecords.size === 0) return;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const periodKey = new Date().toISOString().slice(0, 13); // Hourly bucket: "2026-02-22T14"

    const records: Array<Record<string, unknown>> = [];

    usageRecords.forEach((record) => {
      if (record.callCount === 0) return;
      records.push({
        period: periodKey,
        tool_name: record.toolName,
        call_count: record.callCount,
        success_count: record.successCount,
        failure_count: record.failureCount,
        avg_latency_ms: record.callCount > 0 ? Math.round(record.totalLatencyMs / record.callCount) : 0,
        max_latency_ms: record.maxLatencyMs,
        retry_count: record.retryCount,
        circuit_trips: record.circuitBreakerTrips,
      });
    });

    if (records.length > 0) {
      const { error } = await supabase
        .from('jarvis_tool_analytics')
        .upsert(records, { onConflict: 'period,tool_name' });

      if (error) {
        // Table might not exist yet - that's OK, just log
        console.warn('[ToolAnalytics] Flush failed (table may not exist):', error.message);
      } else {
        console.log(`[ToolAnalytics] Flushed ${records.length} tool metrics to DB`);
      }
    }
  } catch (error) {
    console.warn('[ToolAnalytics] Flush error:', error);
  }
}

/**
 * Generate a human-readable analytics summary
 */
export function getAnalyticsSummaryText(): string {
  const snapshot = getAnalyticsSnapshot();
  
  if (snapshot.totalCalls === 0) return 'Aucune donnée d\'utilisation disponible.';

  const lines = [
    `## 📊 Analytics Jarvis (session en cours)`,
    ``,
    `**Global:** ${snapshot.totalCalls} appels | ${snapshot.successRate}% réussite | ${snapshot.avgLatencyMs}ms latence moy.`,
    ``,
    `### Top outils:`,
  ];

  for (const tool of snapshot.topTools.slice(0, 10)) {
    const bar = tool.successRate >= 90 ? '🟢' : tool.successRate >= 70 ? '🟡' : '🔴';
    lines.push(`${bar} **${tool.name}**: ${tool.calls}x | ${tool.successRate}% | ${tool.avgLatencyMs}ms`);
  }

  // Circuit breakers
  const openCircuits = Object.entries(snapshot.circuitBreakers).filter(([_, s]) => s.state !== 'closed');
  if (openCircuits.length > 0) {
    lines.push(`\n### ⚡ Circuit Breakers actifs:`);
    for (const [name, state] of openCircuits) {
      lines.push(`🔴 **${name}**: ${state.state} (${state.failures} échecs)`);
    }
  }

  return lines.join('\n');
}
