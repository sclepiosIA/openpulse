import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCreatePulseConversation,
  executeListPulseConversations,
  executeSearchPulseMessages,
  executeSendPulseMessage,
} from "./pulse-tools.ts";

type MockDbResult = {
  data?: unknown;
  error?: Error | null;
};

type MockCall = {
  table: string;
  method: string;
  args?: unknown[];
};

function createSupabaseMock(responsesByTable: Record<string, MockDbResult[]>) {
  const calls: MockCall[] = [];
  const queues = new Map<string, MockDbResult[]>(
    Object.entries(responsesByTable).map(([table, responses]) => [table, [...responses]]),
  );

  function nextResponse(table: string): MockDbResult {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      return { data: null, error: null };
    }
    return queue.shift() ?? { data: null, error: null };
  }

  const supabase = {
    from(table: string) {
      calls.push({ table, method: "from" });
      const response = nextResponse(table);

      const builder: any = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ table, method: "in", args });
          return builder;
        },
        is(...args: unknown[]) {
          calls.push({ table, method: "is", args });
          return builder;
        },
        ilike(...args: unknown[]) {
          calls.push({ table, method: "ilike", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
          return builder;
        },
        insert(...args: unknown[]) {
          calls.push({ table, method: "insert", args });
          return builder;
        },
        delete(...args: unknown[]) {
          calls.push({ table, method: "delete", args });
          return builder;
        },
        maybeSingle() {
          calls.push({ table, method: "maybeSingle" });
          return Promise.resolve(response);
        },
        single() {
          calls.push({ table, method: "single" });
          return Promise.resolve(response);
        },
        then(resolve: (value: MockDbResult) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(response).then(resolve, reject);
        },
      };

      return builder;
    },
  };

  return { supabase: supabase as any, calls };
}

Deno.test("module loads and exports Pulse tool functions", () => {
  assertExists(executeSendPulseMessage);
  assertExists(executeCreatePulseConversation);
  assertExists(executeListPulseConversations);
  assertExists(executeSearchPulseMessages);
  assertEquals(typeof executeSendPulseMessage, "function");
  assertEquals(typeof executeCreatePulseConversation, "function");
  assertEquals(typeof executeListPulseConversations, "function");
  assertEquals(typeof executeSearchPulseMessages, "function");
});

Deno.test("executeSendPulseMessage rejects missing required parameters without querying Supabase", async () => {
  const { supabase, calls } = createSupabaseMock({});

  const result = await executeSendPulseMessage(
    { supabase, userId: "user-1" },
    { conversation_id: "", content: "Bonjour" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, 'Les paramètres "conversation_id" et "content" sont requis');
  assertEquals(calls.length, 0);
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeSendPulseMessage sends a message when user is a conversation member", async () => {
  const { supabase, calls } = createSupabaseMock({
    pulse_conversation_members: [
      { data: { id: "member-1" }, error: null },
    ],
    pulse_messages: [
      {
        data: {
          id: "msg-1",
          content: "Hello Pulse",
          created_at: "2025-01-01T10:00:00.000Z",
        },
        error: null,
      },
    ],
  });

  const result = await executeSendPulseMessage(
    { supabase, userId: "user-1" },
    { conversation_id: "conv-1", content: "Hello Pulse" },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).message, "Message Pulse envoyé avec succès");
  assertEquals((result.data as any).pulse_message.id, "msg-1");
  assertEquals((result.data as any).pulse_message.content, "Hello Pulse");

  assertEquals(
    calls.some((call) =>
      call.table === "pulse_conversation_members" &&
      call.method === "eq" &&
      call.args?.[0] === "conversation_id" &&
      call.args?.[1] === "conv-1"
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_conversation_members" &&
      call.method === "eq" &&
      call.args?.[0] === "user_id" &&
      call.args?.[1] === "user-1"
    ),
    true,
  );

  const insertCall = calls.find((call) => call.table === "pulse_messages" && call.method === "insert");
  assertExists(insertCall);
  assertEquals(insertCall.args?.[0], {
    conversation_id: "conv-1",
    user_id: "user-1",
    content: "Hello Pulse",
  });
});

