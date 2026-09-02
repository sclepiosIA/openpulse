import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  analyzeSentiment,
  applyThresholdAdjustments,
  calculateThresholdAdjustments,
  detectUserCorrections,
  generateLearnedPreferences,
} from "./active-learning.ts";

class MockSupabaseQuery {
  table: string;
  options: any;
  calls: any[];
  upserts: any[];

  constructor(table: string, options: any, calls: any[], upserts: any[]) {
    this.table = table;
    this.options = options;
    this.calls = calls;
    this.upserts = upserts;
  }

  select(columns: string) {
    this.calls.push({ table: this.table, method: "select", columns });
    return this;
  }

  eq(column: string, value: unknown) {
    this.calls.push({ table: this.table, method: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.calls.push({ table: this.table, method: "gte", column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.calls.push({ table: this.table, method: "order", column, options });
    return this;
  }

  limit(count: number) {
    this.calls.push({ table: this.table, method: "limit", count });
    return this;
  }

  upsert(payload: unknown, options?: unknown) {
    this.calls.push({ table: this.table, method: "upsert", payload, options });
    this.upserts.push({ table: this.table, payload, options });

    if (this.options.upsertError) {
      return Promise.reject(this.options.upsertError);
    }

    return Promise.resolve({ data: payload, error: null });
  }

  then(onfulfilled?: any, onrejected?: any) {
    const data = this.options.selectDataByTable?.[this.table] ?? [];
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function createMockSupabase(options: any = {}) {
  const calls: any[] = [];
  const upserts: any[] = [];

  return {
    calls,
    upserts,
    from(table: string) {
      calls.push({ table, method: "from" });
      return new MockSupabaseQuery(table, options, calls, upserts);
    },
  };
}

function findByActionType(items: any[], actionType: string) {
  return items.find((item) => item.actionType === actionType);
}

Deno.test("analyzeSentiment detects positive, negative, mixed and neutral responses", () => {
  assertEquals(analyzeSentiment("Merci, c'est parfait et super."), {
    sentiment: "positive",
    confidence: 0.8,
  });

  assertEquals(analyzeSentiment("Non, c'est incorrect, il y a un problème."), {
    sentiment: "negative",
    confidence: 0.8,
  });

  assertEquals(analyzeSentiment("Oui mais non, pas exactement."), {
    sentiment: "neutral",
    confidence: 0.5,
  });

  assertEquals(analyzeSentiment("Je vais regarder cela demain."), {
    sentiment: "neutral",
    confidence: 0.6,
  });
});

Deno.test("analyzeSentiment accepts non-string values by JavaScript coercion", () => {
  assertEquals(analyzeSentiment(undefined as any), {
    sentiment: "neutral",
    confidence: 0.6,
  });

  assertThrows(
    () => analyzeSentiment({ toString: () => {
      throw new Error("cannot stringify");
    } } as any),
    Error,
    "cannot stringify",
  );
});

Deno.test("detectUserCorrections extracts repeated tone, format and auto-action correction patterns", async () => {
  const conversations = [
    {
      updated_at: "2025-01-03T10:00:00.000Z",
      messages: [
        { role: "assistant", content: "Bonjour, voici mon email." },
        { role: "user", content: "Peux-tu le rendre plus formel s’il te plaît ?" },
        { role: "assistant", content: "Voici une réponse avec beaucoup de détails inutiles." },
        { role: "user", content: "plus court, merci." },
        { role: "assistant", content: "Action: je vais envoyer cet email maintenant." },
        { role: "user", content: "Non, attends ma validation." },
      ],
    },
    {
      updated_at: "2025-01-02T09:00:00.000Z",
      messages: [
        { role: "assistant", content: "Deuxième email à corriger." },
        { role: "user", content: "Merci de le rendre plus formel." },
        { role: "assistant", content: "Deuxième réponse beaucoup trop longue." },
        { role: "user", content: "plus court s'il te plaît." },
        { role: "assistant", content: "Action: je crée la tâche tout de suite." },
        { role: "user", content: "attends, pas maintenant." },
      ],
    },
  ];

  const supabase = createMockSupabase({
    selectDataByTable: {
      jarvis_conversations: conversations,
    },
  });

  const patterns = await detectUserCorrections(supabase as any, "user-123");

  assertEquals(patterns.length, 3);

  const emailTone = findByActionType(patterns, "email_tone");
  assertExists(emailTone);
  assertEquals(emailTone.frequency, 2);
  assertEquals(emailTone.correctedBehavior, "Ton formel");
  assertEquals(emailTone.lastObserved, "2025-01-03T10:00:00.000Z");
  assertEquals(emailTone.confidence, 0.7);

  const responseFormat = findByActionType(patterns, "response_format");
  assertExists(responseFormat);
  assertEquals(responseFormat.frequency, 2);
  assertEquals(responseFormat.correctedBehavior, "Réponses courtes");
  assertEquals(responseFormat.confidence, 0.7);

  const autoAction = findByActionType(patterns, "auto_action");
  assertExists(autoAction);
  assertEquals(autoAction.frequency, 2);
  assertEquals(autoAction.correctedBehavior, "attends, pas maintenant.");
  assertEquals(autoAction.confidence, 0.7);

  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_conversations" &&
      call.method === "select" &&
      call.columns === "messages, updated_at"
    ),
  );
  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_conversations" &&
      call.method === "eq" &&
      call.column === "user_id" &&
      call.value === "user-123"
    ),
  );
  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_conversations" &&
      call.method === "gte" &&
      call.column === "updated_at" &&
      typeof call.value === "string"
    ),
  );
  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_conversations" &&
      call.method === "limit" &&
      call.count === 100
    ),
  );
});

