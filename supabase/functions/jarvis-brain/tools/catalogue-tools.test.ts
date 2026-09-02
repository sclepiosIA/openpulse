import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeGetCatalogueStats,
  executeListCatalogueProduits,
  executeManageCatalogueProduit,
} from "./catalogue-tools.ts";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

type RecordedCall = {
  method: string;
  args: unknown[];
};

class MockSupabase {
  queries: MockQuery[] = [];
  rpcCalls: Array<{ name: string; args?: unknown }> = [];

  private selectResults: QueryResult[];
  private mutationResults: QueryResult[];
  private rpcResults: QueryResult[];

  constructor(options: {
    selectResults?: QueryResult[];
    mutationResults?: QueryResult[];
    rpcResults?: QueryResult[];
  } = {}) {
    this.selectResults = [...(options.selectResults || [])];
    this.mutationResults = [...(options.mutationResults || [])];
    this.rpcResults = [...(options.rpcResults || [])];
  }

  from(table: string): MockQuery {
    const query = new MockQuery(this, table);
    this.queries.push(query);
    return query;
  }

  async rpc(name: string, args?: unknown): Promise<QueryResult> {
    this.rpcCalls.push({ name, args });
    return this.rpcResults.length > 0 ? this.rpcResults.shift()! : { data: null, error: null };
  }

  dequeueSelect(): QueryResult {
    return this.selectResults.length > 0 ? this.selectResults.shift()! : { data: null, error: null };
  }

  dequeueMutation(): QueryResult {
    return this.mutationResults.length > 0 ? this.mutationResults.shift()! : { data: null, error: null };
  }
}

class MockQuery {
  calls: RecordedCall[] = [];
  operation: "select" | "insert" | "update" | null = null;
  result: QueryResult = { data: null, error: null };
  insertedPayload: unknown = undefined;
  updatedPayload: unknown = undefined;

