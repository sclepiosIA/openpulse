import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeAddAvoirLigne, executeManageAvoir } from "./avoir-tools.ts";

type MockCall = {
  table: string;
  ops: Array<Record<string, unknown>>;
};

type MockResponse =
  | Record<string, unknown>
  | ((call: MockCall) => Record<string, unknown>);

function createSupabaseMock(responses: MockResponse[] = []) {
  const calls: MockCall[] = [];

  const cloneOps = (ops: Array<Record<string, unknown>>) =>
    ops.map((op) => ({ ...op }));

  const supabase = {
    from(table: string) {
      const state = {
        table,
        ops: [] as Array<Record<string, unknown>>,
      };

      let finished = false;

      const finish = () => {
        if (finished) {
          throw new Error(`Query for table ${table} was already resolved`);
        }
        finished = true;

        const call = { table: state.table, ops: cloneOps(state.ops) };
        calls.push(call);

        const response = responses.shift();
        if (!response) {
          throw new Error(`No mock response configured for table ${table}`);
        }

        return typeof response === "function" ? response(call) : response;
      };

      const builder: Record<string, unknown> = {
        select(columns?: string, options?: Record<string, unknown>) {
          state.ops.push({ method: "select", columns, options });
          return builder;
        },
        order(column: string, options?: Record<string, unknown>) {
          state.ops.push({ method: "order", column, options });
          return builder;
        },
        limit(count: number) {
          state.ops.push({ method: "limit", count });
          return Promise.resolve(finish());
        },
        eq(column: string, value: unknown) {
          state.ops.push({ method: "eq", column, value });
          return builder;
        },
        gte(column: string, value: unknown) {
          state.ops.push({ method: "gte", column, value });
          return Promise.resolve(finish());
        },
        single() {
          state.ops.push({ method: "single" });
          return Promise.resolve(finish());
        },
        insert(values: Record<string, unknown>) {
          state.ops.push({ method: "insert", values });
          return builder;
        },
        update(values: Record<string, unknown>) {
          state.ops.push({ method: "update", values });
          return builder;
        },
        delete() {
          state.ops.push({ method: "delete" });
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) {
          return Promise.resolve(finish()).then(resolve, reject);
        },
      };

      return builder;
    },
  };

  return { supabase, calls };
}

Deno.test("executeManageAvoir list retourne les avoirs triés avec le count", async () => {
  const avoirs = [
    { id: "av-2", numero: "AV-2024-0002", etablissements: { nom: "Clinique B" } },
    { id: "av-1", numero: "AV-2024-0001", etablissements: { nom: "Clinique A" } },
  ];
  const { supabase, calls } = createSupabaseMock([
    { data: avoirs, error: null },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { avoirs, count: 2 });
  assertEquals(typeof result.execution_time_ms, "number");
  assertEquals(calls, [
    {
      table: "avoirs",
      ops: [
        { method: "select", columns: "*, etablissements(nom)", options: undefined },
        { method: "order", column: "date_emission", options: { ascending: false } },
        { method: "limit", count: 50 },
      ],
    },
  ]);
});

Deno.test("executeManageAvoir list transforme une erreur Supabase en résultat d'échec", async () => {
  const { supabase } = createSupabaseMock([
    { data: null, error: new Error("database unavailable") },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeManageAvoir get exige avoir_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "get" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "avoir_id required");
  assertEquals(calls, []);
});

Deno.test("executeManageAvoir get récupère un avoir et ses lignes", async () => {
  const avoir = {
    id: "av-1",
    numero: "AV-2024-0001",
    avoirs_lignes: [{ id: "ligne-1", designation: "Remise", montant_ht: 100 }],
  };
  const { supabase, calls } = createSupabaseMock([
    { data: avoir, error: null },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "get", avoir_id: "av-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { avoir });
  assertEquals(calls, [
    {
      table: "avoirs",
      ops: [
        { method: "select", columns: "*, avoirs_lignes(*)", options: undefined },
        { method: "eq", column: "id", value: "av-1" },
        { method: "single" },
      ],
    },
  ]);
});

Deno.test("executeManageAvoir create génère le numéro, la date, le statut et created_by", async () => {
  const year = new Date().getFullYear();
  const expectedNumero = `AV-${year}-0004`;
  const expectedDate = new Date().toISOString().split("T")[0];

  const { supabase, calls } = createSupabaseMock([
    { count: 3, data: null, error: null },
    (call) => {
      const insertOp = call.ops.find((op) => op.method === "insert");
      assertExists(insertOp);
      return {
        data: { id: "av-created", ...(insertOp.values as Record<string, unknown>) },
        error: null,
      };
    },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-42" },
    {
      action: "create",
      data: {
        etablissement_id: "etab-1",
        montant_ttc: 120,
        motif: "Trop-perçu",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, `Avoir ${expectedNumero} créé`);
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.numero, expectedNumero);
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.date_emission, expectedDate);
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.statut, "brouillon");
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.created_by, "user-42");
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.etablissement_id, "etab-1");
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.montant_ttc, 120);

  assertEquals(calls[0], {
    table: "avoirs",
    ops: [
      { method: "select", columns: "*", options: { count: "exact", head: true } },
      { method: "gte", column: "date_emission", value: `${year}-01-01` },
    ],
  });
  assertEquals(calls[1].table, "avoirs");
  assertEquals(calls[1].ops[0], {
    method: "insert",
    values: {
      etablissement_id: "etab-1",
      montant_ttc: 120,
      motif: "Trop-perçu",
      numero: expectedNumero,
      date_emission: expectedDate,
      statut: "brouillon",
      created_by: "user-42",
    },
  });
  assertEquals(calls[1].ops[1], { method: "select", columns: undefined, options: undefined });
  assertEquals(calls[1].ops[2], { method: "single" });
});

Deno.test("executeManageAvoir create utilise 0 quand count est null", async () => {
  const year = new Date().getFullYear();
  const expectedNumero = `AV-${year}-0001`;

  const { supabase } = createSupabaseMock([
    { count: null, data: null, error: null },
    (call) => {
      const insertOp = call.ops.find((op) => op.method === "insert");
      assertExists(insertOp);
      return {
        data: { id: "av-first", ...(insertOp.values as Record<string, unknown>) },
        error: null,
      };
    },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "create", data: { montant_ttc: 10 } },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, `Avoir ${expectedNumero} créé`);
  assertEquals((result.data as { avoir: Record<string, unknown> }).avoir.numero, expectedNumero);
});

Deno.test("executeManageAvoir update exige avoir_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "update", data: { statut: "validé" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "avoir_id required");
  assertEquals(calls, []);
});