Deno.test("detectUserCorrections ignores correction patterns with fewer than two occurrences", async () => {
  const supabase = createMockSupabase({
    selectDataByTable: {
      jarvis_conversations: [
        {
          updated_at: "2025-01-03T10:00:00.000Z",
          messages: [
            { role: "assistant", content: "Voici un email." },
            { role: "user", content: "plus formel, merci." },
          ],
        },
      ],
    },
  });

  const patterns = await detectUserCorrections(supabase as any, "user-123");

  assertEquals(patterns, []);
});

Deno.test("detectUserCorrections tolerates missing conversations and missing messages arrays", async () => {
  const supabaseWithoutRows = createMockSupabase({
    selectDataByTable: {
      jarvis_conversations: null,
    },
  });

  assertEquals(await detectUserCorrections(supabaseWithoutRows as any, "user-123"), []);

  const supabaseWithMissingMessages = createMockSupabase({
    selectDataByTable: {
      jarvis_conversations: [
        { updated_at: "2025-01-03T10:00:00.000Z" },
        { updated_at: "2025-01-02T10:00:00.000Z", messages: null },
      ],
    },
  });

  assertEquals(await detectUserCorrections(supabaseWithMissingMessages as any, "user-123"), []);
});

Deno.test("generateLearnedPreferences maps confident corrections to preferences and upserts them", async () => {
  const supabase = createMockSupabase();

  const preferences = await generateLearnedPreferences(supabase as any, "user-123", [
    {
      actionType: "email_tone",
      originalBehavior: "Email initial trop familier",
      correctedBehavior: "Ton formel",
      frequency: 3,
      lastObserved: "2025-01-03T10:00:00.000Z",
      confidence: 0.75,
    },
    {
      actionType: "response_format",
      originalBehavior: "Réponse trop longue",
      correctedBehavior: "Réponses courtes",
      frequency: 2,
      lastObserved: "2025-01-02T10:00:00.000Z",
      confidence: 0.6,
    },
    {
      actionType: "auto_action",
      originalBehavior: "Action exécutée sans accord",
      correctedBehavior: "attends, pas maintenant.",
      frequency: 5,
      lastObserved: "2025-01-01T10:00:00.000Z",
      confidence: 0.9,
    },
    {
      actionType: "email_tone",
      originalBehavior: "Confiance insuffisante",
      correctedBehavior: "Ton informel",
      frequency: 1,
      lastObserved: "2025-01-01T09:00:00.000Z",
      confidence: 0.59,
    },
  ]);

  assertEquals(preferences.length, 3);

  assertEquals(preferences[0], {
    key: "preferred_email_tone",
    value: "Ton formel",
    source: "corrected",
    confidence: 0.75,
    examples: ["Email initial trop familier"],
    lastUpdated: "2025-01-03T10:00:00.000Z",
  });

  assertEquals(preferences[1], {
    key: "preferred_response_format",
    value: "Réponses courtes",
    source: "corrected",
    confidence: 0.6,
    examples: ["Réponse trop longue"],
    lastUpdated: "2025-01-02T10:00:00.000Z",
  });

  assertEquals(preferences[2], {
    key: "auto_action_preference",
    value: "Demander confirmation avant exécution",
    source: "corrected",
    confidence: 0.9,
    examples: ["Action exécutée sans accord"],
    lastUpdated: "2025-01-01T10:00:00.000Z",
  });

  assertEquals(supabase.upserts.length, 3);
  assertEquals(supabase.upserts.map((entry: any) => entry.table), [
    "jarvis_user_memory",
    "jarvis_user_memory",
    "jarvis_user_memory",
  ]);

  assertEquals(supabase.upserts[0].payload.user_id, "user-123");
  assertEquals(supabase.upserts[0].payload.category, "preference");
  assertEquals(supabase.upserts[0].payload.key, "preferred_email_tone");
  assertEquals(supabase.upserts[0].payload.value, "Ton formel");
  assertEquals(supabase.upserts[0].payload.importance, 4);
  assertEquals(supabase.upserts[0].payload.metadata, {
    source: "corrected",
    confidence: 0.75,
    examples: ["Email initial trop familier"],
    auto_learned: true,
  });
  assertEquals(supabase.upserts[0].options, {
    onConflict: "user_id,category,key",
  });

  assertEquals(supabase.upserts[2].payload.importance, 5);
});

