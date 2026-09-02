import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeManageContact,
  executeManageEtablissement,
  executeManageGroupe,
  executeManagePartenaire,
} from "./crm-management-tools.ts";

type RecordedCall = {
  table: string;
  method: string;
  args: unknown[];
};

class QueryBuilderStub {
  table: string;
  calls: RecordedCall[];
  supabase: SupabaseStub;
  operation = "select";
  payload: unknown = undefined;
  filters: Array<{ method: string; column?: string; value?: unknown; args: unknown[] }> = [];

  constructor(supabase: SupabaseStub, table: string) {
    this.supabase = supabase;
    this.table = table;
    this.calls = supabase.calls;
  }

  private record(method: string, args: unknown[]) {
    this.calls.push({ table: this.table, method, args });
  }

  select(...args: unknown[]) {
    this.record("select", args);
    return this;
  }

  order(...args: unknown[]) {
    this.record("order", args);
    return this;
  }

  limit(...args: unknown[]) {
    this.record("limit", args);
    return this;
  }

  eq(...args: unknown[]) {
    this.record("eq", args);
    this.filters.push({ method: "eq", column: args[0] as string, value: args[1], args });
    return this;
  }

  ilike(...args: unknown[]) {
    this.record("ilike", args);
    this.filters.push({ method: "ilike", column: args[0] as string, value: args[1], args });
    return this;
  }

  or(...args: unknown[]) {
    this.record("or", args);
    return this;
  }

  insert(...args: unknown[]) {
    this.operation = "insert";
    this.payload = args[0];
    this.record("insert", args);
    return this;
  }

  update(...args: unknown[]) {
    this.operation = "update";
    this.payload = args[0];
    this.record("update", args);
    return this;
  }

  delete(...args: unknown[]) {
    this.operation = "delete";
    this.record("delete", args);
    return this;
  }

  single() {
    this.record("single", []);
    return Promise.resolve(this.supabase.resolve(this, true));
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.supabase.resolve(this, false)).then(onfulfilled, onrejected);
  }
}

class SupabaseStub {
  calls: RecordedCall[] = [];
  resolver?: (query: QueryBuilderStub, single: boolean) => { data: unknown; error: unknown };

  constructor(resolver?: (query: QueryBuilderStub, single: boolean) => { data: unknown; error: unknown }) {
    this.resolver = resolver;
  }

  from(table: string) {
    this.calls.push({ table, method: "from", args: [table] });
    return new QueryBuilderStub(this, table);
  }

  resolve(query: QueryBuilderStub, single: boolean) {
    if (this.resolver) {
      return this.resolver(query, single);
    }

    const idFilter = query.filters.find((filter) => filter.method === "eq" && filter.column === "id");

    if (query.operation === "insert") {
      return {
        data: {
          id: `${query.table}-created-id`,
          ...(query.payload as Record<string, unknown>),
        },
        error: null,
      };
    }

    if (query.operation === "update") {
      return {
        data: {
          id: idFilter?.value ?? `${query.table}-updated-id`,
          nom: "Nom mis à jour",
          ...(query.payload as Record<string, unknown>),
        },
        error: null,
      };
    }

    if (query.operation === "delete") {
      return { data: null, error: null };
    }

    if (single) {
      return {
        data: {
          id: idFilter?.value ?? `${query.table}-single-id`,
          nom: `${query.table} single`,
        },
        error: null,
      };
    }

    return { data: [], error: null };
  }
}

function makeCtx(supabase: SupabaseStub) {
  return {
    supabase: supabase as unknown as any,
    userId: "user-test-123",
  };
}

function callsFor(stub: SupabaseStub, method: string, table?: string) {
  return stub.calls.filter((call) => call.method === method && (!table || call.table === table));
}

Deno.test("module exports expected CRM management functions", () => {
  assertExists(executeManageEtablissement);
  assertExists(executeManageContact);
  assertExists(executeManageGroupe);
  assertExists(executeManagePartenaire);
});

