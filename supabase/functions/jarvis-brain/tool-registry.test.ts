import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as registry from "./tool-registry.ts";

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      dupes.add(value);
    }
    seen.add(value);
  }

  return [...dupes].sort();
}

function resolveToolDefinitions(): unknown[] | undefined {
  const mod = registry as Record<string, unknown>;
  const candidates: unknown[] = [
    mod.JARVIS_TOOLS,
    mod.JARVIS_TOOLS_V3,
    mod.TOOLS,
    mod.TOOL_REGISTRY,
    mod.toolRegistry,
    mod.toolDefinitions,
    mod.default,
  ];

  for (const fnName of ["getJarvisTools", "getTools", "getToolDefinitions"]) {
    const fn = mod[fnName];
    if (typeof fn === "function") {
      candidates.push((fn as () => unknown)());
    }
  }

  return candidates.find((candidate): candidate is unknown[] => Array.isArray(candidate));
}

function getToolName(tool: unknown): string | undefined {
  if (!tool || typeof tool !== "object") return undefined;
  const candidate = tool as { function?: { name?: unknown } };
  return typeof candidate.function?.name === "string" ? candidate.function.name : undefined;
}

Deno.test("ALLOWED_TABLES expose les tables métier essentielles", () => {
  assertExists(registry.ALLOWED_TABLES);
  assertEquals(Array.isArray(registry.ALLOWED_TABLES), true);
  assertEquals(registry.ALLOWED_TABLES.length >= 100, true);

  assertEquals(registry.ALLOWED_TABLES.slice(0, 4), [
    "etablissements",
    "contacts",
    "groupes_etablissements",
    "partenaires",
  ]);

  for (
    const table of [
      "taches",
      "devis",
      "devis_lignes",
      "factures",
      "factures_lignes",
      "profiles",
      "email_threads",
      "email_messages",
      "support_tickets",
      "calendar_events",
      "documents",
      "rd_tasks",
      "job_offers",
      "contrats",
      "pulse_messages",
      "email_sequence_enrollments",
    ]
  ) {
    assertEquals(registry.ALLOWED_TABLES.includes(table), true);
  }
});

Deno.test("ALLOWED_TABLES refuse implicitement les tables système ou dangereuses", () => {
  for (
    const forbiddenTable of [
      "auth.users",
      "storage.objects",
      "pg_catalog.pg_tables",
      "information_schema.tables",
      "users; drop table profiles",
      "profiles delete",
    ]
  ) {
    assertEquals(registry.ALLOWED_TABLES.includes(forbiddenTable), false);
  }
});

Deno.test("ALLOWED_TABLES ne contient ni doublon ni nom invalide", () => {
  assertEquals(duplicates(registry.ALLOWED_TABLES), []);

  const invalidNames = registry.ALLOWED_TABLES.filter((table) =>
    !/^[a-z][a-z0-9_]*$/.test(table)
  );

  assertEquals(invalidNames, []);
});

Deno.test("AVAILABLE_EDGE_FUNCTIONS expose les fonctions Edge métier attendues", () => {
  assertExists(registry.AVAILABLE_EDGE_FUNCTIONS);
  assertEquals(Array.isArray(registry.AVAILABLE_EDGE_FUNCTIONS), true);
  assertEquals(registry.AVAILABLE_EDGE_FUNCTIONS.length >= 35, true);

  for (
    const fn of [
      "qonto-sync-transactions",
      "qonto-get-balance",
      "generate-invoice-pdf",
      "parse-bulletin-salaire",
      "send-email",
      "send-email-reply",
      "parse-cv",
      "generate-ai-suggestions",
      "jarvis-web-scrape",
      "jarvis-background-worker",
    ]
  ) {
    assertEquals(registry.AVAILABLE_EDGE_FUNCTIONS.includes(fn), true);
  }
});

Deno.test("AVAILABLE_EDGE_FUNCTIONS ne contient ni doublon ni nom invalide", () => {
  assertEquals(duplicates(registry.AVAILABLE_EDGE_FUNCTIONS), []);

  const invalidNames = registry.AVAILABLE_EDGE_FUNCTIONS.filter((fn) =>
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fn)
  );

  assertEquals(invalidNames, []);
});

Deno.test("AVAILABLE_EDGE_FUNCTIONS exclut les fonctions non déclarées", () => {
  for (
    const forbiddenFn of [
      "delete-all-data",
      "admin-reset-database",
      "send_email",
      "kb.semantic.search",
      "jarvis web scrape",
      "qonto-sync-transactions;drop",
    ]
  ) {
    assertEquals(registry.AVAILABLE_EDGE_FUNCTIONS.includes(forbiddenFn), false);
  }
});

