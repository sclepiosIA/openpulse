import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeParsePayslip,
  executeManageAbsence,
  executeCalculatePayrollKpis,
  executeRecommendTraining,
  executeGetEmployeeCompetences,
} from "./rh-tools.ts";

type QueryResult = { data?: unknown; error?: unknown };

class QueryBuilderMock {
  private state: {
    table: string;
    selected?: string;
    filters: Array<{ op: string; column: string; value: unknown }>;
    ordered?: { column: string; options?: unknown };
    limited?: number;
    inserted?: unknown;
    singleResult?: boolean;
  };

  constructor(
    private readonly handlers: Record<string, (state: QueryBuilderMock["state"]) => Promise<QueryResult> | QueryResult>,
    table: string,
  ) {
    this.state = {
      table,
      filters: [],
    };
  }

  select(columns?: string) {
    this.state.selected = columns;
    return this;
  }

  order(column: string, options?: unknown) {
    this.state.ordered = { column, options };
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.state.filters.push({ op: "neq", column, value });
    return this;
  }

  limit(count: number) {
    this.state.limited = count;
    return this.resolve();
  }

  insert(payload: unknown) {
    this.state.inserted = payload;
    return this;
  }

  single() {
    this.state.singleResult = true;
    return this.resolve();
  }

  then(onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) {
    return this.resolve().then(onFulfilled, onRejected);
  }

  private resolve(): Promise<QueryResult> {
    const handler = this.handlers[this.state.table];
    if (!handler) return Promise.resolve({ data: null, error: null });
    return Promise.resolve(handler(structuredClone(this.state)));
  }
}

function createSupabaseMock(options?: {
  functionsInvoke?: (name: string, payload: unknown) => Promise<QueryResult> | QueryResult;
  tableHandlers?: Record<string, (state: unknown) => Promise<QueryResult> | QueryResult>;
}) {
  return {
    functions: {
      invoke: (name: string, payload: unknown) => {
        if (!options?.functionsInvoke) return Promise.resolve({ data: null, error: null });
        return Promise.resolve(options.functionsInvoke(name, payload));
      },
    },
    from: (table: string) => new QueryBuilderMock((options?.tableHandlers ?? {}) as Record<string, (state: QueryBuilderMock["state"]) => Promise<QueryResult> | QueryResult>, table),
  };
}

Deno.test("executeParsePayslip retourne les données analysées en succès", async () => {
  const supabase = createSupabaseMock({
    functionsInvoke: (name, payload) => {
      assertEquals(name, "parse-bulletin-salaire");
      assertEquals(payload, {
        body: { storage_path: "docs/bulletin.pdf", profile_id: "prof_1" },
      });
      return {
        data: {
          parsed_data: { employeur: "ACME", periode: "2024-01" },
          salaire_net: 2450.5,
        },
        error: null,
      };
    },
  });

  const result = await executeParsePayslip(
    { supabase: supabase as never, userId: "user_1" },
    { storage_path: "docs/bulletin.pdf", profile_id: "prof_1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Bulletin analysé",
    parsed_data: { employeur: "ACME", periode: "2024-01" },
    salaire_net: 2450.5,
  });
  assertExists(result.execution_time_ms);
});

