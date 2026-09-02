import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOptimizedContext,
  CONTEXT_BUDGETS,
  getContextBudget,
  getSystemHealthStatus,
  type SystemHealthStatus,
} from "./optimized-context-builder.ts";

type Operation = {
  method: string;
  args: unknown[];
};

type QueryCall = {
  table: string;
  operations: Operation[];
};

type QueryResult = {
  data: unknown;
};

type TableResolver = unknown[] | Record<string, unknown> | null | Error | ((call: QueryCall) => unknown[] | Record<string, unknown> | null);

type SupabaseMockOptions = {
  fromThrows?: boolean;
};

class MockQuery {
  private call: QueryCall;

  constructor(
    private table: string,
    private tableData: Record<string, TableResolver>,
    private calls: QueryCall[],
  ) {
    this.call = { table, operations: [] };
    this.calls.push(this.call);
  }

  select(...args: unknown[]): this {
    return this.record("select", ...args);
  }

  eq(...args: unknown[]): this {
    return this.record("eq", ...args);
  }

  in(...args: unknown[]): this {
    return this.record("in", ...args);
  }

  order(...args: unknown[]): this {
    return this.record("order", ...args);
  }

  limit(...args: unknown[]): this {
    return this.record("limit", ...args);
  }

  lt(...args: unknown[]): this {
    return this.record("lt", ...args);
  }

  not(...args: unknown[]): this {
    return this.record("not", ...args);
  }

  or(...args: unknown[]): this {
    return this.record("or", ...args);
  }

  gt(...args: unknown[]): this {
    return this.record("gt", ...args);
  }

  gte(...args: unknown[]): this {
    return this.record("gte", ...args);
  }

  maybeSingle(): Promise<QueryResult> {
    this.record("maybeSingle");
    try {
      const raw = this.resolveRaw();
      const data = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
      return Promise.resolve({ data });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.getResult())
      .then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private record(method: string, ...args: unknown[]): this {
    this.call.operations.push({ method, args });
    return this;
  }

  private resolveRaw(): unknown[] | Record<string, unknown> | null {
    const resolver = this.tableData[this.table];

    if (resolver instanceof Error) {
      throw resolver;
    }

    if (typeof resolver === "function") {
      return resolver(this.call);
    }

    if (resolver === undefined) {
      return [];
    }

    return resolver;
  }

  private getResult(): QueryResult {
    const raw = this.resolveRaw();

    if (!Array.isArray(raw)) {
      return { data: raw ?? [] };
    }

    let data = [...raw];
    const limitOps = this.call.operations.filter((operation) => operation.method === "limit");
    const lastLimit = limitOps.at(-1)?.args[0];

    if (typeof lastLimit === "number") {
      data = data.slice(0, lastLimit);
    }

    return { data };
  }
}

function createSupabaseMock(
  tableData: Record<string, TableResolver> = {},
  options: SupabaseMockOptions = {},
): { supabase: any; calls: QueryCall[] } {
  const calls: QueryCall[] = [];

  return {
    calls,
    supabase: {
      from(table: string) {
        if (options.fromThrows) {
          throw new Error(`Unexpected database access for ${table}`);
        }
        return new MockQuery(table, tableData, calls);
      },
    },
  };
}

function hasOperation(call: QueryCall, method: string, args?: unknown[]): boolean {
  return call.operations.some((operation) => {
    if (operation.method !== method) return false;
    if (!args) return true;
    return JSON.stringify(operation.args) === JSON.stringify(args);
  });
}

Deno.test("module exports the expected testable API", () => {
  assertExists(buildOptimizedContext);
  assertExists(getContextBudget);
  assertExists(getSystemHealthStatus);
  assertExists(CONTEXT_BUDGETS);
  assertEquals(typeof buildOptimizedContext, "function");
  assertEquals(typeof getContextBudget, "function");
  assertEquals(typeof getSystemHealthStatus, "function");
});

Deno.test("getContextBudget returns balanced limits for every health status and falls back to HEALTHY", () => {
  assertEquals(getContextBudget("HEALTHY"), {
    teamLimit: 15,
    tasksLimit: 12,
    overdueTasksLimit: 5,
    establishmentsLimit: 10,
    emailsLimit: 8,
    eventsLimit: 6,
    ticketsLimit: 5,
    groupsLimit: 8,
    partnersLimit: 8,
  });

  assertEquals(getContextBudget("DEGRADED").teamLimit, 8);
  assertEquals(getContextBudget("DEGRADED").tasksLimit, 5);
  assertEquals(getContextBudget("UNHEALTHY").teamLimit, 3);
  assertEquals(getContextBudget("UNHEALTHY").emailsLimit, 2);

  assertEquals(getContextBudget("OFFLINE"), {
    teamLimit: 0,
    tasksLimit: 3,
    overdueTasksLimit: 2,
    establishmentsLimit: 0,
    emailsLimit: 0,
    eventsLimit: 0,
    ticketsLimit: 0,
    groupsLimit: 0,
    partnersLimit: 0,
  });

  assertEquals(getContextBudget("UNKNOWN_STATUS" as SystemHealthStatus), CONTEXT_BUDGETS.HEALTHY);
});

Deno.test("getSystemHealthStatus maps circuit states to context health status", async () => {
  const cases: Array<{ state: string | null; expected: SystemHealthStatus }> = [
    { state: "OPEN", expected: "UNHEALTHY" },
    { state: "HALF_OPEN", expected: "DEGRADED" },
    { state: "CLOSED", expected: "HEALTHY" },
    { state: null, expected: "HEALTHY" },
  ];

  for (const testCase of cases) {
    const { supabase, calls } = createSupabaseMock({
      jarvis_circuit_state: testCase.state === null ? null : { state: testCase.state },
    });

    const status = await getSystemHealthStatus(supabase);

    assertEquals(status, testCase.expected);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].table, "jarvis_circuit_state");
    assertEquals(hasOperation(calls[0], "select", ["state"]), true);
    assertEquals(hasOperation(calls[0], "eq", ["circuit_name", "azure_openai"]), true);
    assertEquals(hasOperation(calls[0], "maybeSingle"), true);
  }
});