Deno.test("executeManageAvoir update modifie les champs demandés", async () => {
  const updatedAvoir = { id: "av-1", statut: "validé", montant_ttc: 240 };
  const { supabase, calls } = createSupabaseMock([
    { data: updatedAvoir, error: null },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "update", avoir_id: "av-1", data: { statut: "validé", montant_ttc: 240 } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Avoir mis à jour", avoir: updatedAvoir });
  assertEquals(calls, [
    {
      table: "avoirs",
      ops: [
        { method: "update", values: { statut: "validé", montant_ttc: 240 } },
        { method: "eq", column: "id", value: "av-1" },
        { method: "select", columns: undefined, options: undefined },
        { method: "single" },
      ],
    },
  ]);
});

Deno.test("executeManageAvoir retourne un message pour une action inconnue sans requête DB", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "archive" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action archive not implemented" });
  assertEquals(calls, []);
});

Deno.test("executeAddAvoirLigne add exige avoir_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeAddAvoirLigne(
    { supabase: supabase as never, userId: "user-1" },
    { action: "add", data: { designation: "Remise" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "avoir_id required");
  assertEquals(calls, []);
});

Deno.test("executeAddAvoirLigne add insère une ligne d'avoir", async () => {
  const { supabase, calls } = createSupabaseMock([
    (call) => {
      const insertOp = call.ops.find((op) => op.method === "insert");
      assertExists(insertOp);
      return {
        data: { id: "ligne-1", ...(insertOp.values as Record<string, unknown>) },
        error: null,
      };
    },
  ]);

  const result = await executeAddAvoirLigne(
    { supabase: supabase as never, userId: "user-1" },
    {
      action: "add",
      avoir_id: "av-1",
      data: {
        designation: "Remise commerciale",
        quantite: 2,
        prix_unitaire_ht: 50,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as Record<string, unknown>).message, "Ligne ajoutée");
  assertEquals((result.data as { ligne: Record<string, unknown> }).ligne, {
    id: "ligne-1",
    avoir_id: "av-1",
    designation: "Remise commerciale",
    quantite: 2,
    prix_unitaire_ht: 50,
  });
  assertEquals(calls, [
    {
      table: "avoirs_lignes",
      ops: [
        {
          method: "insert",
          values: {
            avoir_id: "av-1",
            designation: "Remise commerciale",
            quantite: 2,
            prix_unitaire_ht: 50,
          },
        },
        { method: "select", columns: undefined, options: undefined },
        { method: "single" },
      ],
    },
  ]);
});

Deno.test("executeAddAvoirLigne delete exige ligne_id", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeAddAvoirLigne(
    { supabase: supabase as never, userId: "user-1" },
    { action: "delete" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "ligne_id required");
  assertEquals(calls, []);
});

Deno.test("executeAddAvoirLigne delete supprime une ligne par id", async () => {
  const { supabase, calls } = createSupabaseMock([
    { data: null, error: null },
  ]);

  const result = await executeAddAvoirLigne(
    { supabase: supabase as never, userId: "user-1" },
    { action: "delete", ligne_id: "ligne-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Ligne supprimée" });
  assertEquals(calls, [
    {
      table: "avoirs_lignes",
      ops: [
        { method: "delete" },
        { method: "eq", column: "id", value: "ligne-1" },
      ],
    },
  ]);
});

Deno.test("executeAddAvoirLigne transforme une erreur Supabase en résultat d'échec", async () => {
  const { supabase } = createSupabaseMock([
    { data: null, error: new Error("insert denied") },
  ]);

  const result = await executeAddAvoirLigne(
    { supabase: supabase as never, userId: "user-1" },
    { action: "add", avoir_id: "av-1", data: { designation: "Remise" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "insert denied");
});

Deno.test("executeAddAvoirLigne retourne un message pour une action inconnue sans requête DB", async () => {
  const { supabase, calls } = createSupabaseMock();

  const result = await executeAddAvoirLigne(
    { supabase: supabase as never, userId: "user-1" },
    { action: "reorder" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action reorder not implemented" });
  assertEquals(calls, []);
});

Deno.test("les helpers de test signalent une réponse Supabase manquante", () => {
  const { supabase } = createSupabaseMock();

  assertThrows(
    () => {
      supabase.from("avoirs").select("*").limit(1);
    },
    Error,
    "No mock response configured for table avoirs",
  );
});

Deno.test("les fonctions exportées ne rejettent pas les erreurs Supabase mais les encapsulent", async () => {
  const { supabase } = createSupabaseMock([
    () => {
      throw new Error("unexpected mock failure");
    },
  ]);

  const result = await executeManageAvoir(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "unexpected mock failure");

  await assertRejects(
    () => Promise.reject(new Error("assertRejects disponible")),
    Error,
    "assertRejects disponible",
  );
});