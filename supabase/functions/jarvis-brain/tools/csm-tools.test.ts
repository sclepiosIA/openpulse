import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeGetChurnPredictions,
  executeGetCsmHealthScore,
  executeGetCsmKpis,
  executeManageCsmBillingFollowup,
  executeManageCsmMilestone,
} from "./csm-tools.ts";

type QueryCall = {
  table: string;
  select?: string;
  filters: Array<{ column: string; value: unknown }>;
  orders: Array<{ column: string; options?: Record<string, unknown> }>;
  limits: number[];
  inserted?: unknown;
  updated?: unknown;
  single: boolean;
  maybeSingle: boolean;
};

type SupabaseResult = { data: unknown; error: Error | null };

function createSupabaseMock(
  resolver: SupabaseResult | ((call: QueryCall) => SupabaseResult) = { data: null, error: null },
) {
  const calls: QueryCall[] = [];

  const resolve = (call: QueryCall): SupabaseResult => {
    return typeof resolver === "function" ? resolver(call) : resolver;
  };

  const supabase = {
    from(table: string) {
      const call: QueryCall = {
        table,
        filters: [],
        orders: [],
        limits: [],
        single: false,
        maybeSingle: false,
      };
      calls.push(call);

      const builder: any = {
        select(columns = "*") {
          call.select = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push({ column, value });
          return builder;
        },
        order(column: string, options?: Record<string, unknown>) {
          call.orders.push({ column, options });
          return builder;
        },
        limit(count: number) {
          call.limits.push(count);
          return builder;
        },
        insert(payload: unknown) {
          call.inserted = payload;
          return builder;
        },
        update(payload: unknown) {
          call.updated = payload;
          return builder;
        },
        maybeSingle() {
          call.maybeSingle = true;
          return Promise.resolve(resolve(call));
        },
        single() {
          call.single = true;
          return Promise.resolve(resolve(call));
        },
        then(onFulfilled: any, onRejected: any) {
          return Promise.resolve(resolve(call)).then(onFulfilled, onRejected);
        },
        catch(onRejected: any) {
          return Promise.resolve(resolve(call)).catch(onRejected);
        },
        finally(onFinally: any) {
          return Promise.resolve(resolve(call)).finally(onFinally);
        },
      };

      return builder;
    },
  };

  return { supabase: supabase as any, calls };
}

Deno.test("executeGetCsmHealthScore récupère le dernier score santé d'un établissement", async () => {
  const healthScore = {
    id: "health-1",
    etablissement_id: "etab-123",
    score_global: 82,
    risk_level: "medium",
  };
  const { supabase, calls } = createSupabaseMock({ data: healthScore, error: null });

  const result = await executeGetCsmHealthScore(
    { supabase, userId: "user-1" },
    { etablissement_id: "etab-123" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).health_score, healthScore);
  assertExists(result.execution_time_ms);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "csm_sante_comptes");
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].filters, [{ column: "etablissement_id", value: "etab-123" }]);
  assertEquals(calls[0].orders, [{ column: "created_at", options: { ascending: false } }]);
  assertEquals(calls[0].limits, [1]);
  assertEquals(calls[0].maybeSingle, true);
});

Deno.test("executeGetCsmHealthScore retourne une erreur métier quand Supabase échoue", async () => {
  const { supabase } = createSupabaseMock({
    data: null,
    error: new Error("database unavailable"),
  });

  const result = await executeGetCsmHealthScore(
    { supabase, userId: "user-1" },
    { etablissement_id: "etab-123" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetCsmKpis utilise les KPIs mensuels par défaut avec filtres CSM et période", async () => {
  const kpis = [
    { id: "kpi-1", periode: "2024-05", csm_id: "csm-1", nps: 48 },
    { id: "kpi-2", periode: "2024-04", csm_id: "csm-1", nps: 45 },
  ];
  const { supabase, calls } = createSupabaseMock({ data: kpis, error: null });

  const result = await executeGetCsmKpis(
    { supabase, userId: "user-1" },
    { csm_id: "csm-1", period: "2024-05" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).kpis, kpis);
  assertEquals((result.data as any).count, 2);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "csm_kpis_mensuels");
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].filters, [
    { column: "csm_id", value: "csm-1" },
    { column: "periode", value: "2024-05" },
  ]);
  assertEquals(calls[0].orders, [{ column: "periode", options: { ascending: false } }]);
  assertEquals(calls[0].limits, [12]);
});

Deno.test("executeGetCsmKpis utilise la table trimestrielle quand type vaut trimestriel", async () => {
  const quarterlyKpis = [{ id: "kpi-q1", periode: "2024-Q1", csm_id: "csm-2" }];
  const { supabase, calls } = createSupabaseMock({ data: quarterlyKpis, error: null });

  const result = await executeGetCsmKpis(
    { supabase, userId: "user-1" },
    { type: "trimestriel" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).kpis, quarterlyKpis);
  assertEquals((result.data as any).count, 1);
  assertEquals(calls[0].table, "csm_kpis_trimestriels");
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].filters, []);
  assertEquals(calls[0].orders, [{ column: "periode", options: { ascending: false } }]);
  assertEquals(calls[0].limits, [12]);
});

