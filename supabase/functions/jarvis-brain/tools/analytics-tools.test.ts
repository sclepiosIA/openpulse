import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeGetDashboardSummary,
  executeGetDailyDigest,
  executeGetPerformanceReport,
  executeAnalyzeTrends,
} from "./analytics-tools.ts";

type QueryResponse = {
  data?: unknown;
  count?: number | null;
};

class QueryBuilderStub {
  #responses: QueryResponse[];
  #shouldThrow: Error | null;

  constructor(responses: QueryResponse[], shouldThrow: Error | null) {
    this.#responses = responses;
    this.#shouldThrow = shouldThrow;
  }

  select(..._args: unknown[]) {
    return this;
  }
  eq(..._args: unknown[]) {
    return this;
  }
  in(..._args: unknown[]) {
    return this;
  }
  lt(..._args: unknown[]) {
    return this;
  }
  lte(..._args: unknown[]) {
    return this;
  }
  gt(..._args: unknown[]) {
    return this;
  }
  gte(..._args: unknown[]) {
    return this;
  }
  is(..._args: unknown[]) {
    return this;
  }
  order(..._args: unknown[]) {
    return this;
  }
  limit(..._args: unknown[]) {
    return this;
  }

  then(resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) {
    if (this.#shouldThrow) {
      if (reject) return Promise.reject(this.#shouldThrow).then(resolve, reject);
      return Promise.reject(this.#shouldThrow).then(resolve);
    }

    const next = this.#responses.length > 0 ? this.#responses.shift()! : {};
    return Promise.resolve(next).then(resolve, reject);
  }
}

function createSupabaseStub(
  mapping: Record<string, QueryResponse[]>,
  shouldThrowForTables: Record<string, Error> = {},
) {
  const queues = new Map<string, QueryResponse[]>();
  for (const [table, responses] of Object.entries(mapping)) {
    queues.set(table, [...responses]);
  }

  return {
    from(table: string) {
      return new QueryBuilderStub(
        queues.get(table) ?? [],
        shouldThrowForTables[table] ?? null,
      );
    },
  };
}

Deno.test("executeGetDashboardSummary calcule les métriques et alertes métier", async () => {
  const supabase = createSupabaseStub({
    etablissements: [{
      data: [
        { statut: "prospect", ca_previsionnel: 1000 },
        { statut: "qualification", ca_previsionnel: 2000 },
        { statut: "negociation", ca_previsionnel: 3000 },
        { statut: "production", ca_previsionnel: 4000 },
        { statut: "perdu", ca_previsionnel: 5000 },
      ],
    }],
    taches: [
      { count: 12 },
      { count: 3 },
      { count: 2 },
    ],
    email_threads: [{ count: 25 }],
    support_tickets: [{ count: 6 }],
    calendar_events: [{ count: 4 }],
    tresorerie_revenus: [{ data: [{ montant: 1500 }, { montant: 2500 }, { montant: 0 }] }],
  });

  const result = await executeGetDashboardSummary(
    { supabase: supabase as never, userId: "user-1" },
    { include_trends: true },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  const data = result.data as Record<string, unknown>;
  const crm = data.crm as Record<string, unknown>;
  const taches = data.taches as Record<string, unknown>;
  const communication = data.communication as Record<string, unknown>;
  const tresorerie = data.tresorerie as Record<string, unknown>;
  const alerts = data.alerts as string[];

  assertEquals(crm.pipeline_value, 6000);
  assertEquals(crm.clients_actifs, 1);
  assertEquals(crm.prospects, 1);
  assertEquals(taches.total, 12);
  assertEquals(taches.urgentes, 3);
  assertEquals(taches.en_retard, 2);
  assertEquals(communication.emails_non_lus, 25);
  assertEquals(communication.tickets_ouverts, 6);
  assertEquals(communication.reunions_aujourdhui, 4);
  assertEquals(tresorerie.ca_mois, 4000);
  assertEquals(alerts, [
    "⚠️ 2 tâche(s) en retard",
    "🎫 6 tickets support ouverts",
    "📧 25 emails non lus",
  ]);
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeGetDashboardSummary retourne zéro et aucune alerte si données absentes", async () => {
  const supabase = createSupabaseStub({
    etablissements: [{ data: null }],
    taches: [{ count: null }, { count: null }, { count: null }],
    email_threads: [{ count: null }],
    support_tickets: [{ count: null }],
    calendar_events: [{ count: null }],
    tresorerie_revenus: [{ data: null }],
  });

  const result = await executeGetDashboardSummary(
    { supabase: supabase as never, userId: "user-2" },
    {},
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals((data.crm as Record<string, unknown>).pipeline_value, 0);
  assertEquals((data.crm as Record<string, unknown>).clients_actifs, 0);
  assertEquals((data.taches as Record<string, unknown>).total, 0);
  assertEquals((data.communication as Record<string, unknown>).emails_non_lus, 0);
  assertEquals((data.tresorerie as Record<string, unknown>).ca_mois, 0);
  assertEquals(data.alerts, []);
});

Deno.test("executeGetDashboardSummary capture les erreurs du client Supabase", async () => {
  const supabase = createSupabaseStub({}, {
    etablissements: new Error("db down"),
  });

  const result = await executeGetDashboardSummary(
    { supabase: supabase as never, userId: "user-err" },
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db down");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeGetDailyDigest agrège les éléments du jour et génère les recommandations", async () => {
  const supabase = createSupabaseStub({
    taches: [{
      data: [
        { id: "t1", titre: "Appeler client", priorite: "haute", etablissement_id: "e1" },
        { id: "t2", titre: "Préparer devis", priorite: "moyenne", etablissement_id: "e2" },
        { id: "t3", titre: "Envoyer contrat", priorite: "critique", etablissement_id: "e3" },
        { id: "t4", titre: "Relance", priorite: "haute", etablissement_id: "e4" },
        { id: "t5", titre: "MAJ CRM", priorite: "basse", etablissement_id: "e5" },
        { id: "t6", titre: "Planifier réunion", priorite: "moyenne", etablissement_id: "e6" },
      ],
    }],
    calendar_events: [{
      data: [
        { id: "m1", title: "Daily", start_time: "2025-01-15T08:00:00.000Z", end_time: "2025-01-15T08:30:00.000Z", location: "Meet" },
        { id: "m2", title: "Client A", start_time: "2025-01-15T09:00:00.000Z", end_time: "2025-01-15T10:00:00.000Z", location: "Paris" },
        { id: "m3", title: "Client B", start_time: "2025-01-15T11:00:00.000Z", end_time: "2025-01-15T12:00:00.000Z", location: "Lyon" },
        { id: "m4", title: "Interne", start_time: "2025-01-15T14:00:00.000Z", end_time: "2025-01-15T15:00:00.000Z", location: "Visio" },
        { id: "m5", title: "Board", start_time: "2025-01-15T16:00:00.000Z", end_time: "2025-01-15T17:00:00.000Z", location: "HQ" },
      ],
    }],
    email_threads: [{
      data: [
        { id: "e1", subject: "Sujet 1", ai_generated_title: "Titre IA 1", category: "sales", last_message_date: "2025-01-15T10:00:00.000Z" },
        { id: "e2", subject: "Sujet 2", ai_generated_title: "", category: "support", last_message_date: "2025-01-15T09:00:00.000Z" },
      ],
    }],
    support_tickets: [{
      data: [
        { id: "s1", titre: "Bug 1", priority: "high", status: "open" },
        { id: "s2", titre: "Bug 2", priority: "low", status: "open" },
      ],
    }],
    factures: [{
      data: [
        { id: "f1", numero: "FAC-001", montant_ttc: 1200, client_nom: "Client A" },
      ],
    }],
  });

  const result = await executeGetDailyDigest(
    { supabase: supabase as never, userId: "user-1" },
    { date: "2025-01-15T12:00:00.000Z" },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  const summary = data.summary as Record<string, unknown>;
  const details = data.details as Record<string, unknown>;
  const recommendations = data.recommendations as string[];

  assertEquals(data.date, "2025-01-15");
  assertEquals(summary.tasks_due, 6);
  assertEquals(summary.meetings, 5);
  assertEquals(summary.new_emails, 2);
  assertEquals(summary.new_tickets, 2);
  assertEquals(summary.invoices_due, 1);

  const tasks = details.tasks as Array<Record<string, unknown>>;
  const meetings = details.meetings as Array<Record<string, unknown>>;
  const emails = details.emails as Array<Record<string, unknown>>;
  const tickets = details.tickets as Array<Record<string, unknown>>;
  const invoices = details.invoices as Array<Record<string, unknown>>;

  assertEquals(tasks[0], { id: "t1", titre: "Appeler client", priorite: "haute" });
  assertEquals(meetings[0], { id: "m1", title: "Daily", time: "2025-01-15T08:00:00.000Z", location: "Meet" });
  assertEquals(emails[0], { id: "e1", subject: "Titre IA 1", category: "sales" });
  assertEquals(emails[1], { id: "e2", subject: "Sujet 2", category: "support" });
  assertEquals(tickets[0], { id: "s1", titre: "Bug 1", priority: "high" });
  assertEquals(invoices[0], { id: "f1", numero: "FAC-001", montant: 1200, client: "Client A" });

  assertEquals(recommendations, [
    "Beaucoup de tâches aujourd'hui - priorisez les plus critiques",
    "Journée chargée en réunions - bloquez du temps pour les tâches",
    "Relancez les factures échues pour maintenir la trésorerie",
  ]);
});

Deno.test("executeGetPerformanceReport individual utilise user_id explicite et calcule les métriques", async () => {
  const supabase = createSupabaseStub({
    taches: [{ data: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] }],
    email_messages: [{ data: [{ id: "e1" }, { id: "e2" }] }],
    support_tickets: [{ data: [{ id: "s1" }] }],
    calendar_events: [{ data: [{ id: "m1" }, { id: "m2" }, { id: "m3" }, { id: "m4" }] }],
  });

  const result = await executeGetPerformanceReport(
    { supabase: supabase as never, userId: "ctx-user" },
    { user_id: "target-user", period: "2025-01-01T00:00:00.000Z", type: "individual" },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.type, "individual");
  assertEquals(data.user_id, "target-user");
  const metrics = data.metrics as Record<string, unknown>;
  assertEquals(metrics.tasks_completed, 3);
  assertEquals(metrics.emails_sent, 2);
  assertEquals(metrics.tickets_resolved, 1);
  assertEquals(metrics.meetings_organized, 4);
});

Deno.test("executeGetPerformanceReport individual utilise ctx.userId par défaut", async () => {
  const supabase = createSupabaseStub({
    taches: [{ data: [] }],
    email_messages: [{ data: [] }],
    support_tickets: [{ data: [] }],
    calendar_events: [{ data: [] }],
  });

  const result = await executeGetPerformanceReport(
    { supabase: supabase as never, userId: "fallback-user" },
    { period: "2025-01-01T00:00:00.000Z", type: "individual" },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.user_id, "fallback-user");
  assertEquals(data.type, "individual");
  assertEquals(data.metrics, {
    tasks_completed: 0,
    emails_sent: 0,
    tickets_resolved: 0,
    meetings_organized: 0,
  });
});

Deno.test("executeGetPerformanceReport team regroupe completed et pending par responsable", async () => {
  const supabase = createSupabaseStub({
    taches: [{
      data: [
        { responsable_id: "u1", statut: "terminee" },
        { responsable_id: "u1", statut: "en_cours" },
        { responsable_id: "u1", statut: "terminee" },
        { responsable_id: "u2", statut: "en_attente" },
        { responsable_id: "u2", statut: "terminee" },
        { responsable_id: null, statut: "terminee" },
      ],
    }],
  });

  const result = await executeGetPerformanceReport(
    { supabase: supabase as never, userId: "manager" },
    { period: "2025-01-01T00:00:00.000Z", type: "team" },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.type, "team");
  assertEquals(data.total_tasks, 6);
  assertEquals(data.performance_by_user, {
    u1: { completed: 2, pending: 1 },
    u2: { completed: 1, pending: 1 },
  });
});

Deno.test("executeAnalyzeTrends pipeline agrège count et value par statut", async () => {
  const supabase = createSupabaseStub({
    etablissements: [{
      data: [
        { statut: "prospect", ca_previsionnel: 1000, created_at: "x", updated_at: "x" },
        { statut: "prospect", ca_previsionnel: 500, created_at: "x", updated_at: "x" },
        { statut: "qualification", ca_previsionnel: 2000, created_at: "x", updated_at: "x" },
        { statut: "qualification", ca_previsionnel: null, created_at: "x", updated_at: "x" },
      ],
    }],
  });

  const result = await executeAnalyzeTrends(
    { supabase: supabase as never, userId: "u1" },
    { metric: "pipeline", period_days: 30 },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.metric, "pipeline");
  assertEquals(data.period_days, 30);
  assertEquals(data.pipeline, {
    prospect: { count: 2, value: 1500 },
    qualification: { count: 2, value: 2000 },
  });
});

Deno.test("executeAnalyzeTrends tasks calcule created completed et completion_rate arrondi", async () => {
  const supabase = createSupabaseStub({
    taches: [{
      data: [
        { statut: "terminee", created_at: "x", date_realisation: "x" },
        { statut: "terminee", created_at: "x", date_realisation: "x" },
        { statut: "en_cours", created_at: "x", date_realisation: null },
      ],
    }],
  });

  const result = await executeAnalyzeTrends(
    { supabase: supabase as never, userId: "u1" },
    { metric: "tasks", period_days: 7 },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.created, 3);
  assertEquals(data.completed, 2);
  assertEquals(data.completion_rate, 67);
});

Deno.test("executeAnalyzeTrends support agrège par priorité et tickets résolus/clos", async () => {
  const supabase = createSupabaseStub({
    support_tickets: [{
      data: [
        { priority: "high", status: "resolved", created_at: "x", resolved_at: "x" },
        { priority: "high", status: "open", created_at: "x", resolved_at: null },
        { priority: "low", status: "closed", created_at: "x", resolved_at: "x" },
        { priority: "medium", status: "in_progress", created_at: "x", resolved_at: null },
      ],
    }],
  });

  const result = await executeAnalyzeTrends(
    { supabase: supabase as never, userId: "u1" },
    { metric: "support", period_days: 14 },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.total, 4);
  assertEquals(data.by_priority, { high: 2, low: 1, medium: 1 });
  assertEquals(data.resolved, 2);
});

Deno.test("executeAnalyzeTrends revenue agrège total et by_category avec catégorie par défaut", async () => {
  const supabase = createSupabaseStub({
    tresorerie_revenus: [{
      data: [
        { montant: 1000, date: "x", categorie: "services" },
        { montant: 500, date: "x", categorie: "services" },
        { montant: 300, date: "x", categorie: "abonnements" },
        { montant: 200, date: "x", categorie: null },
      ],
    }],
  });

  const result = await executeAnalyzeTrends(
    { supabase: supabase as never, userId: "u1" },
    { metric: "revenue", period_days: 90 },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.total, 2000);
  assertEquals(data.by_category, {
    services: 1500,
    abonnements: 300,
    autre: 200,
  });
});

Deno.test("executeAnalyzeTrends retourne un message pour une métrique non implémentée", async () => {
  const supabase = createSupabaseStub({});

  const result = await executeAnalyzeTrends(
    { supabase: supabase as never, userId: "u1" },
    { metric: "unknown_metric", period_days: 5 },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.metric, "unknown_metric");
  assertEquals(data.period_days, 5);
  assertEquals(data.message, "Trend analysis for 'unknown_metric' not implemented");
});