Deno.test("les exports de validation optionnels de tables restent cohérents avec ALLOWED_TABLES", () => {
  const mod = registry as Record<string, unknown>;
  const validator = mod.isTableAllowed ?? mod.isAllowedTable ?? mod.validateTableName;

  if (typeof validator !== "function") {
    return;
  }

  const fn = validator as (table: string) => boolean;

  assertEquals(fn("etablissements"), true);
  assertEquals(fn("email_messages"), true);
  assertEquals(fn("pulse_conversations"), true);
  assertEquals(fn("auth.users"), false);
  assertEquals(fn("unknown_table"), false);
});

Deno.test("les exports de validation optionnels d'Edge Functions restent cohérents avec AVAILABLE_EDGE_FUNCTIONS", () => {
  const mod = registry as Record<string, unknown>;
  const validator = mod.isEdgeFunctionAvailable ??
    mod.isAvailableEdgeFunction ??
    mod.validateEdgeFunctionName;

  if (typeof validator !== "function") {
    return;
  }

  const fn = validator as (name: string) => boolean;

  assertEquals(fn("send-email"), true);
  assertEquals(fn("jarvis-web-scrape"), true);
  assertEquals(fn("send_email"), false);
  assertEquals(fn("delete-all-data"), false);
});

Deno.test("les définitions d'outils exportées, si présentes, ont des noms uniques", () => {
  const tools = resolveToolDefinitions();

  if (!tools) {
    return;
  }

  assertEquals(tools.length >= 60, true);

  const names = tools.map(getToolName).filter((name): name is string => typeof name === "string");
  assertEquals(names.length, tools.length);
  assertEquals(duplicates(names), []);

  for (
    const expectedTool of [
      "query_database",
      "send_email",
      "create_task",
      "schedule_meeting",
      "search_knowledge_base",
      "search_documents",
      "index_document",
      "update_entity_status",
      "get_user_context",
      "calculate_metrics",
    ]
  ) {
    assertEquals(names.includes(expectedTool), true);
  }
});

Deno.test("l'outil query_database exporté, si présent, référence exactement ALLOWED_TABLES", () => {
  const tools = resolveToolDefinitions();

  if (!tools) {
    return;
  }

  const queryTool = tools.find((tool) => getToolName(tool) === "query_database") as {
    type?: unknown;
    function?: {
      description?: unknown;
      parameters?: {
        type?: unknown;
        properties?: {
          table?: { enum?: unknown };
          filters?: {
            items?: {
              properties?: {
                operator?: { enum?: unknown };
              };
              required?: unknown;
            };
          };
          limit?: { type?: unknown };
        };
        required?: unknown;
      };
    };
  } | undefined;

  assertExists(queryTool);
  assertEquals(queryTool.type, "function");
  assertEquals(queryTool.function?.parameters?.type, "object");
  assertEquals(queryTool.function?.parameters?.required, ["table"]);
  assertEquals(queryTool.function?.parameters?.properties?.table?.enum, registry.ALLOWED_TABLES);
  assertEquals(queryTool.function?.parameters?.properties?.limit?.type, "number");
  assertEquals(queryTool.function?.parameters?.properties?.filters?.items?.required, [
    "column",
    "operator",
    "value",
  ]);

  assertEquals(
    queryTool.function?.parameters?.properties?.filters?.items?.properties?.operator?.enum,
    ["eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in", "is", "contains"],
  );
});

Deno.test("l'outil execute_edge_function exporté, si présent, référence AVAILABLE_EDGE_FUNCTIONS", () => {
  const tools = resolveToolDefinitions();

  if (!tools) {
    return;
  }

  const executeTool = tools.find((tool) => getToolName(tool) === "execute_edge_function") as {
    type?: unknown;
    function?: {
      parameters?: {
        properties?: {
          function_name?: { enum?: unknown };
          name?: { enum?: unknown };
        };
      };
    };
  } | undefined;

  if (!executeTool) {
    return;
  }

  assertEquals(executeTool.type, "function");

  const enumValue = executeTool.function?.parameters?.properties?.function_name?.enum ??
    executeTool.function?.parameters?.properties?.name?.enum;

  assertEquals(enumValue, registry.AVAILABLE_EDGE_FUNCTIONS);
});