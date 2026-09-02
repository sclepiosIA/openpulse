import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCorrectEmail,
  executeCreateEmailTemplate,
  executeReformulateEmail,
  executeSuggestEmailResponse,
  executeTranslateEmail,
} from "./communication-tools.ts";

function createInvokeSupabaseStub(
  invokeImpl: (name: string, options: unknown) => Promise<{ data?: unknown; error?: unknown }>,
) {
  const calls: Array<{ name: string; options: unknown }> = [];

  return {
    calls,
    supabase: {
      functions: {
        invoke: async (name: string, options: unknown) => {
          calls.push({ name, options });
          return await invokeImpl(name, options);
        },
      },
    },
  };
}

Deno.test("executeTranslateEmail invokes translate-email and maps translated content", async () => {
  const { supabase, calls } = createInvokeSupabaseStub(async () => ({
    data: { translated: "Hello team" },
    error: null,
  }));

  const result = await executeTranslateEmail(
    { supabase: supabase as never, userId: "user-1" },
    { content: "Bonjour équipe", target_language: "en" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    translated_content: "Hello team",
    target_language: "en",
  });
  assertExists(result.execution_time_ms);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, "translate-email");
  assertEquals(calls[0].options, {
    body: { content: "Bonjour équipe", target_language: "en" },
  });
});

Deno.test("executeTranslateEmail uses result fallback and returns structured errors", async () => {
  const fallback = createInvokeSupabaseStub(async () => ({
    data: { result: "Hola equipo" },
    error: null,
  }));

  const fallbackResult = await executeTranslateEmail(
    { supabase: fallback.supabase as never, userId: "user-1" },
    { content: "Bonjour équipe", target_language: "es" },
  );

  assertEquals(fallbackResult.success, true);
  assertEquals(fallbackResult.data, {
    translated_content: "Hola equipo",
    target_language: "es",
  });

  const failure = createInvokeSupabaseStub(async () => ({
    data: null,
    error: new Error("translator unavailable"),
  }));

  const failureResult = await executeTranslateEmail(
    { supabase: failure.supabase as never, userId: "user-1" },
    { content: "Bonjour", target_language: "de" },
  );

  assertEquals(failureResult.success, false);
  assertEquals(failureResult.error, "translator unavailable");
  assertExists(failureResult.execution_time_ms);
});

Deno.test("executeCorrectEmail invokes correct-spelling-email and maps corrections count", async () => {
  const { supabase, calls } = createInvokeSupabaseStub(async () => ({
    data: { corrected: "Je vous remercie.", corrections_count: 2 },
    error: null,
  }));

  const result = await executeCorrectEmail(
    { supabase: supabase as never, userId: "user-2" },
    { content: "Je vous remerci." },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    corrected_content: "Je vous remercie.",
    corrections_count: 2,
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, "correct-spelling-email");
  assertEquals(calls[0].options, {
    body: { content: "Je vous remerci." },
  });
});

Deno.test("executeCorrectEmail uses result fallback, defaults corrections count to 0, and handles errors", async () => {
  const fallback = createInvokeSupabaseStub(async () => ({
    data: { result: "Texte corrigé." },
    error: null,
  }));

  const fallbackResult = await executeCorrectEmail(
    { supabase: fallback.supabase as never, userId: "user-2" },
    { content: "Texte corrige." },
  );

  assertEquals(fallbackResult.success, true);
  assertEquals(fallbackResult.data, {
    corrected_content: "Texte corrigé.",
    corrections_count: 0,
  });

  const failure = createInvokeSupabaseStub(async () => ({
    data: null,
    error: new Error("correction quota exceeded"),
  }));

  const failureResult = await executeCorrectEmail(
    { supabase: failure.supabase as never, userId: "user-2" },
    { content: "Texte" },
  );

  assertEquals(failureResult.success, false);
  assertEquals(failureResult.error, "correction quota exceeded");
});

Deno.test("executeReformulateEmail defaults tone to professional", async () => {
  const { supabase, calls } = createInvokeSupabaseStub(async () => ({
    data: { reformulated: "Je vous prie de bien vouloir confirmer votre disponibilité." },
    error: null,
  }));

  const result = await executeReformulateEmail(
    { supabase: supabase as never, userId: "user-3" },
    { content: "Confirmez si vous êtes dispo." },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    reformulated_content: "Je vous prie de bien vouloir confirmer votre disponibilité.",
    tone: "professional",
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, "reformulate-email");
  assertEquals(calls[0].options, {
    body: {
      content: "Confirmez si vous êtes dispo.",
      tone: "professional",
    },
  });
});

