import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCreateTrainingSession,
  executeRegisterAttendance,
  executeGetSessionAttendance,
  executeGetTrainingAnalytics,
  executeManageCertification,
  executeSendSatisfactionSurvey,
  executeGetSatisfactionResults,
} from "./training-tools.ts";

class MockQuery {
  table: string;
  operations: Array<{ method: string; args: unknown[] }> = [];
  insertValue: unknown;
  updateValue: unknown;

  constructor(table: string, private resolver: (query: MockQuery) => unknown) {
    this.table = table;
  }

  select(...args: unknown[]) {
    this.operations.push({ method: "select", args });
    return this;
  }

  insert(value: unknown) {
    this.insertValue = value;
    this.operations.push({ method: "insert", args: [value] });
    return this;
  }

  update(value: unknown) {
    this.updateValue = value;
    this.operations.push({ method: "update", args: [value] });
    return this;
  }

  eq(...args: unknown[]) {
    this.operations.push({ method: "eq", args });
    return this;
  }

  gte(...args: unknown[]) {
    this.operations.push({ method: "gte", args });
    return this;
  }

  order(...args: unknown[]) {
    this.operations.push({ method: "order", args });
    return this;
  }

  limit(...args: unknown[]) {
    this.operations.push({ method: "limit", args });
    return this;
  }

  single(...args: unknown[]) {
    this.operations.push({ method: "single", args });
    return this;
  }

  has(method: string) {
    return this.operations.some((operation) => operation.method === method);
  }

  opArgs(method: string) {
    return this.operations
      .filter((operation) => operation.method === method)
      .map((operation) => operation.args);
  }

  then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
    try {
      return Promise.resolve(this.resolver(this)).then(onFulfilled, onRejected);
    } catch (error) {
      return Promise.reject(error).then(onFulfilled, onRejected);
    }
  }
}

function createSupabaseMock(resolver: (query: MockQuery) => unknown) {
  const calls: Array<{ table: string; query: MockQuery }> = [];

  return {
    calls,
    client: {
      from(table: string) {
        const query = new MockQuery(table, resolver);
        calls.push({ table, query });
        return query;
      },
    },
  };
}

Deno.test("executeCreateTrainingSession crée une session planifiée avec le formateur par défaut et les participants", async () => {
  const session = {
    id: "session-1",
    etablissement_id: "eta-1",
    module: "HACCP",
    date_session: "2025-01-15T12:00:00.000Z",
    formateur_id: "user-1",
    statut: "planifiee",
    created_by: "user-1",
  };

  const mock = createSupabaseMock((query) => {
    if (query.table === "sessions_formation") {
      return { data: session, error: null };
    }
    if (query.table === "emargements") {
      return { data: query.insertValue, error: null };
    }
    return { data: null, error: null };
  });

  const result = await executeCreateTrainingSession(
    { supabase: mock.client as never, userId: "user-1" },
    {
      etablissement_id: "eta-1",
      module: "HACCP",
      date: "2025-01-15T12:00:00.000Z",
      participants: ["participant-1", "participant-2"],
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Session créée pour le 15/01/2025");
  assertEquals(result.data.session, session);
  assertEquals(result.data.participants_count, 2);
  assertExists(result.execution_time_ms);

  assertEquals(mock.calls.length, 2);
  assertEquals(mock.calls[0].table, "sessions_formation");
  assertEquals(mock.calls[0].query.insertValue, {
    etablissement_id: "eta-1",
    module: "HACCP",
    date_session: "2025-01-15T12:00:00.000Z",
    formateur_id: "user-1",
    statut: "planifiee",
    created_by: "user-1",
  });
  assertEquals(mock.calls[0].query.opArgs("select"), [[]]);
  assertEquals(mock.calls[0].query.opArgs("single"), [[]]);

  assertEquals(mock.calls[1].table, "emargements");
  assertEquals(mock.calls[1].query.insertValue, [
    { session_id: "session-1", participant_id: "participant-1" },
    { session_id: "session-1", participant_id: "participant-2" },
  ]);
});

Deno.test("executeCreateTrainingSession utilise formateur_id fourni et ne crée pas d'émargements sans participants", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.table === "sessions_formation") {
      return {
        data: {
          id: "session-2",
          formateur_id: "trainer-9",
        },
        error: null,
      };
    }
    return { data: null, error: null };
  });

  const result = await executeCreateTrainingSession(
    { supabase: mock.client as never, userId: "creator-1" },
    {
      etablissement_id: "eta-2",
      module: "Sécurité incendie",
      date: "2025-02-20T09:00:00.000Z",
      formateur_id: "trainer-9",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.participants_count, 0);
  assertEquals(mock.calls.length, 1);
  assertEquals(mock.calls[0].query.insertValue, {
    etablissement_id: "eta-2",
    module: "Sécurité incendie",
    date_session: "2025-02-20T09:00:00.000Z",
    formateur_id: "trainer-9",
    statut: "planifiee",
    created_by: "creator-1",
  });
});

