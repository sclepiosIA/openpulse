import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeEvaluateCandidate,
  executeGetCandidateHistory,
  executeManageCandidate,
  executeManageJobOffer,
  executeParseCV,
  executeScheduleInterview,
} from "./recruitment-tools.ts";

type QueryCall = {
  table: string;
  operation: string;
  payload: unknown;
  columns?: string;
  filters: Array<{ column: string; value: unknown }>;
  orders: Array<{ column: string; options?: unknown }>;
  limitValue?: number;
  terminal?: string;
};

function createSupabaseMock(
  resolver: (call: QueryCall) => unknown | Promise<unknown>,
) {
  const calls: QueryCall[] = [];

  class MockQuery {
    table: string;
    operation = "select";
    payload: unknown = undefined;
    columns?: string;
    filters: Array<{ column: string; value: unknown }> = [];
    orders: Array<{ column: string; options?: unknown }> = [];
    limitValue?: number;
    terminal?: string;

    constructor(table: string) {
      this.table = table;
    }

    select(columns?: string) {
      this.columns = columns;
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

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    order(column: string, options?: unknown) {
      this.orders.push({ column, options });
      return this;
    }

    limit(value: number) {
      this.limitValue = value;
      return this;
    }

    single() {
      this.terminal = "single";
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      const call: QueryCall = {
        table: this.table,
        operation: this.operation,
        payload: this.payload,
        columns: this.columns,
        filters: [...this.filters],
        orders: [...this.orders],
        limitValue: this.limitValue,
        terminal: this.terminal,
      };
      calls.push(call);
      return Promise.resolve()
        .then(() => resolver(call))
        .then(onfulfilled, onrejected);
    }
  }

  return {
    calls,
    client: {
      from(table: string) {
        return new MockQuery(table);
      },
    },
  };
}

function createContext(
  resolver: (call: QueryCall) => unknown | Promise<unknown>,
  userId = "user-123",
) {
  const mock = createSupabaseMock(resolver);
  return {
    ctx: { supabase: mock.client as never, userId },
    calls: mock.calls,
  };
}

Deno.test("executeManageJobOffer list returns offers ordered by newest with count", async () => {
  const offers = [
    { id: "offer-2", titre: "Lead TypeScript", status: "published" },
    { id: "offer-1", titre: "Backend Engineer", status: "draft" },
  ];

  const { ctx, calls } = createContext((call) => {
    assertEquals(call.table, "job_offers");
    assertEquals(call.operation, "select");
    return { data: offers, error: null };
  });

  const result = await executeManageJobOffer(ctx, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data, { offers, count: 2 });
  assertExists(result.execution_time_ms);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].columns, "*");
  assertEquals(calls[0].orders, [{ column: "created_at", options: { ascending: false } }]);
  assertEquals(calls[0].limitValue, 50);
});