Deno.test("local assertion helpers behave as expected", async () => {
  assertThrows(() => {
    throw new Error("validation locale");
  }, Error, "validation locale");

  await assertRejects(
    () => Promise.reject(new Error("rejet local")),
    Error,
    "rejet local",
  );
});

Deno.test("executeManageEtablissement create validates required nom without database call", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "create",
    data: { ville: "Paris" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "nom requis pour créer un établissement");
  assertEquals(supabase.calls.length, 0);
});

Deno.test("executeManageEtablissement create inserts default statut and created_by", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "create",
    data: {
      nom: "Clinique Saint Jean",
      ville: "Lyon",
      ca_previsionnel: 120000,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, 'Établissement "Clinique Saint Jean" créé');
  assertEquals(result.data.etablissement, {
    id: "etablissements-created-id",
    nom: "Clinique Saint Jean",
    ville: "Lyon",
    ca_previsionnel: 120000,
    statut: "prospect",
    created_by: "user-test-123",
  });

  assertEquals(callsFor(supabase, "insert", "etablissements")[0].args[0], {
    nom: "Clinique Saint Jean",
    ville: "Lyon",
    ca_previsionnel: 120000,
    statut: "prospect",
    created_by: "user-test-123",
  });
  assertEquals(callsFor(supabase, "select", "etablissements").length, 1);
  assertEquals(callsFor(supabase, "single", "etablissements").length, 1);
});

Deno.test("executeManageEtablissement list applies business filters, ordering and limit", async () => {
  const supabase = new SupabaseStub((query) => {
    if (query.table === "etablissements") {
      return {
        data: [
          { id: "eta-1", nom: "Clinique Nord", statut: "client", ville: "Lyon" },
          { id: "eta-2", nom: "EHPAD Sud", statut: "client", ville: "Villeurbanne" },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "list",
    limit: 10,
    filters: {
      statut: "client",
      commercial_id: "commercial-1",
      csm_id: "csm-2",
      dpi: "DPI-X",
      ville: "Lyon",
      groupe_id: "groupe-3",
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.count, 2);
  assertEquals(result.data.etablissements[0].nom, "Clinique Nord");
  assertEquals(callsFor(supabase, "select", "etablissements")[0].args[0], "id, nom, statut, ville, ca_previsionnel, ca_signe, dpi, created_at");
  assertEquals(callsFor(supabase, "order", "etablissements")[0].args, ["created_at", { ascending: false }]);
  assertEquals(callsFor(supabase, "limit", "etablissements")[0].args, [10]);
  assertEquals(callsFor(supabase, "eq", "etablissements").map((call) => call.args), [
    ["statut", "client"],
    ["commercial_id", "commercial-1"],
    ["csm_id", "csm-2"],
    ["dpi", "DPI-X"],
    ["groupe_id", "groupe-3"],
  ]);
  assertEquals(callsFor(supabase, "ilike", "etablissements")[0].args, ["ville", "%Lyon%"]);
});

Deno.test("executeManageEtablissement search sanitizes term before building Supabase OR query", async () => {
  const supabase = new SupabaseStub((query) => {
    assertEquals(query.table, "etablissements");
    return {
      data: [{ id: "eta-10", nom: "Clinique Nord", ville: "Nantes", statut: "prospect", dpi: "DPI-A" }],
      error: null,
    };
  });

  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "search",
    search_term: "Clinique.%*:Nord",
    limit: 7,
  });

  assertEquals(result.success, true);
  assertEquals(result.data.count, 1);
  assertEquals(result.data.search_term, "Clinique.%*:Nord");
  assertEquals(callsFor(supabase, "or", "etablissements")[0].args[0], "nom.ilike.%Clinique    Nord%,ville.ilike.%Clinique    Nord%,finess.ilike.%Clinique    Nord%");
  assertEquals(callsFor(supabase, "limit", "etablissements")[0].args, [7]);
});

Deno.test("executeManageEtablissement search returns empty result and skips database for unsafe empty term", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "search",
    search_term: ".,%*:\\",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    etablissements: [],
    count: 0,
    search_term: ".,%*:\\",
  });
  assertEquals(supabase.calls.length, 0);
});

