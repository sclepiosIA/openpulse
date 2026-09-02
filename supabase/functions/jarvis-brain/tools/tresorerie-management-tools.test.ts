import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeManageRevenue,
  executeManageBudget,
  executeGetTresorerieSummary,
} from "./tresorerie-management-tools.ts";

type QueryResult = { data?: unknown; error?: unknown };

class QueryBuilder {
  private operation = "select";
  private payload: unknown = undefined;
  private filters: Array<{ type: string; column: string; value?: unknown; values?: unknown[] }> = [];
  private orderBy?: { column: string; options?: unknown };
  private limitValue?: number;

  constructor(
    private readonly table: string,
    private readonly handlers: Record<string, (state: {
      operation: string;
      payload: unknown;
      filters: Array<{ type: string; column: string; value?: unknown; values?: unknown[] }>;
      orderBy?: { column: string; options?: unknown };
      limitValue?: number;
    }) => QueryResult | Promise<QueryResult>>,
  ) {}

  select(_columns?: string) {
    this.operation = this.operation === "insert" || this.operation === "update" ? this.operation : "select";
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  order(column: string, options?: unknown) {
    this.orderBy = { column, options };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  single() {
    return this.execute();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    const handler = this.handlers[this.table];
    if (!handler) {
      throw new Error(`No handler for table ${this.table}`);
    }
    return await handler({
      operation: this.operation,
      payload: this.payload,
      filters: this.filters,
      orderBy: this.orderBy,
      limitValue: this.limitValue,
    });
  }
}

function createSupabaseStub(
  handlers: Record<string, (state: {
    operation: string;
    payload: unknown;
    filters: Array<{ type: string; column: string; value?: unknown; values?: unknown[] }>;
    orderBy?: { column: string; options?: unknown };
    limitValue?: number;
  }) => QueryResult | Promise<QueryResult>>,
) {
  return {
    from(table: string) {
      return new QueryBuilder(table, handlers);
    },
  };
}

Deno.test("executeManageRevenue list retourne les revenus triés/limités avec le count", async () => {
  const fakeRows = [
    { id: "r2", montant_ttc: 200, date: "2025-02-02" },
    { id: "r1", montant_ttc: 100, date: "2025-02-01" },
  ];

  const supabase = createSupabaseStub({
    tresorerie_revenus: (state) => {
      assertEquals(state.operation, "select");
      assertEquals(state.orderBy?.column, "date");
      assertEquals(state.orderBy?.options, { ascending: false });
      assertEquals(state.limitValue, 50);
      return { data: fakeRows, error: null };
    },
  });

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { revenues: fakeRows, count: 2 });
  assertExists(result.execution_time_ms);
});

Deno.test("executeManageRevenue create ajoute created_by et retourne le revenu créé", async () => {
  const supabase = createSupabaseStub({
    tresorerie_revenus: (state) => {
      assertEquals(state.operation, "insert");
      assertEquals(state.payload, {
        libelle: "Abonnement",
        montant_ttc: 149.99,
        created_by: "user-42",
      });
      return {
        data: {
          id: "rev-1",
          libelle: "Abonnement",
          montant_ttc: 149.99,
          created_by: "user-42",
        },
        error: null,
      };
    },
  });

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-42" },
    { action: "create", data: { libelle: "Abonnement", montant_ttc: 149.99 } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Revenu créé",
    revenue: {
      id: "rev-1",
      libelle: "Abonnement",
      montant_ttc: 149.99,
      created_by: "user-42",
    },
  });
});

Deno.test("executeManageRevenue update sans revenue_id retourne une erreur métier", async () => {
  const supabase = createSupabaseStub({
    tresorerie_revenus: () => ({ data: null, error: null }),
  });

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-1" },
    { action: "update", data: { montant_ttc: 300 } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "revenue_id required");
});