Deno.test("generateLearnedPreferences ignores low-confidence and unknown correction types", async () => {
  const supabase = createMockSupabase();

  const preferences = await generateLearnedPreferences(supabase as any, "user-123", [
    {
      actionType: "email_tone",
      originalBehavior: "Email initial",
      correctedBehavior: "Ton formel",
      frequency: 1,
      lastObserved: "2025-01-03T10:00:00.000Z",
      confidence: 0.59,
    },
    {
      actionType: "unknown_action",
      originalBehavior: "Comportement inconnu",
      correctedBehavior: "Correction inconnue",
      frequency: 10,
      lastObserved: "2025-01-03T10:00:00.000Z",
      confidence: 0.95,
    },
  ]);

  assertEquals(preferences, []);
  assertEquals(supabase.upserts.length, 0);
});

Deno.test("generateLearnedPreferences rejects when persistence fails", async () => {
  const supabase = createMockSupabase({
    upsertError: new Error("upsert failed"),
  });

  await assertRejects(
    () =>
      generateLearnedPreferences(supabase as any, "user-123", [
        {
          actionType: "email_tone",
          originalBehavior: "Email initial",
          correctedBehavior: "Ton formel",
          frequency: 2,
          lastObserved: "2025-01-03T10:00:00.000Z",
          confidence: 0.8,
        },
      ]),
    Error,
    "upsert failed",
  );
});

Deno.test("calculateThresholdAdjustments computes thresholds from acceptance rates and sample sizes", async () => {
  const learningData = [
    ...Array.from({ length: 10 }, () => ({ action_type: "send_email", accepted: true })),
    ...Array.from({ length: 9 }, () => ({ action_type: "create_task", accepted: true })),
    { action_type: "create_task", accepted: false },
    ...Array.from({ length: 4 }, () => ({ action_type: "schedule_meeting", accepted: true })),
    ...Array.from({ length: 6 }, () => ({ action_type: "schedule_meeting", accepted: false })),
    ...Array.from({ length: 6 }, () => ({ action_type: "update_entity_status", accepted: true })),
    ...Array.from({ length: 4 }, () => ({ action_type: "update_entity_status", accepted: false })),
    ...Array.from({ length: 7 }, () => ({ action_type: "archive_document", accepted: true })),
    ...Array.from({ length: 3 }, () => ({ action_type: "archive_document", accepted: false })),
    ...Array.from({ length: 4 }, () => ({ action_type: "too_few_samples", accepted: true })),
  ];

  const supabase = createMockSupabase({
    selectDataByTable: {
      jarvis_learning_data: learningData,
    },
  });

  const adjustments = await calculateThresholdAdjustments(supabase as any, "user-123");

  assertEquals(adjustments.length, 5);

  assertEquals(findByActionType(adjustments, "send_email"), {
    actionType: "send_email",
    currentThreshold: 0.9,
    suggestedThreshold: 0.7,
    basedOnSamples: 10,
    acceptanceRate: 1,
  });

  assertEquals(findByActionType(adjustments, "create_task"), {
    actionType: "create_task",
    currentThreshold: 0.6,
    suggestedThreshold: 0.5,
    basedOnSamples: 10,
    acceptanceRate: 0.9,
  });

  assertEquals(findByActionType(adjustments, "schedule_meeting"), {
    actionType: "schedule_meeting",
    currentThreshold: 0.8,
    suggestedThreshold: 0.95,
    basedOnSamples: 10,
    acceptanceRate: 0.4,
  });

  assertEquals(findByActionType(adjustments, "update_entity_status"), {
    actionType: "update_entity_status",
    currentThreshold: 0.7,
    suggestedThreshold: 0.7999999999999999,
    basedOnSamples: 10,
    acceptanceRate: 0.6,
  });

  assertEquals(findByActionType(adjustments, "archive_document"), {
    actionType: "archive_document",
    currentThreshold: 0.7,
    suggestedThreshold: 0.7,
    basedOnSamples: 10,
    acceptanceRate: 0.7,
  });

  assertEquals(findByActionType(adjustments, "too_few_samples"), undefined);

  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_learning_data" &&
      call.method === "select" &&
      call.columns === "action_type, accepted"
    ),
  );
  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_learning_data" &&
      call.method === "eq" &&
      call.column === "user_id" &&
      call.value === "user-123"
    ),
  );
  assertExists(
    supabase.calls.find((call: any) =>
      call.table === "jarvis_learning_data" &&
      call.method === "gte" &&
      call.column === "recorded_at" &&
      typeof call.value === "string"
    ),
  );
});

