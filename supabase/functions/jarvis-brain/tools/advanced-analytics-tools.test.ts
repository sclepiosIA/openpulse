import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCorrelationAnalysis,
  executeDetectAnomalies,
  executeGetPerformanceScore,
  executePredictTrend,
} from "./advanced-analytics-tools.ts";

type Row = Record<string, unknown>;

function createSupabaseMock(tables: Record<string, Row[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
    from(table: string) {
      calls.push({ table, method: "from", args: [] });
      const eqFilters: Array<{ field: string; value: unknown }> = [];

      const query = {
        select(columns: string) {
          calls.push({ table, method: "select", args: [columns] });
          return query;
        },
        gte(field: string, value: unknown) {
          calls.push({ table, method: "gte", args: [field, value] });
          return query;
        },
        eq(field: string, value: unknown) {
          calls.push({ table, method: "eq", args: [field, value] });
          eqFilters.push({ field, value });
          return query;
        },
        get data() {
          return (tables[table] ?? []).filter((row) =>
            eqFilters.every((filter) => row[filter.field] === filter.value)
          );
        },
        get error() {
          return null;
        },
      };

      return query;
    },
  };
}

Deno.test("executePredictTrend agrège le revenu mensuel et calcule une tendance haussière", async () => {
  const supabase = createSupabaseMock({
    tresorerie_revenus: [
      { montant: 100, date_reception: "2024-01-05T00:00:00.000Z" },
      { montant: 50, date_reception: "2024-01-20T00:00:00.000Z" },
      { montant: 200, date_reception: "2024-02-05T00:00:00.000Z" },
      { montant: 250, date_reception: "2024-03-05T00:00:00.000Z" },
      { montant: 300, date_reception: "2024-04-05T00:00:00.000Z" },
    ],
  });

  const result = await executePredictTrend(
    { supabase: supabase as never, userId: "user-1" },
    { metric: "revenue", period_months: 12, forecast_months: 3 },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.metric, "revenue");
  assertEquals(result.data.historical, [
    { month: "2024-01", value: 150 },
    { month: "2024-02", value: 200 },
    { month: "2024-03", value: 250 },
    { month: "2024-04", value: 300 },
  ]);
  assertEquals(result.data.forecast, [
    { month: "2024-05", predicted: 350, confidence: "high" },
    { month: "2024-06", predicted: 400, confidence: "medium" },
    { month: "2024-07", predicted: 450, confidence: "low" },
  ]);
  assertEquals(result.data.trend.direction, "upward");
  assertEquals(result.data.trend.slope, 50);
  assertEquals(result.data.trend.avg_growth_rate, 57.1);
  assertEquals(result.data.analysis, "Tendance à la hausse pour revenue");
});

Deno.test("executePredictTrend compte les nouveaux clients de production par mois", async () => {
  const supabase = createSupabaseMock({
    etablissements: [
      { created_at: "2024-01-01T00:00:00.000Z", statut: "production" },
      { created_at: "2024-02-01T00:00:00.000Z", statut: "production" },
      { created_at: "2024-02-15T00:00:00.000Z", statut: "production" },
      { created_at: "2024-03-01T00:00:00.000Z", statut: "production" },
      { created_at: "2024-03-15T00:00:00.000Z", statut: "prospect" },
    ],
  });

  const result = await executePredictTrend(
    { supabase: supabase as never, userId: "user-1" },
    { metric: "new_clients", forecast_months: 1 },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.historical, [
    { month: "2024-01", value: 1 },
    { month: "2024-02", value: 2 },
    { month: "2024-03", value: 1 },
  ]);
  assertEquals(result.data.forecast, [
    { month: "2024-04", predicted: 1, confidence: "high" },
  ]);
});

Deno.test("executePredictTrend refuse une métrique non supportée", async () => {
  const supabase = createSupabaseMock({});

  const result = await executePredictTrend(
    { supabase: supabase as never, userId: "user-1" },
    { metric: "profit_margin" },
  );

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Métrique 'profit_margin' non supportée. Valides: revenue, new_clients, support_tickets",
  );
});