Deno.test("executeManageRevenue update applique le filtre eq sur id et renvoie le revenu modifié", async () => {
  const supabase = createSupabaseStub({
    tresorerie_revenus: (state) => {
      assertEquals(state.operation, "update");
      assertEquals(state.payload, { montant_ttc: 300 });
      assertEquals(state.filters, [{ type: "eq", column: "id", value: "rev-9" }]);
      return {
        data: { id: "rev-9", montant_ttc: 300 },
        error: null,
      };
    },
  });

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-1" },
    { action: "update", revenue_id: "rev-9", data: { montant_ttc: 300 } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Revenu mis à jour",
    revenue: { id: "rev-9", montant_ttc: 300 },
  });
});

Deno.test("executeManageRevenue delete supprime par id", async () => {
  const supabase = createSupabaseStub({
    tresorerie_revenus: (state) => {
      assertEquals(state.operation, "delete");
      assertEquals(state.filters, [{ type: "eq", column: "id", value: "rev-del" }]);
      return { error: null };
    },
  });

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-1" },
    { action: "delete", revenue_id: "rev-del" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Revenu supprimé" });
});

Deno.test("executeManageRevenue retourne success false si Supabase renvoie une erreur", async () => {
  const supabase = createSupabaseStub({
    tresorerie_revenus: () => ({
      data: null,
      error: new Error("db revenue failure"),
    }),
  });

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db revenue failure");
});

Deno.test("executeManageRevenue action inconnue retourne un message not implemented", async () => {
  const supabase = createSupabaseStub({});

  const result = await executeManageRevenue(
    { supabase: supabase as never, userId: "user-1" },
    { action: "archive" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action archive not implemented" });
});

Deno.test("executeManageBudget list retourne les budgets avec count", async () => {
  const fakeRows = [
    { id: "b2", nom: "Marketing" },
    { id: "b1", nom: "RH" },
  ];

  const supabase = createSupabaseStub({
    tresorerie_budgets: (state) => {
      assertEquals(state.operation, "select");
      assertEquals(state.orderBy?.column, "created_at");
      assertEquals(state.orderBy?.options, { ascending: false });
      assertEquals(state.limitValue, 50);
      return { data: fakeRows, error: null };
    },
  });

  const result = await executeManageBudget(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { budgets: fakeRows, count: 2 });
});

Deno.test("executeManageBudget create ajoute created_by", async () => {
  const supabase = createSupabaseStub({
    tresorerie_budgets: (state) => {
      assertEquals(state.operation, "insert");
      assertEquals(state.payload, {
        nom: "Trésorerie 2025",
        montant_prevu: 10000,
        created_by: "budget-user",
      });
      return {
        data: {
          id: "bud-1",
          nom: "Trésorerie 2025",
          montant_prevu: 10000,
          created_by: "budget-user",
        },
        error: null,
      };
    },
  });

  const result = await executeManageBudget(
    { supabase: supabase as never, userId: "budget-user" },
    { action: "create", data: { nom: "Trésorerie 2025", montant_prevu: 10000 } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Budget créé",
    budget: {
      id: "bud-1",
      nom: "Trésorerie 2025",
      montant_prevu: 10000,
      created_by: "budget-user",
    },
  });
});

Deno.test("executeManageBudget update sans budget_id retourne une erreur métier", async () => {
  const supabase = createSupabaseStub({
    tresorerie_budgets: () => ({ data: null, error: null }),
  });

  const result = await executeManageBudget(
    { supabase: supabase as never, userId: "user-1" },
    { action: "update", data: { montant_prevu: 5000 } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "budget_id required");
});

Deno.test("executeManageBudget update modifie le budget ciblé", async () => {
  const supabase = createSupabaseStub({
    tresorerie_budgets: (state) => {
      assertEquals(state.operation, "update");
      assertEquals(state.payload, { montant_prevu: 7500 });
      assertEquals(state.filters, [{ type: "eq", column: "id", value: "bud-9" }]);
      return {
        data: { id: "bud-9", montant_prevu: 7500 },
        error: null,
      };
    },
  });

  const result = await executeManageBudget(
    { supabase: supabase as never, userId: "user-1" },
    { action: "update", budget_id: "bud-9", data: { montant_prevu: 7500 } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Budget mis à jour",
    budget: { id: "bud-9", montant_prevu: 7500 },
  });
});

Deno.test("executeManageBudget retourne success false si Supabase renvoie une erreur", async () => {
  const supabase = createSupabaseStub({
    tresorerie_budgets: () => ({
      data: null,
      error: new Error("db budget failure"),
    }),
  });

  const result = await executeManageBudget(
    { supabase: supabase as never, userId: "user-1" },
    { action: "create", data: { nom: "Ops" } },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db budget failure");
});

Deno.test("executeGetTresorerieSummary calcule les agrégats mensuels et filtres factures en retard", async () => {
  const realDate = Date;
  class FakeDate extends Date {
    constructor(...args: [] | [string | number | Date]) {
      if (args.length === 0) {
        super("2025-03-15T12:00:00.000Z");
      } else {
        super(args[0]);
      }
    }
    static now() {
      return new realDate("2025-03-15T12:00:00.000Z").getTime();
    }
  }
  globalThis.Date = FakeDate as DateConstructor;

  try {
    const supabase = createSupabaseStub({
      tresorerie_revenus: (state) => {
        assertEquals(state.operation, "select");
        assertEquals(state.filters, [{ type: "gte", column: "date", value: "2025-03-01" }]);
        return {
          data: [{ montant_ttc: 1000 }, { montant_ttc: 500 }, { montant_ttc: null }],
          error: null,
        };
      },
      tresorerie_depenses: (state) => {
        assertEquals(state.operation, "select");
        assertEquals(state.filters, [{ type: "gte", column: "date", value: "2025-03-01" }]);
        return {
          data: [{ montant_ttc: 300 }, { montant_ttc: 200 }],
          error: null,
        };
      },
      factures: (state) => {
        assertEquals(state.operation, "select");
        assertEquals(state.filters, [{ type: "in", column: "statut", values: ["envoyee", "en_retard"] }]);
        return {
          data: [
            { montant_ttc: 400, statut: "envoyee" },
            { montant_ttc: 250, statut: "en_retard" },
            { montant_ttc: 100, statut: "en_retard" },
          ],
          error: null,
        };
      },
    });

    const result = await executeGetTresorerieSummary({
      supabase: supabase as never,
      userId: "user-1",
    });

    assertEquals(result.success, true);
    assertEquals(result.data, {
      periode: "2025-03-01",
      revenus_mois: 1500,
      depenses_mois: 500,
      solde_mois: 1000,
      a_encaisser: 750,
      factures_en_retard: 2,
    });
    assertExists(result.execution_time_ms);
  } finally {
    globalThis.Date = realDate;
  }
});

Deno.test("executeGetTresorerieSummary retourne success false si une requête échoue", async () => {
  const realDate = Date;
  class FakeDate extends Date {
    constructor(...args: [] | [string | number | Date]) {
      if (args.length === 0) {
        super("2025-04-20T08:00:00.000Z");
      } else {
        super(args[0]);
      }
    }
    static now() {
      return new realDate("2025-04-20T08:00:00.000Z").getTime();
    }
  }
  globalThis.Date = FakeDate as DateConstructor;

  try {
    const supabase = createSupabaseStub({
      tresorerie_revenus: () => ({ data: [{ montant_ttc: 100 }], error: null }),
      tresorerie_depenses: () => {
        throw new Error("depenses unavailable");
      },
      factures: () => ({ data: [], error: null }),
    });

    const result = await executeGetTresorerieSummary({
      supabase: supabase as never,
      userId: "user-1",
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "depenses unavailable");
  } finally {
    globalThis.Date = realDate;
  }
});