import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeGetChurnPredictionsList,
  executeRecomputeChurnPredictions,
  executeGetChurnAccountDetail,
} from "./churn-tools.ts";

type QueryConfig = {
  data?: unknown;
  error?: Error | null;
};

function createSupabaseStub(options?: {
  list?: QueryConfig;
  detail?: QueryConfig;
  rpc?: QueryConfig;
}) {
  const calls = {
    from: [] as string[],
    select: [] as string[],
    order: [] as Array<{ column: string; options?: unknown }>,
    limit: [] as number[],
    eq: [] as Array<{ column: string; value: unknown }>,
    gte: [] as Array<{ column: string; value: unknown }>,
    maybeSingleCalled: false,
    rpc: [] as string[],
  };

  function makeThenableResult(config: QueryConfig = {}) {
    return Promise.resolve({
      data: config.data ?? null,
      error: config.error ?? null,
    });
  }

  function createQueryBuilder(table: string) {
    const config = table === "churn_predictions" ? options?.list ?? {} : {};
    const qb: any = {
      select(selection: string) {
        calls.select.push(selection);
        return qb;
      },
      order(column: string, opts?: unknown) {
        calls.order.push({ column, options: opts });
        return qb;
      },
      limit(value: number) {
        calls.limit.push(value);
        return qb;
      },
      eq(column: string, value: unknown) {
        calls.eq.push({ column, value });
        return qb;
      },
      gte(column: string, value: unknown) {
        calls.gte.push({ column, value });
        return qb;
      },
      maybeSingle() {
        calls.maybeSingleCalled = true;
        return Promise.resolve({
          data: options?.detail?.data ?? null,
          error: options?.detail?.error ?? null,
        });
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return makeThenableResult(config).then(onFulfilled, onRejected);
      },
    };
    return qb;
  }

  const supabase = {
    from(table: string) {
      calls.from.push(table);
      return createQueryBuilder(table);
    },
    rpc(fn: string) {
      calls.rpc.push(fn);
      return Promise.resolve({
        data: options?.rpc?.data ?? null,
        error: options?.rpc?.error ?? null,
      });
    },
  };

  return { supabase, calls };
}

Deno.test("executeGetChurnPredictionsList retourne une liste transformée, triée et agrégée par tier", async () => {
  const rows = [
    {
      id: "p1",
      etablissement_id: "e1",
      score: 0.92,
      tier: "critique",
      factors: ["baisse usage", "tickets ouverts", "retards paiement", "autre"],
      recommendations: ["appeler", "audit", "offre retention", "bonus"],
      computed_at: "2024-01-10T10:00:00Z",
      etablissements: { nom: "Clinique A", statut: "actif" },
    },
    {
      id: "p2",
      etablissement_id: "e2",
      score: 0.81,
      tier: "eleve",
      factors: ["usage faible"],
      recommendations: ["former équipe"],
      computed_at: "2024-01-11T10:00:00Z",
      etablissements: { nom: "Cabinet B", statut: "en_risque" },
    },
    {
      id: "p3",
      etablissement_id: "e3",
      score: 0.79,
      tier: "critique",
      factors: null,
      recommendations: null,
      computed_at: "2024-01-12T10:00:00Z",
      etablissements: null,
    },
  ];

  const { supabase, calls } = createSupabaseStub({
    list: { data: rows, error: null },
  });

  const result = await executeGetChurnPredictionsList(
    { supabase: supabase as any, userId: "user-1" },
    { tier: "critique", limit: 2, min_score: 0.8 },
  );

  assertEquals(result.success, true);
  assertExists(result.execution_time_ms);
  assertEquals(calls.from, ["churn_predictions"]);
  assertEquals(calls.limit, [2]);
  assertEquals(calls.eq, [{ column: "tier", value: "critique" }]);
  assertEquals(calls.gte, [{ column: "score", value: 0.8 }]);
  assertEquals(calls.order.length, 1);
  assertEquals(calls.order[0].column, "score");

  assertEquals(result.data.total, 3);
  assertEquals(result.data.by_tier, { critique: 2, eleve: 1 });
  assertEquals(result.data.predictions, [
    {
      etablissement_id: "e1",
      nom: "Clinique A",
      statut: "actif",
      score: 0.92,
      tier: "critique",
      top_factors: ["baisse usage", "tickets ouverts", "retards paiement"],
      recommendations: ["appeler", "audit", "offre retention"],
      computed_at: "2024-01-10T10:00:00Z",
    },
    {
      etablissement_id: "e2",
      nom: "Cabinet B",
      statut: "en_risque",
      score: 0.81,
      tier: "eleve",
      top_factors: ["usage faible"],
      recommendations: ["former équipe"],
      computed_at: "2024-01-11T10:00:00Z",
    },
    {
      etablissement_id: "e3",
      nom: null,
      statut: null,
      score: 0.79,
      tier: "critique",
      top_factors: [],
      recommendations: [],
      computed_at: "2024-01-12T10:00:00Z",
    },
  ]);
});

