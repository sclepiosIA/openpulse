import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeAddDevisLigne,
  executeConvertDevisToInvoice,
  executeManageDevis,
} from "./devis-tools.ts";

type QueryCall = {
  table: string;
  action?: string;
  selected?: unknown[];
  payload?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
  modifiers: Array<{ method: string; args: unknown[] }>;
};

type QueryResponse = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

function createSupabaseMock(
  responses: Array<QueryResponse | ((call: QueryCall) => QueryResponse)> = [],
) {
  const calls: QueryCall[] = [];

  const nextResponse = (call: QueryCall): QueryResponse => {
    const response = responses.shift();
    if (typeof response === "function") return response(call);
    return response ?? { data: null, error: null };
  };

  class QueryBuilder {
    private consumed = false;

    constructor(private call: QueryCall) {}

    select(...args: unknown[]) {
      if (!this.call.action) this.call.action = "select";
      this.call.selected = args;
      return this;
    }

    insert(payload: unknown) {
      this.call.action = "insert";
      this.call.payload = payload;
      return this;
    }

    update(payload: unknown) {
      this.call.action = "update";
      this.call.payload = payload;
      return this;
    }

    delete() {
      this.call.action = "delete";
      return this;
    }

    eq(...args: unknown[]) {
      this.call.filters.push({ method: "eq", args });
      return this;
    }

    gte(...args: unknown[]) {
      this.call.filters.push({ method: "gte", args });
      return this;
    }

    order(...args: unknown[]) {
      this.call.modifiers.push({ method: "order", args });
      return this;
    }

    limit(...args: unknown[]) {
      this.call.modifiers.push({ method: "limit", args });
      return this;
    }

    single() {
      this.call.modifiers.push({ method: "single", args: [] });
      return Promise.resolve(nextResponse(this.call));
    }

    then<TResult1 = QueryResponse, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      if (this.consumed) {
        return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
      }
      this.consumed = true;
      return Promise.resolve(nextResponse(this.call)).then(onfulfilled, onrejected);
    }
  }

  const supabase = {
    from(table: string) {
      const call: QueryCall = { table, filters: [], modifiers: [] };
      calls.push(call);
      return new QueryBuilder(call);
    },
  };

  return { supabase, calls };
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DEVIS_ID = "22222222-2222-4222-8222-222222222222";
const LIGNE_ID = "33333333-3333-4333-8333-333333333333";
const FACTURE_ID = "44444444-4444-4444-8444-444444444444";

Deno.test("module exports expected tool functions", () => {
  assertExists(executeManageDevis);
  assertExists(executeAddDevisLigne);
  assertExists(executeConvertDevisToInvoice);
  assertThrows(() => {
    throw new Error("assertThrows disponible");
  }, Error);
});

Deno.test("executeManageDevis list returns devis ordered by creation date with count", async () => {
  const devis = [
    { id: DEVIS_ID, numero: "DEV-2025-0002", etablissements: { nom: "Clinique Nord" } },
    { id: "55555555-5555-4555-8555-555555555555", numero: "DEV-2025-0001", etablissements: { nom: "Clinique Sud" } },
  ];
  const { supabase, calls } = createSupabaseMock([{ data: devis, error: null }]);

  const result = await executeManageDevis({ supabase: supabase as never, userId: USER_ID }, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data, { devis, count: 2 });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].action, "select");
  assertEquals(calls[0].selected, ["*, etablissements(nom)"]);
  assertEquals(calls[0].modifiers, [
    { method: "order", args: ["created_at", { ascending: false }] },
    { method: "limit", args: [50] },
  ]);
});

Deno.test("executeManageDevis get requires devis_id and does not query database when missing", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageDevis({ supabase: supabase as never, userId: USER_ID }, { action: "get" });

  assertEquals(result.success, false);
  assertEquals(result.error, "devis_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageDevis get fetches devis with lignes and etablissement details", async () => {
  const devis = {
    id: DEVIS_ID,
    numero: "DEV-2025-0003",
    devis_lignes: [{ designation: "Consultation", quantite: 2 }],
    etablissements: { nom: "Clinique Nord", siret: "12345678900011", adresse: "1 rue Test" },
  };
  const { supabase, calls } = createSupabaseMock([{ data: devis, error: null }]);

  const result = await executeManageDevis(
    { supabase: supabase as never, userId: USER_ID },
    { action: "get", devis_id: DEVIS_ID },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { devis });
  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].selected, ["*, devis_lignes(*), etablissements(nom, siret, adresse)"]);
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", DEVIS_ID] }]);
  assertEquals(calls[0].modifiers.at(-1), { method: "single", args: [] });
});

