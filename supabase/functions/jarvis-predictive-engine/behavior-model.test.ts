import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildUserBehaviorProfile,
  detectActionSequences,
  predictNextActions,
  saveUserBehaviorProfile,
} from "./behavior-model.ts";

function localTimeIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
): string {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString();
}

function assistantTools(...names: string[]) {
  return {
    role: "assistant",
    tool_calls: names.map((name) => ({ function: { name } })),
  };
}

function createConversationData() {
  return [
    {
      created_at: localTimeIso(2024, 0, 1, 9),
      messages: [
        { role: "user", content: "Prépare mon point du matin" },
        assistantTools("query_database", "generate_report", "send_email"),
      ],
    },
    {
      created_at: localTimeIso(2024, 0, 8, 9),
      messages: [
        { role: "user", content: "Même routine" },
        assistantTools("query_database", "generate_report", "send_email"),
      ],
    },
    {
      created_at: localTimeIso(2024, 0, 15, 9),
      messages: [
        { role: "user", content: "Lance la routine hebdo" },
        assistantTools("query_database", "generate_report", "send_email"),
      ],
    },
  ];
}

function createSupabaseStub(tableData: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const data = tableData[table] ?? [];
      const query = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        order() {
          return Promise.resolve({ data, error: null });
        },
        in() {
          return Promise.resolve({ data, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

Deno.test("detectActionSequences détecte les paires et triplets récurrents avec métriques", async () => {
  const conversations = createConversationData();
  const supabase = createSupabaseStub({
    jarvis_conversations: conversations,
  });

  const sequences = await detectActionSequences(supabase as any, "user-123", 90);

  const queryThenReport = sequences.find((seq) => seq.id === "query_database_generate_report");
  assertExists(queryThenReport);
  assertEquals(queryThenReport.actions, ["query_database", "generate_report"]);
  assertEquals(queryThenReport.frequency, 3);
  assertEquals(queryThenReport.avgGapSeconds, 604800);
  assertEquals(queryThenReport.confidence, 0.36);
  assertEquals(queryThenReport.lastObserved, localTimeIso(2024, 0, 15, 9));
  assertEquals(queryThenReport.contextTriggers.dayOfWeek, [
    new Date(localTimeIso(2024, 0, 1, 9)).getDay(),
  ]);
  assertEquals(queryThenReport.contextTriggers.hourOfDay, [
    new Date(localTimeIso(2024, 0, 1, 9)).getHours(),
  ]);

  const triplet = sequences.find((seq) =>
    seq.id === "query_database_generate_report_send_email"
  );
  assertExists(triplet);
  assertEquals(triplet.actions, ["query_database", "generate_report", "send_email"]);
  assertEquals(triplet.frequency, 3);
});

Deno.test("detectActionSequences retourne une liste vide sans conversations", async () => {
  const supabase = createSupabaseStub({
    jarvis_conversations: [],
  });

  const sequences = await detectActionSequences(supabase as any, "user-empty");

  assertEquals(sequences, []);
});

Deno.test("detectActionSequences ignore les séquences observées moins de trois fois", async () => {
  const supabase = createSupabaseStub({
    jarvis_conversations: [
      {
        created_at: localTimeIso(2024, 1, 5, 10),
        messages: [assistantTools("check_emails", "create_task")],
      },
      {
        created_at: localTimeIso(2024, 1, 6, 10),
        messages: [assistantTools("check_emails", "create_task")],
      },
    ],
  });

  const sequences = await detectActionSequences(supabase as any, "user-low-signal");

  assertEquals(sequences, []);
});

Deno.test("detectActionSequences propage une erreur de requête Supabase", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        order() {
          return Promise.reject(new Error("db unavailable"));
        },
      };
    },
  };

  await assertRejects(
    () => detectActionSequences(supabase as any, "user-123"),
    Error,
    "db unavailable",
  );
});

