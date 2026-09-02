import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeScoreProspects } from "./prospect-scoring-tools.ts";

type Filter = {
  type: "in" | "eq" | "gte";
  column: string;
  value: unknown;
};

class QueryBuilder {
  table: string;
  operation: "select" | "update" | "insert" = "select";
  columns?: string;
  payload?: unknown;
  filters: Filter[] = [];
  orderBy?: { column: string; ascending: boolean };
  limitCount?: number;

  constructor(private mock: MockSupabase, table: string) {
    this.table = table;
  }

  select(columns: string) {
    this.operation = "select";
    this.columns = columns;
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: "in", column, value });
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

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this.execute();
  }

  execute() {
    return this.mock.execute(this);
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class MockSupabase {
  data: Record<string, any[]>;
  errors: Record<string, Error>;
  rpcResponses: Record<string, any>;
  rpcShouldThrow: boolean;
  executedQueries: any[] = [];
  updates: any[] = [];
  inserts: any[] = [];
  rpcCalls: any[] = [];

  constructor(options: {
    data?: Record<string, any[]>;
    errors?: Record<string, Error>;
    rpcResponses?: Record<string, any>;
    rpcShouldThrow?: boolean;
  } = {}) {
    this.data = options.data ?? {};
    this.errors = options.errors ?? {};
    this.rpcResponses = options.rpcResponses ?? {};
    this.rpcShouldThrow = options.rpcShouldThrow ?? false;
  }

  from(table: string) {
    return new QueryBuilder(this, table);
  }

  async rpc(name: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ name, args });

    if (this.rpcShouldThrow) {
      throw new Error("RPC unavailable");
    }

    const id = String(args._etablissement_id ?? "");
    return {
      data: Object.prototype.hasOwnProperty.call(this.rpcResponses, id)
        ? this.rpcResponses[id]
        : null,
      error: null,
    };
  }

  execute(query: QueryBuilder) {
    const record = {
      table: query.table,
      operation: query.operation,
      columns: query.columns,
      filters: query.filters.map((filter) => ({ ...filter })),
      orderBy: query.orderBy ? { ...query.orderBy } : undefined,
      limitCount: query.limitCount,
      payload: query.payload,
    };
    this.executedQueries.push(record);

    if (query.operation === "update") {
      this.updates.push(record);
      return Promise.resolve({ data: null, error: null });
    }

    if (query.operation === "insert") {
      this.inserts.push(record);
      return Promise.resolve({ data: query.payload, error: null });
    }

    if (this.errors[query.table]) {
      return Promise.resolve({ data: null, error: this.errors[query.table] });
    }

    let rows = [...(this.data[query.table] ?? [])];

    for (const filter of query.filters) {
      if (filter.type === "in") {
        rows = rows.filter((row) => Array.isArray(filter.value) && filter.value.includes(row[filter.column]));
      } else if (filter.type === "eq") {
        rows = rows.filter((row) => row[filter.column] === filter.value);
      } else if (filter.type === "gte") {
        rows = rows.filter((row) => row[filter.column] >= filter.value);
      }
    }

    if (query.orderBy) {
      const { column, ascending } = query.orderBy;
      rows.sort((a, b) => {
        if (a[column] === b[column]) return 0;
        if (a[column] == null) return 1;
        if (b[column] == null) return -1;
        return ascending ? (a[column] > b[column] ? 1 : -1) : (a[column] < b[column] ? 1 : -1);
      });
    }

    if (typeof query.limitCount === "number") {
      rows = rows.slice(0, query.limitCount);
    }

    return Promise.resolve({ data: rows, error: null });
  }
}

function createMockContext(options: {
  data?: Record<string, any[]>;
  errors?: Record<string, Error>;
  rpcResponses?: Record<string, any>;
  rpcShouldThrow?: boolean;
} = {}) {
  const supabase = new MockSupabase(options);
  return {
    ctx: { supabase } as any,
    supabase,
  };
}

