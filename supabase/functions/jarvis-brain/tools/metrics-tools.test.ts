import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeCalculateMetrics } from "./metrics-tools.ts";

type MockRow = Record<string, unknown>;
type TableMap = Record<string, MockRow[]>;

function createSupabaseMock(tables: TableMap) {
  const state = {
    calls: [] as Array<{
      table: string;
      select?: string;
      filters: Array<{ op: string; column: string; value: unknown }>;
    }>,
  };

  function applyFilters(rows: MockRow[], filters: Array<{ op: string; column: string; value: unknown }>) {
    return rows.filter((row) =>
      filters.every((f) => {
        const value = row[f.column];
        switch (f.op) {
          case "eq":
            return value === f.value;
          case "gte":
            return String(value ?? "") >= String(f.value ?? "");
          case "lte":
            return String(value ?? "") <= String(f.value ?? "");
          default:
            return true;
        }
      })
    );
  }

  function buildQuery(table: string) {
    const call = { table, select: undefined as string | undefined, filters: [] as Array<{ op: string; column: string; value: unknown }> };
    state.calls.push(call);

    const query = {
      select(columns: string) {
        call.select = columns;
        return query;
      },
      eq(column: string, value: unknown) {
        call.filters.push({ op: "eq", column, value });
        return query;
      },
      gte(column: string, value: unknown) {
        call.filters.push({ op: "gte", column, value });
        return query;
      },
      lte(column: string, value: unknown) {
        call.filters.push({ op: "lte", column, value });
        return query;
      },
      then(resolve: (value: { data: MockRow[] }) => unknown, reject?: (reason?: unknown) => unknown) {
        try {
          const rows = tables[table] ?? [];
          const data = applyFilters(rows, call.filters);
          return Promise.resolve({ data }).then(resolve, reject);
        } catch (err) {
          return Promise.reject(err).then(resolve, reject);
        }
      },
    };

    return query;
  }

  return {
    supabase: {
      from(table: string) {
        return buildQuery(table);
      },
    },
    state,
  };
}

Deno.test("calculate_metrics ca calcule CA total, encaissé, en attente et applique les filtres", async () => {
  const mock = createSupabaseMock({
    factures: [
      { montant_ttc: 100, date_emission: "2024-01-10", statut: "payee", etablissement_id: "eta_1" },
      { montant_ttc: 50, date_emission: "2024-01-15", statut: "brouillon", etablissement_id: "eta_1" },
      { montant_ttc: 75, date_emission: "2024-02-01", statut: "payee", etablissement_id: "eta_2" },
      { montant_ttc: 25, date_emission: "2023-12-31", statut: "payee", etablissement_id: "eta_1" },
    ],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "ca",
      filters: {
        date_from: "2024-01-01",
        date_to: "2024-01-31",
        etablissement_id: "eta_1",
      },
    },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals((result.data as Record<string, unknown>).metric_type, "ca");
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.ca_total, 150);
  assertEquals(metrics.ca_encaisse, 100);
  assertEquals(metrics.ca_en_attente, 50);
  assertEquals(metrics.taux_encaissement, 67);

  assertEquals(mock.state.calls.length, 1);
  assertEquals(mock.state.calls[0].table, "factures");
  assertEquals(mock.state.calls[0].filters, [
    { op: "gte", column: "date_emission", value: "2024-01-01" },
    { op: "lte", column: "date_emission", value: "2024-01-31" },
    { op: "eq", column: "etablissement_id", value: "eta_1" },
  ]);
});

Deno.test("calculate_metrics tasks calcule les volumes par statut et le taux de completion", async () => {
  const mock = createSupabaseMock({
    taches: [
      { id: 1, statut: "Terminé", priorite: "haute", created_at: "2024-05-01", updated_at: "2024-05-02", etablissement_id: "eta_1" },
      { id: 2, statut: "En cours", priorite: "moyenne", created_at: "2024-05-03", updated_at: "2024-05-04", etablissement_id: "eta_1" },
      { id: 3, statut: "A faire", priorite: "basse", created_at: "2024-05-05", updated_at: "2024-05-05", etablissement_id: "eta_1" },
      { id: 4, statut: "Terminé", priorite: "haute", created_at: "2024-04-30", updated_at: "2024-05-01", etablissement_id: "eta_1" },
      { id: 5, statut: "Terminé", priorite: "haute", created_at: "2024-05-06", updated_at: "2024-05-07", etablissement_id: "eta_2" },
    ],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "tasks",
      filters: {
        date_from: "2024-05-01",
        etablissement_id: "eta_1",
      },
    },
  );

  assertEquals(result.success, true);
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.total, 3);
  assertEquals(metrics.terminees, 1);
  assertEquals(metrics.en_cours, 1);
  assertEquals(metrics.a_faire, 1);
  assertEquals(metrics.taux_completion, 33);
});