Deno.test("getSystemHealthStatus returns HEALTHY when the circuit-state query fails", async () => {
  const { supabase } = createSupabaseMock({}, { fromThrows: true });

  const status = await getSystemHealthStatus(supabase);

  assertEquals(status, "HEALTHY");
});

Deno.test("buildOptimizedContext returns an empty context and performs no database query in OFFLINE mode", async () => {
  const { supabase, calls } = createSupabaseMock();

  const context = await buildOptimizedContext(
    supabase,
    `profile-offline-${crypto.randomUUID()}`,
    "OFFLINE",
  );

  assertEquals(context, "");
  assertEquals(calls.length, 0);
});

Deno.test("buildOptimizedContext builds a compact rich context with merged establishments and reference hints", async () => {
  const profileId = `profile-rich-${crypto.randomUUID()}`;

  const todayNoon = new Date();
  todayNoon.setHours(12, 0, 0, 0);

  const tomorrowMorning = new Date(todayNoon);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 30, 0, 0);

  const overdueDate = new Date(todayNoon);
  overdueDate.setDate(overdueDate.getDate() - 2);

  const { supabase, calls } = createSupabaseMock({
    profiles: [
      {
        id: "user-1",
        prenom: "Alice",
        nom: "Martin",
        email: "alice@example.test",
        fonction: "CSM",
      },
      {
        id: "user-2",
        prenom: "Bob",
        nom: "Durand",
        email: "bob@example.test",
        fonction: null,
      },
    ],
    taches: (call) => {
      if (hasOperation(call, "lt")) {
        return [
          {
            id: "late-1",
            titre: "Relancer contrat",
            statut: "En cours",
            priorite: null,
            echeance: overdueDate.toISOString(),
          },
        ];
      }

      return [
        {
          id: "task-1",
          titre: "Préparer comité",
          statut: "En cours",
          priorite: "haute",
          echeance: todayNoon.toISOString(),
        },
        {
          id: "task-2",
          titre: "Appeler direction",
          statut: "A faire",
          priorite: null,
          echeance: null,
        },
      ];
    },
    etablissements: [
      {
        id: "est-1",
        nom: "Clinique Alpha",
        ville: "Lyon",
        statut: "Actif",
        commercial_id: profileId,
        chef_projet_id: "another-profile",
        csm_id: profileId,
      },
      {
        id: "est-2",
        nom: "EHPAD Beta",
        ville: null,
        statut: "Onboarding",
        commercial_id: "another-profile",
        chef_projet_id: profileId,
        csm_id: null,
      },
    ],
    email_threads: [
      {
        id: "mail-1",
        subject: "Sujet original",
        ai_generated_title: "Titre IA",
      },
      {
        id: "mail-2",
        subject: "Question facturation",
        ai_generated_title: null,
      },
    ],
    calendar_events: [
      {
        id: "evt-1",
        title: "Réunion lancement",
        start_time: tomorrowMorning.toISOString(),
      },
    ],
    support_tickets: [
      {
        id: "tic-1",
        titre: "Erreur portail",
        priorite: "urgent",
      },
    ],
    groupes_etablissements: [
      {
        id: "grp-1",
        nom: "Groupe Santé",
      },
    ],
    partenaires: [
      {
        id: "partner-1",
        nom: "PartnerX",
      },
    ],
  });

  const context = await buildOptimizedContext(supabase, profileId, "HEALTHY");

  assertEquals(context.startsWith("\n\n=== CONTEXTE ===\n"), true);
  assertEquals(context.endsWith("================"), true);
  assertEquals(context.includes("👥 ÉQUIPE (2): Alice Martin <alice@example.test> - CSM | Bob Durand <bob@example.test>"), true);
  assertEquals(context.includes("📋 TÂCHES (2): [task-1][H]Préparer comité (auj) | [task-2]Appeler direction"), true);
  assertEquals(context.includes("📝 Pour référencer une tâche, utilise: [[task:ID|titre]]"), true);
  assertEquals(context.includes("⚠️ EN RETARD (1): [late-1]Relancer contrat"), true);
  assertEquals(context.includes("🏥 ÉTABLISSEMENTS (2): [est-1]Clinique Alpha (Lyon) [Commercial, CSM] | [est-2]EHPAD Beta [Chef de projet]"), true);
  assertEquals(context.includes("📝 Pour référencer un établissement, utilise: [[etablissement:ID|nom]]"), true);
  assertEquals(context.includes("📧 EMAILS NON LUS (2): [mail-1]Titre IA | [mail-2]Question facturation"), true);
  assertEquals(context.includes("📝 Pour référencer un email, utilise: [[email:ID|titre]]"), true);
  assertEquals(context.includes("📅 ÉVÉNEMENTS: [evt-1]Réunion lancement (dem"), true);
  assertEquals(context.includes("09:30"), true);
  assertEquals(context.includes("📝 Pour référencer un événement, utilise: [[event:ID|titre]]"), true);
  assertEquals(context.includes("🎫 TICKETS (1): [tic-1][U] Erreur portail"), true);
  assertEquals(context.includes("📝 Pour référencer un ticket, utilise: [[ticket:ID|titre]]"), true);
  assertEquals(context.includes("🏢 Groupes: Groupe Santé | Partenaires: PartnerX"), true);

  assertEquals(calls.length, 9);

  const establishmentCalls = calls.filter((call) => call.table === "etablissements");
  assertEquals(establishmentCalls.length, 1);
  assertEquals(
    hasOperation(establishmentCalls[0], "select", ["id, nom, ville, statut, commercial_id, chef_projet_id, csm_id"]),
    true,
  );
  assertEquals(
    hasOperation(establishmentCalls[0], "or", [`commercial_id.eq.${profileId},chef_projet_id.eq.${profileId},csm_id.eq.${profileId}`]),
    true,
  );
  assertEquals(hasOperation(establishmentCalls[0], "limit", [10]), true);

  const profilesCall = calls.find((call) => call.table === "profiles");
  assertExists(profilesCall);
  assertEquals(hasOperation(profilesCall, "select", ["id, prenom, nom, email, fonction"]), true);
  assertEquals(hasOperation(profilesCall, "eq", ["actif", true]), true);
  assertEquals(hasOperation(profilesCall, "limit", [15]), true);

  const taskCalls = calls.filter((call) => call.table === "taches");
  assertEquals(taskCalls.length, 2);
  assertEquals(taskCalls.some((call) => hasOperation(call, "in", ["statut", ["A faire", "En cours"]])), true);
  assertEquals(taskCalls.some((call) => hasOperation(call, "not", ["statut", "in", "(\"Terminé\",\"Annulé\")"])), true);
});

