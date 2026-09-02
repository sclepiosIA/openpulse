import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCreateInvoice,
  executeForecastCashflow,
  executeGetBankBalance,
  executeManageExpense,
  executeSyncQontoTransactions,
} from "./treasury-tools.ts";

function createFunctionsInvokeContext(
  invokeImpl: (name: string, options: Record<string, unknown>) => Promise<Record<string, unknown>>,
) {
  return {
    userId: "user-test-1",
    supabase: {
      functions: {
        invoke: invokeImpl,
      },
    },
  } as any;
}

Deno.test("executeSyncQontoTransactions synchronise Qonto avec les valeurs par défaut", async () => {
  const invocations: Array<{ name: string; options: Record<string, unknown> }> = [];
  const ctx = createFunctionsInvokeContext(async (name, options) => {
    invocations.push({ name, options });
    return {
      data: { synced_count: 12, skipped_count: 2 },
      error: null,
    };
  });

  const result = await executeSyncQontoTransactions(ctx, {});

  assertEquals(result.success, true);
  assertEquals(invocations, [
    {
      name: "qonto-sync-transactions",
      options: { body: { days_back: 30, force_relink: false } },
    },
  ]);
  assertEquals(result.data, {
    message: "Synchronisation Qonto terminée",
    synced_count: 12,
    skipped_count: 2,
  });
  assertExists(result.execution_time_ms);
});

Deno.test("executeSyncQontoTransactions transmet days_back et force_relink explicites", async () => {
  const invocations: Array<{ name: string; options: Record<string, unknown> }> = [];
  const ctx = createFunctionsInvokeContext(async (name, options) => {
    invocations.push({ name, options });
    return { data: { synced_count: 3 }, error: null };
  });

  const result = await executeSyncQontoTransactions(ctx, {
    days_back: 7,
    force_relink: true,
  });

  assertEquals(result.success, true);
  assertEquals(invocations[0], {
    name: "qonto-sync-transactions",
    options: { body: { days_back: 7, force_relink: true } },
  });
  assertEquals(result.data?.synced_count, 3);
});

Deno.test("executeSyncQontoTransactions retourne une erreur métier si l'invocation échoue", async () => {
  const ctx = createFunctionsInvokeContext(async () => ({
    data: null,
    error: new Error("Qonto token expired"),
  }));

  const result = await executeSyncQontoTransactions(ctx, { days_back: 5 });

  assertEquals(result.success, false);
  assertEquals(result.error, "Qonto token expired");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetBankBalance retourne le solde et utilise EUR comme devise par défaut", async () => {
  const invocations: Array<{ name: string; options: Record<string, unknown> }> = [];
  const ctx = createFunctionsInvokeContext(async (name, options) => {
    invocations.push({ name, options });
    return {
      data: { balance: 15420.75 },
      error: null,
    };
  });

  const result = await executeGetBankBalance(ctx);

  assertEquals(result.success, true);
  assertEquals(invocations, [
    {
      name: "qonto-get-balance",
      options: { body: {} },
    },
  ]);
  assertEquals(result.data, {
    balance: 15420.75,
    currency: "EUR",
  });
});

Deno.test("executeGetBankBalance conserve la devise retournée par le service", async () => {
  const ctx = createFunctionsInvokeContext(async () => ({
    data: { balance: 2200, currency: "USD" },
    error: null,
  }));

  const result = await executeGetBankBalance(ctx);

  assertEquals(result.success, true);
  assertEquals(result.data, {
    balance: 2200,
    currency: "USD",
  });
});

Deno.test("executeForecastCashflow appelle predict-cashflow et normalise forecast manquant", async () => {
  const invocations: Array<{ name: string; options: Record<string, unknown> }> = [];
  const ctx = createFunctionsInvokeContext(async (name, options) => {
    invocations.push({ name, options });
    return {
      data: {
        summary: { opening_balance: 10000, closing_balance: 14500 },
      },
      error: null,
    };
  });

  const result = await executeForecastCashflow(ctx, { months_ahead: 0 });

  assertEquals(result.success, true);
  assertEquals(invocations, [
    {
      name: "predict-cashflow",
      options: { body: { months_ahead: 3 } },
    },
  ]);
  assertEquals(result.data, {
    forecast: [],
    summary: { opening_balance: 10000, closing_balance: 14500 },
  });
});

Deno.test("executeForecastCashflow retourne l'erreur de prévision", async () => {
  const ctx = createFunctionsInvokeContext(async () => ({
    data: null,
    error: new Error("insufficient transaction history"),
  }));

  const result = await executeForecastCashflow(ctx, { months_ahead: 6 });

  assertEquals(result.success, false);
  assertEquals(result.error, "insufficient transaction history");
});