Deno.test("executeReformulateEmail preserves custom tone, uses result fallback, and handles errors", async () => {
  const fallback = createInvokeSupabaseStub(async () => ({
    data: { result: "Salut, peux-tu confirmer ?" },
    error: null,
  }));

  const fallbackResult = await executeReformulateEmail(
    { supabase: fallback.supabase as never, userId: "user-3" },
    { content: "Confirme disponibilité.", tone: "friendly" },
  );

  assertEquals(fallbackResult.success, true);
  assertEquals(fallbackResult.data, {
    reformulated_content: "Salut, peux-tu confirmer ?",
    tone: "friendly",
  });
  assertEquals(fallback.calls[0].options, {
    body: {
      content: "Confirme disponibilité.",
      tone: "friendly",
    },
  });

  const failure = createInvokeSupabaseStub(async () => ({
    data: null,
    error: new Error("model timeout"),
  }));

  const failureResult = await executeReformulateEmail(
    { supabase: failure.supabase as never, userId: "user-3" },
    { content: "Message", tone: "formal" },
  );

  assertEquals(failureResult.success, false);
  assertEquals(failureResult.error, "model timeout");
});

Deno.test("executeSuggestEmailResponse loads thread messages and invokes suggest-email-content", async () => {
  const messages = [
    {
      from_address: "client@example.test",
      subject: "Devis",
      body_text: "Pouvez-vous envoyer le devis actualisé ?",
    },
    {
      from_address: "sales@example.test",
      subject: "Re: Devis",
      body_text: "Bien sûr, je reviens vers vous rapidement.",
    },
  ];

  const dbCalls: Array<{ method: string; args: unknown[] }> = [];
  const invokeCalls: Array<{ name: string; options: unknown }> = [];

  const queryBuilder = {
    select: (...args: unknown[]) => {
      dbCalls.push({ method: "select", args });
      return queryBuilder;
    },
    eq: (...args: unknown[]) => {
      dbCalls.push({ method: "eq", args });
      return queryBuilder;
    },
    order: (...args: unknown[]) => {
      dbCalls.push({ method: "order", args });
      return queryBuilder;
    },
    limit: async (...args: unknown[]) => {
      dbCalls.push({ method: "limit", args });
      return { data: messages, error: null };
    },
  };

  const supabase = {
    from: (table: string) => {
      dbCalls.push({ method: "from", args: [table] });
      return queryBuilder;
    },
    functions: {
      invoke: async (name: string, options: unknown) => {
        invokeCalls.push({ name, options });
        return {
          data: { suggestion: "Bonjour, voici le devis actualisé en pièce jointe." },
          error: null,
        };
      },
    },
  };

  const result = await executeSuggestEmailResponse(
    { supabase: supabase as never, userId: "user-4" },
    { thread_id: "thread-123" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    suggested_response: "Bonjour, voici le devis actualisé en pièce jointe.",
    based_on_messages: 2,
  });
  assertEquals(dbCalls, [
    { method: "from", args: ["email_messages"] },
    { method: "select", args: ["from_address, subject, body_text"] },
    { method: "eq", args: ["thread_id", "thread-123"] },
    { method: "order", args: ["sent_at", { ascending: true }] },
    { method: "limit", args: [10] },
  ]);
  assertEquals(invokeCalls, [
    {
      name: "suggest-email-content",
      options: {
        body: {
          thread_id: "thread-123",
          context: messages,
        },
      },
    },
  ]);
});

Deno.test("executeSuggestEmailResponse uses result fallback and fails when thread has no messages", async () => {
  const fallbackMessages = [
    {
      from_address: "support@example.test",
      subject: "Ticket",
      body_text: "Nous avons reçu votre demande.",
    },
  ];

  const fallbackQueryBuilder = {
    select: () => fallbackQueryBuilder,
    eq: () => fallbackQueryBuilder,
    order: () => fallbackQueryBuilder,
    limit: async () => ({ data: fallbackMessages, error: null }),
  };

  const fallbackSupabase = {
    from: () => fallbackQueryBuilder,
    functions: {
      invoke: async () => ({
        data: { result: "Merci pour votre retour, nous restons disponibles." },
        error: null,
      }),
    },
  };

  const fallbackResult = await executeSuggestEmailResponse(
    { supabase: fallbackSupabase as never, userId: "user-4" },
    { thread_id: "thread-fallback" },
  );

  assertEquals(fallbackResult.success, true);
  assertEquals(fallbackResult.data, {
    suggested_response: "Merci pour votre retour, nous restons disponibles.",
    based_on_messages: 1,
  });

  let invoked = false;
  const emptyQueryBuilder = {
    select: () => emptyQueryBuilder,
    eq: () => emptyQueryBuilder,
    order: () => emptyQueryBuilder,
    limit: async () => ({ data: [], error: null }),
  };

  const emptySupabase = {
    from: () => emptyQueryBuilder,
    functions: {
      invoke: async () => {
        invoked = true;
        return { data: {}, error: null };
      },
    },
  };

  const emptyResult = await executeSuggestEmailResponse(
    { supabase: emptySupabase as never, userId: "user-4" },
    { thread_id: "thread-empty" },
  );

  assertEquals(emptyResult.success, false);
  assertEquals(emptyResult.error, "No messages found in thread");
  assertEquals(invoked, false);
});