Deno.test("executePredictTrend refuse une prédiction avec moins de trois mois de données", async () => {
  const supabase = createSupabaseMock({
    support_tickets: [
      { created_at: "2024-01-01T00:00:00.000Z" },
      { created_at: "2024-02-01T00:00:00.000Z" },
    ],
  });

  const result = await executePredictTrend(
    { supabase: supabase as never, userId: "user-1" },
    { metric: "support_tickets" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Données insuffisantes pour une prédiction fiable");
});

Deno.test("executeDetectAnomalies détecte un pic de revenu quotidien", async () => {
  const supabase = createSupabaseMock({
    tresorerie_revenus: [
      { montant: 10, date_reception: "2024-04-01T08:00:00.000Z" },
      { montant: 10, date_reception: "2024-04-02T08:00:00.000Z" },
      { montant: 10, date_reception: "2024-04-03T08:00:00.000Z" },
      { montant: 10, date_reception: "2024-04-04T08:00:00.000Z" },
      { montant: 100, date_reception: "2024-04-05T08:00:00.000Z" },
    ],
  });

  const result = await executeDetectAnomalies(
    { supabase: supabase as never, userId: "user-1" },
    { data_source: "daily_revenue", threshold: 1.5, period_days: 10 },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.data_source, "daily_revenue");
  assertEquals(result.data.period_days, 10);
  assertEquals(result.data.statistics, {
    mean: 28,
    std_dev: 36,
    min: 10,
    max: 100,
  });
  assertEquals(result.data.anomaly_count, 1);
  assertEquals(result.data.threshold_used, 1.5);
  assertEquals(result.data.anomalies, [
    {
      date: "2024-04-05",
      value: 100,
      deviation: 2,
      type: "high",
    },
  ]);
});

Deno.test("executeDetectAnomalies agrège les tickets quotidiens avant le calcul statistique", async () => {
  const supabase = createSupabaseMock({
    support_tickets: [
      { created_at: "2024-05-01T08:00:00.000Z" },
      { created_at: "2024-05-02T08:00:00.000Z" },
      { created_at: "2024-05-03T08:00:00.000Z" },
      { created_at: "2024-05-04T08:00:00.000Z" },
      { created_at: "2024-05-05T08:00:00.000Z" },
      { created_at: "2024-05-05T09:00:00.000Z" },
      { created_at: "2024-05-05T10:00:00.000Z" },
      { created_at: "2024-05-05T11:00:00.000Z" },
      { created_at: "2024-05-05T12:00:00.000Z" },
      { created_at: "2024-05-05T13:00:00.000Z" },
    ],
  });

  const result = await executeDetectAnomalies(
    { supabase: supabase as never, userId: "user-1" },
    { data_source: "daily_tickets", threshold: 1.5 },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.statistics.mean, 2);
  assertEquals(result.data.statistics.max, 6);
  assertEquals(result.data.anomaly_count, 1);
  assertEquals(result.data.anomalies[0].date, "2024-05-05");
  assertEquals(result.data.anomalies[0].value, 6);
  assertEquals(result.data.anomalies[0].type, "high");
});

Deno.test("executeDetectAnomalies refuse une source non supportée", async () => {
  const supabase = createSupabaseMock({});

  const result = await executeDetectAnomalies(
    { supabase: supabase as never, userId: "user-1" },
    { data_source: "daily_signups" },
  );

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Source 'daily_signups' non supportée. Valides: daily_revenue, daily_tickets, daily_tasks",
  );
});

Deno.test("executeDetectAnomalies refuse moins de cinq points de données", async () => {
  const supabase = createSupabaseMock({
    taches: [
      { created_at: "2024-04-01T00:00:00.000Z" },
      { created_at: "2024-04-02T00:00:00.000Z" },
      { created_at: "2024-04-03T00:00:00.000Z" },
      { created_at: "2024-04-04T00:00:00.000Z" },
    ],
  });

  const result = await executeDetectAnomalies(
    { supabase: supabase as never, userId: "user-1" },
    { data_source: "daily_tasks" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Données insuffisantes pour détecter des anomalies");
});

Deno.test("executeCorrelationAnalysis calcule une forte corrélation positive", async () => {
  const supabase = createSupabaseMock({
    tresorerie_revenus: [
      { montant: 100, date_reception: "2024-01-01T00:00:00.000Z" },
      { montant: 200, date_reception: "2024-02-01T00:00:00.000Z" },
      { montant: 300, date_reception: "2024-03-01T00:00:00.000Z" },
      { montant: 400, date_reception: "2024-04-01T00:00:00.000Z" },
    ],
    support_tickets: [
      { created_at: "2024-01-03T00:00:00.000Z" },
      { created_at: "2024-01-04T00:00:00.000Z" },
      { created_at: "2024-02-03T00:00:00.000Z" },
      { created_at: "2024-02-04T00:00:00.000Z" },
      { created_at: "2024-02-05T00:00:00.000Z" },
      { created_at: "2024-02-06T00:00:00.000Z" },
      { created_at: "2024-03-03T00:00:00.000Z" },
      { created_at: "2024-03-04T00:00:00.000Z" },
      { created_at: "2024-03-05T00:00:00.000Z" },
      { created_at: "2024-03-06T00:00:00.000Z" },
      { created_at: "2024-03-07T00:00:00.000Z" },
      { created_at: "2024-03-08T00:00:00.000Z" },
      { created_at: "2024-04-03T00:00:00.000Z" },
      { created_at: "2024-04-04T00:00:00.000Z" },
      { created_at: "2024-04-05T00:00:00.000Z" },
      { created_at: "2024-04-06T00:00:00.000Z" },
      { created_at: "2024-04-07T00:00:00.000Z" },
      { created_at: "2024-04-08T00:00:00.000Z" },
      { created_at: "2024-04-09T00:00:00.000Z" },
      { created_at: "2024-04-10T00:00:00.000Z" },
    ],
  });

  const result = await executeCorrelationAnalysis(
    { supabase: supabase as never, userId: "user-1" },
    { metric_a: "revenue", metric_b: "tickets", period_months: 4 },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.metric_a, "revenue");
  assertEquals(result.data.metric_b, "tickets");
  assertEquals(result.data.correlation_coefficient, 1);
  assertEquals(result.data.interpretation, "Forte corrélation positive");
  assertEquals(result.data.sample_size, 4);
  assertEquals(result.data.period_months, 4);
  assertEquals(result.data.data_points, [
    { month: "2024-01", a: 100, b: 2 },
    { month: "2024-02", a: 200, b: 4 },
    { month: "2024-03", a: 300, b: 6 },
    { month: "2024-04", a: 400, b: 8 },
  ]);
});

Deno.test("executeCorrelationAnalysis calcule une forte corrélation négative", async () => {
  const supabase = createSupabaseMock({
    taches: [
      { updated_at: "2024-01-01T00:00:00.000Z", statut: "termine" },
      { updated_at: "2024-01-02T00:00:00.000Z", statut: "termine" },
      { updated_at: "2024-01-03T00:00:00.000Z", statut: "termine" },
      { updated_at: "2024-02-01T00:00:00.000Z", statut: "termine" },
      { updated_at: "2024-02-02T00:00:00.000Z", statut: "termine" },
      { updated_at: "2024-03-01T00:00:00.000Z", statut: "termine" },
    ],
    email_messages: [
      { received_at: "2024-01-01T00:00:00.000Z" },
      { received_at: "2024-02-01T00:00:00.000Z" },
      { received_at: "2024-02-02T00:00:00.000Z" },
      { received_at: "2024-03-01T00:00:00.000Z" },
      { received_at: "2024-03-02T00:00:00.000Z" },
      { received_at: "2024-03-03T00:00:00.000Z" },
    ],
  });

  const result = await executeCorrelationAnalysis(
    { supabase: supabase as never, userId: "user-1" },
    { metric_a: "tasks_completed", metric_b: "emails" },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.correlation_coefficient, -1);
  assertEquals(result.data.interpretation, "Forte corrélation négative");
  assertEquals(result.data.data_points, [
    { month: "2024-01", a: 3, b: 1 },
    { month: "2024-02", a: 2, b: 2 },
    { month: "2024-03", a: 1, b: 3 },
  ]);
});

Deno.test("executeCorrelationAnalysis refuse moins de trois mois alignés", async () => {
  const supabase = createSupabaseMock({
    tresorerie_revenus: [
      { montant: 100, date_reception: "2024-01-01T00:00:00.000Z" },
    ],
    support_tickets: [
      { created_at: "2024-02-01T00:00:00.000Z" },
    ],
  });

  const result = await executeCorrelationAnalysis(
    { supabase: supabase as never, userId: "user-1" },
    { metric_a: "revenue", metric_b: "tickets" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Données insuffisantes pour une analyse de corrélation");
});

Deno.test("executeGetPerformanceScore calcule le score global pondéré", async () => {
  const supabase = createSupabaseMock({
    taches: [
      { statut: "termine", created_at: "2024-04-01T00:00:00.000Z" },
      { statut: "termine", created_at: "2024-04-02T00:00:00.000Z" },
      { statut: "termine", created_at: "2024-04-03T00:00:00.000Z" },
      { statut: "en_cours", created_at: "2024-04-04T00:00:00.000Z" },
    ],
    support_tickets: [
      { status: "resolved", created_at: "2024-04-01T00:00:00.000Z" },
      { status: "closed", created_at: "2024-04-02T00:00:00.000Z" },
      { status: "open", created_at: "2024-04-03T00:00:00.000Z" },
      { status: "pending", created_at: "2024-04-04T00:00:00.000Z" },
    ],
    tresorerie_revenus: [
      { montant: 1000, date_reception: "2024-04-01T00:00:00.000Z" },
    ],
  });

  const result = await executeGetPerformanceScore(
    { supabase: supabase as never, userId: "user-1" },
    { scope: "global" },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertExists(result.data.calculated_at);
  assertEquals(result.data.scores.global, {
    score: 60,
    factors: {
      task_completion: 75,
      ticket_resolution: 50,
      revenue_health: 50,
    },
  });
});

Deno.test("executeGetPerformanceScore calcule le score d'un membre d'équipe avec filtres entity_id", async () => {
  const supabase = createSupabaseMock({
    taches: [
      { responsable_id: "member-1", statut: "termine" },
      { responsable_id: "member-1", statut: "termine" },
      { responsable_id: "member-1", statut: "en_cours" },
      { responsable_id: "member-2", statut: "en_cours" },
    ],
    support_tickets: [
      { assigned_to: "member-1", status: "resolved" },
      { assigned_to: "member-1", status: "open" },
      { assigned_to: "member-2", status: "closed" },
    ],
  });

  const result = await executeGetPerformanceScore(
    { supabase: supabase as never, userId: "user-1" },
    { scope: "team_member", entity_id: "member-1" },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.scores.team_member, {
    score: 58,
    factors: {
      task_completion: 67,
      ticket_resolution: 50,
    },
  });
});

Deno.test("executeGetPerformanceScore utilise les valeurs neutres quand aucune donnée globale n'existe", async () => {
  const supabase = createSupabaseMock({
    taches: [],
    support_tickets: [],
    tresorerie_revenus: [],
  });

  const result = await executeGetPerformanceScore(
    { supabase: supabase as never, userId: "user-1" },
    {},
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.scores.global, {
    score: 50,
    factors: {
      task_completion: 50,
      ticket_resolution: 50,
      revenue_health: 50,
    },
  });
});

Deno.test("les fonctions retournent une erreur contrôlée si le client Supabase échoue", async () => {
  const failingSupabase = {
    from() {
      return {
        select() {
          throw new Error("supabase unavailable");
        },
      };
    },
  };

  const prediction = await executePredictTrend(
    { supabase: failingSupabase as never, userId: "user-1" },
    { metric: "revenue" },
  );

  const anomalies = await executeDetectAnomalies(
    { supabase: failingSupabase as never, userId: "user-1" },
    { data_source: "daily_revenue" },
  );

  const correlation = await executeCorrelationAnalysis(
    { supabase: failingSupabase as never, userId: "user-1" },
    { metric_a: "revenue", metric_b: "tickets" },
  );

  const score = await executeGetPerformanceScore(
    { supabase: failingSupabase as never, userId: "user-1" },
    { scope: "global" },
  );

  assertEquals(prediction.success, false);
  assertEquals(prediction.error, "supabase unavailable");
  assertEquals(anomalies.success, false);
  assertEquals(anomalies.error, "supabase unavailable");
  assertEquals(correlation.success, false);
  assertEquals(correlation.error, "supabase unavailable");
  assertEquals(score.success, false);
  assertEquals(score.error, "supabase unavailable");
});