Deno.test("buildOptimizedContext uses reduced UNHEALTHY limits for all non-disabled query families", async () => {
  const profileId = `profile-unhealthy-${crypto.randomUUID()}`;

  const { supabase, calls } = createSupabaseMock({
    profiles: [
      { id: "u1", prenom: "Mini", nom: "User", email: "mini@example.test", fonction: null },
      { id: "u2", prenom: "Ignored", nom: "ByLimit", email: "ignored@example.test", fonction: null },
      { id: "u3", prenom: "Also", nom: "Kept", email: "also@example.test", fonction: null },
      { id: "u4", prenom: "Too", nom: "Much", email: "too@example.test", fonction: null },
    ],
    taches: [],
    etablissements: [],
    email_threads: [],
    calendar_events: [],
    support_tickets: [],
    groupes_etablissements: [],
    partenaires: [],
  });

  const context = await buildOptimizedContext(supabase, profileId, "UNHEALTHY");

  assertEquals(context.includes("👥 ÉQUIPE (3):"), true);

  const expectedLimits: Record<string, number[]> = {
    profiles: [3],
    etablissements: [3],
    email_threads: [2],
    calendar_events: [2],
    support_tickets: [2],
    groupes_etablissements: [3],
    partenaires: [3],
  };

  for (const [table, limits] of Object.entries(expectedLimits)) {
    const tableCall = calls.find((call) => call.table === table);
    assertExists(tableCall);
    for (const limit of limits) {
      assertEquals(hasOperation(tableCall, "limit", [limit]), true);
    }
  }

  const taskCalls = calls.filter((call) => call.table === "taches");
  assertEquals(taskCalls.length, 2);
  assertEquals(taskCalls.some((call) => hasOperation(call, "limit", [3])), true);
  assertEquals(taskCalls.some((call) => hasOperation(call, "limit", [2])), true);
});