Deno.test("calculateThresholdAdjustments caps lower and upper suggested thresholds", async () => {
  const learningData = [
    ...Array.from({ length: 20 }, () => ({ action_type: "create_task", accepted: true })),
    ...Array.from({ length: 20 }, () => ({ action_type: "send_email", accepted: false })),
  ];

  const supabase = createMockSupabase({
    selectDataByTable: {
      jarvis_learning_data: learningData,
    },
  });

  const adjustments = await calculateThresholdAdjustments(supabase as any, "user-123");

  assertEquals(findByActionType(adjustments, "create_task"), {
    actionType: "create_task",
    currentThreshold: 0.6,
    suggestedThreshold: 0.39999999999999997,
    basedOnSamples: 20,
    acceptanceRate: 1,
  });

  assertEquals(findByActionType(adjustments, "send_email"), {
    actionType: "send_email",
    currentThreshold: 0.9,
    suggestedThreshold: 0.95,
    basedOnSamples: 20,
    acceptanceRate: 0,
  });
});

Deno.test("calculateThresholdAdjustments returns an empty list when no learning data exists", async () => {
  const supabase = createMockSupabase({
    selectDataByTable: {
      jarvis_learning_data: [],
    },
  });

  const adjustments = await calculateThresholdAdjustments(supabase as any, "user-123");

  assertEquals(adjustments, []);
});

Deno.test("applyThresholdAdjustments upserts only thresholds that actually changed", async () => {
  const supabase = createMockSupabase();

  await applyThresholdAdjustments(supabase as any, "user-123", [
    {
      actionType: "send_email",
      currentThreshold: 0.9,
      suggestedThreshold: 0.7,
      basedOnSamples: 10,
      acceptanceRate: 1,
    },
    {
      actionType: "create_task",
      currentThreshold: 0.6,
      suggestedThreshold: 0.6,
      basedOnSamples: 10,
      acceptanceRate: 0.75,
    },
    {
      actionType: "schedule_meeting",
      currentThreshold: 0.8,
      suggestedThreshold: 0.95,
      basedOnSamples: 10,
      acceptanceRate: 0.4,
    },
  ]);

  assertEquals(supabase.upserts.length, 1);
  assertEquals(supabase.upserts[0].table, "jarvis_settings");
  assertEquals(supabase.upserts[0].payload.user_id, "user-123");
  assertEquals(supabase.upserts[0].payload.custom_thresholds, {
    send_email: 0.7,
    schedule_meeting: 0.95,
  });
  assertEquals(supabase.upserts[0].options, {
    onConflict: "user_id",
  });
  assertEquals(typeof supabase.upserts[0].payload.updated_at, "string");
});

Deno.test("applyThresholdAdjustments does not persist anything when all thresholds are unchanged", async () => {
  const supabase = createMockSupabase();

  await applyThresholdAdjustments(supabase as any, "user-123", [
    {
      actionType: "send_email",
      currentThreshold: 0.9,
      suggestedThreshold: 0.9,
      basedOnSamples: 10,
      acceptanceRate: 0.8,
    },
  ]);

  assertEquals(supabase.upserts.length, 0);
});

Deno.test("applyThresholdAdjustments rejects when settings persistence fails", async () => {
  const supabase = createMockSupabase({
    upsertError: new Error("settings upsert failed"),
  });

  await assertRejects(
    () =>
      applyThresholdAdjustments(supabase as any, "user-123", [
        {
          actionType: "send_email",
          currentThreshold: 0.9,
          suggestedThreshold: 0.7,
          basedOnSamples: 10,
          acceptanceRate: 1,
        },
      ]),
    Error,
    "settings upsert failed",
  );
});