Deno.test("buildUserBehaviorProfile construit le profil comportemental complet", async () => {
  const learningData = [
    { action_type: "create_task", accepted: true, recorded_at: localTimeIso(2024, 2, 1, 8) },
    { action_type: "create_task", accepted: true, recorded_at: localTimeIso(2024, 2, 2, 8) },
    { action_type: "create_task", accepted: true, recorded_at: localTimeIso(2024, 2, 3, 8) },
    { action_type: "send_email", accepted: false, recorded_at: localTimeIso(2024, 2, 4, 14) },
    { action_type: "send_email", accepted: false, recorded_at: localTimeIso(2024, 2, 5, 14) },
    { action_type: "generate_report", accepted: true, recorded_at: localTimeIso(2024, 2, 6, 8) },
  ];

  const memoryData = [
    { key: "style_prefere", value: "Merci d'utiliser un ton formel." },
    { key: "réponse_format", value: "Je préfère un résumé détaillé." },
  ];

  const supabase = createSupabaseStub({
    jarvis_conversations: createConversationData(),
    jarvis_learning_data: learningData,
    jarvis_user_memory: memoryData,
  });

  const profile = await buildUserBehaviorProfile(supabase as any, "user-profile");

  assertEquals(profile.userId, "user-profile");
  assertEquals(profile.communicationStyle, "formal");
  assertEquals(profile.responsePreference, "detailed");
  assertEquals(profile.avgSessionDurationMinutes, 15);
  assertEquals(profile.topActions, [
    { action: "create_task", count: 3 },
    { action: "send_email", count: 2 },
    { action: "generate_report", count: 1 },
  ]);
  assertEquals(profile.avoidedActions, ["send_email"]);
  assertEquals(profile.peakProductivityHours, [8, 14]);

  const createTaskPreference = profile.preferredActionTimes.find((pref) =>
    pref.action === "create_task"
  );
  assertExists(createTaskPreference);
  assertEquals(createTaskPreference.preferredHours, [8]);

  const sendEmailPreference = profile.preferredActionTimes.find((pref) =>
    pref.action === "send_email"
  );
  assertExists(sendEmailPreference);
  assertEquals(sendEmailPreference.preferredHours, [14]);

  assertEquals(profile.primaryWorkPatterns.length, 3);
  assertEquals(profile.primaryWorkPatterns[0].frequency, 3);
});

Deno.test("predictNextActions priorise la suite logique, le contexte et les heures préférées", () => {
  const profile = {
    userId: "user-predict",
    primaryWorkPatterns: [
      {
        id: "check_emails_create_task",
        actions: ["check_emails", "create_task"],
        frequency: 12,
        avgGapSeconds: 180,
        confidence: 0.7,
        lastObserved: localTimeIso(2024, 3, 1, 9),
        contextTriggers: {
          dayOfWeek: [1],
          hourOfDay: [9],
        },
      },
      {
        id: "query_database_generate_report",
        actions: ["query_database", "generate_report"],
        frequency: 8,
        avgGapSeconds: 300,
        confidence: 0.6,
        lastObserved: localTimeIso(2024, 3, 1, 10),
        contextTriggers: {
          dayOfWeek: [2],
          hourOfDay: [10],
        },
      },
    ],
    preferredActionTimes: [
      { action: "create_task", preferredHours: [9] },
      { action: "sync_qonto_transactions", preferredHours: [9] },
    ],
    communicationStyle: "casual",
    responsePreference: "actionable",
    topActions: [],
    avgSessionDurationMinutes: 15,
    peakProductivityHours: [9],
    avoidedActions: [],
  };

  const predictions = predictNextActions(profile as any, {
    hour: 9,
    dayOfWeek: 1,
    lastAction: "check_emails",
  });

  assertEquals(predictions.length, 3);
  assertEquals(predictions[0], {
    action: "create_task",
    probability: 0.95,
    reason: 'Suite logique après "check_emails"',
    contextMatch: 1,
    executableCommand: "Crée une nouvelle tâche",
  });
  assertEquals(predictions[1], {
    action: "check_emails",
    probability: 0.9,
    reason: "Pattern habituel à cette heure/jour",
    contextMatch: 0.6,
    executableCommand: "Vérifie mes emails non lus",
  });
  assertEquals(predictions[2], {
    action: "sync_qonto_transactions",
    probability: 0.5,
    reason: "Action fréquente à 9h",
    contextMatch: 0.5,
    executableCommand: "Synchronise les transactions Qonto",
  });
});