async function withFixedNow<T>(isoDate: string, fn: () => T | Promise<T>): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => new Date(isoDate).getTime();

  try {
    return await fn();
  } finally {
    Date.now = originalNow;
  }
}

function factor(score: any, label: string) {
  const found = score.factors.find((f: any) => f.label === label);
  assertExists(found);
  return found;
}

Deno.test("executeScoreProspects returns empty result when no establishment matches prospect scope", async () => {
  const { ctx, supabase } = createMockContext({
    data: {
      etablissements: [],
    },
  });

  const result = await executeScoreProspects(ctx, {});

  assertEquals(result.success, true);
  assertEquals(result.data.scores, []);
  assertEquals(result.data.message, "Aucun établissement trouvé");
  assertExists(result.execution_time_ms);

  const etabQuery = supabase.executedQueries[0];
  assertEquals(etabQuery.table, "etablissements");
  assertEquals(etabQuery.operation, "select");
  assertEquals(etabQuery.limitCount, 200);
  assertEquals(etabQuery.filters, [
    {
      type: "in",
      column: "statut",
      value: ["Prospect", "Rendez-vous pris", "Négociation", "Contractualisation"],
    },
  ]);
});

Deno.test("executeScoreProspects computes static and behavioral scores, factors, averages and sorted rankings", async () => {
  await withFixedNow("2024-01-31T00:00:00.000Z", async () => {
    const { ctx, supabase } = createMockContext({
      data: {
        etablissements: [
          {
            id: "etab-low",
            nom: "Clinique Basse",
            statut: "Prospect",
            type_structure: "Clinique",
            nombre_passages_urgences_annuel: 6000,
            created_at: "2023-12-01T00:00:00.000Z",
            updated_at: "2024-01-01T00:00:00.000Z",
            commercial_id: null,
            chef_projet_id: null,
            csm_id: null,
          },
          {
            id: "etab-high",
            nom: "CHU Prioritaire",
            statut: "Négociation",
            type_structure: "CHU",
            nombre_passages_urgences_annuel: 90000,
            created_at: "2023-11-01T00:00:00.000Z",
            updated_at: "2024-01-15T00:00:00.000Z",
            commercial_id: "commercial-1",
            chef_projet_id: "chef-1",
            csm_id: "csm-1",
          },
        ],
        email_threads: [
          { etablissement_id: "etab-high", last_message_at: "2024-01-29T00:00:00.000Z" },
          { etablissement_id: "etab-high", last_message_at: "2024-01-25T00:00:00.000Z" },
          { etablissement_id: "etab-high", last_message_at: "2024-01-10T00:00:00.000Z" },
          { etablissement_id: "etab-high", last_message_at: "2023-12-01T00:00:00.000Z" },
          { etablissement_id: null, last_message_at: "2024-01-30T00:00:00.000Z" },
        ],
        taches: [
          { etablissement_id: "etab-high", statut: "À faire", archive: false, created_at: "2024-01-20T00:00:00.000Z" },
          { etablissement_id: "etab-high", statut: "En cours", archive: false, created_at: "2024-01-21T00:00:00.000Z" },
          { etablissement_id: "etab-high", statut: "Terminé", archive: false, created_at: "2024-01-22T00:00:00.000Z" },
          { etablissement_id: "etab-high", statut: "Archivé", archive: true, created_at: "2024-01-23T00:00:00.000Z" },
          { etablissement_id: null, statut: "Orpheline", archive: false, created_at: "2024-01-24T00:00:00.000Z" },
        ],
        calendar_events: [
          { etablissement_id: "etab-high", start_time: "2024-01-12T10:00:00.000Z" },
          { etablissement_id: "etab-high", start_time: "2024-01-26T10:00:00.000Z" },
          { etablissement_id: "etab-high", start_time: "2023-09-01T10:00:00.000Z" },
          { etablissement_id: null, start_time: "2024-01-27T10:00:00.000Z" },
        ],
      },
      rpcResponses: {
        "etab-high": { behavioral_score: 40, engagement_velocity: 3 },
        "etab-low": { behavioral_score: 5, engagement_velocity: -1 },
      },
    });

    const result = await executeScoreProspects(ctx, { scope: "all", save: false });

    assertEquals(result.success, true);
    assertEquals(result.data.total_scored, 2);
    assertEquals(result.data.average_score, 41);
    assertEquals(result.data.average_behavioral, 23);
    assertEquals(result.data.top_3, [
      "CHU Prioritaire: 75/100 (stat 35 + comp 40)",
      "Clinique Basse: 6/100 (stat 1 + comp 5)",
    ]);
    assertEquals(result.data.top_velocity, [
      "CHU Prioritaire: +3/sem",
      "Clinique Basse: -1/sem",
    ]);

    const scores = result.data.scores;
    assertEquals(scores.length, 2);
    assertEquals(scores[0].etablissement_id, "etab-high");
    assertEquals(scores[0].nom, "CHU Prioritaire");
    assertEquals(scores[0].static_score, 35);
    assertEquals(scores[0].behavioral_score, 40);
    assertEquals(scores[0].engagement_velocity, 3);
    assertEquals(scores[0].score, 75);

    assertEquals(factor(scores[0], "Avancement pipeline").points, 22);
    assertEquals(factor(scores[0], "Volume emails").points, 8);
    assertEquals(factor(scores[0], "Volume emails").detail, "4 thread(s)");
    assertEquals(factor(scores[0], "Rendez-vous").points, 10);
    assertEquals(factor(scores[0], "Rendez-vous").detail, "2 RDV (90j)");
    assertEquals(factor(scores[0], "Tâches liées").points, 5);
    assertEquals(factor(scores[0], "Tâches liées").detail, "3 tâche(s)");
    assertEquals(factor(scores[0], "Taille établissement").points, 10);
    assertEquals(factor(scores[0], "Dernière interaction").points, 10);
    assertEquals(factor(scores[0], "Dernière interaction").detail, "il y a 2j");
    assertEquals(factor(scores[0], "Équipe assignée").points, 5);
    assertEquals(factor(scores[0], "Équipe assignée").detail, "3/3 rôles");
    assertEquals(factor(scores[0], "Score comportemental").points, 40);
    assertEquals(factor(scores[0], "Score comportemental").detail, "40/50 (vélocité +3/sem)");

    assertEquals(scores[1].etablissement_id, "etab-low");
    assertEquals(scores[1].static_score, 1);
    assertEquals(scores[1].behavioral_score, 5);
    assertEquals(scores[1].score, 6);
    assertEquals(factor(scores[1], "Dernière interaction").points, -5);
    assertEquals(factor(scores[1], "Dernière interaction").detail, "Aucun email");

    assertEquals(supabase.updates.length, 0);
    assertEquals(supabase.inserts.length, 0);
    assertEquals(supabase.rpcCalls, [
      { name: "compute_behavioral_score", args: { _etablissement_id: "etab-low" } },
      { name: "compute_behavioral_score", args: { _etablissement_id: "etab-high" } },
    ]);
  });
});

