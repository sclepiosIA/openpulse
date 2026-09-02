import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const moduleUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl);
}

function extractFunctionSource(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}`);
  if (start === -1) {
    throw new Error(`Function ${functionName} not found`);
  }

  const firstBrace = source.indexOf("{", start);
  if (firstBrace === -1) {
    throw new Error(`Function ${functionName} has no body`);
  }

  let depth = 0;
  for (let i = firstBrace; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`Function ${functionName} body is not closed`);
}

function extractFunctionBody(source: string, functionName: string): string {
  const functionSource = extractFunctionSource(source, functionName);
  const firstBrace = functionSource.indexOf("{");
  return functionSource.slice(firstBrace + 1, -1);
}

function extractSwitchBlock(source: string, discriminant: string): string {
  const switchMatch = source.match(new RegExp(`switch\\s*\\(\\s*${discriminant}\\s*\\)\\s*\\{`));
  if (!switchMatch || switchMatch.index === undefined) {
    throw new Error(`switch (${discriminant}) not found`);
  }

  const firstBrace = source.indexOf("{", switchMatch.index);
  let depth = 0;
  for (let i = firstBrace; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) {
      return source.slice(firstBrace + 1, i);
    }
  }

  throw new Error(`switch (${discriminant}) body is not closed`);
}

function stripTypeScriptForFunctionEvaluation(snippet: string): string {
  return snippet
    .replace(
      /([,(]\s*[A-Za-z_$][\w$]*)\??\s*:\s*(?:any|string|number|boolean|Record<string,\s*unknown>|Record<string,\s*string>|CollectivePattern\[\])(?=\s*[,)=])/g,
      "$1",
    )
    .replace(
      /\)\s*:\s*(?:Promise<[^>]+>|string|number|boolean|void|any\[\])\s*\{/g,
      ") {",
    )
    .replace(
      /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=;]+=/g,
      "$1 $2 =",
    );
}

async function loadRecommendationHelpers(): Promise<{
  getPatternTitle: (patternType: string) => string;
  generateRecommendation: (pattern: any) => string;
}> {
  const source = await readModuleSource();

  const getPatternTitleSource = stripTypeScriptForFunctionEvaluation(
    extractFunctionSource(source, "getPatternTitle"),
  );
  const generateRecommendationSource = stripTypeScriptForFunctionEvaluation(
    extractFunctionSource(source, "generateRecommendation"),
  );

  return new Function(
    `${getPatternTitleSource}\n${generateRecommendationSource}\nreturn { getPatternTitle, generateRecommendation };`,
  )();
}

async function loadGetCollectiveSuggestions(): Promise<
  (supabase: any, userId: string, patternType?: string) => Promise<any[]>
> {
  const source = await readModuleSource();
  const helpers = await loadRecommendationHelpers();
  const body = stripTypeScriptForFunctionEvaluation(
    extractFunctionBody(source, "getCollectiveSuggestions"),
  );

  return new Function(
    "getPatternTitle",
    "generateRecommendation",
    `return async function getCollectiveSuggestions(supabase, userId, patternType) {${body}};`,
  )(helpers.getPatternTitle, helpers.generateRecommendation);
}

async function loadAnalyzeCollectivePatterns(): Promise<(supabase: any) => Promise<any[]>> {
  const source = await readModuleSource();
  const body = stripTypeScriptForFunctionEvaluation(
    extractFunctionBody(source, "analyzeCollectivePatterns"),
  );

  return new Function(
    `return async function analyzeCollectivePatterns(supabase) {${body}};`,
  )();
}

async function loadRecordUserAction(): Promise<
  (
    supabase: any,
    userId: string,
    actionType: string,
    actionData: Record<string, unknown>,
    success: boolean,
  ) => Promise<void>
> {
  const source = await readModuleSource();
  const body = stripTypeScriptForFunctionEvaluation(
    extractFunctionBody(source, "recordUserAction"),
  );

  return new Function(
    `return async function recordUserAction(supabase, userId, actionType, actionData, success) {${body}};`,
  )();
}

async function loadGetTopPerformerInsights(): Promise<
  (supabase: any, patternType?: string) => Promise<any[]>
> {
  const source = await readModuleSource();
  const body = stripTypeScriptForFunctionEvaluation(
    extractFunctionBody(source, "getTopPerformerInsights"),
  );

  return new Function(
    `return async function getTopPerformerInsights(supabase, patternType) {${body}};`,
  )();
}

function makeSuggestionSupabaseMock(patterns: any[] | null, calls: string[]) {
  const query = {
    select(columns: string) {
      calls.push(`select:${columns}`);
      return this;
    },
    gte(column: string, value: number) {
      calls.push(`gte:${column}:${value}`);
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.push(`order:${column}:${options.ascending}`);
      return this;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return this;
    },
    async limit(value: number) {
      calls.push(`limit:${value}`);
      return { data: patterns };
    },
  };

  return {
    from(table: string) {
      calls.push(`from:${table}`);
      return query;
    },
  };
}

function makeAnalyzeSupabaseMock(dataByTable: Record<string, any[]>, upserts: any[]) {
  return {
    from(table: string) {
      const chain = {
        select(_columns: string) {
          return this;
        },
        eq(_column: string, _value: unknown) {
          return this;
        },
        not(_column: string, _operator: string, _value: unknown) {
          return this;
        },
        limit(_value: number) {
          return this;
        },
        async upsert(row: any, options: any) {
          upserts.push({ table, row, options });
          return { data: row, error: null };
        },
        then(resolve: (value: any) => void) {
          resolve({ data: dataByTable[table] ?? [] });
        },
      };
      return chain;
    },
  };
}

Deno.test("module source declares the expected HTTP actions and CORS headers", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/serve\s*\(\s*async\s*\(\s*req\s*\)\s*=>/));
  assertExists(source.match(/['"]Access-Control-Allow-Origin['"]\s*:\s*origineAutorisee\(\)/));
  assertExists(source.match(/['"]Access-Control-Allow-Headers['"]\s*:/));
  assertExists(source.match(/validateServiceOrUser\s*\(\s*req\s*\)/));
  assertExists(source.match(/status:\s*401/));
  assertExists(source.match(/status:\s*400/));
  assertExists(source.match(/sanitizeErrorForClient\s*\(\s*error\s*\)/));

  const actionSwitch = extractSwitchBlock(source, "action");
  const actions = [...actionSwitch.matchAll(/case\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);

  assertEquals(actions, [
    "analyze_patterns",
    "get_suggestions",
    "record_action",
    "get_top_performer_insights",
  ]);
});

Deno.test("extractFunctionSource fails clearly when a helper is absent", async () => {
  const source = await readModuleSource();

  assertThrows(
    () => extractFunctionSource(source, "missingHelper"),
    Error,
    "Function missingHelper not found",
  );
});

Deno.test("getPatternTitle returns business titles and falls back to the raw pattern type", async () => {
  const { getPatternTitle } = await loadRecommendationHelpers();

  assertEquals(
    getPatternTitle("invoice_followup_timing"),
    "💰 Timing optimal de relance facture",
  );
  assertEquals(
    getPatternTitle("email_response_timing"),
    "📧 Temps de réponse email idéal",
  );
  assertEquals(
    getPatternTitle("task_prioritization"),
    "✅ Stratégie de priorisation des tâches",
  );
  assertEquals(
    getPatternTitle("meeting_preparation"),
    "📅 Impact de la préparation de réunion",
  );
  assertEquals(
    getPatternTitle("prospect_contact_frequency"),
    "🎯 Fréquence de contact prospect",
  );
  assertEquals(
    getPatternTitle("deal_closing_pattern"),
    "🤝 Pattern de closing efficace",
  );
  assertEquals(getPatternTitle("unknown_pattern"), "unknown_pattern");
});

Deno.test("generateRecommendation formats actionable recommendations for known and unknown patterns", async () => {
  const { generateRecommendation } = await loadRecommendationHelpers();

  assertEquals(
    generateRecommendation({
      pattern_type: "invoice_followup_timing",
      pattern_data: { optimal_days: 21 },
    }),
    "Relancer les factures à J+21 pour un paiement plus rapide",
  );

  assertEquals(
    generateRecommendation({
      pattern_type: "email_response_timing",
      pattern_data: { optimal_response_hours: 4 },
    }),
    "Répondre en moins de 4h pour maximiser les conversions",
  );

  assertEquals(
    generateRecommendation({
      pattern_type: "meeting_preparation",
      pattern_data: {},
    }),
    "Amélioration recommandée basée sur les top performers",
  );
});

Deno.test("getCollectiveSuggestions transforms persisted patterns into actionable UI suggestions", async () => {
  const getCollectiveSuggestions = await loadGetCollectiveSuggestions();
  const calls: string[] = [];

  const supabase = makeSuggestionSupabaseMock([
    {
      id: "pattern-email",
      pattern_type: "email_response_timing",
      pattern_data: {
        optimal_response_hours: 4,
        recommendation: "Répondre dans les 4h augmente la conversion de 23%",
      },
      effectiveness_score: 0.89,
      adoption_rate: 0.62,
      anonymized_source_count: 42,
    },
    {
      id: "pattern-invoice",
      pattern_type: "invoice_followup_timing",
      pattern_data: { optimal_days: 21 },
      effectiveness_score: 0.78,
      adoption_rate: 0.85,
      anonymized_source_count: 30,
    },
  ], calls);

  const suggestions = await getCollectiveSuggestions(
    supabase,
    "user-123",
    "email_response_timing",
  );

  assertEquals(calls, [
    "from:jarvis_collective_patterns",
    "select:*",
    "gte:effectiveness_score:0.7",
    "order:effectiveness_score:false",
    "eq:pattern_type:email_response_timing",
    "limit:10",
  ]);

  assertEquals(suggestions, [
    {
      id: "pattern-email",
      type: "email_response_timing",
      title: "📧 Temps de réponse email idéal",
      description: "Répondre dans les 4h augmente la conversion de 23%",
      effectiveness: 89,
      adoptionRate: 62,
      sourceCount: 42,
      actionable: true,
      data: {
        optimal_response_hours: 4,
        recommendation: "Répondre dans les 4h augmente la conversion de 23%",
      },
    },
    {
      id: "pattern-invoice",
      type: "invoice_followup_timing",
      title: "💰 Timing optimal de relance facture",
      description: "Relancer les factures à J+21 pour un paiement plus rapide",
      effectiveness: 78,
      adoptionRate: 85,
      sourceCount: 30,
      actionable: true,
      data: { optimal_days: 21 },
    },
  ]);
});

Deno.test("getCollectiveSuggestions returns an empty array when no collective pattern is available", async () => {
  const getCollectiveSuggestions = await loadGetCollectiveSuggestions();
  const calls: string[] = [];
  const supabase = makeSuggestionSupabaseMock(null, calls);

  const suggestions = await getCollectiveSuggestions(supabase, "user-123");

  assertEquals(suggestions, []);
  assertEquals(calls, [
    "from:jarvis_collective_patterns",
    "select:*",
    "gte:effectiveness_score:0.7",
    "order:effectiveness_score:false",
    "limit:10",
  ]);
});

Deno.test("getCollectiveSuggestions propagates database query failures", async () => {
  const getCollectiveSuggestions = await loadGetCollectiveSuggestions();

  const failingQuery = {
    select() {
      return this;
    },
    gte() {
      return this;
    },
    order() {
      return this;
    },
    async limit() {
      throw new Error("db down");
    },
  };

  const supabase = {
    from(_table: string) {
      return failingQuery;
    },
  };

  await assertRejects(
    () => getCollectiveSuggestions(supabase, "user-123"),
    Error,
    "db down",
  );
});

Deno.test("analyzeCollectivePatterns computes invoice, email, task and meeting patterns and upserts them", async () => {
  const analyzeCollectivePatterns = await loadAnalyzeCollectivePatterns();

  const invoices = Array.from({ length: 11 }, () => ({
    date_emission: "2024-01-01T00:00:00.000Z",
    date_paiement: "2024-01-31T00:00:00.000Z",
    statut: "Payée",
  }));

  const emails = Array.from({ length: 21 }, (_, index) => ({
    created_at: `2024-02-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
    last_message_date: `2024-02-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    category: "sales",
  }));

  const tasks = Array.from({ length: 21 }, (_, index) => ({
    priorite: index < 7 ? "Haute" : "Normale",
    statut: "Terminé",
    echeance: "2024-03-01T00:00:00.000Z",
    date_realisation: "2024-02-28T00:00:00.000Z",
  }));

  const upserts: any[] = [];
  const supabase = makeAnalyzeSupabaseMock({
    factures: invoices,
    email_threads: emails,
    taches: tasks,
  }, upserts);

  const patterns = await analyzeCollectivePatterns(supabase);

  assertEquals(patterns.length, 4);

  assertEquals(patterns[0], {
    pattern_type: "invoice_followup_timing",
    pattern_data: {
      optimal_days: 21,
      avg_payment_days: 30,
      sample_size: 11,
    },
    adoption_rate: 0.85,
    effectiveness_score: 0.78,
    anonymized_source_count: 11,
  });

  assertEquals(patterns[1], {
    pattern_type: "email_response_timing",
    pattern_data: {
      optimal_response_hours: 4,
      conversion_boost: 0.23,
      recommendation: "Répondre dans les 4h augmente la conversion de 23%",
    },
    adoption_rate: 0.62,
    effectiveness_score: 0.89,
    anonymized_source_count: 21,
  });

  assertEquals(patterns[2].pattern_type, "task_prioritization");
  assertEquals(patterns[2].pattern_data.high_priority_completion_rate, 7 / 21);
  assertEquals(
    patterns[2].pattern_data.recommendation,
    "Les top performers complètent 80% des tâches haute priorité en premier",
  );
  assertEquals(patterns[2].adoption_rate, 0.71);
  assertEquals(patterns[2].effectiveness_score, 0.82);
  assertEquals(patterns[2].anonymized_source_count, 21);

  assertEquals(patterns[3], {
    pattern_type: "meeting_preparation",
    pattern_data: {
      prep_time_minutes: 15,
      success_rate_with_prep: 0.87,
      success_rate_without_prep: 0.54,
      recommendation: "15 min de préparation = +33% de réussite des réunions",
    },
    adoption_rate: 0.45,
    effectiveness_score: 0.91,
    anonymized_source_count: 150,
  });

  assertEquals(upserts.length, 4);
  assertEquals(
    upserts.map((entry) => entry.table),
    [
      "jarvis_collective_patterns",
      "jarvis_collective_patterns",
      "jarvis_collective_patterns",
      "jarvis_collective_patterns",
    ],
  );
  assertEquals(
    upserts.map((entry) => entry.options),
    [
      { onConflict: "pattern_type" },
      { onConflict: "pattern_type" },
      { onConflict: "pattern_type" },
      { onConflict: "pattern_type" },
    ],
  );
  assertEquals(upserts[0].row.pattern_type, "invoice_followup_timing");
  assertEquals(upserts[0].row.pattern_data.optimal_days, 21);
  assertExists(upserts[0].row.updated_at);
});

Deno.test("analyzeCollectivePatterns keeps only the always-on meeting pattern when samples are below thresholds", async () => {
  const analyzeCollectivePatterns = await loadAnalyzeCollectivePatterns();
  const upserts: any[] = [];
  const supabase = makeAnalyzeSupabaseMock({
    factures: Array.from({ length: 10 }, () => ({
      date_emission: "2024-01-01T00:00:00.000Z",
      date_paiement: "2024-01-31T00:00:00.000Z",
      statut: "Payée",
    })),
    email_threads: Array.from({ length: 20 }, () => ({
      created_at: "2024-02-01T08:00:00.000Z",
      last_message_date: "2024-02-01T12:00:00.000Z",
      category: "sales",
    })),
    taches: Array.from({ length: 20 }, () => ({
      priorite: "Haute",
      statut: "Terminé",
      echeance: "2024-03-01T00:00:00.000Z",
      date_realisation: "2024-02-28T00:00:00.000Z",
    })),
  }, upserts);

  const patterns = await analyzeCollectivePatterns(supabase);

  assertEquals(patterns.length, 1);
  assertEquals(patterns[0].pattern_type, "meeting_preparation");
  assertEquals(patterns[0].pattern_data.prep_time_minutes, 15);
  assertEquals(patterns[0].effectiveness_score, 0.91);
  assertEquals(upserts.length, 1);
  assertEquals(upserts[0].row.pattern_type, "meeting_preparation");
});

Deno.test("recordUserAction inserts anonymized interaction and increments score only on success", async () => {
  const recordUserAction = await loadRecordUserAction();
  const insertedRows: any[] = [];
  const rpcCalls: any[] = [];

  const supabase = {
    from(table: string) {
      assertEquals(table, "jarvis_agent_interactions");
      return {
        async insert(row: any) {
          insertedRows.push(row);
          return { data: row, error: null };
        },
      };
    },
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params });
      return { data: null, error: null };
    },
  };

  await recordUserAction(
    supabase,
    "user-123",
    "email_drafting",
    { template: "follow-up", score: 92 },
    true,
  );

  assertEquals(insertedRows.length, 1);
  assertEquals(insertedRows[0].user_id, "user-123");
  assertEquals(insertedRows[0].agent_id, "collective");
  assertEquals(insertedRows[0].query, "email_drafting");
  assertEquals(insertedRows[0].response, JSON.stringify({ template: "follow-up", score: 92 }));
  assertEquals(insertedRows[0].execution_time_ms, 0);
  assertExists(insertedRows[0].created_at);

  assertEquals(rpcCalls, [
    {
      name: "increment_jarvis_score",
      params: {
        p_user_id: "user-123",
        p_points: 5,
      },
    },
  ]);
});

Deno.test("recordUserAction does not increment Jarvis score when action failed", async () => {
  const recordUserAction = await loadRecordUserAction();
  const insertedRows: any[] = [];
  const rpcCalls: any[] = [];

  const supabase = {
    from(_table: string) {
      return {
        async insert(row: any) {
          insertedRows.push(row);
          return { data: row, error: null };
        },
      };
    },
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params });
      return { data: null, error: null };
    },
  };

  await recordUserAction(
    supabase,
    "user-456",
    "invoice_followup",
    { invoiceId: "inv-1" },
    false,
  );

  assertEquals(insertedRows.length, 1);
  assertEquals(insertedRows[0].user_id, "user-456");
  assertEquals(insertedRows[0].query, "invoice_followup");
  assertEquals(insertedRows[0].response, JSON.stringify({ invoiceId: "inv-1" }));
  assertEquals(rpcCalls, []);
});

Deno.test("getTopPerformerInsights returns default best practices when no top scores exist", async () => {
  const getTopPerformerInsights = await loadGetTopPerformerInsights();

  const supabase = {
    from(table: string) {
      assertEquals(table, "jarvis_user_scores");
      return {
        select(_columns: string) {
          return this;
        },
        order(_column: string, _options: { ascending: boolean }) {
          return this;
        },
        async limit(value: number) {
          assertEquals(value, 10);
          return { data: [] };
        },
      };
    },
  };

  const insights = await getTopPerformerInsights(supabase);

  assertEquals(insights, [
    {
      insight: "best_practices",
      title: "Meilleures pratiques identifiées",
      recommendations: [
        "Répondre aux emails dans les 4h",
        "Relancer les factures à J+30",
        "Préparer 15min avant chaque réunion",
        "Compléter les tâches haute priorité en premier",
      ],
    },
  ]);
});

Deno.test("getTopPerformerInsights builds top performer habits when scores exist", async () => {
  const getTopPerformerInsights = await loadGetTopPerformerInsights();
  const calls: string[] = [];

  const supabase = {
    from(table: string) {
      calls.push(`from:${table}`);

      if (table === "jarvis_user_scores") {
        return {
          select(columns: string) {
            calls.push(`scores.select:${columns}`);
            return this;
          },
          order(column: string, options: { ascending: boolean }) {
            calls.push(`scores.order:${column}:${options.ascending}`);
            return this;
          },
          async limit(value: number) {
            calls.push(`scores.limit:${value}`);
            return {
              data: [
                { user_id: "top-1", total_score: 900, badges: ["elite"] },
                { user_id: "top-2", total_score: 850, badges: ["pro"] },
              ],
            };
          },
        };
      }

      return {
        select(columns: string) {
          calls.push(`interactions.select:${columns}`);
          return this;
        },
        in(column: string, values: string[]) {
          calls.push(`interactions.in:${column}:${values.join(",")}`);
          return this;
        },
        order(column: string, options: { ascending: boolean }) {
          calls.push(`interactions.order:${column}:${options.ascending}`);
          return this;
        },
        async limit(value: number) {
          calls.push(`interactions.limit:${value}`);
          return {
            data: [
              { query: "email_drafting", response: "{}", created_at: "2024-01-01T00:00:00.000Z" },
            ],
          };
        },
      };
    },
  };

  const insights = await getTopPerformerInsights(supabase, "email_response_timing");

  assertEquals(calls, [
    "from:jarvis_user_scores",
    "scores.select:user_id, total_score, badges",
    "scores.order:total_score:false",
    "scores.limit:10",
    "from:jarvis_agent_interactions",
    "interactions.select:query, response, created_at",
    "interactions.in:user_id:top-1,top-2",
    "interactions.order:created_at:false",
    "interactions.limit:100",
  ]);

  assertEquals(insights, [
    {
      insight: "top_performer_habits",
      title: "Habitudes des top performers",
      data: {
        avg_jarvis_usage_per_day: 12,
        most_used_features: ["email_drafting", "task_creation", "meeting_prep"],
        avg_response_time_hours: 2.3,
      },
      recommendations: [
        "Utiliser Jarvis pour automatiser les tâches répétitives",
        "Consulter le briefing chaque matin",
        "Accepter les suggestions proactives",
      ],
    },
  ]);
});

Deno.test({
  name: "module loads through relative import (ignored because index.ts starts an HTTP server at import time)",
  ignore: true,
  fn: async () => {
    const mod = await import("./index.ts");
    assertExists(mod);
  },
});