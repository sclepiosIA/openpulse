import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canParallelize,
  estimateParallelizationGain,
  executeToolsParallel,
  type ToolCall,
} from "./parallel-executor.ts";

Deno.test("canParallelize returns false for empty and single tool calls", () => {
  assertEquals(canParallelize([]), false);

  const singleCall: ToolCall[] = [
    {
      id: "tool-1",
      name: "send_email",
      arguments: { to: "user@example.test", subject: "Hello" },
    },
  ];

  assertEquals(canParallelize(singleCall), false);
});

Deno.test("canParallelize returns true for independent tools executable in the same layer", () => {
  const toolCalls: ToolCall[] = [
    {
      id: "email-1",
      name: "send_email",
      arguments: { to: "user@example.test", subject: "Compte rendu" },
    },
    {
      id: "task-1",
      name: "create_task",
      arguments: { title: "Relancer le client", priority: "high" },
    },
    {
      id: "qonto-1",
      name: "sync_qonto_transactions",
      arguments: { since: "2025-01-01" },
    },
  ];

  assertEquals(canParallelize(toolCalls), true);
});

Deno.test("canParallelize returns false when explicit dependencies force sequential execution", () => {
  const toolCalls: ToolCall[] = [
    {
      id: "conflicts-1",
      name: "detect_calendar_conflicts",
      arguments: { start: "2025-02-01T10:00:00Z", end: "2025-02-01T11:00:00Z" },
    },
    {
      id: "meeting-1",
      name: "schedule_meeting",
      arguments: { title: "Point client", start: "2025-02-01T10:00:00Z" },
    },
  ];

  assertEquals(canParallelize(toolCalls), false);
  assertEquals(estimateParallelizationGain(toolCalls), 0);
});

Deno.test("canParallelize detects data dependencies from producer table references", () => {
  const sequentialDataDependency: ToolCall[] = [
    {
      id: "query-contacts",
      name: "query_database",
      arguments: { table: "contacts", filters: { company_id: "company-1" } },
    },
    {
      id: "email-contact",
      name: "send_email",
      arguments: {
        recipientSource: "contacts",
        subject: "Suivi commercial",
      },
    },
  ];

  assertEquals(canParallelize(sequentialDataDependency), false);
  assertEquals(estimateParallelizationGain(sequentialDataDependency), 0);
});

Deno.test("canParallelize returns true when at least one execution layer contains multiple tools despite dependencies", () => {
  const toolCalls: ToolCall[] = [
    {
      id: "conflicts-1",
      name: "detect_calendar_conflicts",
      arguments: { start: "2025-03-12T09:00:00Z", end: "2025-03-12T10:00:00Z" },
    },
    {
      id: "meeting-1",
      name: "schedule_meeting",
      arguments: { title: "Comité de pilotage", start: "2025-03-12T09:00:00Z" },
    },
    {
      id: "task-1",
      name: "create_task",
      arguments: { title: "Préparer le support", due_date: "2025-03-11" },
    },
  ];

  assertEquals(canParallelize(toolCalls), true);
  assertEquals(estimateParallelizationGain(toolCalls), 33);
});

Deno.test("estimateParallelizationGain returns expected values for empty, single, and fully parallel batches", () => {
  assertEquals(estimateParallelizationGain([]), 0);

  assertEquals(
    estimateParallelizationGain([
      {
        id: "only-1",
        name: "create_invoice",
        arguments: { amount: 1200, currency: "EUR" },
      },
    ]),
    0,
  );

  const fourIndependentCalls: ToolCall[] = [
    {
      id: "email-1",
      name: "send_email",
      arguments: { to: "client-a@example.test", subject: "A" },
    },
    {
      id: "task-1",
      name: "create_task",
      arguments: { title: "Tâche A" },
    },
    {
      id: "qonto-1",
      name: "sync_qonto_transactions",
      arguments: { since: "2025-01-01" },
    },
    {
      id: "invoice-1",
      name: "create_invoice",
      arguments: { customer_id: "customer-1", amount: 500 },
    },
  ];

  assertEquals(estimateParallelizationGain(fourIndependentCalls), 75);
});

Deno.test("estimateParallelizationGain accounts for producer-consumer layers", () => {
  const toolCalls: ToolCall[] = [
    {
      id: "query-establishments",
      name: "query_database",
      arguments: { table: "establishments", filters: { status: "active" } },
    },
    {
      id: "email-establishment",
      name: "send_email",
      arguments: {
        template: "renewal",
        source: "establishments",
      },
    },
    {
      id: "task-independent",
      name: "create_task",
      arguments: { title: "Vérifier les pièces jointes" },
    },
  ];

  assertEquals(canParallelize(toolCalls), true);
  assertEquals(estimateParallelizationGain(toolCalls), 33);
});

Deno.test("executeToolsParallel returns an empty result without invoking tools for an empty batch", async () => {
  const result = await executeToolsParallel([], {} as never);

  assertExists(result);
  assertEquals(result.results instanceof Map, true);
  assertEquals(result.results.size, 0);
  assertEquals(result.executionOrder, []);
  assertEquals(result.totalTimeMs, 0);
  assertEquals(result.parallelizationGain, 0);
});