Deno.test("executeScoreProspects saves score fields and history snapshot when save is not false", async () => {
  await withFixedNow("2024-01-31T00:00:00.000Z", async () => {
    const { ctx, supabase } = createMockContext({
      data: {
        etablissements: [
          {
            id: "etab-save",
            nom: "Hôpital Sauvegardé",
            statut: "Contractualisation",
            type_structure: "Hôpital",
            nombre_passages_urgences_annuel: 55000,
            created_at: "2023-10-01T00:00:00.000Z",
            updated_at: "2024-01-01T00:00:00.000Z",
            commercial_id: "commercial-1",
            chef_projet_id: null,
            csm_id: null,
          },
        ],
        email_threads: Array.from({ length: 10 }, (_, index) => ({
          etablissement_id: "etab-save",
          last_message_at: index === 0 ? "2023-12-22T00:00:00.000Z" : "2023-12-01T00:00:00.000Z",
        })),
        taches: Array.from({ length: 10 }, (_, index) => ({
          etablissement_id: "etab-save",
          statut: "Ouverte",
          archive: false,
          created_at: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        })),
        calendar_events: Array.from({ length: 5 }, (_, index) => ({
          etablissement_id: "etab-save",
          start_time: `2024-01-${String(index + 10).padStart(2, "0")}T09:00:00.000Z`,
        })),
      },
      rpcResponses: {
        "etab-save": { behavioral_score: 50, engagement_velocity: 12 },
      },
    });

    const result = await executeScoreProspects(ctx, { etablissement_ids: ["etab-save"] });

    assertEquals(result.success, true);
    assertEquals(result.data.scores[0].score, 89);
    assertEquals(result.data.scores[0].static_score, 39);
    assertEquals(result.data.scores[0].behavioral_score, 50);
    assertEquals(result.data.scores[0].engagement_velocity, 12);

    assertEquals(supabase.updates.length, 1);
    assertEquals(supabase.updates[0].table, "etablissements");
    assertEquals(supabase.updates[0].filters, [{ type: "eq", column: "id", value: "etab-save" }]);
    assertEquals(supabase.updates[0].payload.score_conversion, 89);
    assertEquals(supabase.updates[0].payload.behavioral_score, 50);
    assertEquals(supabase.updates[0].payload.engagement_velocity, 12);
    assertEquals(Array.isArray(supabase.updates[0].payload.score_conversion_factors), true);
    assertExists(supabase.updates[0].payload.score_conversion_updated_at);

    assertEquals(supabase.inserts.length, 1);
    assertEquals(supabase.inserts[0].table, "prospect_score_history");
    assertEquals(supabase.inserts[0].payload.etablissement_id, "etab-save");
    assertEquals(supabase.inserts[0].payload.score, 89);
    assertEquals(supabase.inserts[0].payload.static_score, 39);
    assertEquals(supabase.inserts[0].payload.behavioral_score, 50);
    assertEquals(supabase.inserts[0].payload.engagement_velocity, 12);

    const firstSelect = supabase.executedQueries.find((query) => query.table === "etablissements" && query.operation === "select");
    assertExists(firstSelect);
    assertEquals(firstSelect.filters, [{ type: "in", column: "id", value: ["etab-save"] }]);
  });
});