Deno.test("buildOptimizedContext caches a non-empty context by profile and health status", async () => {
  const profileId = `profile-cache-${crypto.randomUUID()}`;

  const firstMock = createSupabaseMock({
    profiles: [
      {
        id: "cached-user",
        prenom: "Cache",
        nom: "Hit",
        email: "cache@example.test",
        fonction: "Support",
      },
    ],
    taches: [],
    etablissements: [],
    email_threads: [],
    calendar_events: [],
    support_tickets: [],
    groupes_etablissements: [],
    partenaires: [],
  });

  const firstContext = await buildOptimizedContext(firstMock.supabase, profileId, "HEALTHY");

  assertEquals(firstContext.includes("Cache Hit <cache@example.test> - Support"), true);
  assertEquals(firstMock.calls.length, 9);

  const secondMock = createSupabaseMock({
    profiles: [
      {
        id: "different-user",
        prenom: "Different",
        nom: "Data",
        email: "different@example.test",
        fonction: null,
      },
    ],
  });

  const secondContext = await buildOptimizedContext(secondMock.supabase, profileId, "HEALTHY");

  assertEquals(secondContext, firstContext);
  assertEquals(secondMock.calls.length, 0);
});

Deno.test("buildOptimizedContext returns an empty string when a database query throws", async () => {
  const { supabase } = createSupabaseMock({}, { fromThrows: true });

  const context = await buildOptimizedContext(
    supabase,
    `profile-error-${crypto.randomUUID()}`,
    "HEALTHY",
  );

  assertEquals(context, "");
});