function createInvoiceSupabaseMock() {
  const state = {
    calls: [] as Array<Record<string, unknown>>,
    insertedFacture: undefined as any,
    insertedLines: undefined as any,
  };

  const supabase = {
    from(table: string) {
      state.calls.push({ method: "from", table });

      if (table === "etablissements") {
        return {
          select(columns: string) {
            state.calls.push({ method: "select", table, columns });
            return {
              eq(column: string, value: unknown) {
                state.calls.push({ method: "eq", table, column, value });
                return {
                  async single() {
                    state.calls.push({ method: "single", table });
                    return {
                      data: {
                        id: "etab-1",
                        nom: "Restaurant Test",
                        siret: "12345678900011",
                        adresse: "1 rue du Test",
                        email_facturation: "factures@example.invalid",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "factures") {
        return {
          select(columns: string, options?: Record<string, unknown>) {
            state.calls.push({ method: "select", table, columns, options });
            return {
              async gte(column: string, value: unknown) {
                state.calls.push({ method: "gte", table, column, value });
                return { count: 7, error: null };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            state.insertedFacture = payload;
            state.calls.push({ method: "insert", table, payload });
            return {
              select() {
                state.calls.push({ method: "select_after_insert", table });
                return {
                  async single() {
                    state.calls.push({ method: "single_after_insert", table });
                    return {
                      data: { id: "facture-123", ...payload },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "factures_lignes") {
        return {
          async insert(payload: Array<Record<string, unknown>>) {
            state.insertedLines = payload;
            state.calls.push({ method: "insert", table, payload });
            return { data: payload, error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, state };
}

Deno.test("executeCreateInvoice calcule les montants HT, TVA, TTC et crée les lignes de facture", async () => {
  const { supabase, state } = createInvoiceSupabaseMock();
  const ctx = {
    userId: "user-invoice-1",
    supabase,
  } as any;

  const year = new Date().getFullYear();
  const result = await executeCreateInvoice(ctx, {
    etablissement_id: "etab-1",
    date_echeance: "2026-02-15",
    conditions_paiement: "Paiement sous 15 jours",
    lignes: [
      {
        designation: "Abonnement mensuel",
        quantite: 2,
        prix_unitaire_ht: 100,
      },
      {
        designation: "Service réduit",
        quantite: 3,
        prix_unitaire_ht: 50,
        taux_tva: 5.5,
      },
    ],
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: `Facture FAC-${year}-0008 créée`,
    facture_id: "facture-123",
    numero: `FAC-${year}-0008`,
    montant_ttc: 398.25,
  });

  assertEquals(state.insertedFacture.numero, `FAC-${year}-0008`);
  assertEquals(state.insertedFacture.etablissement_id, "etab-1");
  assertEquals(state.insertedFacture.client_nom, "Restaurant Test");
  assertEquals(state.insertedFacture.client_siret, "12345678900011");
  assertEquals(state.insertedFacture.date_echeance, "2026-02-15");
  assertEquals(state.insertedFacture.conditions_paiement, "Paiement sous 15 jours");
  assertEquals(state.insertedFacture.montant_ht, 350);
  assertEquals(state.insertedFacture.montant_tva, 48.25);
  assertEquals(state.insertedFacture.montant_ttc, 398.25);
  assertEquals(state.insertedFacture.statut, "brouillon");
  assertEquals(state.insertedFacture.created_by, "user-invoice-1");

  assertEquals(state.insertedLines, [
    {
      facture_id: "facture-123",
      designation: "Abonnement mensuel",
      quantite: 2,
      prix_unitaire_ht: 100,
      taux_tva: 20,
      montant_ht: 200,
      montant_tva: 40,
      montant_ttc: 240,
    },
    {
      facture_id: "facture-123",
      designation: "Service réduit",
      quantite: 3,
      prix_unitaire_ht: 50,
      taux_tva: 5.5,
      montant_ht: 150,
      montant_tva: 8.25,
      montant_ttc: 158.25,
    },
  ]);
});

Deno.test("executeCreateInvoice retourne une erreur si l'insertion facture échoue", async () => {
  const supabase = {
    from(table: string) {
      if (table === "etablissements") {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return {
                      data: { nom: "Client Erreur", siret: "00000000000000" },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "factures") {
        return {
          select() {
            return {
              async gte() {
                return { count: 0, error: null };
              },
            };
          },
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: null,
                      error: new Error("duplicate invoice number"),
                    };
                  },
                };
              },
            };
          },
        };
      }

      return {
        async insert() {
          return { data: null, error: null };
        },
      };
    },
  };

  const result = await executeCreateInvoice(
    { userId: "user-err", supabase } as any,
    {
      etablissement_id: "etab-error",
      lignes: [{ designation: "Prestation", quantite: 1, prix_unitaire_ht: 100 }],
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "duplicate invoice number");
});

function createExpenseSupabaseMock() {
  const state = {
    calls: [] as Array<Record<string, unknown>>,
    createdPayload: undefined as any,
    updatedPayload: undefined as any,
    updatedId: undefined as any,
    deletedId: undefined as any,
  };

  const expenses = [
    { id: "dep-2", date: "2025-03-12", montant: 75, libelle: "Taxi" },
    { id: "dep-1", date: "2025-03-10", montant: 120, libelle: "Fournitures" },
  ];

  const supabase = {
    from(table: string) {
      state.calls.push({ method: "from", table });

      return {
        select(columns: string) {
          state.calls.push({ method: "select", table, columns });
          return {
            order(column: string, options: Record<string, unknown>) {
              state.calls.push({ method: "order", table, column, options });
              return {
                async limit(value: number) {
                  state.calls.push({ method: "limit", table, value });
                  return { data: expenses, error: null };
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          state.createdPayload = payload;
          state.calls.push({ method: "insert", table, payload });
          return {
            select() {
              state.calls.push({ method: "select_after_insert", table });
              return {
                async single() {
                  return {
                    data: { id: "dep-created", ...payload },
                    error: null,
                  };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          state.updatedPayload = payload;
          state.calls.push({ method: "update", table, payload });
          return {
            eq(column: string, value: unknown) {
              state.updatedId = value;
              state.calls.push({ method: "eq_after_update", table, column, value });
              return {
                select() {
                  state.calls.push({ method: "select_after_update", table });
                  return {
                    async single() {
                      return {
                        data: { id: value, ...payload },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
        delete() {
          state.calls.push({ method: "delete", table });
          return {
            async eq(column: string, value: unknown) {
              state.deletedId = value;
              state.calls.push({ method: "eq_after_delete", table, column, value });
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { supabase, state, expenses };
}

Deno.test("executeManageExpense liste les 50 dernières dépenses triées par date décroissante", async () => {
  const { supabase, state, expenses } = createExpenseSupabaseMock();

  const result = await executeManageExpense(
    { userId: "user-expense-1", supabase } as any,
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    expenses,
    count: 2,
  });
  assertEquals(state.calls, [
    { method: "from", table: "tresorerie_depenses" },
    { method: "select", table: "tresorerie_depenses", columns: "*" },
    {
      method: "order",
      table: "tresorerie_depenses",
      column: "date",
      options: { ascending: false },
    },
    { method: "limit", table: "tresorerie_depenses", value: 50 },
  ]);
});

Deno.test("executeManageExpense crée une dépense avec created_by", async () => {
  const { supabase, state } = createExpenseSupabaseMock();

  const result = await executeManageExpense(
    { userId: "user-expense-creator", supabase } as any,
    {
      action: "create",
      data: {
        libelle: "Repas équipe",
        montant: 95.5,
        date: "2025-03-20",
        categorie: "restauration",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(state.createdPayload, {
    libelle: "Repas équipe",
    montant: 95.5,
    date: "2025-03-20",
    categorie: "restauration",
    created_by: "user-expense-creator",
  });
  assertEquals(result.data, {
    message: "Dépense créée",
    expense: {
      id: "dep-created",
      libelle: "Repas équipe",
      montant: 95.5,
      date: "2025-03-20",
      categorie: "restauration",
      created_by: "user-expense-creator",
    },
  });
});

Deno.test("executeManageExpense met à jour une dépense existante", async () => {
  const { supabase, state } = createExpenseSupabaseMock();

  const result = await executeManageExpense(
    { userId: "user-expense-1", supabase } as any,
    {
      action: "update",
      expense_id: "dep-42",
      data: {
        montant: 130,
        libelle: "Fournitures bureau",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(state.updatedId, "dep-42");
  assertEquals(state.updatedPayload, {
    montant: 130,
    libelle: "Fournitures bureau",
  });
  assertEquals(result.data, {
    message: "Dépense mise à jour",
    expense: {
      id: "dep-42",
      montant: 130,
      libelle: "Fournitures bureau",
    },
  });
});

Deno.test("executeManageExpense supprime une dépense existante", async () => {
  const { supabase, state } = createExpenseSupabaseMock();

  const result = await executeManageExpense(
    { userId: "user-expense-1", supabase } as any,
    {
      action: "delete",
      expense_id: "dep-delete-1",
    },
  );

  assertEquals(result.success, true);
  assertEquals(state.deletedId, "dep-delete-1");
  assertEquals(result.data, {
    message: "Dépense supprimée",
  });
});

Deno.test("executeManageExpense refuse update et delete sans expense_id", async () => {
  const ctx = {
    userId: "user-expense-1",
    supabase: {
      from() {
        throw new Error("from should not be called without expense_id");
      },
    },
  } as any;

  const updateResult = await executeManageExpense(ctx, {
    action: "update",
    data: { montant: 10 },
  });

  const deleteResult = await executeManageExpense(ctx, {
    action: "delete",
  });

  assertEquals(updateResult.success, false);
  assertEquals(updateResult.error, "expense_id required");
  assertEquals(deleteResult.success, false);
  assertEquals(deleteResult.error, "expense_id required");
});

Deno.test("executeManageExpense refuse une action inconnue", async () => {
  const ctx = {
    userId: "user-expense-1",
    supabase: {},
  } as any;

  const result = await executeManageExpense(ctx, {
    action: "archive",
    expense_id: "dep-1",
  } as any);

  assertEquals(result.success, false);
  assertEquals(result.error, "Unknown action: archive");
});

Deno.test("assert helpers are available for synchronous and asynchronous failures", async () => {
  assertThrows(() => {
    throw new Error("sync failure");
  }, Error, "sync failure");

  await assertRejects(
    async () => {
      throw new Error("async failure");
    },
    Error,
    "async failure",
  );
});