Deno.test("executeScoreProspects keeps behavioral score at zero when RPC fails", async () => {
  await withFixedNow("2024-01-31T00:00:00.000Z", async () => {
    const { ctx } = createMockContext({
      data: {
        etablissements: [
          {
            id: "etab-rpc-fail",
            nom: "Centre RPC Indisponible",
            statut: "Rendez-vous pris",
            type_structure: "Centre",
            nombre_passages_urgences_annuel: 20000,
            created_at: "2023-12-01T00:00:00.000Z",
            updated_at: "2024-01-01T00:00:00.000Z",
            commercial_id: "commercial-1",
            chef_projet_id: null,
            csm_id: null,
          },
        ],
        email_threads: [
          { etablissement_id: "etab-rpc-fail", last_message_at: "2024-01-24T00:00:00.000Z" },
        ],
        taches: [],
        calendar_events: [],
      },
      rpcShouldThrow: true,
    });

    const result = await executeScoreProspects(ctx, { save: false });

    assertEquals(result.success, true);
    assertEquals(result.data.scores.length, 1);
    assertEquals(result.data.scores[0].static_score, 15);
    assertEquals(result.data.scores[0].behavioral_score, 0);
    assertEquals(result.data.scores[0].engagement_velocity, 0);
    assertEquals(result.data.scores[0].score, 15);
    assertEquals(factor(result.data.scores[0], "Score comportemental").detail, "0/50 (vélocité 0/sem)");
  });
});

Deno.test("executeScoreProspects returns failure result when establishment query errors", async () => {
  const { ctx } = createMockContext({
    errors: {
      etablissements: new Error("database unavailable"),
    },
  });

  const result = await executeScoreProspects(ctx, { save: false });

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertExists(result.execution_time_ms);
});