Deno.test("predictNextActions fournit une commande de repli pour une action inconnue", () => {
  const profile = {
    userId: "user-custom",
    primaryWorkPatterns: [],
    preferredActionTimes: [
      { action: "custom_action", preferredHours: [16] },
    ],
    communicationStyle: "concise",
    responsePreference: "brief",
    topActions: [],
    avgSessionDurationMinutes: 15,
    peakProductivityHours: [16],
    avoidedActions: [],
  };

  const predictions = predictNextActions(profile as any, {
    hour: 16,
    dayOfWeek: 4,
  });

  assertEquals(predictions, [
    {
      action: "custom_action",
      probability: 0.5,
      reason: "Action fréquente à 16h",
      contextMatch: 0.5,
      executableCommand: "Exécute custom_action",
    },
  ]);
});

Deno.test("predictNextActions lance une TypeError avec un profil absent", () => {
  assertThrows(
    () => predictNextActions(undefined as any, { hour: 9, dayOfWeek: 1 }),
    TypeError,
  );
});

Deno.test("saveUserBehaviorProfile upsert chaque séquence principale", async () => {
  const upserts: Array<{ table: string; payload: unknown; options: unknown }> = [];
  const supabase = {
    from(table: string) {
      return {
        upsert(payload: unknown, options: unknown) {
          upserts.push({ table, payload, options });
          return Promise.resolve({ data: payload, error: null });
        },
      };
    },
  };

  await saveUserBehaviorProfile(supabase as any, {
    userId: "user-save",
    primaryWorkPatterns: [
      {
        id: "query_database_generate_report",
        actions: ["query_database", "generate_report"],
        frequency: 5,
        avgGapSeconds: 240,
        confidence: 0.4,
        lastObserved: "2024-04-01T09:00:00.000Z",
        contextTriggers: {
          dayOfWeek: [1],
          hourOfDay: [9],
        },
      },
      {
        id: "check_pipeline_send_email",
        actions: ["check_pipeline", "send_email"],
        frequency: 4,
        avgGapSeconds: 420,
        confidence: 0.38,
        lastObserved: "2024-04-02T11:00:00.000Z",
        contextTriggers: {
          dayOfWeek: [2],
          hourOfDay: [11],
        },
      },
    ],
    preferredActionTimes: [],
    communicationStyle: "casual",
    responsePreference: "actionable",
    topActions: [],
    avgSessionDurationMinutes: 15,
    peakProductivityHours: [],
    avoidedActions: [],
  });

  assertEquals(upserts, [
    {
      table: "jarvis_user_behavior_model",
      payload: {
        user_id: "user-save",
        action_sequence: ["query_database", "generate_report"],
        frequency: 5,
        avg_time_gap_seconds: 240,
        context_triggers: {
          dayOfWeek: [1],
          hourOfDay: [9],
        },
        confidence: 0.4,
        last_observed: "2024-04-01T09:00:00.000Z",
      },
      options: {
        onConflict: "user_id,action_sequence",
      },
    },
    {
      table: "jarvis_user_behavior_model",
      payload: {
        user_id: "user-save",
        action_sequence: ["check_pipeline", "send_email"],
        frequency: 4,
        avg_time_gap_seconds: 420,
        context_triggers: {
          dayOfWeek: [2],
          hourOfDay: [11],
        },
        confidence: 0.38,
        last_observed: "2024-04-02T11:00:00.000Z",
      },
      options: {
        onConflict: "user_id,action_sequence",
      },
    },
  ]);
});