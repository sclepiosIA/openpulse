import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getCircuit,
  canExecuteBase,
  recordSuccessBase,
  recordFailureBase,
  canExecutePersistent,
} from "./circuit-breaker-persistent.ts";

function uniqueCircuitName(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

Deno.test("module exports load successfully", () => {
  assertExists(getCircuit);
  assertExists(canExecuteBase);
  assertExists(recordSuccessBase);
  assertExists(recordFailureBase);
  assertExists(canExecutePersistent);
  assertExists(assertThrows);
  assertExists(assertRejects);
});

Deno.test("getCircuit initializes a new circuit with closed state and empty metrics", () => {
  const name = uniqueCircuitName("init");
  const circuit = getCircuit(name);

  assertEquals(circuit.state, "CLOSED");
  assertEquals(circuit.metrics.totalRequests, 0);
  assertEquals(circuit.metrics.successCount, 0);
  assertEquals(circuit.metrics.failureCount, 0);
  assertEquals(circuit.metrics.consecutiveFailures, 0);
  assertEquals(circuit.metrics.consecutiveSuccesses, 0);
  assertEquals(circuit.metrics.avgLatencyMs, 0);
  assertEquals(circuit.metrics.p95LatencyMs, 0);
  assertEquals(circuit.metrics.lastFailureTime, null);
  assertEquals(circuit.metrics.lastSuccessTime, null);
});

Deno.test("canExecutePersistent without forceRestore delegates to in-memory circuit state only", async () => {
  const name = uniqueCircuitName("can-execute");

  const result = await canExecutePersistent(name, false);

  assertEquals(result.allowed, true);
  assertEquals(result.state, "CLOSED");
  assertEquals(result.reason, undefined);
});

Deno.test("recordSuccessBase increments success metrics and keeps circuit executable", async () => {
  const name = uniqueCircuitName("success");

  recordSuccessBase(name, 120);
  const circuit = getCircuit(name);
  const execution = await canExecutePersistent(name, false);

  assertEquals(circuit.state, "CLOSED");
  assertEquals(circuit.metrics.totalRequests, 1);
  assertEquals(circuit.metrics.successCount, 1);
  assertEquals(circuit.metrics.failureCount, 0);
  assertEquals(circuit.metrics.consecutiveSuccesses, 1);
  assertEquals(circuit.metrics.consecutiveFailures, 0);
  assertEquals(circuit.metrics.avgLatencyMs, 120);
  assertEquals(circuit.metrics.p95LatencyMs, 120);
  assertExists(circuit.metrics.lastSuccessTime);
  assertEquals(circuit.metrics.lastFailureTime, null);
  assertEquals(execution.allowed, true);
  assertEquals(execution.state, "CLOSED");
});

Deno.test("recordFailureBase increments failure metrics and records latency", () => {
  const name = uniqueCircuitName("failure");

  recordFailureBase(name, 250, "upstream timeout");
  const circuit = getCircuit(name);

  assertEquals(circuit.metrics.totalRequests, 1);
  assertEquals(circuit.metrics.successCount, 0);
  assertEquals(circuit.metrics.failureCount, 1);
  assertEquals(circuit.metrics.consecutiveFailures, 1);
  assertEquals(circuit.metrics.consecutiveSuccesses, 0);
  assertEquals(circuit.metrics.avgLatencyMs, 250);
  assertEquals(circuit.metrics.p95LatencyMs, 250);
  assertExists(circuit.metrics.lastFailureTime);
  assertEquals(circuit.metrics.lastSuccessTime, null);
});

Deno.test("success after failure resets consecutive failure counter", () => {
  const name = uniqueCircuitName("failure-then-success");

  recordFailureBase(name, 300, "temporary error");
  recordSuccessBase(name, 100);
  const circuit = getCircuit(name);

  assertEquals(circuit.metrics.totalRequests, 2);
  assertEquals(circuit.metrics.failureCount, 1);
  assertEquals(circuit.metrics.successCount, 1);
  assertEquals(circuit.metrics.consecutiveFailures, 0);
  assertEquals(circuit.metrics.consecutiveSuccesses, 1);
  assertExists(circuit.metrics.lastFailureTime);
  assertExists(circuit.metrics.lastSuccessTime);
});