Deno.test("executeManageJobOffer create inserts a draft offer with creator", async () => {
  const { ctx, calls } = createContext((call) => {
    return {
      data: {
        id: "offer-123",
        titre: "Product Manager",
        status: "draft",
        created_by: "recruiter-1",
      },
      error: null,
    };
  }, "recruiter-1");

  const result = await executeManageJobOffer(ctx, {
    action: "create",
    data: {
      titre: "Product Manager",
      localisation: "Paris",
      salaire_min: 52000,
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Offre créée");
  assertEquals(result.data?.offer, {
    id: "offer-123",
    titre: "Product Manager",
    status: "draft",
    created_by: "recruiter-1",
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "job_offers");
  assertEquals(calls[0].operation, "insert");
  assertEquals(calls[0].payload, {
    titre: "Product Manager",
    localisation: "Paris",
    salaire_min: 52000,
    status: "draft",
    created_by: "recruiter-1",
  });
  assertEquals(calls[0].terminal, "single");
});

Deno.test("executeManageJobOffer publish updates status and published_at for the requested offer", async () => {
  const { ctx, calls } = createContext((call) => {
    assertEquals(call.table, "job_offers");
    assertEquals(call.operation, "update");
    return {
      data: {
        id: "offer-999",
        status: "published",
        titre: "Data Engineer",
      },
      error: null,
    };
  });

  const result = await executeManageJobOffer(ctx, {
    action: "publish",
    offer_id: "offer-999",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Offre publiée");
  assertEquals(result.data?.offer, {
    id: "offer-999",
    status: "published",
    titre: "Data Engineer",
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].filters, [{ column: "id", value: "offer-999" }]);
  assertEquals((calls[0].payload as Record<string, unknown>).status, "published");
  assertExists((calls[0].payload as Record<string, unknown>).published_at);
  assertEquals(
    Number.isNaN(Date.parse((calls[0].payload as Record<string, string>).published_at)),
    false,
  );
});

Deno.test("executeManageJobOffer publish without offer_id returns a business error", async () => {
  const { ctx, calls } = createContext(() => {
    throw new Error("Supabase should not be called");
  });

  const result = await executeManageJobOffer(ctx, { action: "publish" });

  assertEquals(result.success, false);
  assertEquals(result.error, "offer_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageJobOffer unknown action is reported as not implemented", async () => {
  const { ctx, calls } = createContext(() => {
    throw new Error("Supabase should not be called");
  });

  const result = await executeManageJobOffer(ctx, { action: "archive", offer_id: "offer-1" });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action archive not implemented" });
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCandidate list includes linked job offer title and limits to 100", async () => {
  const candidates = [
    { id: "cand-1", prenom: "Ada", nom: "Lovelace", job_offers: { titre: "CTO" } },
    { id: "cand-2", prenom: "Grace", nom: "Hopper", job_offers: { titre: "Compiler Engineer" } },
  ];

  const { ctx, calls } = createContext((call) => {
    return { data: candidates, error: null };
  });

  const result = await executeManageCandidate(ctx, { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data, { candidates, count: 2 });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "candidates");
  assertEquals(calls[0].columns, "*, job_offers(titre)");
  assertEquals(calls[0].orders, [{ column: "created_at", options: { ascending: false } }]);
  assertEquals(calls[0].limitValue, 100);
});

Deno.test("executeManageCandidate create inserts a new candidate with initial stage and creator", async () => {
  const { ctx, calls } = createContext(() => {
    return {
      data: {
        id: "cand-123",
        prenom: "Katherine",
        nom: "Johnson",
        stage: "new",
        created_by: "recruiter-7",
      },
      error: null,
    };
  }, "recruiter-7");

  const result = await executeManageCandidate(ctx, {
    action: "create",
    data: {
      prenom: "Katherine",
      nom: "Johnson",
      email: "candidate@example.test",
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Candidat ajouté");
  assertEquals(result.data?.candidate, {
    id: "cand-123",
    prenom: "Katherine",
    nom: "Johnson",
    stage: "new",
    created_by: "recruiter-7",
  });
  assertEquals(calls[0].table, "candidates");
  assertEquals(calls[0].operation, "insert");
  assertEquals(calls[0].payload, {
    prenom: "Katherine",
    nom: "Johnson",
    email: "candidate@example.test",
    stage: "new",
    created_by: "recruiter-7",
  });
});

Deno.test("executeManageCandidate advance_stage moves screening candidate to interview", async () => {
  const { ctx, calls } = createContext((call) => {
    if (call.operation === "select") {
      return { data: { stage: "screening" }, error: null };
    }

    assertEquals(call.operation, "update");
    assertEquals(call.payload, { stage: "interview" });
    return {
      data: {
        id: "cand-55",
        stage: "interview",
      },
      error: null,
    };
  });

  const result = await executeManageCandidate(ctx, {
    action: "advance_stage",
    candidate_id: "cand-55",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Candidat avancé: interview");
  assertEquals(result.data?.candidate, { id: "cand-55", stage: "interview" });
  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "candidates");
  assertEquals(calls[0].columns, "stage");
  assertEquals(calls[0].filters, [{ column: "id", value: "cand-55" }]);
  assertEquals(calls[1].filters, [{ column: "id", value: "cand-55" }]);
});

Deno.test("executeManageCandidate advance_stage keeps hired candidate at hired", async () => {
  const { ctx, calls } = createContext((call) => {
    if (call.operation === "select") {
      return { data: { stage: "hired" }, error: null };
    }
    return {
      data: {
        id: "cand-hired",
        stage: (call.payload as Record<string, unknown>).stage,
      },
      error: null,
    };
  });

  const result = await executeManageCandidate(ctx, {
    action: "advance_stage",
    candidate_id: "cand-hired",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Candidat avancé: hired");
  assertEquals(result.data?.candidate, { id: "cand-hired", stage: "hired" });
  assertEquals(calls[1].payload, { stage: "hired" });
});

Deno.test("executeManageCandidate advance_stage without candidate_id returns a business error", async () => {
  const { ctx, calls } = createContext(() => {
    throw new Error("Supabase should not be called");
  });

  const result = await executeManageCandidate(ctx, { action: "advance_stage" });

  assertEquals(result.success, false);
  assertEquals(result.error, "candidate_id required");
  assertEquals(calls.length, 0);
});

Deno.test("executeManageCandidate unknown action is reported as not implemented", async () => {
  const { ctx, calls } = createContext(() => {
    throw new Error("Supabase should not be called");
  });

  const result = await executeManageCandidate(ctx, { action: "merge_duplicates" });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action merge_duplicates not implemented" });
  assertEquals(calls.length, 0);
});

Deno.test("executeScheduleInterview creates a video interview by default and formats French date", async () => {
  const { ctx, calls } = createContext((call) => {
    if (call.table === "candidates") {
      return { data: { prenom: "Ada", nom: "Lovelace" }, error: null };
    }

    assertEquals(call.table, "interviews");
    assertEquals(call.operation, "insert");
    return {
      data: {
        id: "interview-1",
        candidate_id: "cand-ada",
        scheduled_at: "2025-03-15T12:00:00.000Z",
        type: "video",
        status: "scheduled",
      },
      error: null,
    };
  }, "recruiter-2");

  const result = await executeScheduleInterview(ctx, {
    candidate_id: "cand-ada",
    interviewer_ids: ["manager-1", "tech-2"],
    datetime: "2025-03-15T12:00:00.000Z",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Entretien planifié le 15/03/2025");
  assertEquals(result.data?.candidate_name, "Ada Lovelace");
  assertEquals(result.data?.interview, {
    id: "interview-1",
    candidate_id: "cand-ada",
    scheduled_at: "2025-03-15T12:00:00.000Z",
    type: "video",
    status: "scheduled",
  });
  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "candidates");
  assertEquals(calls[0].columns, "nom, prenom");
  assertEquals(calls[0].filters, [{ column: "id", value: "cand-ada" }]);
  assertEquals(calls[1].payload, {
    candidate_id: "cand-ada",
    scheduled_at: "2025-03-15T12:00:00.000Z",
    type: "video",
    status: "scheduled",
    created_by: "recruiter-2",
  });
});

Deno.test("executeScheduleInterview uses the provided interview type", async () => {
  const { ctx, calls } = createContext((call) => {
    if (call.table === "candidates") {
      return { data: { prenom: "Grace", nom: "Hopper" }, error: null };
    }
    return {
      data: {
        id: "interview-onsite",
        type: "onsite",
      },
      error: null,
    };
  });

  const result = await executeScheduleInterview(ctx, {
    candidate_id: "cand-grace",
    interviewer_ids: ["manager-3"],
    datetime: "2025-06-20T10:30:00.000Z",
    interview_type: "onsite",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.candidate_name, "Grace Hopper");
  assertEquals((calls[1].payload as Record<string, unknown>).type, "onsite");
});

Deno.test("executeEvaluateCandidate inserts evaluation with criteria, recommendation and comments", async () => {
  const { ctx, calls } = createContext((call) => {
    return {
      data: {
        id: "eval-1",
        candidate_id: "cand-1",
        recommendation: "hire",
      },
      error: null,
    };
  }, "evaluator-1");

  const result = await executeEvaluateCandidate(ctx, {
    candidate_id: "cand-1",
    interview_id: "interview-1",
    criteria: {
      communication: 4,
      technical: 5,
      culture_fit: 4,
    },
    recommendation: "hire",
    comments: "Très bon niveau technique.",
  });

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Évaluation ajoutée: hire");
  assertEquals(result.data?.evaluation, {
    id: "eval-1",
    candidate_id: "cand-1",
    recommendation: "hire",
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "candidate_evaluations");
  assertEquals(calls[0].operation, "insert");
  assertEquals(calls[0].payload, {
    candidate_id: "cand-1",
    interview_id: "interview-1",
    evaluator_id: "evaluator-1",
    criteres: {
      communication: 4,
      technical: 5,
      culture_fit: 4,
    },
    recommendation: "hire",
    commentaire_general: "Très bon niveau technique.",
  });
});

Deno.test("executeEvaluateCandidate defaults missing criteria to an empty object", async () => {
  const { ctx, calls } = createContext(() => {
    return {
      data: { id: "eval-2", recommendation: "no_hire" },
      error: null,
    };
  });

  const result = await executeEvaluateCandidate(ctx, {
    candidate_id: "cand-2",
    recommendation: "no_hire",
  });

  assertEquals(result.success, true);
  assertEquals((calls[0].payload as Record<string, unknown>).criteres, {});
  assertEquals((calls[0].payload as Record<string, unknown>).interview_id, undefined);
  assertEquals((calls[0].payload as Record<string, unknown>).commentaire_general, undefined);
});

Deno.test("executeParseCV returns a deterministic placeholder without calling Supabase", async () => {
  const { ctx, calls } = createContext(() => {
    throw new Error("Supabase should not be called");
  });

  const result = await executeParseCV(ctx, {
    storage_path: "candidates/cand-1/cv.pdf",
    candidate_id: "cand-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "CV parsing requires document AI integration",
    storage_path: "candidates/cand-1/cv.pdf",
  });
  assertEquals(calls.length, 0);
});

Deno.test("executeGetCandidateHistory returns history ordered by newest with count", async () => {
  const history = [
    { id: "hist-2", candidate_id: "cand-1", action: "stage_changed" },
    { id: "hist-1", candidate_id: "cand-1", action: "created" },
  ];

  const { ctx, calls } = createContext((call) => {
    return { data: history, error: null };
  });

  const result = await executeGetCandidateHistory(ctx, { candidate_id: "cand-1" });

  assertEquals(result.success, true);
  assertEquals(result.data, { history, count: 2 });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "candidate_history");
  assertEquals(calls[0].columns, "*");
  assertEquals(calls[0].filters, [{ column: "candidate_id", value: "cand-1" }]);
  assertEquals(calls[0].orders, [{ column: "created_at", options: { ascending: false } }]);
});

Deno.test("executeGetCandidateHistory returns Supabase error message on failure", async () => {
  const { ctx } = createContext(() => {
    return { data: null, error: new Error("history table unavailable") };
  });

  const result = await executeGetCandidateHistory(ctx, { candidate_id: "cand-err" });

  assertEquals(result.success, false);
  assertEquals(result.error, "history table unavailable");
});

Deno.test("database errors are caught and surfaced for create job offer", async () => {
  const { ctx } = createContext(() => {
    return { data: null, error: new Error("insert denied") };
  });

  const result = await executeManageJobOffer(ctx, {
    action: "create",
    data: { titre: "Confidential role" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "insert denied");
});

Deno.test("database errors are caught and surfaced for candidate creation", async () => {
  const { ctx } = createContext(() => {
    return { data: null, error: new Error("candidate insert denied") };
  });

  const result = await executeManageCandidate(ctx, {
    action: "create",
    data: { prenom: "Alan", nom: "Turing" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "candidate insert denied");
});

Deno.test("database errors are caught and surfaced for interview scheduling", async () => {
  const { ctx } = createContext((call) => {
    if (call.table === "candidates") {
      return { data: { prenom: "Alan", nom: "Turing" }, error: null };
    }
    return { data: null, error: new Error("calendar conflict") };
  });

  const result = await executeScheduleInterview(ctx, {
    candidate_id: "cand-alan",
    interviewer_ids: ["interviewer-1"],
    datetime: "2025-04-01T09:00:00.000Z",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "calendar conflict");
});

Deno.test("database errors are caught and surfaced for candidate evaluation", async () => {
  const { ctx } = createContext(() => {
    return { data: null, error: new Error("evaluation write failed") };
  });

  const result = await executeEvaluateCandidate(ctx, {
    candidate_id: "cand-1",
    recommendation: "maybe",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "evaluation write failed");
});

Deno.test("mock helper supports synchronous and asynchronous assertion failures", async () => {
  assertThrows(() => {
    throw new Error("sync assertion failure");
  }, Error, "sync assertion failure");

  await assertRejects(
    () => Promise.reject(new Error("async assertion failure")),
    Error,
    "async assertion failure",
  );
});