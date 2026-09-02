import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeGetEmployeeDossier, executeUpdateProfile } from "./people-tools.ts";

type QueryResult = { data: unknown; error: Error | null };

class QueryBuilderStub {
  table: string;
  private responses: Map<string, QueryResult>;
  private state: {
    filters: Array<{ type: string; column: string; value: unknown }>;
    orders: Array<{ column: string; ascending?: boolean }>;
    limit?: number;
    selected?: string;
    updateData?: Record<string, unknown>;
    singleCalled?: boolean;
  };

  constructor(table: string, responses: Map<string, QueryResult>) {
    this.table = table;
    this.responses = responses;
    this.state = { filters: [], orders: [] };
  }

  select(columns?: string) {
    this.state.selected = columns;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.state.updateData = data;
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.state.filters.push({ type: "in", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orders.push({ column, ascending: options?.ascending });
    return this;
  }

  limit(value: number) {
    this.state.limit = value;
    return this;
  }

  async single() {
    this.state.singleCalled = true;
    const result = this.responses.get(this.table) ?? { data: null, error: null };
    return result;
  }

  then(onfulfilled?: (value: QueryResult) => unknown, onrejected?: (reason: unknown) => unknown) {
    const result = this.responses.get(this.table) ?? { data: null, error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  snapshot() {
    return {
      table: this.table,
      filters: this.state.filters.slice(),
      orders: this.state.orders.slice(),
      limit: this.state.limit,
      selected: this.state.selected,
      updateData: this.state.updateData ? { ...this.state.updateData } : undefined,
      singleCalled: this.state.singleCalled ?? false,
    };
  }
}

class SupabaseStub {
  responses: Map<string, QueryResult>;
  builders: QueryBuilderStub[];

  constructor(responses: Record<string, QueryResult>) {
    this.responses = new Map(Object.entries(responses));
    this.builders = [];
  }

  from(table: string) {
    const builder = new QueryBuilderStub(table, this.responses);
    this.builders.push(builder);
    return builder;
  }

  builderFor(table: string) {
    const found = this.builders.find((b) => b.table === table);
    assertExists(found);
    return found;
  }
}

Deno.test("executeGetEmployeeDossier returns aggregated dossier and summary counts", async () => {
  const supabase = new SupabaseStub({
    profiles: {
      data: {
        id: "p1",
        prenom: "Alice",
        nom: "Martin",
        email: "alice@example.test",
        fonction: "RH",
        telephone: "0102030405",
        date_embauche: "2023-01-15",
        type_contrat: "CDI",
        actif: true,
        avatar_url: "https://cdn.example.test/a.png",
        linkedin_url: "https://linkedin.example.test/alice",
      },
      error: null,
    },
    rh_salaires_mensuels: {
      data: [
        { mois: 5, annee: 2024, salaire_net: 2500, salaire_brut: 3200, cout_employeur: 4200 },
        { mois: 4, annee: 2024, salaire_net: 2490, salaire_brut: 3190, cout_employeur: 4190 },
      ],
      error: null,
    },
    rh_absences: {
      data: [
        { id: "a1", type: "CP", date_debut: "2024-05-01", date_fin: "2024-05-03", statut: "Validé", nombre_jours: 3 },
      ],
      error: null,
    },
    employee_competences: {
      data: [
        { id: "c1", niveau: 4, referentiel_competences: { nom: "Gestion RH", categorie: "Métier" } },
        { id: "c2", niveau: 3, referentiel_competences: { nom: "Paie", categorie: "Métier" } },
        { id: "c3", niveau: 5, referentiel_competences: { nom: "Communication", categorie: "Soft skills" } },
      ],
      error: null,
    },
    employee_certifications: {
      data: [
        { id: "cert1", nom: "CQP", organisme: "AFPA", date_obtention: "2023-02-01", date_expiration: null, statut: "Valide" },
      ],
      error: null,
    },
    taches: {
      data: [
        { id: "t1", titre: "Signer avenant", statut: "En cours", priorite: "Haute", echeance: "2024-06-01" },
        { id: "t2", titre: "Mettre à jour dossier", statut: "A faire", priorite: "Moyenne", echeance: "2024-06-15" },
      ],
      error: null,
    },
  });

  const result = await executeGetEmployeeDossier(
    { supabase: supabase as unknown as never, userId: "u1" },
    { profile_id: "p1" },
  );

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals((result.data as Record<string, unknown>).summary, {
    derniers_salaires: 2,
    absences_total: 1,
    competences_count: 3,
    certifications_count: 1,
    taches_actives: 2,
  });

  const data = result.data as Record<string, unknown>;
  assertEquals((data.profile as Record<string, unknown>).id, "p1");
  assertEquals((data.salaires as unknown[]).length, 2);
  assertEquals((data.absences as unknown[]).length, 1);
  assertEquals((data.competences as unknown[]).length, 3);
  assertEquals((data.certifications as unknown[]).length, 1);
  assertEquals((data.taches_en_cours as unknown[]).length, 2);
  assertEquals(typeof result.execution_time_ms, "number");

  const profileQ = supabase.builderFor("profiles").snapshot();
  assertEquals(profileQ.selected, "id, prenom, nom, email, fonction, telephone, date_embauche, type_contrat, actif, avatar_url, linkedin_url");
  assertEquals(profileQ.filters, [{ type: "eq", column: "id", value: "p1" }]);
  assertEquals(profileQ.singleCalled, true);

  const salairesQ = supabase.builderFor("rh_salaires_mensuels").snapshot();
  assertEquals(salairesQ.filters, [{ type: "eq", column: "profile_id", value: "p1" }]);
  assertEquals(salairesQ.orders, [
    { column: "annee", ascending: false },
    { column: "mois", ascending: false },
  ]);
  assertEquals(salairesQ.limit, 6);

  const absencesQ = supabase.builderFor("rh_absences").snapshot();
  assertEquals(absencesQ.filters, [{ type: "eq", column: "profile_id", value: "p1" }]);
  assertEquals(absencesQ.orders, [{ column: "date_debut", ascending: false }]);
  assertEquals(absencesQ.limit, 10);

  const tasksQ = supabase.builderFor("taches").snapshot();
  assertEquals(tasksQ.filters, [
    { type: "eq", column: "responsable_id", value: "p1" },
    { type: "in", column: "statut", value: ["A faire", "En cours"] },
  ]);
  assertEquals(tasksQ.orders, [{ column: "echeance", ascending: true }]);
  assertEquals(tasksQ.limit, 10);
});

Deno.test("executeGetEmployeeDossier falls back to empty arrays when non-profile datasets are null", async () => {
  const supabase = new SupabaseStub({
    profiles: {
      data: { id: "p2", prenom: "Bob", nom: "Durand" },
      error: null,
    },
    rh_salaires_mensuels: { data: null, error: null },
    rh_absences: { data: null, error: null },
    employee_competences: { data: null, error: null },
    employee_certifications: { data: null, error: null },
    taches: { data: null, error: null },
  });

  const result = await executeGetEmployeeDossier(
    { supabase: supabase as unknown as never, userId: "u2" },
    { profile_id: "p2" },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.salaires, []);
  assertEquals(data.absences, []);
  assertEquals(data.competences, []);
  assertEquals(data.certifications, []);
  assertEquals(data.taches_en_cours, []);
  assertEquals(data.summary, {
    derniers_salaires: 0,
    absences_total: 0,
    competences_count: 0,
    certifications_count: 0,
    taches_actives: 0,
  });
});

Deno.test("executeGetEmployeeDossier returns failure when profile query has an error", async () => {
  const supabase = new SupabaseStub({
    profiles: { data: null, error: new Error("profile not found") },
    rh_salaires_mensuels: { data: [], error: null },
    rh_absences: { data: [], error: null },
    employee_competences: { data: [], error: null },
    employee_certifications: { data: [], error: null },
    taches: { data: [], error: null },
  });

  const result = await executeGetEmployeeDossier(
    { supabase: supabase as unknown as never, userId: "u3" },
    { profile_id: "missing" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "profile not found");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeUpdateProfile updates only allowed fields and returns updated_fields", async () => {
  const updatedRow = {
    id: "p1",
    fonction: "Directrice RH",
    telephone: "0600000000",
    email: "alice.new@example.test",
  };

  const supabase = new SupabaseStub({
    profiles: { data: updatedRow, error: null },
  });

  const result = await executeUpdateProfile(
    { supabase: supabase as unknown as never, userId: "u1" },
    {
      profile_id: "p1",
      data: {
        fonction: "Directrice RH",
        telephone: "0600000000",
        email: "alice.new@example.test",
        actif: false,
        nom: "ShouldNotPass",
      },
    },
  );

  assertEquals(result.success, true);
  const data = result.data as Record<string, unknown>;
  assertEquals(data.message, "Profil mis à jour");
  assertEquals(data.profile, updatedRow);
  assertEquals(data.updated_fields, ["fonction", "telephone", "email"]);

  const profileQ = supabase.builderFor("profiles").snapshot();
  assertEquals(profileQ.updateData, {
    fonction: "Directrice RH",
    telephone: "0600000000",
    email: "alice.new@example.test",
  });
  assertEquals(profileQ.filters, [{ type: "eq", column: "id", value: "p1" }]);
  assertEquals(profileQ.selected, undefined);
  assertEquals(profileQ.singleCalled, true);
});

Deno.test("executeUpdateProfile rejects payload with no allowed fields", async () => {
  const supabase = new SupabaseStub({
    profiles: { data: { id: "p1" }, error: null },
  });

  const result = await executeUpdateProfile(
    { supabase: supabase as unknown as never, userId: "u1" },
    {
      profile_id: "p1",
      data: {
        actif: true,
        role: "admin",
        nom: "Martin",
      },
    },
  );

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Aucun champ modifiable trouvé. Champs autorisés: fonction, telephone, email, linkedin_url, avatar_url, date_embauche, type_contrat",
  );
  assertEquals(supabase.builders.length, 0);
});

Deno.test("executeUpdateProfile rejects nullish payload with no allowed fields", async () => {
  const supabase = new SupabaseStub({
    profiles: { data: { id: "p1" }, error: null },
  });

  const result = await executeUpdateProfile(
    { supabase: supabase as unknown as never, userId: "u1" },
    {
      profile_id: "p1",
      data: {},
    },
  );

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Aucun champ modifiable trouvé. Champs autorisés: fonction, telephone, email, linkedin_url, avatar_url, date_embauche, type_contrat",
  );
});

Deno.test("executeUpdateProfile returns failure when update query errors", async () => {
  const supabase = new SupabaseStub({
    profiles: { data: null, error: new Error("update denied") },
  });

  const result = await executeUpdateProfile(
    { supabase: supabase as unknown as never, userId: "u1" },
    {
      profile_id: "p1",
      data: {
        email: "blocked@example.test",
      },
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "update denied");

  const profileQ = supabase.builderFor("profiles").snapshot();
  assertEquals(profileQ.updateData, { email: "blocked@example.test" });
  assertEquals(profileQ.filters, [{ type: "eq", column: "id", value: "p1" }]);
});

Deno.test("module exported functions are loadable and are functions", () => {
  assertEquals(typeof executeGetEmployeeDossier, "function");
  assertEquals(typeof executeUpdateProfile, "function");
  assertThrows(() => {
    throw new Error("sentinel");
  }, Error, "sentinel");
});

Deno.test("assert helpers import smoke test for async rejects", async () => {
  await assertRejects(
    async () => {
      throw new Error("async sentinel");
    },
    Error,
    "async sentinel",
  );
});