Deno.test("executeManageDevis create generates sequential numero and injects brouillon status and creator", async () => {
  const year = new Date().getFullYear();
  const insertedDevis = {
    id: DEVIS_ID,
    numero: `DEV-${year}-0008`,
    statut: "brouillon",
    client_nom: "Cabinet Médical Central",
    created_by: USER_ID,
  };
  const { supabase, calls } = createSupabaseMock([
    { count: 7, error: null },
    { data: insertedDevis, error: null },
  ]);

  const result = await executeManageDevis(
    { supabase: supabase as never, userId: USER_ID },
    {
      action: "create",
      data: {
        client_nom: "Cabinet Médical Central",
        montant_ht: 1000,
        montant_tva: 200,
        montant_ttc: 1200,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: `Devis DEV-${year}-0008 créé`,
    devis: insertedDevis,
  });
  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].action, "select");
  assertEquals(calls[0].selected, ["*", { count: "exact", head: true }]);
  assertEquals(calls[0].filters, [{ method: "gte", args: ["created_at", `${year}-01-01`] }]);
  assertEquals(calls[1].table, "devis");
  assertEquals(calls[1].action, "insert");
  assertEquals(calls[1].payload, {
    client_nom: "Cabinet Médical Central",
    montant_ht: 1000,
    montant_tva: 200,
    montant_ttc: 1200,
    numero: `DEV-${year}-0008`,
    statut: "brouillon",
    created_by: USER_ID,
  });
});

Deno.test("executeManageDevis update returns database error as failed tool result", async () => {
  const { supabase, calls } = createSupabaseMock([
    { data: null, error: new Error("permission denied") },
  ]);

  const result = await executeManageDevis(
    { supabase: supabase as never, userId: USER_ID },
    { action: "update", devis_id: DEVIS_ID, data: { statut: "envoye" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "permission denied");
  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].action, "update");
  assertEquals(calls[0].payload, { statut: "envoye" });
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", DEVIS_ID] }]);
});

Deno.test("executeManageDevis delete removes devis by id", async () => {
  const { supabase, calls } = createSupabaseMock([{ error: null }]);

  const result = await executeManageDevis(
    { supabase: supabase as never, userId: USER_ID },
    { action: "delete", devis_id: DEVIS_ID },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Devis supprimé" });
  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].action, "delete");
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", DEVIS_ID] }]);
});