  constructor(private owner: MockSupabase, public table: string) {}

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args });
  }

  select(columns: string): this {
    this.record("select", [columns]);
    if (this.operation === null) {
      this.operation = "select";
      this.result = this.owner.dequeueSelect();
    }
    return this;
  }

  order(column: string, options?: unknown): this {
    this.record("order", [column, options]);
    return this;
  }

  limit(count: number): this {
    this.record("limit", [count]);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.record("eq", [column, value]);
    return this;
  }

  or(filter: string): this {
    this.record("or", [filter]);
    return this;
  }

  ["in"](column: string, values: unknown[]): this {
    this.record("in", [column, values]);
    return this;
  }

  insert(payload: unknown): this {
    this.record("insert", [payload]);
    this.operation = "insert";
    this.insertedPayload = payload;
    this.result = this.owner.dequeueMutation();
    return this;
  }

  update(payload: unknown): this {
    this.record("update", [payload]);
    this.operation = "update";
    this.updatedPayload = payload;
    this.result = this.owner.dequeueMutation();
    return this;
  }

  single(): Promise<QueryResult> {
    this.record("single", []);
    return Promise.resolve(this.result);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createContext(supabase: MockSupabase) {
  return {
    supabase: supabase as never,
    userId: "user-test-1",
  };
}

Deno.test("executeListCatalogueProduits applique les filtres, la limite maximale et la recherche assainie", async () => {
  const produits = [
    {
      id: "prod-1",
      code: "CRM-001",
      nom: "CRM Premium",
      description: "Abonnement CRM",
      type: "service",
      categorie: "logiciel",
      prix_unitaire_ht: 120,
      taux_tva: 20,
      unite: "mois",
      recurrence: "monthly",
      est_actif: true,
      ordre_affichage: 1,
    },
  ];

  const supabase = new MockSupabase({
    selectResults: [{ data: produits, error: null }],
  });

  const result = await executeListCatalogueProduits(createContext(supabase), {
    search: `"CRM"`,
    type: "service",
    categorie: "logiciel",
    actif_only: true,
    limit: 500,
  });

  assertEquals(result.success, true);
  assertEquals((result.data as { produits: unknown[]; total: number }).produits, produits);
  assertEquals((result.data as { produits: unknown[]; total: number }).total, 1);
  assertEquals(typeof result.execution_time_ms, "number");

  assertEquals(supabase.queries.length, 1);
  const query = supabase.queries[0];
  assertEquals(query.table, "catalogue_produits");
  assertEquals(query.calls.map((call) => call.method), [
    "select",
    "order",
    "limit",
    "eq",
    "eq",
    "eq",
    "or",
  ]);
  assertEquals(query.calls[0].args, [
    "id, code, nom, description, type, categorie, prix_unitaire_ht, taux_tva, unite, recurrence, est_actif, ordre_affichage",
  ]);
  assertEquals(query.calls[1].args, ["ordre_affichage", { ascending: true }]);
  assertEquals(query.calls[2].args, [200]);
  assertEquals(query.calls[3].args, ["est_actif", true]);
  assertEquals(query.calls[4].args, ["type", "service"]);
  assertEquals(query.calls[5].args, ["categorie", "logiciel"]);
  assertEquals(query.calls[6].args, ["nom.ilike.%CRM%,code.ilike.%CRM%"]);
});

Deno.test("executeListCatalogueProduits n'ajoute pas le filtre actif ni OR quand actif_only=false et recherche vide après nettoyage", async () => {
  const supabase = new MockSupabase({
    selectResults: [{ data: [], error: null }],
  });

  const result = await executeListCatalogueProduits(createContext(supabase), {
    actif_only: false,
    search: `()%*:",.\\`,
  });

  assertEquals(result.success, true);
  assertEquals((result.data as { produits: unknown[]; total: number }).produits, []);
  assertEquals((result.data as { produits: unknown[]; total: number }).total, 0);

  const query = supabase.queries[0];
  assertEquals(query.calls.map((call) => call.method), ["select", "order", "limit"]);
  assertEquals(query.calls[2].args, [50]);
});

Deno.test("executeListCatalogueProduits retourne une erreur métier quand Supabase échoue", async () => {
  const supabase = new MockSupabase({
    selectResults: [{ data: null, error: new Error("permission denied") }],
  });

  const result = await executeListCatalogueProduits(createContext(supabase), {});

  assertEquals(result.success, false);
  assertEquals(result.error, "permission denied");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeGetCatalogueStats trie par CA, calcule les totaux et joint les noms produits du top", async () => {
  const stats = [
    {
      produit_id: "prod-low",
      nb_devis: 2,
      nb_factures: 1,
      ca_cumule_ht: 100,
      derniere_utilisation: "2024-01-10",
    },
    {
      produit_id: "prod-high",
      nb_devis: 8,
      nb_factures: 5,
      ca_cumule_ht: 1500,
      derniere_utilisation: "2024-03-10",
    },
    {
      produit_id: "prod-mid",
      nb_devis: 4,
      nb_factures: 2,
      ca_cumule_ht: 650,
      derniere_utilisation: null,
    },
  ];

  const produits = [
    { id: "prod-high", code: "HIGH", nom: "Produit High" },
    { id: "prod-mid", code: "MID", nom: "Produit Mid" },
  ];

  const supabase = new MockSupabase({
    rpcResults: [{ data: stats, error: null }],
    selectResults: [{ data: produits, error: null }],
  });

  const result = await executeGetCatalogueStats(createContext(supabase), { top_n: 2 });

  assertEquals(result.success, true);
  assertEquals(supabase.rpcCalls, [{ name: "get_catalogue_stats", args: undefined }]);

  const data = result.data as {
    total_produits_utilises: number;
    ca_total_ht: number;
    top: Array<{
      produit_id: string;
      ca_cumule_ht: number;
      nom: string | null;
      code: string | null;
    }>;
  };

  assertEquals(data.total_produits_utilises, 3);
  assertEquals(data.ca_total_ht, 2250);
  assertEquals(data.top.length, 2);
  assertEquals(data.top[0].produit_id, "prod-high");
  assertEquals(data.top[0].nom, "Produit High");
  assertEquals(data.top[0].code, "HIGH");
  assertEquals(data.top[1].produit_id, "prod-mid");
  assertEquals(data.top[1].nom, "Produit Mid");
  assertEquals(data.top[1].code, "MID");

  const productQuery = supabase.queries[0];
  assertEquals(productQuery.table, "catalogue_produits");
  assertEquals(productQuery.calls.map((call) => call.method), ["select", "in"]);
  assertEquals(productQuery.calls[0].args, ["id, code, nom"]);
  assertEquals(productQuery.calls[1].args, ["id", ["prod-high", "prod-mid"]]);
});

Deno.test("executeGetCatalogueStats limite le top à 50 même si top_n est supérieur", async () => {
  const stats = Array.from({ length: 60 }, (_, index) => ({
    produit_id: `prod-${index}`,
    nb_devis: index,
    nb_factures: index,
    ca_cumule_ht: 1000 - index,
    derniere_utilisation: null,
  }));

  const supabase = new MockSupabase({
    rpcResults: [{ data: stats, error: null }],
    selectResults: [{ data: [], error: null }],
  });

  const result = await executeGetCatalogueStats(createContext(supabase), { top_n: 100 });

  assertEquals(result.success, true);
  const data = result.data as { top: Array<{ produit_id: string; nom: string | null; code: string | null }> };
  assertEquals(data.top.length, 50);
  assertEquals(data.top[0], {
    produit_id: "prod-0",
    nb_devis: 0,
    nb_factures: 0,
    ca_cumule_ht: 1000,
    derniere_utilisation: null,
    nom: null,
    code: null,
  });
  assertEquals(data.top[49].produit_id, "prod-49");
});

Deno.test("executeGetCatalogueStats retourne une erreur quand la RPC échoue", async () => {
  const supabase = new MockSupabase({
    rpcResults: [{ data: null, error: new Error("rpc unavailable") }],
  });

  const result = await executeGetCatalogueStats(createContext(supabase), { top_n: 5 });

  assertEquals(result.success, false);
  assertEquals(result.error, "rpc unavailable");
  assertEquals(supabase.queries.length, 0);
});

Deno.test("executeManageCatalogueProduit create valide les champs requis et n'appelle pas Supabase si code ou nom manque", async () => {
  const supabase = new MockSupabase();

  const result = await executeManageCatalogueProduit(createContext(supabase), {
    action: "create",
    data: { code: "SVC-001" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "code et nom requis");
  assertEquals(supabase.queries.length, 0);
});

Deno.test("executeManageCatalogueProduit create insère les valeurs par défaut et retourne le produit créé", async () => {
  const supabase = new MockSupabase({
    mutationResults: [{
      data: { id: "prod-1", code: "SVC-001", nom: "Service Conseil" },
      error: null,
    }],
  });

  const result = await executeManageCatalogueProduit(createContext(supabase), {
    action: "create",
    data: {
      code: "SVC-001",
      nom: "Service Conseil",
      prix_unitaire_ht: 900,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: `Produit "Service Conseil" créé`,
    produit: { id: "prod-1", code: "SVC-001", nom: "Service Conseil" },
  });

  const query = supabase.queries[0];
  assertEquals(query.table, "catalogue_produits");
  assertEquals(query.calls.map((call) => call.method), ["insert", "select", "single"]);
  assertEquals(query.insertedPayload, {
    code: "SVC-001",
    nom: "Service Conseil",
    prix_unitaire_ht: 900,
    est_actif: true,
    type: "service",
    taux_tva: 20,
  });
  assertEquals(query.calls[1].args, ["id, code, nom"]);
});

Deno.test("executeManageCatalogueProduit update exige produit_id", async () => {
  const supabase = new MockSupabase();

  const result = await executeManageCatalogueProduit(createContext(supabase), {
    action: "update",
    data: { nom: "Nouveau nom" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "produit_id requis");
  assertEquals(supabase.queries.length, 0);
});

Deno.test("executeManageCatalogueProduit update ajoute updated_at, filtre par id et retourne le produit mis à jour", async () => {
  const supabase = new MockSupabase({
    mutationResults: [{
      data: { id: "prod-2", code: "SVC-002", nom: "Service Audit" },
      error: null,
    }],
  });

  const result = await executeManageCatalogueProduit(createContext(supabase), {
    action: "update",
    produit_id: "prod-2",
    data: {
      nom: "Service Audit",
      prix_unitaire_ht: 450,
      taux_tva: 10,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: `Produit "Service Audit" mis à jour`,
    produit: { id: "prod-2", code: "SVC-002", nom: "Service Audit" },
  });

  const query = supabase.queries[0];
  assertEquals(query.table, "catalogue_produits");
  assertEquals(query.calls.map((call) => call.method), ["update", "eq", "select", "single"]);

  const payload = query.updatedPayload as {
    nom: string;
    prix_unitaire_ht: number;
    taux_tva: number;
    updated_at: string;
  };
  assertEquals(payload.nom, "Service Audit");
  assertEquals(payload.prix_unitaire_ht, 450);
  assertEquals(payload.taux_tva, 10);
  assertExists(payload.updated_at);
  assertEquals(Number.isNaN(Date.parse(payload.updated_at)), false);

  assertEquals(query.calls[1].args, ["id", "prod-2"]);
  assertEquals(query.calls[2].args, ["id, code, nom"]);
});

Deno.test("executeManageCatalogueProduit archive et restore basculent est_actif avec les messages attendus", async () => {
  const supabase = new MockSupabase({
    mutationResults: [
      {
        data: { id: "prod-3", code: "OLD", nom: "Ancien produit", est_actif: false },
        error: null,
      },
      {
        data: { id: "prod-3", code: "OLD", nom: "Ancien produit", est_actif: true },
        error: null,
      },
    ],
  });

  const archiveResult = await executeManageCatalogueProduit(createContext(supabase), {
    action: "archive",
    produit_id: "prod-3",
  });

  const restoreResult = await executeManageCatalogueProduit(createContext(supabase), {
    action: "restore",
    produit_id: "prod-3",
  });

  assertEquals(archiveResult.success, true);
  assertEquals(archiveResult.data, {
    message: `Produit "Ancien produit" archivé`,
    produit: { id: "prod-3", code: "OLD", nom: "Ancien produit", est_actif: false },
  });

  assertEquals(restoreResult.success, true);
  assertEquals(restoreResult.data, {
    message: `Produit "Ancien produit" réactivé`,
    produit: { id: "prod-3", code: "OLD", nom: "Ancien produit", est_actif: true },
  });

  const archiveQuery = supabase.queries[0];
  const restoreQuery = supabase.queries[1];

  assertEquals(archiveQuery.updatedPayload, { est_actif: false });
  assertEquals(archiveQuery.calls.map((call) => call.method), ["update", "eq", "select", "single"]);
  assertEquals(archiveQuery.calls[1].args, ["id", "prod-3"]);
  assertEquals(archiveQuery.calls[2].args, ["id, code, nom, est_actif"]);

  assertEquals(restoreQuery.updatedPayload, { est_actif: true });
  assertEquals(restoreQuery.calls.map((call) => call.method), ["update", "eq", "select", "single"]);
  assertEquals(restoreQuery.calls[1].args, ["id", "prod-3"]);
  assertEquals(restoreQuery.calls[2].args, ["id, code, nom, est_actif"]);
});

Deno.test("executeManageCatalogueProduit retourne une erreur pour une action inconnue", async () => {
  const supabase = new MockSupabase();

  const result = await executeManageCatalogueProduit(createContext(supabase), {
    action: "delete",
    produit_id: "prod-4",
  } as never);

  assertEquals(result.success, false);
  assertEquals(result.error, "Action inconnue: delete");
  assertEquals(supabase.queries.length, 0);
});

Deno.test("executeManageCatalogueProduit propage les erreurs Supabase sous forme de ToolResult en échec", async () => {
  const supabase = new MockSupabase({
    mutationResults: [{ data: null, error: new Error("duplicate key value violates unique constraint") }],
  });

  const result = await executeManageCatalogueProduit(createContext(supabase), {
    action: "create",
    data: {
      code: "DUP",
      nom: "Doublon",
    },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "duplicate key value violates unique constraint");
});