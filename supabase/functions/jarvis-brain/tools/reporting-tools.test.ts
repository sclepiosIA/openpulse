import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCreateDashboardSnapshot,
  executeExportToExcel,
  executeGenerateReport,
  executeScheduleReport,
} from "./reporting-tools.ts";

type QueryCall = {
  table: string;
  operation?: string;
  selected?: string;
  filters: Array<{ method: string; column: string; value: unknown }>;
  payload?: unknown;
  limitCount?: number;
  single?: boolean;
  terminal: string;
};

function createMockSupabase(
  resolver: (call: QueryCall) => { data?: unknown; error?: unknown } | Promise<{ data?: unknown; error?: unknown }>,
) {
  const calls: QueryCall[] = [];

  function from(table: string) {
    const state: Omit<QueryCall, "terminal"> = {
      table,
      filters: [],
    };

    const terminal = (terminalName: string) => {
      const call: QueryCall = {
        table: state.table,
        operation: state.operation,
        selected: state.selected,
        filters: [...state.filters],
        payload: state.payload,
        limitCount: state.limitCount,
        single: state.single,
        terminal: terminalName,
      };
      calls.push(call);
      return Promise.resolve(resolver(call));
    };

    const builder = {
      select(columns = "*") {
        if (!state.operation) state.operation = "select";
        state.selected = columns;
        return builder;
      },
      insert(payload: unknown) {
        state.operation = "insert";
        state.payload = payload;
        return builder;
      },
      upsert(payload: unknown) {
        state.operation = "upsert";
        state.payload = payload;
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push({ method: "eq", column, value });
        return builder;
      },
      gte(column: string, value: unknown) {
        state.filters.push({ method: "gte", column, value });
        return builder;
      },
      lte(column: string, value: unknown) {
        state.filters.push({ method: "lte", column, value });
        return builder;
      },
      ilike(column: string, value: unknown) {
        state.filters.push({ method: "ilike", column, value });
        return builder;
      },
      in(column: string, value: unknown) {
        state.filters.push({ method: "in", column, value });
        return builder;
      },
      limit(count: number) {
        state.limitCount = count;
        return terminal("limit");
      },
      single() {
        state.single = true;
        return terminal("single");
      },
      then<TResult1 = { data?: unknown; error?: unknown }, TResult2 = never>(
        onfulfilled?: ((value: { data?: unknown; error?: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return terminal("then").then(onfulfilled, onrejected);
      },
    };

    return builder;
  }

  return { supabase: { from }, calls };
}

Deno.test("executeGenerateReport génère un rapport CRM avec agrégats et sauvegarde le rapport", async () => {
  const { supabase, calls } = createMockSupabase((call) => {
    if (call.table === "etablissements") {
      return { data: [{ statut: "prospect" }, { statut: "client" }, { statut: "prospect" }], error: null };
    }
    if (call.table === "taches") {
      return { data: [{ statut: "Termine" }, { statut: "En cours" }, { statut: "Termine" }], error: null };
    }
    if (call.table === "contacts") {
      return { data: [{ id: "c1" }, { id: "c2" }], error: null };
    }
    if (call.table === "ai_analysis_log") {
      return { data: { id: "report-crm-1" }, error: null };
    }
    return { data: [], error: null };
  });

  const result = await executeGenerateReport(
    { supabase: supabase as any, userId: "user-123" },
    {
      title: "Activité CRM janvier",
      type: "crm_activity",
      period_start: "2024-01-01T00:00:00Z",
      period_end: "2024-01-31T23:59:59Z",
      filters: { region: "IDF" },
    },
  );

  assertEquals(result.success, true);
  const data = result.data as any;
  assertEquals(data.message, 'Rapport "Activité CRM janvier" généré');
  assertEquals(data.report_id, "report-crm-1");
  assertEquals(data.report.title, "Activité CRM janvier");
  assertEquals(data.report.type, "crm_activity");
  assertEquals(data.report.period.start, "2024-01-01T00:00:00.000Z");
  assertEquals(data.report.period.end, "2024-01-31T23:59:59.000Z");
  assertExists(data.report.generated_at);
  assertEquals(data.report.sections.etablissements.total, 3);
  assertEquals(data.report.sections.etablissements.by_status, { prospect: 2, client: 1 });
  assertEquals(data.report.sections.tasks.total, 3);
  assertEquals(data.report.sections.tasks.completed, 2);
  assertEquals(data.report.sections.contacts_created, 2);

  const insertCall = calls.find((call) => call.table === "ai_analysis_log" && call.operation === "insert");
  assertExists(insertCall);
  assertEquals((insertCall.payload as any).user_id, "user-123");
  assertEquals((insertCall.payload as any).analysis_type, "report_crm_activity");
  assertEquals((insertCall.payload as any).filters, { region: "IDF" });
  assertEquals((insertCall.payload as any).has_insights, true);
});

Deno.test("executeGenerateReport calcule les totaux financiers par catégorie et le profit", async () => {
  const { supabase } = createMockSupabase((call) => {
    if (call.table === "tresorerie_revenus") {
      return {
        data: [
          { montant: 1000, categorie: "abonnements" },
          { montant: 250, categorie: "abonnements" },
          { montant: 150, categorie: "services" },
        ],
        error: null,
      };
    }
    if (call.table === "tresorerie_depenses") {
      return {
        data: [
          { montant: 300, categorie: "salaires" },
          { montant: 120, categorie: "outillage" },
          { montant: 20, categorie: null },
        ],
        error: null,
      };
    }
    if (call.table === "ai_analysis_log") {
      return { data: { id: "financial-report-1" }, error: null };
    }
    return { data: [], error: null };
  });

  const result = await executeGenerateReport(
    { supabase: supabase as any, userId: "user-finance" },
    {
      title: "Synthèse financière",
      type: "financial",
      period_start: "2024-02-01",
      period_end: "2024-02-29",
    },
  );

  assertEquals(result.success, true);
  const sections = (result.data as any).report.sections;
  assertEquals(sections.revenue.total, 1400);
  assertEquals(sections.revenue.by_category, { abonnements: 1250, services: 150 });
  assertEquals(sections.expenses.total, 440);
  assertEquals(sections.expenses.by_category, { salaires: 300, outillage: 120, other: 20 });
  assertEquals(sections.profit, 960);
});

Deno.test("executeGenerateReport calcule les statistiques support et le temps moyen de résolution", async () => {
  const { supabase } = createMockSupabase((call) => {
    if (call.table === "support_tickets") {
      return {
        data: [
          {
            status: "resolved",
            priority: "high",
            created_at: "2024-03-01T00:00:00Z",
            resolved_at: "2024-03-01T02:00:00Z",
          },
          {
            status: "resolved",
            priority: "critical",
            created_at: "2024-03-02T10:00:00Z",
            resolved_at: "2024-03-02T15:00:00Z",
          },
          {
            status: "open",
            priority: "critical",
            created_at: "2024-03-03T09:00:00Z",
            resolved_at: null,
          },
        ],
        error: null,
      };
    }
    if (call.table === "ai_analysis_log") {
      return { data: { id: "support-report-1" }, error: null };
    }
    return { data: [], error: null };
  });

  const result = await executeGenerateReport(
    { supabase: supabase as any, userId: "support-manager" },
    {
      title: "Support mars",
      type: "support",
      period_start: "2024-03-01",
      period_end: "2024-03-31",
    },
  );

  assertEquals(result.success, true);
  const sections = (result.data as any).report.sections;
  assertEquals(sections.total, 3);
  assertEquals(sections.by_status, { resolved: 2, open: 1 });
  assertEquals(sections.by_priority, { high: 1, critical: 2 });
  assertEquals(sections.avg_resolution_hours, 3.5);
});

Deno.test("executeGenerateReport retourne une section explicite pour un type inconnu", async () => {
  const { supabase, calls } = createMockSupabase((call) => {
    if (call.table === "ai_analysis_log") {
      return { data: { id: "unknown-report-1" }, error: null };
    }
    return { data: [], error: null };
  });

  const result = await executeGenerateReport(
    { supabase: supabase as any, userId: "user-unknown" },
    { title: "Rapport spécial", type: "custom_type" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).report.sections, { message: "Type de rapport non reconnu" });
  assertEquals(calls.filter((call) => call.table !== "ai_analysis_log").length, 0);
});

Deno.test("executeExportToExcel refuse une table non autorisée sans requêter Supabase", async () => {
  const { supabase, calls } = createMockSupabase(() => {
    throw new Error("Supabase ne doit pas être appelée pour une table interdite");
  });

  const result = await executeExportToExcel(
    { supabase: supabase as any, userId: "user-export" },
    { table: "secrets_admin", columns: ["id"] },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Table 'secrets_admin' non autorisée pour l'export");
  assertEquals(calls.length, 0);
});

Deno.test("executeExportToExcel applique les colonnes, filtres et limite puis retourne les lignes exportables", async () => {
  const { supabase, calls } = createMockSupabase((call) => {
    assertEquals(call.table, "contacts");
    assertEquals(call.selected, "id,email");
    assertEquals(call.limitCount, 1000);
    assertEquals(call.filters, [
      { method: "eq", column: "statut", value: "actif" },
      { method: "gte", column: "created_at", value: "2024-01-01" },
      { method: "ilike", column: "email", value: "%example.com%" },
    ]);
    return {
      data: [
        { id: "c1", email: "alice@example.com" },
        { id: "c2", email: "bob@example.com" },
      ],
      error: null,
    };
  });

  const result = await executeExportToExcel(
    { supabase: supabase as any, userId: "user-export" },
    {
      table: "contacts",
      columns: ["id", "email"],
      filename: "contacts_actifs.xlsx",
      filters: [
        { column: "statut", operator: "eq", value: "actif" },
        { column: "created_at", operator: "gte", value: "2024-01-01" },
        { column: "email", operator: "ilike", value: "example.com" },
      ],
    },
  );

  assertEquals(result.success, true);
  const data = result.data as any;
  assertEquals(data.message, "Export préparé: 2 lignes");
  assertEquals(data.filename, "contacts_actifs.xlsx");
  assertEquals(data.table, "contacts");
  assertEquals(data.row_count, 2);
  assertEquals(data.rows, [
    { id: "c1", email: "alice@example.com" },
    { id: "c2", email: "bob@example.com" },
  ]);
  assertEquals(calls.length, 1);
});

Deno.test("executeExportToExcel retourne une erreur métier quand la requête Supabase échoue", async () => {
  const { supabase } = createMockSupabase(() => {
    return { data: null, error: new Error("permission denied") };
  });

  const result = await executeExportToExcel(
    { supabase: supabase as any, userId: "user-export" },
    { table: "taches" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "permission denied");
});

Deno.test("executeCreateDashboardSnapshot calcule les KPI executive", async () => {
  const { supabase } = createMockSupabase((call) => {
    if (call.table === "etablissements") {
      return {
        data: [
          { statut: "production" },
          { statut: "production" },
          { statut: "prospect" },
          { statut: "prospection_active" },
          { statut: "archive" },
        ],
        error: null,
      };
    }
    if (call.table === "taches") {
      return { data: [{ statut: "termine" }, { statut: "termine" }, { statut: "termine" }], error: null };
    }
    if (call.table === "support_tickets") {
      return { data: [{ status: "open" }, { status: "in_progress" }], error: null };
    }
    if (call.table === "tresorerie_revenus") {
      return { data: [{ montant: 1200 }, { montant: 300 }, { montant: null }], error: null };
    }
    return { data: [], error: null };
  });

  const result = await executeCreateDashboardSnapshot(
    { supabase: supabase as any, userId: "ceo-user" },
    { dashboard_type: "executive" },
  );

  assertEquals(result.success, true);
  const data = result.data as any;
  assertEquals(data.message, "Snapshot executive créé");
  assertEquals(data.snapshot.type, "executive");
  assertEquals(data.snapshot.created_by, "ceo-user");
  assertEquals(data.snapshot.metrics, {
    total_clients: 2,
    prospects: 2,
    tasks_completed_month: 3,
    open_tickets: 2,
    mtd_revenue: 1500,
  });
});

Deno.test("executeCreateDashboardSnapshot calcule le pipeline sales avec groupement par étape", async () => {
  const { supabase } = createMockSupabase((call) => {
    assertEquals(call.table, "etablissements");
    assertEquals(call.filters, [
      { method: "in", column: "statut", value: ["prospect", "prospection_active", "negociation", "proposition"] },
    ]);
    return {
      data: [
        { statut: "prospect", valeur_estimee: 1000 },
        { statut: "prospect", valeur_estimee: 2500 },
        { statut: "negociation", valeur_estimee: 4000 },
        { statut: "proposition", valeur_estimee: null },
      ],
      error: null,
    };
  });

  const result = await executeCreateDashboardSnapshot(
    { supabase: supabase as any, userId: "sales-user" },
    { dashboard_type: "sales" },
  );

  assertEquals(result.success, true);
  const metrics = (result.data as any).snapshot.metrics;
  assertEquals(metrics.pipeline_count, 4);
  assertEquals(metrics.pipeline_value, 7500);
  assertEquals(metrics.by_stage, {
    prospect: { count: 2, value: 3500 },
    negociation: { count: 1, value: 4000 },
    proposition: { count: 1, value: 0 },
  });
});

Deno.test("executeCreateDashboardSnapshot calcule les métriques operations", async () => {
  const { supabase } = createMockSupabase((call) => {
    if (call.table === "taches") {
      return {
        data: [
          { priorite: "haute", statut: "en_cours" },
          { priorite: "critique", statut: "en_attente" },
          { priorite: "normale", statut: "en_attente" },
        ],
        error: null,
      };
    }
    if (call.table === "calendar_events") {
      return { data: [{ id: "evt-1" }, { id: "evt-2" }], error: null };
    }
    if (call.table === "support_tickets") {
      return {
        data: [{ priority: "critical" }, { priority: "high" }, { priority: "critical" }],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const result = await executeCreateDashboardSnapshot(
    { supabase: supabase as any, userId: "ops-user" },
    { dashboard_type: "operations" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).snapshot.metrics, {
    pending_tasks: 3,
    urgent_tasks: 2,
    today_events: 2,
    critical_tickets: 2,
  });
});

Deno.test("executeScheduleReport sauvegarde une préférence de rapport programmé", async () => {
  const { supabase, calls } = createMockSupabase((call) => {
    assertEquals(call.table, "user_preferences");
    assertEquals(call.operation, "upsert");
    return { data: { id: "pref-1" }, error: null };
  });

  const result = await executeScheduleReport(
    { supabase: supabase as any, userId: "scheduler-user" },
    {
      report_type: "financial",
      frequency: "weekly",
      recipients: ["finance@example.test", "direction@example.test"],
      title: "Finance hebdo",
    },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, 'Rapport "Finance hebdo" programmé (weekly)');
  assertEquals((result.data as any).schedule, {
    type: "financial",
    frequency: "weekly",
    recipients: ["finance@example.test", "direction@example.test"],
  });

  const upsertCall = calls.find((call) => call.table === "user_preferences" && call.operation === "upsert");
  assertExists(upsertCall);
  const payload = upsertCall.payload as any;
  assertEquals(payload.user_id, "scheduler-user");
  assertEquals(payload.preference_key, "scheduled_report_financial");

  const preference = JSON.parse(payload.preference_value);
  assertEquals(preference.type, "financial");
  assertEquals(preference.frequency, "weekly");
  assertEquals(preference.recipients, ["finance@example.test", "direction@example.test"]);
  assertEquals(preference.title, "Finance hebdo");
  assertEquals(preference.enabled, true);
  assertExists(preference.created_at);
});

Deno.test("executeScheduleReport retourne une erreur si l'upsert échoue", async () => {
  const { supabase } = createMockSupabase(() => {
    return { data: null, error: new Error("upsert failed") };
  });

  const result = await executeScheduleReport(
    { supabase: supabase as any, userId: "scheduler-user" },
    {
      report_type: "support",
      frequency: "monthly",
      recipients: ["support@example.test"],
      title: "Support mensuel",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "upsert failed");
});