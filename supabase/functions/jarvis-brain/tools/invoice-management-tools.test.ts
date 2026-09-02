import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeManageInvoice } from "./invoice-management-tools.ts";

function createSupabaseMock(responsesOrResolver: unknown[] | ((query: Record<string, unknown>, index: number) => unknown)) {
  const queries: Record<string, unknown>[] = [];

  const resolveResponse = (query: Record<string, unknown>) => {
    const index = queries.length;
    queries.push(query);

    if (typeof responsesOrResolver === "function") {
      return responsesOrResolver(query, index) ?? { data: null, error: null };
    }

    return responsesOrResolver.shift() ?? { data: null, error: null };
  };

  const supabase = {
    from(table: string) {
      const state: Record<string, unknown> = {
        table,
        operation: undefined,
        selectColumns: undefined,
        updatePayload: undefined,
        filters: [],
        inFilters: [],
        orders: [],
        limitValue: undefined,
        single: false,
      };

      const snapshot = () => ({
        table: state.table,
        operation: state.operation,
        selectColumns: state.selectColumns,
        updatePayload: state.updatePayload,
        filters: [...(state.filters as unknown[])],
        inFilters: [...(state.inFilters as unknown[])],
        orders: [...(state.orders as unknown[])],
        limitValue: state.limitValue,
        single: state.single,
      });

      const builder = {
        select(columns = "*") {
          if (!state.operation) state.operation = "select";
          state.selectColumns = columns;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          state.operation = "update";
          state.updatePayload = payload;
          return builder;
        },
        delete() {
          state.operation = "delete";
          return builder;
        },
        eq(column: string, value: unknown) {
          (state.filters as unknown[]).push({ column, value });
          return builder;
        },
        in(column: string, values: unknown[]) {
          (state.inFilters as unknown[]).push({ column, values });
          return builder;
        },
        order(column: string, options: Record<string, unknown>) {
          (state.orders as unknown[]).push({ column, options });
          return builder;
        },
        limit(value: number) {
          state.limitValue = value;
          return Promise.resolve(resolveResponse(snapshot()));
        },
        single() {
          state.single = true;
          return Promise.resolve(resolveResponse(snapshot()));
        },
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve(resolveResponse(snapshot())).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return { supabase, queries };
}

Deno.test("executeManageInvoice list returns invoices, count, and uses expected query shape", async () => {
  const invoices = [
    {
      id: "inv-001",
      numero: "F-2024-001",
      client_nom: "Client A",
      montant_ht: 100,
      montant_tva: 20,
      montant_ttc: 120,
      statut: "envoyee",
      date_emission: "2024-01-10",
      date_echeance: "2024-02-10",
      etablissement_id: "est-1",
    },
    {
      id: "inv-002",
      numero: "F-2024-002",
      client_nom: "Client B",
      montant_ht: 200,
      montant_tva: 40,
      montant_ttc: 240,
      statut: "payee",
      date_emission: "2024-01-08",
      date_echeance: "2024-02-08",
      etablissement_id: "est-1",
    },
  ];

  const { supabase, queries } = createSupabaseMock([{ data: invoices, error: null }]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.invoices, invoices);
  assertEquals(result.data.count, 2);
  assertExists(result.execution_time_ms);

  assertEquals(queries.length, 1);
  assertEquals(queries[0].table, "factures");
  assertEquals(queries[0].operation, "select");
  assertEquals(
    queries[0].selectColumns,
    "id, numero, client_nom, montant_ht, montant_tva, montant_ttc, statut, date_emission, date_echeance, etablissement_id",
  );
  assertEquals(queries[0].orders, [
    { column: "date_emission", options: { ascending: false } },
  ]);
  assertEquals(queries[0].limitValue, 50);
  assertEquals(queries[0].filters, []);
});

Deno.test("executeManageInvoice list applies statut and etablissement filters", async () => {
  const invoices = [
    {
      id: "inv-003",
      numero: "F-2024-003",
      client_nom: "Client C",
      montant_ttc: 360,
      statut: "payee",
      etablissement_id: "est-2",
    },
  ];

  const { supabase, queries } = createSupabaseMock([{ data: invoices, error: null }]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    {
      action: "list",
      data: {
        statut: "payee",
        etablissement_id: "est-2",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.count, 1);
  assertEquals(result.data.invoices[0].numero, "F-2024-003");
  assertEquals(queries[0].filters, [
    { column: "statut", value: "payee" },
    { column: "etablissement_id", value: "est-2" },
  ]);
});

Deno.test("executeManageInvoice get requires invoice_id", async () => {
  const { supabase, queries } = createSupabaseMock([]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "get" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "invoice_id required");
  assertEquals(queries.length, 0);
});

Deno.test("executeManageInvoice get fetches one invoice with its lines", async () => {
  const invoice = {
    id: "inv-010",
    numero: "F-2024-010",
    client_nom: "Client Detail",
    montant_ttc: 120,
    factures_lignes: [
      { id: "line-1", description: "Prestation", quantite: 2, prix_unitaire: 50 },
    ],
  };

  const { supabase, queries } = createSupabaseMock([{ data: invoice, error: null }]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "get", invoice_id: "inv-010" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.invoice, invoice);
  assertEquals(queries[0].table, "factures");
  assertEquals(queries[0].operation, "select");
  assertEquals(queries[0].selectColumns, "*, factures_lignes(*)");
  assertEquals(queries[0].filters, [{ column: "id", value: "inv-010" }]);
  assertEquals(queries[0].single, true);
});

Deno.test("executeManageInvoice update requires invoice_id", async () => {
  const { supabase, queries } = createSupabaseMock([]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "update", data: { statut: "envoyee" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "invoice_id required");
  assertEquals(queries.length, 0);
});

Deno.test("executeManageInvoice update sends payload and returns updated invoice", async () => {
  const updatedInvoice = {
    id: "inv-020",
    numero: "F-2024-020",
    statut: "envoyee",
    client_nom: "Updated Client",
  };

  const { supabase, queries } = createSupabaseMock([{ data: updatedInvoice, error: null }]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    {
      action: "update",
      invoice_id: "inv-020",
      data: {
        statut: "envoyee",
        client_nom: "Updated Client",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Facture mise à jour");
  assertEquals(result.data.invoice, updatedInvoice);

  assertEquals(queries[0].table, "factures");
  assertEquals(queries[0].operation, "update");
  assertEquals(queries[0].updatePayload, {
    statut: "envoyee",
    client_nom: "Updated Client",
  });
  assertEquals(queries[0].filters, [{ column: "id", value: "inv-020" }]);
  assertEquals(queries[0].selectColumns, "*");
  assertEquals(queries[0].single, true);
});

Deno.test("executeManageInvoice mark_paid requires invoice_id", async () => {
  const { supabase, queries } = createSupabaseMock([]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "mark_paid", data: { mode_paiement: "virement" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "invoice_id required");
  assertEquals(queries.length, 0);
});

Deno.test("executeManageInvoice mark_paid updates payment status, date, mode and reference", async () => {
  const paidInvoice = {
    id: "inv-030",
    numero: "F-2024-030",
    statut: "payee",
    mode_paiement: "virement",
    reference_paiement: "REF-123",
  };

  const { supabase, queries } = createSupabaseMock([{ data: paidInvoice, error: null }]);

  const before = Date.now();
  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    {
      action: "mark_paid",
      invoice_id: "inv-030",
      data: {
        mode_paiement: "virement",
        reference_paiement: "REF-123",
      },
    },
  );
  const after = Date.now();

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Facture marquée comme payée");
  assertEquals(result.data.invoice, paidInvoice);

  const payload = queries[0].updatePayload as Record<string, unknown>;
  assertEquals(queries[0].operation, "update");
  assertEquals(payload.statut, "payee");
  assertEquals(payload.mode_paiement, "virement");
  assertEquals(payload.reference_paiement, "REF-123");
  assertEquals(typeof payload.date_paiement, "string");

  const paymentTimestamp = Date.parse(payload.date_paiement as string);
  assertEquals(Number.isNaN(paymentTimestamp), false);
  assertEquals(paymentTimestamp >= before && paymentTimestamp <= after, true);

  assertEquals(queries[0].filters, [{ column: "id", value: "inv-030" }]);
  assertEquals(queries[0].selectColumns, "*");
  assertEquals(queries[0].single, true);
});

Deno.test("executeManageInvoice delete refuses non-draft invoices", async () => {
  const { supabase, queries } = createSupabaseMock([
    { data: { statut: "envoyee" }, error: null },
  ]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "delete", invoice_id: "inv-040" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Seules les factures en brouillon peuvent être supprimées");
  assertEquals(queries.length, 1);
  assertEquals(queries[0].operation, "select");
  assertEquals(queries[0].selectColumns, "statut");
  assertEquals(queries[0].filters, [{ column: "id", value: "inv-040" }]);
  assertEquals(queries[0].single, true);
});

Deno.test("executeManageInvoice delete removes draft invoices", async () => {
  const { supabase, queries } = createSupabaseMock([
    { data: { statut: "brouillon" }, error: null },
    { data: null, error: null },
  ]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "delete", invoice_id: "inv-041" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Facture supprimée");
  assertEquals(queries.length, 2);

  assertEquals(queries[0].operation, "select");
  assertEquals(queries[0].selectColumns, "statut");
  assertEquals(queries[0].filters, [{ column: "id", value: "inv-041" }]);

  assertEquals(queries[1].operation, "delete");
  assertEquals(queries[1].table, "factures");
  assertEquals(queries[1].filters, [{ column: "id", value: "inv-041" }]);
});

Deno.test("executeManageInvoice get_unpaid returns unpaid invoices, count and total amount", async () => {
  const unpaidInvoices = [
    {
      id: "inv-050",
      numero: "F-2024-050",
      client_nom: "Late Client",
      montant_ttc: 100.5,
      date_emission: "2024-01-01",
      date_echeance: "2024-01-31",
      statut: "en_retard",
      etablissement_id: "est-1",
    },
    {
      id: "inv-051",
      numero: "F-2024-051",
      client_nom: "Sent Client",
      montant_ttc: 249.5,
      date_emission: "2024-01-15",
      date_echeance: "2024-02-15",
      statut: "envoyee",
      etablissement_id: "est-2",
    },
    {
      id: "inv-052",
      numero: "F-2024-052",
      client_nom: "Missing Amount Client",
      date_emission: "2024-01-20",
      date_echeance: "2024-02-20",
      statut: "envoyee",
      etablissement_id: "est-3",
    },
  ];

  const { supabase, queries } = createSupabaseMock([{ data: unpaidInvoices, error: null }]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "get_unpaid" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.unpaid_invoices, unpaidInvoices);
  assertEquals(result.data.count, 3);
  assertEquals(result.data.total_amount, 350);

  assertEquals(queries[0].table, "factures");
  assertEquals(queries[0].operation, "select");
  assertEquals(
    queries[0].selectColumns,
    "id, numero, client_nom, montant_ttc, date_emission, date_echeance, statut, etablissement_id",
  );
  assertEquals(queries[0].inFilters, [
    { column: "statut", values: ["envoyee", "en_retard"] },
  ]);
  assertEquals(queries[0].orders, [
    { column: "date_echeance", options: { ascending: true } },
  ]);
  assertEquals(queries[0].limitValue, 50);
});

Deno.test("executeManageInvoice returns failure when a Supabase query returns an error", async () => {
  const { supabase } = createSupabaseMock([
    { data: null, error: new Error("database unavailable") },
  ]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertExists(result.execution_time_ms);
});

Deno.test("executeManageInvoice handles unknown actions with not implemented message", async () => {
  const { supabase, queries } = createSupabaseMock([]);

  const result = await executeManageInvoice(
    { supabase, userId: "user-1" },
    { action: "archive" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Action 'archive' not implemented");
  assertEquals(queries.length, 0);
});