Deno.test("executeSendPulseMessage refuses to send when user is not a member", async () => {
  const { supabase, calls } = createSupabaseMock({
    pulse_conversation_members: [
      { data: null, error: null },
    ],
  });

  const result = await executeSendPulseMessage(
    { supabase, userId: "user-1" },
    { conversation_id: "conv-private", content: "Message interdit" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Vous n'êtes pas membre de cette conversation Pulse");
  assertEquals(calls.some((call) => call.table === "pulse_messages"), false);
});

Deno.test("executeSendPulseMessage returns database membership errors as tool failures", async () => {
  const { supabase } = createSupabaseMock({
    pulse_conversation_members: [
      { data: null, error: new Error("membership query failed") },
    ],
  });

  const result = await executeSendPulseMessage(
    { supabase, userId: "user-1" },
    { conversation_id: "conv-1", content: "Bonjour" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "membership query failed");
});

Deno.test("executeCreatePulseConversation validates name and non-empty member_ids before insert", async () => {
  const { supabase, calls } = createSupabaseMock({});

  const result = await executeCreatePulseConversation(
    { supabase, userId: "user-1" },
    { name: "", member_ids: [] },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, 'Les paramètres "name" et "member_ids" (non vide) sont requis');
  assertEquals(calls.length, 0);
});

Deno.test("executeCreatePulseConversation creates a private conversation and deduplicates members", async () => {
  const { supabase, calls } = createSupabaseMock({
    pulse_conversations: [
      { data: { id: "conv-new", name: "Projet Atlas" }, error: null },
    ],
    pulse_conversation_members: [
      { data: null, error: null },
    ],
  });

  const result = await executeCreatePulseConversation(
    { supabase, userId: "profile-1", authUserId: "auth-1" },
    {
      name: "Projet Atlas",
      member_ids: ["user-2", "auth-1", "user-2"],
    },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).conversation, { id: "conv-new", name: "Projet Atlas" });
  assertEquals((result.data as any).members_count, 2);
  assertEquals(
    (result.data as any).message,
    'Conversation Pulse "Projet Atlas" créée avec 2 membre(s)',
  );

  const conversationInsert = calls.find((call) =>
    call.table === "pulse_conversations" && call.method === "insert"
  );
  assertExists(conversationInsert);
  assertEquals(conversationInsert.args?.[0], {
    name: "Projet Atlas",
    description: null,
    created_by: "auth-1",
    visibility: "private",
  });

  const membersInsert = calls.find((call) =>
    call.table === "pulse_conversation_members" && call.method === "insert"
  );
  assertExists(membersInsert);
  assertEquals(membersInsert.args?.[0], [
    { conversation_id: "conv-new", user_id: "auth-1", role: "admin" },
    { conversation_id: "conv-new", user_id: "user-2", role: "member" },
  ]);
});

Deno.test("executeCreatePulseConversation cleans up created conversation when member insertion fails", async () => {
  const { supabase, calls } = createSupabaseMock({
    pulse_conversations: [
      { data: { id: "conv-to-clean", name: "Erreur membres" }, error: null },
      { data: null, error: null },
    ],
    pulse_conversation_members: [
      { data: null, error: new Error("members insert failed") },
    ],
  });

  const result = await executeCreatePulseConversation(
    { supabase, userId: "user-1" },
    {
      name: "Erreur membres",
      description: "Conversation à nettoyer",
      member_ids: ["user-2"],
      visibility: "public",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "members insert failed");
  assertEquals(
    calls.some((call) => call.table === "pulse_conversations" && call.method === "delete"),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_conversations" &&
      call.method === "eq" &&
      call.args?.[0] === "id" &&
      call.args?.[1] === "conv-to-clean"
    ),
    true,
  );
});

Deno.test("executeListPulseConversations returns an empty list when user has no memberships", async () => {
  const { supabase, calls } = createSupabaseMock({
    pulse_conversation_members: [
      { data: [], error: null },
    ],
  });

  const result = await executeListPulseConversations(
    { supabase, userId: "user-without-conversations" },
    { limit: 10 },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    conversations: [],
    count: 0,
    message: "Aucune conversation Pulse trouvée",
  });
  assertEquals(calls.some((call) => call.table === "pulse_conversations"), false);
});

Deno.test("executeListPulseConversations lists memberships and caps requested limit to 50", async () => {
  const conversations = [
    {
      id: "conv-2",
      name: "Support",
      description: "Support interne",
      visibility: "private",
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-03T00:00:00.000Z",
    },
    {
      id: "conv-1",
      name: "Général",
      description: null,
      visibility: "public",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
  ];

  const { supabase, calls } = createSupabaseMock({
    pulse_conversation_members: [
      {
        data: [{ conversation_id: "conv-1" }, { conversation_id: "conv-2" }],
        error: null,
      },
    ],
    pulse_conversations: [
      { data: conversations, error: null },
    ],
  });

  const result = await executeListPulseConversations(
    { supabase, userId: "user-1" },
    { limit: 999 },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).conversations, conversations);
  assertEquals((result.data as any).count, 2);

  assertEquals(
    calls.some((call) =>
      call.table === "pulse_conversations" &&
      call.method === "in" &&
      call.args?.[0] === "id" &&
      JSON.stringify(call.args?.[1]) === JSON.stringify(["conv-1", "conv-2"])
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_conversations" &&
      call.method === "order" &&
      call.args?.[0] === "updated_at" &&
      JSON.stringify(call.args?.[1]) === JSON.stringify({ ascending: false })
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_conversations" &&
      call.method === "limit" &&
      call.args?.[0] === 50
    ),
    true,
  );
});

Deno.test("executeListPulseConversations returns membership query errors as tool failures", async () => {
  const { supabase } = createSupabaseMock({
    pulse_conversation_members: [
      { data: null, error: new Error("memberships unavailable") },
    ],
  });

  const result = await executeListPulseConversations(
    { supabase, userId: "user-1" },
    { limit: 5 },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "memberships unavailable");
});

Deno.test("executeSearchPulseMessages rejects query shorter than two characters", async () => {
  const { supabase, calls } = createSupabaseMock({});

  const result = await executeSearchPulseMessages(
    { supabase, userId: "user-1" },
    { query: " a ", limit: 20 },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, 'Le paramètre "query" doit contenir au moins 2 caractères');
  assertEquals(calls.length, 0);
});

Deno.test("executeSearchPulseMessages returns empty results when user has no conversations", async () => {
  const { supabase, calls } = createSupabaseMock({
    pulse_conversation_members: [
      { data: [], error: null },
    ],
  });

  const result = await executeSearchPulseMessages(
    { supabase, userId: "user-1" },
    { query: "incident" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    results: [],
    count: 0,
    query: "incident",
  });
  assertEquals(calls.some((call) => call.table === "pulse_messages"), false);
});

Deno.test("executeSearchPulseMessages searches only accessible conversations and applies optional conversation filter", async () => {
  const messages = [
    {
      id: "msg-2",
      content: "Incident résolu dans Pulse",
      created_at: "2025-01-03T11:00:00.000Z",
      conversation_id: "conv-2",
    },
    {
      id: "msg-1",
      content: "Incident détecté",
      created_at: "2025-01-03T10:00:00.000Z",
      conversation_id: "conv-2",
    },
  ];

  const { supabase, calls } = createSupabaseMock({
    pulse_conversation_members: [
      {
        data: [{ conversation_id: "conv-1" }, { conversation_id: "conv-2" }],
        error: null,
      },
    ],
    pulse_messages: [
      { data: messages, error: null },
    ],
  });

  const result = await executeSearchPulseMessages(
    { supabase, userId: "user-1" },
    { query: "Incident", conversation_id: "conv-2", limit: 100 },
  );

  assertEquals(result.success, true);
  assertEquals((result.data as any).results, messages);
  assertEquals((result.data as any).count, 2);
  assertEquals((result.data as any).query, "Incident");

  assertEquals(
    calls.some((call) =>
      call.table === "pulse_messages" &&
      call.method === "is" &&
      call.args?.[0] === "deleted_at" &&
      call.args?.[1] === null
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_messages" &&
      call.method === "in" &&
      call.args?.[0] === "conversation_id" &&
      JSON.stringify(call.args?.[1]) === JSON.stringify(["conv-1", "conv-2"])
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_messages" &&
      call.method === "ilike" &&
      call.args?.[0] === "content" &&
      call.args?.[1] === "%Incident%"
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_messages" &&
      call.method === "eq" &&
      call.args?.[0] === "conversation_id" &&
      call.args?.[1] === "conv-2"
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "pulse_messages" &&
      call.method === "limit" &&
      call.args?.[0] === 50
    ),
    true,
  );
});

Deno.test("executeSearchPulseMessages returns search query errors as tool failures", async () => {
  const { supabase } = createSupabaseMock({
    pulse_conversation_members: [
      { data: [{ conversation_id: "conv-1" }], error: null },
    ],
    pulse_messages: [
      { data: null, error: new Error("search index unavailable") },
    ],
  });

  const result = await executeSearchPulseMessages(
    { supabase, userId: "user-1" },
    { query: "incident", limit: 10 },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "search index unavailable");
});