Deno.test("executeManageEtablissement get validates etablissement_id", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "get",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "etablissement_id requis");
  assertEquals(supabase.calls.length, 0);
});

Deno.test("executeManageEtablissement update validates data and surfaces database errors", async () => {
  const missingDataSupabase = new SupabaseStub();
  const missingData = await executeManageEtablissement(makeCtx(missingDataSupabase), {
    action: "update",
    etablissement_id: "eta-1",
  });

  assertEquals(missingData.success, false);
  assertEquals(missingData.error, "data requis pour la mise à jour");
  assertEquals(missingDataSupabase.calls.length, 0);

  const failingSupabase = new SupabaseStub(() => ({
    data: null,
    error: new Error("contrainte établissement"),
  }));

  const failedList = await executeManageEtablissement(makeCtx(failingSupabase), {
    action: "list",
  });

  assertEquals(failedList.success, false);
  assertEquals(failedList.error, "contrainte établissement");
});

Deno.test("executeManageEtablissement delete archives instead of deleting row", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageEtablissement(makeCtx(supabase), {
    action: "delete",
    etablissement_id: "eta-archive",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Établissement archivé");
  assertEquals(callsFor(supabase, "update", "etablissements")[0].args[0], { statut: "archived" });
  assertEquals(callsFor(supabase, "eq", "etablissements")[0].args, ["id", "eta-archive"]);
  assertEquals(callsFor(supabase, "delete", "etablissements").length, 0);
});

Deno.test("executeManageContact create validates required fields", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageContact(makeCtx(supabase), {
    action: "create",
    etablissement_id: "eta-1",
    data: { prenom: "Alice" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "nom et etablissement_id requis");
  assertEquals(supabase.calls.length, 0);
});

Deno.test("executeManageContact create inserts etablissement_id and created_by", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageContact(makeCtx(supabase), {
    action: "create",
    etablissement_id: "eta-42",
    data: {
      nom: "Durand",
      prenom: "Alice",
      email: "alice@example.test",
      est_decideur: true,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, 'Contact "Alice Durand" créé');
  assertEquals(result.data.contact, {
    id: "contacts-created-id",
    nom: "Durand",
    prenom: "Alice",
    email: "alice@example.test",
    est_decideur: true,
    etablissement_id: "eta-42",
    created_by: "user-test-123",
  });
  assertEquals(callsFor(supabase, "insert", "contacts")[0].args[0], {
    nom: "Durand",
    prenom: "Alice",
    email: "alice@example.test",
    est_decideur: true,
    etablissement_id: "eta-42",
    created_by: "user-test-123",
  });
});

Deno.test("executeManageContact list orders by nom and filters by etablissement_id", async () => {
  const supabase = new SupabaseStub(() => ({
    data: [
      { id: "contact-1", nom: "Bernard", prenom: "Zoé", etablissement_id: "eta-1" },
      { id: "contact-2", nom: "Martin", prenom: "Marc", etablissement_id: "eta-1" },
    ],
    error: null,
  }));

  const result = await executeManageContact(makeCtx(supabase), {
    action: "list",
    etablissement_id: "eta-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.count, 2);
  assertEquals(callsFor(supabase, "select", "contacts")[0].args[0], "id, nom, prenom, email, telephone, fonction, est_decideur, etablissement_id");
  assertEquals(callsFor(supabase, "order", "contacts")[0].args, ["nom", { ascending: true }]);
  assertEquals(callsFor(supabase, "limit", "contacts")[0].args, [50]);
  assertEquals(callsFor(supabase, "eq", "contacts")[0].args, ["etablissement_id", "eta-1"]);
});

Deno.test("executeManageContact update and delete validate contact_id", async () => {
  const supabase = new SupabaseStub();

  const updateResult = await executeManageContact(makeCtx(supabase), {
    action: "update",
    data: { telephone: "0102030405" },
  });

  const deleteResult = await executeManageContact(makeCtx(supabase), {
    action: "delete",
  });

  assertEquals(updateResult.success, false);
  assertEquals(updateResult.error, "contact_id requis");
  assertEquals(deleteResult.success, false);
  assertEquals(deleteResult.error, "contact_id requis");
  assertEquals(supabase.calls.length, 0);
});

Deno.test("executeManageGroupe create inserts created_by and returns message", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageGroupe(makeCtx(supabase), {
    action: "create",
    data: {
      nom: "Groupe Santé Ouest",
      type: "regional",
      description: "Réseau régional",
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, 'Groupe "Groupe Santé Ouest" créé');
  assertEquals(callsFor(supabase, "insert", "groupes_etablissements")[0].args[0], {
    nom: "Groupe Santé Ouest",
    type: "regional",
    description: "Réseau régional",
    created_by: "user-test-123",
  });
});

Deno.test("executeManageGroupe delete first detaches establishments then deletes group", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManageGroupe(makeCtx(supabase), {
    action: "delete",
    groupe_id: "groupe-99",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Groupe supprimé");
  assertEquals(supabase.calls.map((call) => `${call.table}.${call.method}`), [
    "etablissements.from",
    "etablissements.update",
    "etablissements.eq",
    "groupes_etablissements.from",
    "groupes_etablissements.delete",
    "groupes_etablissements.eq",
  ]);
  assertEquals(callsFor(supabase, "update", "etablissements")[0].args[0], { groupe_id: null });
  assertEquals(callsFor(supabase, "eq", "etablissements")[0].args, ["groupe_id", "groupe-99"]);
  assertEquals(callsFor(supabase, "eq", "groupes_etablissements")[0].args, ["id", "groupe-99"]);
});

Deno.test("executeManageGroupe add_member validates ids and updates etablissement group", async () => {
  const validationSupabase = new SupabaseStub();
  const validation = await executeManageGroupe(makeCtx(validationSupabase), {
    action: "add_member",
    groupe_id: "groupe-1",
  });

  assertEquals(validation.success, false);
  assertEquals(validation.error, "groupe_id et etablissement_id requis");
  assertEquals(validationSupabase.calls.length, 0);

  const supabase = new SupabaseStub((query) => ({
    data: { id: "eta-7", nom: "Clinique Ajoutée", ...(query.payload as Record<string, unknown>) },
    error: null,
  }));

  const result = await executeManageGroupe(makeCtx(supabase), {
    action: "add_member",
    groupe_id: "groupe-1",
    etablissement_id: "eta-7",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, 'Établissement "Clinique Ajoutée" ajouté au groupe');
  assertEquals(callsFor(supabase, "update", "etablissements")[0].args[0], { groupe_id: "groupe-1" });
  assertEquals(callsFor(supabase, "eq", "etablissements")[0].args, ["id", "eta-7"]);
  assertEquals(callsFor(supabase, "select", "etablissements")[0].args[0], "id, nom");
});

Deno.test("executeManageGroupe remove_member clears groupe_id", async () => {
  const supabase = new SupabaseStub((query) => ({
    data: { id: "eta-8", nom: "Clinique Retirée", ...(query.payload as Record<string, unknown>) },
    error: null,
  }));

  const result = await executeManageGroupe(makeCtx(supabase), {
    action: "remove_member",
    etablissement_id: "eta-8",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, 'Établissement "Clinique Retirée" retiré du groupe');
  assertEquals(callsFor(supabase, "update", "etablissements")[0].args[0], { groupe_id: null });
  assertEquals(callsFor(supabase, "eq", "etablissements")[0].args, ["id", "eta-8"]);
});

Deno.test("executeManagePartenaire create defaults est_actif to true", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManagePartenaire(makeCtx(supabase), {
    action: "create",
    data: {
      nom: "Cabinet Conseil Santé",
      type: "consultant",
      commission_rate: 7.5,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, 'Partenaire "Cabinet Conseil Santé" créé');
  assertEquals(result.data.partenaire.est_actif, true);
  assertEquals(callsFor(supabase, "insert", "partenaires")[0].args[0], {
    nom: "Cabinet Conseil Santé",
    type: "consultant",
    commission_rate: 7.5,
    est_actif: true,
    created_by: "user-test-123",
  });
});

Deno.test("executeManagePartenaire create preserves explicit est_actif false", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManagePartenaire(makeCtx(supabase), {
    action: "create",
    data: {
      nom: "Partenaire Inactif Initial",
      est_actif: false,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data.partenaire.est_actif, false);
  assertEquals(callsFor(supabase, "insert", "partenaires")[0].args[0], {
    nom: "Partenaire Inactif Initial",
    est_actif: false,
    created_by: "user-test-123",
  });
});

Deno.test("executeManagePartenaire get validates id and fetches establishments relation", async () => {
  const missingIdSupabase = new SupabaseStub();
  const missingId = await executeManagePartenaire(makeCtx(missingIdSupabase), {
    action: "get",
  });

  assertEquals(missingId.success, false);
  assertEquals(missingId.error, "partenaire_id requis");
  assertEquals(missingIdSupabase.calls.length, 0);

  const supabase = new SupabaseStub(() => ({
    data: {
      id: "partenaire-1",
      nom: "Apporteur A",
      etablissements: [{ id: "eta-1", nom: "Clinique A", statut: "client" }],
    },
    error: null,
  }));

  const result = await executeManagePartenaire(makeCtx(supabase), {
    action: "get",
    partenaire_id: "partenaire-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.partenaire.nom, "Apporteur A");
  assertEquals(callsFor(supabase, "select", "partenaires")[0].args[0], `
            *,
            etablissements:etablissements(id, nom, statut)
          `);
  assertEquals(callsFor(supabase, "eq", "partenaires")[0].args, ["id", "partenaire-1"]);
  assertEquals(callsFor(supabase, "single", "partenaires").length, 1);
});

Deno.test("executeManagePartenaire delete soft-disables partner", async () => {
  const supabase = new SupabaseStub();
  const result = await executeManagePartenaire(makeCtx(supabase), {
    action: "delete",
    partenaire_id: "partenaire-9",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Partenaire désactivé");
  assertEquals(callsFor(supabase, "update", "partenaires")[0].args[0], { est_actif: false });
  assertEquals(callsFor(supabase, "eq", "partenaires")[0].args, ["id", "partenaire-9"]);
  assertEquals(callsFor(supabase, "delete", "partenaires").length, 0);
});

Deno.test("executeManagePartenaire list returns count and deterministic ordering", async () => {
  const supabase = new SupabaseStub(() => ({
    data: [
      { id: "p-1", nom: "Alpha", est_actif: true },
      { id: "p-2", nom: "Beta", est_actif: false },
    ],
    error: null,
  }));

  const result = await executeManagePartenaire(makeCtx(supabase), {
    action: "list",
  });

  assertEquals(result.success, true);
  assertEquals(result.data.count, 2);
  assertEquals(result.data.partenaires[1].nom, "Beta");
  assertEquals(callsFor(supabase, "select", "partenaires")[0].args[0], "id, nom, type, email, telephone, commission_rate, est_actif, created_at");
  assertEquals(callsFor(supabase, "order", "partenaires")[0].args, ["nom", { ascending: true }]);
  assertEquals(callsFor(supabase, "limit", "partenaires")[0].args, [50]);
});