Deno.test("executeCreateTrainingSession retourne une erreur métier si l'insertion Supabase échoue", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.table === "sessions_formation") {
      return { data: null, error: new Error("insert failed") };
    }
    return { data: null, error: null };
  });

  const result = await executeCreateTrainingSession(
    { supabase: mock.client as never, userId: "user-1" },
    {
      etablissement_id: "eta-1",
      module: "HACCP",
      date: "2025-01-15T12:00:00.000Z",
      participants: ["participant-1"],
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "insert failed");
  assertEquals(mock.calls.length, 1);
});

Deno.test("executeRegisterAttendance met à jour un émargement existant", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.table === "emargements" && query.has("update")) {
      return {
        data: {
          id: "emargement-1",
          est_present: true,
          signature: "signature-base64",
        },
        error: null,
      };
    }
    return { data: { id: "emargement-1" }, error: null };
  });

  const result = await executeRegisterAttendance(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-1",
      participant_id: "participant-1",
      signature: "signature-base64",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Présence enregistrée");
  assertEquals(result.data.emargement, {
    id: "emargement-1",
    est_present: true,
    signature: "signature-base64",
  });

  assertEquals(mock.calls.length, 2);
  assertEquals(mock.calls[0].query.opArgs("select"), [["id"]]);
  assertEquals(mock.calls[0].query.opArgs("eq"), [
    ["session_id", "session-1"],
    ["participant_id", "participant-1"],
  ]);

  assertEquals(mock.calls[1].query.updateValue.est_present, true);
  assertEquals(mock.calls[1].query.updateValue.signature, "signature-base64");
  assertExists(mock.calls[1].query.updateValue.signed_at);
  assertEquals(mock.calls[1].query.opArgs("eq"), [["id", "emargement-1"]]);
});

Deno.test("executeRegisterAttendance insère un nouvel émargement si aucun existant n'est trouvé", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.has("insert")) {
      return {
        data: {
          id: "emargement-new",
          ...query.insertValue,
        },
        error: null,
      };
    }
    return { data: null, error: null };
  });

  const result = await executeRegisterAttendance(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-2",
      participant_id: "participant-8",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.emargement.id, "emargement-new");
  assertEquals(mock.calls.length, 2);
  assertEquals(mock.calls[1].query.insertValue.session_id, "session-2");
  assertEquals(mock.calls[1].query.insertValue.participant_id, "participant-8");
  assertEquals(mock.calls[1].query.insertValue.est_present, true);
  assertEquals(mock.calls[1].query.insertValue.signature, undefined);
  assertExists(mock.calls[1].query.insertValue.signed_at);
});

Deno.test("executeRegisterAttendance retourne une erreur si la mise à jour échoue", async () => {
  const mock = createSupabaseMock((query) => {
    if (query.has("update")) {
      return { data: null, error: new Error("update denied") };
    }
    return { data: { id: "emargement-1" }, error: null };
  });

  const result = await executeRegisterAttendance(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-1",
      participant_id: "participant-1",
      signature: "sig",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "update denied");
});