Deno.test("executeParsePayslip retourne une erreur lisible si la function échoue", async () => {
  const supabase = createSupabaseMock({
    functionsInvoke: () => ({
      data: null,
      error: new Error("function failed"),
    }),
  });

  const result = await executeParsePayslip(
    { supabase: supabase as never, userId: "user_1" },
    { storage_path: "docs/bulletin.pdf", profile_id: "prof_1" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "function failed");
  assertExists(result.execution_time_ms);
});

Deno.test("executeManageAbsence list retourne les absences et le count", async () => {
  const absences = [
    { id: "a1", profile_id: "p1", date_debut: "2024-05-10", profiles: { nom: "Doe", prenom: "Jane" } },
    { id: "a2", profile_id: "p1", date_debut: "2024-04-01", profiles: { nom: "Doe", prenom: "Jane" } },
  ];

  const supabase = createSupabaseMock({
    tableHandlers: {
      rh_absences: (state: any) => {
        assertEquals(state.selected, "*, profiles(nom, prenom)");
        assertEquals(state.ordered, { column: "date_debut", options: { ascending: false } });
        assertEquals(state.limited, 50);
        assertEquals(state.filters, [{ op: "eq", column: "profile_id", value: "p1" }]);
        return { data: absences, error: null };
      },
    },
  });

  const result = await executeManageAbsence(
    { supabase: supabase as never, userId: "manager_1" },
    { action: "list", profile_id: "p1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { absences, count: 2 });
});

Deno.test("executeManageAbsence create crée une absence avec les bonnes valeurs par défaut", async () => {
  const created = {
    id: "abs_1",
    profile_id: "p42",
    type: "conge_paye",
    date_debut: "2024-08-01",
    date_fin: "2024-08-10",
    statut: "pending",
    created_by: "user_99",
  };

  const supabase = createSupabaseMock({
    tableHandlers: {
      rh_absences: (state: any) => {
        assertEquals(state.inserted, {
          profile_id: "p42",
          type: "conge_paye",
          date_debut: "2024-08-01",
          date_fin: "2024-08-10",
          statut: "pending",
          created_by: "user_99",
        });
        assertEquals(state.selected, undefined);
        assertEquals(state.singleResult, true);
        return { data: created, error: null };
      },
    },
  });

  const result = await executeManageAbsence(
    { supabase: supabase as never, userId: "user_99" },
    { action: "create", profile_id: "p42", date_debut: "2024-08-01", date_fin: "2024-08-10" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Absence créée",
    absence: created,
  });
});

Deno.test("executeManageAbsence create retourne une erreur si des champs requis manquent", async () => {
  const supabase = createSupabaseMock();

  const result = await executeManageAbsence(
    { supabase: supabase as never, userId: "user_99" },
    { action: "create", profile_id: "p42", date_debut: "2024-08-01" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "profile_id, date_debut, date_fin required");
});

Deno.test("executeManageAbsence check_conflicts détecte des conflits existants", async () => {
  const conflicts = [
    { id: "abs_1", profile_id: "p7", statut: "pending" },
    { id: "abs_2", profile_id: "p7", statut: "approved" },
  ];

  const supabase = createSupabaseMock({
    tableHandlers: {
      rh_absences: (state: any) => {
        assertEquals(state.selected, "*");
        assertEquals(state.filters, [
          { op: "eq", column: "profile_id", value: "p7" },
          { op: "neq", column: "statut", value: "rejected" },
        ]);
        return { data: conflicts, error: null };
      },
    },
  });

  const result = await executeManageAbsence(
    { supabase: supabase as never, userId: "user_1" },
    { action: "check_conflicts", profile_id: "p7", date_debut: "2024-09-01", date_fin: "2024-09-02" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    has_conflicts: true,
    existing_absences: conflicts,
  });
});

Deno.test("executeManageAbsence check_conflicts retourne false quand aucune absence n'existe", async () => {
  const supabase = createSupabaseMock({
    tableHandlers: {
      rh_absences: () => ({ data: [], error: null }),
    },
  });

  const result = await executeManageAbsence(
    { supabase: supabase as never, userId: "user_1" },
    { action: "check_conflicts", profile_id: "p7", date_debut: "2024-09-01", date_fin: "2024-09-02" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    has_conflicts: false,
    existing_absences: [],
  });
});

Deno.test("executeManageAbsence retourne un message pour une action non implémentée", async () => {
  const supabase = createSupabaseMock();

  const result = await executeManageAbsence(
    { supabase: supabase as never, userId: "user_1" },
    { action: "delete", absence_id: "a1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Action delete not implemented",
  });
});

Deno.test("executeCalculatePayrollKpis agrège correctement les montants du mois", async () => {
  const salaires = [
    { salaire_net: 2000, salaire_brut: 2600, cout_employeur: 3400 },
    { salaire_net: 2500.5, salaire_brut: 3200, cout_employeur: 4100.25 },
    { salaire_net: null, salaire_brut: 1000, cout_employeur: null },
  ];

  const supabase = createSupabaseMock({
    tableHandlers: {
      rh_salaires_mensuels: (state: any) => {
        assertEquals(state.selected, "salaire_net, salaire_brut, cout_employeur");
        assertEquals(state.filters, [
          { op: "eq", column: "annee", value: 2024 },
          { op: "eq", column: "mois", value: 3 },
        ]);
        return { data: salaires, error: null };
      },
    },
  });

  const result = await executeCalculatePayrollKpis(
    { supabase: supabase as never, userId: "user_1" },
    { period: "2024-03" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    period: "2024-03",
    masse_salariale_nette: 4500.5,
    masse_salariale_brute: 6800,
    cout_employeur_total: 7500.25,
    nombre_employes: 3,
  });
});

Deno.test("executeCalculatePayrollKpis gère une liste vide", async () => {
  const supabase = createSupabaseMock({
    tableHandlers: {
      rh_salaires_mensuels: () => ({ data: [], error: null }),
    },
  });

  const result = await executeCalculatePayrollKpis(
    { supabase: supabase as never, userId: "user_1" },
    { period: "2024-12" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    period: "2024-12",
    masse_salariale_nette: 0,
    masse_salariale_brute: 0,
    cout_employeur_total: 0,
    nombre_employes: 0,
  });
});

Deno.test("executeRecommendTraining retourne les recommandations", async () => {
  const recommendations = [
    { id: "t1", title: "Excel avancé" },
    { id: "t2", title: "Droit social" },
  ];

  const supabase = createSupabaseMock({
    functionsInvoke: (name, payload) => {
      assertEquals(name, "recommend-training");
      assertEquals(payload, { body: { profile_id: "p88" } });
      return { data: { recommendations }, error: null };
    },
  });

  const result = await executeRecommendTraining(
    { supabase: supabase as never, userId: "user_1" },
    { profile_id: "p88" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { recommendations });
});

Deno.test("executeRecommendTraining retourne un tableau vide si aucune recommandation", async () => {
  const supabase = createSupabaseMock({
    functionsInvoke: () => ({ data: {}, error: null }),
  });

  const result = await executeRecommendTraining(
    { supabase: supabase as never, userId: "user_1" },
    { profile_id: "p88" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { recommendations: [] });
});

Deno.test("executeGetEmployeeCompetences retourne les compétences et le count", async () => {
  const competences = [
    { id: "c1", niveau: 4, referentiel_competences: { nom: "Communication", categorie: "Soft skills" } },
    { id: "c2", niveau: 5, referentiel_competences: { nom: "Paie", categorie: "Métier" } },
  ];

  const supabase = createSupabaseMock({
    tableHandlers: {
      employee_competences: (state: any) => {
        assertEquals(state.selected, "*, referentiel_competences(nom, categorie)");
        assertEquals(state.filters, [{ op: "eq", column: "profile_id", value: "prof_77" }]);
        return { data: competences, error: null };
      },
    },
  });

  const result = await executeGetEmployeeCompetences(
    { supabase: supabase as never, userId: "user_1" },
    { profile_id: "prof_77" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    competences,
    count: 2,
  });
});

Deno.test("executeGetEmployeeCompetences retourne une erreur si la requête échoue", async () => {
  const supabase = createSupabaseMock({
    tableHandlers: {
      employee_competences: () => ({ data: null, error: new Error("db failed") }),
    },
  });

  const result = await executeGetEmployeeCompetences(
    { supabase: supabase as never, userId: "user_1" },
    { profile_id: "prof_77" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db failed");
});

Deno.test("sanity: assert helpers imported", () => {
  assertExists(assertThrows);
  assertExists(assertRejects);
});