Deno.test("executeCreateEmailTemplate inserts a template with defaults and creator id", async () => {
  const insertedRows: unknown[] = [];
  const dbCalls: Array<{ method: string; args: unknown[] }> = [];
  const createdTemplate = {
    id: "template-1",
    name: "Relance client",
    subject: "Relance concernant {{project}}",
    content: "Bonjour {{name}}, pouvez-vous confirmer ?",
  };

  const queryBuilder = {
    insert: (rows: unknown[]) => {
      dbCalls.push({ method: "insert", args: [rows] });
      insertedRows.push(...rows);
      return queryBuilder;
    },
    select: () => {
      dbCalls.push({ method: "select", args: [] });
      return queryBuilder;
    },
    single: async () => {
      dbCalls.push({ method: "single", args: [] });
      return { data: createdTemplate, error: null };
    },
  };

  const supabase = {
    from: (table: string) => {
      dbCalls.push({ method: "from", args: [table] });
      return queryBuilder;
    },
  };

  const result = await executeCreateEmailTemplate(
    { supabase: supabase as never, userId: "user-creator" },
    {
      name: "Relance client",
      subject: "Relance concernant {{project}}",
      body: "Bonjour {{name}}, pouvez-vous confirmer ?",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Template email créé avec succès",
    template: createdTemplate,
  });
  assertEquals(insertedRows, [
    {
      name: "Relance client",
      subject: "Relance concernant {{project}}",
      content: "Bonjour {{name}}, pouvez-vous confirmer ?",
      variables: [],
      category: null,
      is_active: true,
      created_by: "user-creator",
    },
  ]);
  assertEquals(dbCalls.map((call) => call.method), ["from", "insert", "select", "single"]);
  assertEquals(dbCalls[0].args, ["email_templates"]);
});

Deno.test("executeCreateEmailTemplate preserves variables and category and reports insert errors", async () => {
  let insertedRow: Record<string, unknown> | undefined;

  const successQueryBuilder = {
    insert: (rows: Record<string, unknown>[]) => {
      insertedRow = rows[0];
      return successQueryBuilder;
    },
    select: () => successQueryBuilder,
    single: async () => ({
      data: { id: "template-2", ...insertedRow },
      error: null,
    }),
  };

  const successSupabase = {
    from: () => successQueryBuilder,
  };

  const successResult = await executeCreateEmailTemplate(
    { supabase: successSupabase as never, userId: "user-creator" },
    {
      name: "Bienvenue",
      subject: "Bienvenue {{firstName}}",
      body: "Bonjour {{firstName}}, bienvenue chez nous.",
      variables: ["firstName"],
      category: "onboarding",
    },
  );

  assertEquals(successResult.success, true);
  assertEquals(insertedRow, {
    name: "Bienvenue",
    subject: "Bienvenue {{firstName}}",
    content: "Bonjour {{firstName}}, bienvenue chez nous.",
    variables: ["firstName"],
    category: "onboarding",
    is_active: true,
    created_by: "user-creator",
  });

  const errorQueryBuilder = {
    insert: () => errorQueryBuilder,
    select: () => errorQueryBuilder,
    single: async () => ({
      data: null,
      error: new Error("duplicate template name"),
    }),
  };

  const errorSupabase = {
    from: () => errorQueryBuilder,
  };

  const errorResult = await executeCreateEmailTemplate(
    { supabase: errorSupabase as never, userId: "user-creator" },
    {
      name: "Bienvenue",
      subject: "Sujet",
      body: "Corps",
    },
  );

  assertEquals(errorResult.success, false);
  assertEquals(errorResult.error, "duplicate template name");
});

Deno.test("imported assertion helpers are available for synchronous and asynchronous failures", async () => {
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