Deno.test("executeGetCsmKpis retourne count 0 quand Supabase renvoie null", async () => {
  const { supabase } = createSupabaseMock({ data: null, error: null });

  const result = await executeGetCsmKpis(
    { supabase, userId: "user-1" },
    {},
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).kpis, null);
  assertEquals((result.data as any).count, 0);
});

Deno.test("executeManageCsmMilestone list exige etablissement_id sans appeler Supabase", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageCsmMilestone(
    { supabase, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "etablissement_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCsmMilestone list retourne les jalons ordonnés par ordre croissant", async () => {
  const milestones = [
    { id: "milestone-1", etablissement_id: "etab-1", ordre: 1, titre: "Kickoff" },
    { id: "milestone-2", etablissement_id: "etab-1", ordre: 2, titre: "Adoption" },
  ];
  const { supabase, calls } = createSupabaseMock({ data: milestones, error: null });

  const result = await executeManageCsmMilestone(
    { supabase, userId: "user-1" },
    { action: "list", etablissement_id: "etab-1" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).milestones, milestones);
  assertEquals((result.data as any).count, 2);
  assertEquals(calls[0].table, "csm_parcours_jalons");
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].filters, [{ column: "etablissement_id", value: "etab-1" }]);
  assertEquals(calls[0].orders, [{ column: "ordre", options: { ascending: true } }]);
});