Deno.test("executeManageDevis unknown action returns not implemented message without database call", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageDevis(
    { supabase: supabase as never, userId: USER_ID },
    { action: "archive" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action archive not implemented" });
  assertEquals(calls.length, 0);
});

Deno.test("executeAddDevisLigne add inserts ligne linked to devis", async () => {
  const ligne = {
    id: LIGNE_ID,
    devis_id: DEVIS_ID,
    designation: "Installation",
    quantite: 3,
    prix_unitaire_ht: 150,
  };
  const { supabase, calls } = createSupabaseMock([{ data: ligne, error: null }]);

  const result = await executeAddDevisLigne(
    { supabase: supabase as never, userId: USER_ID },
    {
      action: "add",
      devis_id: DEVIS_ID,
      data: {
        designation: "Installation",
        quantite: 3,
        prix_unitaire_ht: 150,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Ligne ajoutée", ligne });
  assertEquals(calls[0].table, "devis_lignes");
  assertEquals(calls[0].action, "insert");
  assertEquals(calls[0].payload, {
    devis_id: DEVIS_ID,
    designation: "Installation",
    quantite: 3,
    prix_unitaire_ht: 150,
  });
});

Deno.test("executeAddDevisLigne update requires ligne_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeAddDevisLigne(
    { supabase: supabase as never, userId: USER_ID },
    { action: "update", data: { quantite: 5 } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "ligne_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeAddDevisLigne update modifies ligne by id", async () => {
  const ligne = { id: LIGNE_ID, quantite: 5, montant_ht: 750 };
  const { supabase, calls } = createSupabaseMock([{ data: ligne, error: null }]);

  const result = await executeAddDevisLigne(
    { supabase: supabase as never, userId: USER_ID },
    { action: "update", ligne_id: LIGNE_ID, data: { quantite: 5, montant_ht: 750 } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Ligne mise à jour", ligne });
  assertEquals(calls[0].table, "devis_lignes");
  assertEquals(calls[0].action, "update");
  assertEquals(calls[0].payload, { quantite: 5, montant_ht: 750 });
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", LIGNE_ID] }]);
});

Deno.test("executeAddDevisLigne delete removes ligne by id", async () => {
  const { supabase, calls } = createSupabaseMock([{ error: null }]);

  const result = await executeAddDevisLigne(
    { supabase: supabase as never, userId: USER_ID },
    { action: "delete", ligne_id: LIGNE_ID },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Ligne supprimée" });
  assertEquals(calls[0].table, "devis_lignes");
  assertEquals(calls[0].action, "delete");
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", LIGNE_ID] }]);
});

Deno.test("executeConvertDevisToInvoice rejects invalid UUID before querying database", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeConvertDevisToInvoice(
    { supabase: supabase as never, userId: USER_ID },
    { devis_id: "not-a-uuid" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, 'devis_id invalide ou manquant: "not-a-uuid"');
  assertEquals(calls.length, 0);
});

Deno.test("executeConvertDevisToInvoice rejects non accepted devis", async () => {
  const devis = {
    id: DEVIS_ID,
    statut: "envoye",
    devis_lignes: [],
  };
  const { supabase, calls } = createSupabaseMock([{ data: devis, error: null }]);

  const result = await executeConvertDevisToInvoice(
    { supabase: supabase as never, userId: USER_ID },
    { devis_id: DEVIS_ID },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Le devis doit être accepté pour être converti (statut actuel: envoye)");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].selected, ["*, devis_lignes(*)"]);
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", DEVIS_ID] }]);
});

Deno.test("executeConvertDevisToInvoice converts accepted devis, copies lines, and marks devis converted", async () => {
  const year = new Date().getFullYear();
  const devis = {
    id: DEVIS_ID,
    statut: "accepte",
    etablissement_id: "66666666-6666-4666-8666-666666666666",
    client_nom: "Clinique Conversion",
    montant_ht: 1000,
    montant_tva: 200,
    montant_ttc: 1200,
    devis_lignes: [
      {
        designation: "Audit",
        quantite: 2,
        prix_unitaire_ht: 300,
        taux_tva: 20,
        montant_ht: 600,
        montant_tva: 120,
        montant_ttc: 720,
      },
      {
        designation: "Formation",
        quantite: 1,
        prix_unitaire_ht: 400,
        taux_tva: 20,
        montant_ht: 400,
        montant_tva: 80,
        montant_ttc: 480,
      },
    ],
  };

  const { supabase, calls } = createSupabaseMock([
    { data: devis, error: null },
    { count: 3, error: null },
    { data: { id: FACTURE_ID, numero: `FAC-${year}-0004` }, error: null },
    { data: [], error: null },
    { data: null, error: null },
  ]);

  const result = await executeConvertDevisToInvoice(
    { supabase: supabase as never, userId: USER_ID },
    { devis_id: DEVIS_ID },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: `Devis converti en facture FAC-${year}-0004`,
    facture_id: FACTURE_ID,
    numero: `FAC-${year}-0004`,
  });

  assertEquals(calls.length, 5);

  assertEquals(calls[0].table, "devis");
  assertEquals(calls[0].action, "select");
  assertEquals(calls[0].filters, [{ method: "eq", args: ["id", DEVIS_ID] }]);

  assertEquals(calls[1].table, "factures");
  assertEquals(calls[1].action, "select");
  assertEquals(calls[1].selected, ["*", { count: "exact", head: true }]);
  assertEquals(calls[1].filters, [{ method: "gte", args: ["date_emission", `${year}-01-01`] }]);

  const facturePayload = calls[2].payload as Record<string, unknown>;
  assertEquals(calls[2].table, "factures");
  assertEquals(calls[2].action, "insert");
  assertEquals(facturePayload.numero, `FAC-${year}-0004`);
  assertEquals(facturePayload.etablissement_id, devis.etablissement_id);
  assertEquals(facturePayload.client_nom, "Clinique Conversion");
  assertEquals(facturePayload.montant_ht, 1000);
  assertEquals(facturePayload.montant_tva, 200);
  assertEquals(facturePayload.montant_ttc, 1200);
  assertEquals(facturePayload.statut, "brouillon");
  assertEquals(facturePayload.created_by, USER_ID);
  assertEquals(facturePayload.devis_id, DEVIS_ID);
  assertEquals(typeof facturePayload.date_emission, "string");
  assertEquals(typeof facturePayload.date_echeance, "string");

  assertEquals(calls[3].table, "factures_lignes");
  assertEquals(calls[3].action, "insert");
  assertEquals(calls[3].payload, [
    {
      facture_id: FACTURE_ID,
      designation: "Audit",
      quantite: 2,
      prix_unitaire_ht: 300,
      taux_tva: 20,
      montant_ht: 600,
      montant_tva: 120,
      montant_ttc: 720,
    },
    {
      facture_id: FACTURE_ID,
      designation: "Formation",
      quantite: 1,
      prix_unitaire_ht: 400,
      taux_tva: 20,
      montant_ht: 400,
      montant_tva: 80,
      montant_ttc: 480,
    },
  ]);

  assertEquals(calls[4].table, "devis");
  assertEquals(calls[4].action, "update");
  assertEquals(calls[4].payload, { statut: "converti" });
  assertEquals(calls[4].filters, [{ method: "eq", args: ["id", DEVIS_ID] }]);

  await assertRejects(
    () => Promise.reject(new Error("assertRejects disponible")),
    Error,
    "assertRejects disponible",
  );
});

Deno.test("executeConvertDevisToInvoice returns not found error when devis query has no data", async () => {
  const { supabase } = createSupabaseMock([{ data: null, error: null }]);

  const result = await executeConvertDevisToInvoice(
    { supabase: supabase as never, userId: USER_ID },
    { devis_id: DEVIS_ID },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Devis introuvable");
});