Deno.test("calculate_metrics support calcule ouverts, résolus et temps moyen de résolution en heures", async () => {
  const mock = createSupabaseMock({
    support_tickets: [
      {
        id: 1,
        status: "resolved",
        priority: "high",
        created_at: "2024-06-01T08:00:00.000Z",
        resolved_at: "2024-06-01T10:00:00.000Z",
        etablissement_id: "eta_1",
      },
      {
        id: 2,
        status: "open",
        priority: "medium",
        created_at: "2024-06-02T08:00:00.000Z",
        resolved_at: null,
        etablissement_id: "eta_1",
      },
      {
        id: 3,
        status: "resolved",
        priority: "low",
        created_at: "2024-06-03T08:00:00.000Z",
        resolved_at: "2024-06-03T14:00:00.000Z",
        etablissement_id: "eta_1",
      },
    ],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "support",
      filters: {
        date_from: "2024-06-01",
        etablissement_id: "eta_1",
      },
    },
  );

  assertEquals(result.success, true);
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.total, 3);
  assertEquals(metrics.ouverts, 1);
  assertEquals(metrics.resolus, 2);
  assertEquals(metrics.temps_resolution_moyen_heures, 4);
});

Deno.test("calculate_metrics emails calcule non lus et agrégation par catégorie avec fallback other", async () => {
  const mock = createSupabaseMock({
    email_threads: [
      { id: 1, unread_count: 2, category: "support", last_message_date: "2024-07-10" },
      { id: 2, unread_count: 0, category: "sales", last_message_date: "2024-07-11" },
      { id: 3, unread_count: 1, category: "support", last_message_date: "2024-07-12" },
      { id: 4, unread_count: 0, category: null, last_message_date: "2024-07-13" },
      { id: 5, unread_count: 3, category: "ignored", last_message_date: "2024-06-30" },
    ],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "emails",
      filters: {
        date_from: "2024-07-01",
      },
    },
  );

  assertEquals(result.success, true);
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.total, 4);
  assertEquals(metrics.non_lus, 2);
  assertEquals(metrics.par_categorie, {
    support: 2,
    sales: 1,
    other: 1,
  });
});

Deno.test("calculate_metrics rh calcule la masse salariale et l'effectif pour le mois demandé", async () => {
  const mock = createSupabaseMock({
    rh_salaires_mensuels: [
      { salaire_net: 2000, salaire_brut: 2600, cout_total_employeur: 3200, mois: "2024-08" },
      { salaire_net: 2500, salaire_brut: 3300, cout_total_employeur: 4000, mois: "2024-08" },
      { salaire_net: 1800, salaire_brut: 2300, cout_total_employeur: 2900, mois: "2024-07" },
    ],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "rh",
      filters: {
        date_from: "2024-08",
      },
    },
  );

  assertEquals(result.success, true);
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.masse_salariale_nette, 4500);
  assertEquals(metrics.masse_salariale_brute, 5900);
  assertEquals(metrics.cout_employeur, 7200);
  assertEquals(metrics.effectif, 2);
});

Deno.test("calculate_metrics pipeline calcule prospects, valeur totale et valeur pondérée", async () => {
  const mock = createSupabaseMock({
    etablissements: [
      { id: "a", statut: "prospect", valeur_estimee: 1000, probabilite: 10 },
      { id: "b", statut: "qualification", valeur_estimee: 2000, probabilite: 50 },
      { id: "c", statut: "proposition", valeur_estimee: 3000, probabilite: 80 },
      { id: "d", statut: "client", valeur_estimee: 4000, probabilite: 100 },
      { id: "e", statut: null, valeur_estimee: 5000, probabilite: 20 },
    ],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "pipeline",
    },
  );

  assertEquals(result.success, true);
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.total_prospects, 3);
  assertEquals(metrics.valeur_pipeline, 6000);
  assertEquals(metrics.valeur_ponderee, 3500);
});

Deno.test("calculate_metrics retourne une erreur métier pour un type inconnu", async () => {
  const mock = createSupabaseMock({});

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "inconnu",
    },
  );

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Type de métrique inconnu: inconnu. Types disponibles: ca, tasks, support, emails, rh, pipeline",
  );
  assertEquals(mock.state.calls.length, 0);
});

Deno.test("calculate_metrics gère les jeux de données vides sans erreur", async () => {
  const mock = createSupabaseMock({
    factures: [],
  });

  const result = await executeCalculateMetrics(
    { supabase: mock.supabase } as never,
    {
      metric_type: "ca",
      filters: {
        date_from: "2024-01-01",
        date_to: "2024-01-31",
      },
    },
  );

  assertEquals(result.success, true);
  const metrics = ((result.data as Record<string, unknown>).metrics as Record<string, unknown>);
  assertEquals(metrics.ca_total, 0);
  assertEquals(metrics.ca_encaisse, 0);
  assertEquals(metrics.ca_en_attente, 0);
  assertEquals(metrics.taux_encaissement, 0);
});

Deno.test("calculate_metrics capture une erreur du client supabase et retourne success false", async () => {
  const failingCtx = {
    supabase: {
      from() {
        return {
          select() {
            return {
              then(_resolve: unknown, reject?: (reason?: unknown) => unknown) {
                return Promise.reject(new Error("DB offline")).then(undefined, reject);
              },
            };
          },
        };
      },
    },
  };

  const result = await executeCalculateMetrics(
    failingCtx as never,
    {
      metric_type: "ca",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "DB offline");
});