Deno.test("executeGetSessionAttendance calcule les compteurs et le taux de présence arrondi", async () => {
  const emargements = [
    { id: "e1", est_present: true, profiles: { nom: "Martin", prenom: "Alice", email: "alice@example.test" } },
    { id: "e2", est_present: false, profiles: { nom: "Durand", prenom: "Bob", email: "bob@example.test" } },
    { id: "e3", est_present: true, profiles: { nom: "Petit", prenom: "Chloé", email: "chloe@example.test" } },
  ];

  const mock = createSupabaseMock(() => ({ data: emargements, error: null }));

  const result = await executeGetSessionAttendance(
    { supabase: mock.client as never, userId: "user-1" },
    { session_id: "session-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.session_id, "session-1");
  assertEquals(result.data.total_participants, 3);
  assertEquals(result.data.present_count, 2);
  assertEquals(result.data.attendance_rate, 67);
  assertEquals(result.data.participants, emargements);
  assertEquals(mock.calls[0].table, "emargements");
  assertEquals(mock.calls[0].query.opArgs("select"), [["*, profiles(nom, prenom, email)"]]);
  assertEquals(mock.calls[0].query.opArgs("eq"), [["session_id", "session-1"]]);
});

Deno.test("executeGetSessionAttendance retourne un taux à 0 sans participants", async () => {
  const mock = createSupabaseMock(() => ({ data: [], error: null }));

  const result = await executeGetSessionAttendance(
    { supabase: mock.client as never, userId: "user-1" },
    { session_id: "session-empty" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total_participants, 0);
  assertEquals(result.data.present_count, 0);
  assertEquals(result.data.attendance_rate, 0);
});

Deno.test("executeGetTrainingAnalytics agrège sessions, modules, participants et filtres", async () => {
  const sessions = [
    {
      id: "s1",
      module: "HACCP",
      emargements: [{ est_present: true }, { est_present: false }],
    },
    {
      id: "s2",
      module: "HACCP",
      emargements: [{ est_present: true }],
    },
    {
      id: "s3",
      module: "Incendie",
      emargements: [],
    },
    {
      id: "s4",
      emargements: [{ est_present: false }],
    },
  ];

  const mock = createSupabaseMock(() => ({ data: sessions, error: null }));
  const period = "2025-01-01T00:00:00.000Z";

  const result = await executeGetTrainingAnalytics(
    { supabase: mock.client as never, userId: "user-1" },
    { etablissement_id: "eta-1", period },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total_sessions, 4);
  assertEquals(result.data.total_participants, 4);
  assertEquals(result.data.total_present, 2);
  assertEquals(result.data.by_module, {
    HACCP: 2,
    Incendie: 1,
    unknown: 1,
  });
  assertEquals(result.data.average_attendance_rate, 50);

  assertEquals(mock.calls[0].table, "sessions_formation");
  assertEquals(mock.calls[0].query.opArgs("select"), [["*, emargements(est_present)"]]);
  assertEquals(mock.calls[0].query.opArgs("eq"), [["etablissement_id", "eta-1"]]);
  assertEquals(mock.calls[0].query.opArgs("gte"), [["date_session", new Date(period).toISOString()]]);
});

Deno.test("executeGetTrainingAnalytics gère une liste vide", async () => {
  const mock = createSupabaseMock(() => ({ data: [], error: null }));

  const result = await executeGetTrainingAnalytics(
    { supabase: mock.client as never, userId: "user-1" },
    {},
  );

  assertEquals(result.success, true);
  assertEquals(result.data.total_sessions, 0);
  assertEquals(result.data.total_participants, 0);
  assertEquals(result.data.total_present, 0);
  assertEquals(result.data.by_module, {});
  assertEquals(result.data.average_attendance_rate, 0);
  assertEquals(mock.calls[0].query.opArgs("eq"), []);
  assertEquals(mock.calls[0].query.opArgs("gte"), []);
});

Deno.test("executeManageCertification liste les certifications d'un profil", async () => {
  const certifications = [
    { id: "cert-1", profile_id: "profile-1", nom: "SST" },
    { id: "cert-2", profile_id: "profile-1", nom: "HACCP" },
  ];

  const mock = createSupabaseMock(() => ({ data: certifications, error: null }));

  const result = await executeManageCertification(
    { supabase: mock.client as never, userId: "user-1" },
    { action: "list", profile_id: "profile-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.certifications, certifications);
  assertEquals(result.data.count, 2);
  assertEquals(mock.calls[0].table, "employee_certifications");
  assertEquals(mock.calls[0].query.opArgs("select"), [["*"]]);
  assertEquals(mock.calls[0].query.opArgs("eq"), [["profile_id", "profile-1"]]);
});

Deno.test("executeManageCertification ajoute une certification avec les données complémentaires", async () => {
  const mock = createSupabaseMock((query) => ({
    data: {
      id: "cert-3",
      ...query.insertValue,
    },
    error: null,
  }));

  const result = await executeManageCertification(
    { supabase: mock.client as never, userId: "user-1" },
    {
      action: "add",
      profile_id: "profile-2",
      certification: "SSIAP 1",
      data: {
        date_obtention: "2025-03-01",
        date_expiration: "2028-03-01",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Certification ajoutée");
  assertEquals(result.data.certification, {
    id: "cert-3",
    profile_id: "profile-2",
    nom: "SSIAP 1",
    date_obtention: "2025-03-01",
    date_expiration: "2028-03-01",
  });
  assertEquals(mock.calls[0].query.insertValue, {
    profile_id: "profile-2",
    nom: "SSIAP 1",
    date_obtention: "2025-03-01",
    date_expiration: "2028-03-01",
  });
  assertEquals(mock.calls[0].query.opArgs("select"), [[]]);
  assertEquals(mock.calls[0].query.opArgs("single"), [[]]);
});

Deno.test("executeManageCertification retourne un message explicite pour une action non implémentée", async () => {
  const mock = createSupabaseMock(() => {
    throw new Error("la base ne devrait pas être appelée");
  });

  const result = await executeManageCertification(
    { supabase: mock.client as never, userId: "user-1" },
    { action: "renew", profile_id: "profile-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Action renew not implemented");
  assertEquals(mock.calls.length, 0);
});

Deno.test("executeSendSatisfactionSurvey insère les enquêtes solution pour chaque participant", async () => {
  const mock = createSupabaseMock(() => ({ data: null, error: null }));

  const result = await executeSendSatisfactionSurvey(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-1",
      type: "solution",
      participant_ids: ["participant-1", "participant-2", "participant-3"],
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Enquêtes envoyées à 3 participants");
  assertEquals(result.data.type, "solution");
  assertEquals(mock.calls.length, 1);
  assertEquals(mock.calls[0].table, "enquetes_satisfaction_solution");
  assertEquals(mock.calls[0].query.insertValue, [
    { session_id: "session-1", participant_id: "participant-1", statut: "envoyee" },
    { session_id: "session-1", participant_id: "participant-2", statut: "envoyee" },
    { session_id: "session-1", participant_id: "participant-3", statut: "envoyee" },
  ]);
});

Deno.test("executeSendSatisfactionSurvey utilise la table formation par défaut et n'appelle pas Supabase sans participants", async () => {
  const mock = createSupabaseMock(() => {
    throw new Error("aucun insert attendu");
  });

  const result = await executeSendSatisfactionSurvey(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-2",
      type: "formation",
      participant_ids: [],
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Enquêtes envoyées à 0 participants");
  assertEquals(result.data.type, "formation");
  assertEquals(mock.calls.length, 0);
});

Deno.test("executeSendSatisfactionSurvey retourne une erreur si l'insert échoue", async () => {
  const mock = createSupabaseMock(() => ({ data: null, error: new Error("survey insert failed") }));

  const result = await executeSendSatisfactionSurvey(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-3",
      type: "formation",
      participant_ids: ["participant-1"],
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "survey insert failed");
  assertEquals(mock.calls[0].table, "enquetes_satisfaction_formation");
});

Deno.test("executeGetSatisfactionResults construit la requête filtrée, ordonnée et limitée", async () => {
  const results = [
    { id: "survey-2", session_id: "session-1", score: 5 },
    { id: "survey-1", session_id: "session-1", score: 4 },
  ];

  const mock = createSupabaseMock(() => ({ data: results, error: null }));

  const result = await executeGetSatisfactionResults(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-1",
      type: "formation",
      etablissement_id: "eta-1",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.results, results);
  assertEquals(result.data.count, 2);
  assertEquals(mock.calls.length, 1);
  assertEquals(mock.calls[0].table, "enquetes_satisfaction_formation");
  assertEquals(mock.calls[0].query.opArgs("select"), [["*"]]);
  assertEquals(mock.calls[0].query.opArgs("eq"), [
    ["session_id", "session-1"],
    ["etablissement_id", "eta-1"],
  ]);
  assertEquals(mock.calls[0].query.opArgs("order"), [["created_at", { ascending: false }]]);
  assertEquals(mock.calls[0].query.opArgs("limit"), [[100]]);
});

Deno.test("executeGetSatisfactionResults utilise la table solution quand le type vaut solution", async () => {
  const mock = createSupabaseMock(() => ({ data: [{ id: "survey-solution-1" }], error: null }));

  const result = await executeGetSatisfactionResults(
    { supabase: mock.client as never, userId: "user-1" },
    {
      type: "solution",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.count, 1);
  assertEquals(mock.calls[0].table, "enquetes_satisfaction_solution");
  assertEquals(mock.calls[0].query.opArgs("eq"), []);
  assertEquals(mock.calls[0].query.opArgs("order"), [["created_at", { ascending: false }]]);
  assertEquals(mock.calls[0].query.opArgs("limit"), [[100]]);
});

Deno.test("executeGetSatisfactionResults retourne une erreur métier si la lecture échoue", async () => {
  const mock = createSupabaseMock(() => ({ data: null, error: new Error("read failed") }));

  const result = await executeGetSatisfactionResults(
    { supabase: mock.client as never, userId: "user-1" },
    {
      session_id: "session-1",
      type: "formation",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "read failed");
});

Deno.test("helpers de test: MockQuery expose les erreurs synchrones sous forme de rejet", async () => {
  const query = new MockQuery("table", () => {
    throw new Error("resolver exploded");
  });

  await assertRejects(
    () => Promise.resolve(query),
    Error,
    "resolver exploded",
  );
});

Deno.test("helpers de test: assertThrows vérifie les erreurs synchrones locales", () => {
  assertThrows(
    () => {
      throw new Error("sync exploded");
    },
    Error,
    "sync exploded",
  );
});