Deno.test("executeGetChurnPredictionsList plafonne la limite à 100 et n'applique pas les filtres absents", async () => {
  const { supabase, calls } = createSupabaseStub({
    list: { data: [], error: null },
  });

  const result = await executeGetChurnPredictionsList(
    { supabase: supabase as any, userId: "user-2" },
    { limit: 250 },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total, 0);
  assertEquals(result.data.by_tier, {});
  assertEquals(result.data.predictions, []);
  assertEquals(calls.limit, [100]);
  assertEquals(calls.eq, []);
  assertEquals(calls.gte, []);
});

Deno.test("executeGetChurnPredictionsList retourne une erreur métier si la requête Supabase échoue", async () => {
  const { supabase } = createSupabaseStub({
    list: { data: null, error: new Error("db list failed") },
  });

  const result = await executeGetChurnPredictionsList(
    { supabase: supabase as any, userId: "user-3" },
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db list failed");
  assertExists(result.execution_time_ms);
});

Deno.test("executeRecomputeChurnPredictions appelle la RPC compute_churn_predictions et retourne le résultat", async () => {
  const rpcResult = { inserted: 42, updated: 5 };
  const { supabase, calls } = createSupabaseStub({
    rpc: { data: rpcResult, error: null },
  });

  const result = await executeRecomputeChurnPredictions(
    { supabase: supabase as any, userId: "user-4" } as any,
    {},
  );

  assertEquals(calls.rpc, ["compute_churn_predictions"]);
  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Recalcul des prédictions de churn lancé",
    result: rpcResult,
  });
  assertExists(result.execution_time_ms);
});

Deno.test("executeRecomputeChurnPredictions retourne une erreur si la RPC échoue", async () => {
  const { supabase } = createSupabaseStub({
    rpc: { data: null, error: new Error("rpc failed") },
  });

  const result = await executeRecomputeChurnPredictions(
    { supabase: supabase as any, userId: "user-5" } as any,
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "rpc failed");
});

Deno.test("executeGetChurnAccountDetail retourne le détail d'un établissement avec valeurs par défaut sur tableaux", async () => {
  const detailRow = {
    etablissement_id: "etab-1",
    score: 0.88,
    tier: "eleve",
    factors: ["baisse fréquence", "insatisfaction support"],
    recommendations: null,
    computed_at: "2024-02-01T09:30:00Z",
    etablissements: {
      id: "etab-1",
      nom: "Maison de Santé C",
      statut: "actif",
      type_structure: "MSP",
      csm_id: "csm-1",
      commercial_id: "com-2",
    },
  };

  const { supabase, calls } = createSupabaseStub({
    detail: { data: detailRow, error: null },
  });

  const result = await executeGetChurnAccountDetail(
    { supabase: supabase as any, userId: "user-6" },
    { etablissement_id: "etab-1" },
  );

  assertEquals(calls.from, ["churn_predictions"]);
  assertEquals(calls.eq, [{ column: "etablissement_id", value: "etab-1" }]);
  assertEquals(calls.maybeSingleCalled, true);
  assertEquals(result.success, true);
  assertEquals(result.data, {
    etablissement: {
      id: "etab-1",
      nom: "Maison de Santé C",
      statut: "actif",
      type_structure: "MSP",
      csm_id: "csm-1",
      commercial_id: "com-2",
    },
    score: 0.88,
    tier: "eleve",
    factors: ["baisse fréquence", "insatisfaction support"],
    recommendations: [],
    computed_at: "2024-02-01T09:30:00Z",
  });
});

Deno.test("executeGetChurnAccountDetail retourne un message explicite quand aucune prédiction n'existe", async () => {
  const { supabase } = createSupabaseStub({
    detail: { data: null, error: null },
  });

  const result = await executeGetChurnAccountDetail(
    { supabase: supabase as any, userId: "user-7" },
    { etablissement_id: "missing-etab" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Aucune prédiction trouvée pour cet établissement",
    etablissement_id: "missing-etab",
  });
});

Deno.test("executeGetChurnAccountDetail échoue si etablissement_id est manquant", async () => {
  const { supabase } = createSupabaseStub({
    detail: { data: null, error: null },
  });

  const result = await executeGetChurnAccountDetail(
    { supabase: supabase as any, userId: "user-8" },
    { etablissement_id: "" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "etablissement_id requis");
});

Deno.test("executeGetChurnAccountDetail retourne une erreur si la lecture Supabase échoue", async () => {
  const { supabase } = createSupabaseStub({
    detail: { data: null, error: new Error("detail query failed") },
  });

  const result = await executeGetChurnAccountDetail(
    { supabase: supabase as any, userId: "user-9" },
    { etablissement_id: "etab-err" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "detail query failed");
});