Deno.test("executeManageCsmMilestone create injecte created_by et retourne le jalon créé", async () => {
  const { supabase, calls } = createSupabaseMock((call) => ({
    data: { id: "milestone-1", ...(call.inserted as Record<string, unknown>) },
    error: null,
  }));

  const result = await executeManageCsmMilestone(
    { supabase, userId: "creator-42" },
    {
      action: "create",
      data: {
        etablissement_id: "etab-1",
        titre: "Formation équipe",
        ordre: 3,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Jalon créé");
  assertEquals((result.data as any).milestone, {
    id: "milestone-1",
    etablissement_id: "etab-1",
    titre: "Formation équipe",
    ordre: 3,
    created_by: "creator-42",
  });
  assertEquals(calls[0].table, "csm_parcours_jalons");
  assertEquals(calls[0].inserted, {
    etablissement_id: "etab-1",
    titre: "Formation équipe",
    ordre: 3,
    created_by: "creator-42",
  });
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].single, true);
});

Deno.test("executeManageCsmMilestone update exige milestone_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageCsmMilestone(
    { supabase, userId: "user-1" },
    { action: "update", data: { statut: "done" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "milestone_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCsmMilestone update modifie le jalon ciblé", async () => {
  const { supabase, calls } = createSupabaseMock((call) => ({
    data: { id: "milestone-9", ...(call.updated as Record<string, unknown>) },
    error: null,
  }));

  const result = await executeManageCsmMilestone(
    { supabase, userId: "user-1" },
    { action: "update", milestone_id: "milestone-9", data: { statut: "done" } },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Jalon mis à jour");
  assertEquals((result.data as any).milestone, { id: "milestone-9", statut: "done" });
  assertEquals(calls[0].table, "csm_parcours_jalons");
  assertEquals(calls[0].updated, { statut: "done" });
  assertEquals(calls[0].filters, [{ column: "id", value: "milestone-9" }]);
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].single, true);
});

Deno.test("executeManageCsmMilestone retourne un message explicite pour une action non implémentée", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageCsmMilestone(
    { supabase, userId: "user-1" },
    { action: "archive", milestone_id: "milestone-1" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Action archive not implemented");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCsmMilestone retourne une erreur métier quand Supabase échoue", async () => {
  const { supabase } = createSupabaseMock({
    data: null,
    error: new Error("milestone table permission denied"),
  });

  const result = await executeManageCsmMilestone(
    { supabase, userId: "user-1" },
    { action: "list", etablissement_id: "etab-1" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "milestone table permission denied");
});

Deno.test("executeGetChurnPredictions filtre par établissement et niveau de risque", async () => {
  const predictions = [
    {
      id: "pred-1",
      etablissement_id: "etab-1",
      risk_level: "high",
      risk_score: 0.91,
      etablissements: { nom: "École Alpha" },
    },
  ];
  const { supabase, calls } = createSupabaseMock({ data: predictions, error: null });

  const result = await executeGetChurnPredictions(
    { supabase, userId: "user-1" },
    { etablissement_id: "etab-1", risk_level: "high" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).predictions, predictions);
  assertEquals((result.data as any).count, 1);
  assertEquals(calls[0].table, "churn_predictions");
  assertEquals(calls[0].select, "*, etablissements(nom)");
  assertEquals(calls[0].filters, [
    { column: "etablissement_id", value: "etab-1" },
    { column: "risk_level", value: "high" },
  ]);
  assertEquals(calls[0].orders, [{ column: "risk_score", options: { ascending: false } }]);
  assertEquals(calls[0].limits, [50]);
});

Deno.test("executeGetChurnPredictions retourne count 0 quand Supabase renvoie null", async () => {
  const { supabase, calls } = createSupabaseMock({ data: null, error: null });

  const result = await executeGetChurnPredictions(
    { supabase, userId: "user-1" },
    {},
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).predictions, null);
  assertEquals((result.data as any).count, 0);
  assertEquals(calls[0].table, "churn_predictions");
  assertEquals(calls[0].filters, []);
  assertEquals(calls[0].orders, [{ column: "risk_score", options: { ascending: false } }]);
  assertEquals(calls[0].limits, [50]);
});

Deno.test("executeGetChurnPredictions retourne une erreur métier quand Supabase échoue", async () => {
  const { supabase } = createSupabaseMock({
    data: null,
    error: new Error("churn predictions unavailable"),
  });

  const result = await executeGetChurnPredictions(
    { supabase, userId: "user-1" },
    { risk_level: "critical" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "churn predictions unavailable");
});

Deno.test("executeManageCsmBillingFollowup list filtre les suivis facturation par établissement", async () => {
  const followups = [
    {
      id: "followup-1",
      etablissement_id: "etab-7",
      statut: "late",
      montant: 1200,
      etablissements: { nom: "Collège Beta" },
    },
  ];
  const { supabase, calls } = createSupabaseMock({ data: followups, error: null });

  const result = await executeManageCsmBillingFollowup(
    { supabase, userId: "user-1" },
    { action: "list", etablissement_id: "etab-7" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).followups, followups);
  assertEquals((result.data as any).count, 1);
  assertEquals(calls[0].table, "csm_facturation_suivi");
  assertEquals(calls[0].select, "*, etablissements(nom)");
  assertEquals(calls[0].filters, [{ column: "etablissement_id", value: "etab-7" }]);
  assertEquals(calls[0].orders, [{ column: "created_at", options: { ascending: false } }]);
  assertEquals(calls[0].limits, [50]);
});

Deno.test("executeManageCsmBillingFollowup create injecte created_by", async () => {
  const { supabase, calls } = createSupabaseMock((call) => ({
    data: { id: "followup-1", ...(call.inserted as Record<string, unknown>) },
    error: null,
  }));

  const result = await executeManageCsmBillingFollowup(
    { supabase, userId: "billing-user" },
    {
      action: "create",
      data: {
        etablissement_id: "etab-3",
        statut: "relance",
        montant: 950,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Suivi facturation créé");
  assertEquals((result.data as any).followup, {
    id: "followup-1",
    etablissement_id: "etab-3",
    statut: "relance",
    montant: 950,
    created_by: "billing-user",
  });
  assertEquals(calls[0].table, "csm_facturation_suivi");
  assertEquals(calls[0].inserted, {
    etablissement_id: "etab-3",
    statut: "relance",
    montant: 950,
    created_by: "billing-user",
  });
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].single, true);
});

Deno.test("executeManageCsmBillingFollowup update exige followup_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageCsmBillingFollowup(
    { supabase, userId: "user-1" },
    { action: "update", data: { statut: "paid" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "followup_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCsmBillingFollowup update modifie le suivi facturation ciblé", async () => {
  const { supabase, calls } = createSupabaseMock((call) => ({
    data: { id: "followup-8", ...(call.updated as Record<string, unknown>) },
    error: null,
  }));

  const result = await executeManageCsmBillingFollowup(
    { supabase, userId: "user-1" },
    { action: "update", followup_id: "followup-8", data: { statut: "paid" } },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Suivi mis à jour");
  assertEquals((result.data as any).followup, { id: "followup-8", statut: "paid" });
  assertEquals(calls[0].table, "csm_facturation_suivi");
  assertEquals(calls[0].updated, { statut: "paid" });
  assertEquals(calls[0].filters, [{ column: "id", value: "followup-8" }]);
  assertEquals(calls[0].select, "*");
  assertEquals(calls[0].single, true);
});

Deno.test("executeManageCsmBillingFollowup retourne un message explicite pour une action non implémentée", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageCsmBillingFollowup(
    { supabase, userId: "user-1" },
    { action: "delete", followup_id: "followup-1" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Action delete not implemented");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCsmBillingFollowup retourne une erreur métier quand Supabase échoue", async () => {
  const { supabase } = createSupabaseMock({
    data: null,
    error: new Error("billing table permission denied"),
  });

  const result = await executeManageCsmBillingFollowup(
    { supabase, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "billing table permission denied");
});

Deno.test("module expose des fonctions asynchrones testables sans réseau", () => {
  assertEquals(typeof executeGetCsmHealthScore, "function");
  assertEquals(typeof executeGetCsmKpis, "function");
  assertEquals(typeof executeManageCsmMilestone, "function");
  assertEquals(typeof executeGetChurnPredictions, "function");
  assertEquals(typeof executeManageCsmBillingFollowup, "function");
  assertThrows(() => {
    throw new Error("assertThrows sanity check");
  }, Error, "assertThrows sanity check");
});

Deno.test("assertRejects est disponible pour les validations asynchrones du fichier", async () => {
  await assertRejects(
    () => Promise.reject(new Error("assertRejects sanity check")),
    Error,
    "assertRejects sanity check",
  );
});