import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TEST_ENV = {
  SUPABASE_URL: "http://supabase.local.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-offline-tests",
  SUPABASE_ANON_KEY: "anon-key-for-offline-tests",
  INTERNAL_FUNCTION_SECRET: "test-internal-secret",
};

function fileUrlToPath(url: URL): string {
  const pathname = decodeURIComponent(url.pathname);
  if (Deno.build.os === "windows") {
    return pathname.replace(/^\//, "").replace(/\//g, "\\");
  }
  return pathname;
}

function joinPath(dir: string, file: string): string {
  const separator = Deno.build.os === "windows" ? "\\" : "/";
  return `${dir}${dir.endsWith("/") || dir.endsWith("\\") ? "" : separator}${file}`;
}

async function runEdgeFunctionScenario(scenario: Record<string, unknown>) {
  const tempDir = await Deno.makeTempDir({ prefix: "create_support_ticket_test_" });

  try {
    const originalSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
    const transformedSource = originalSource
      .replace(
        `import { origineAutorisee } from '../_shared/cors.ts'`,
        `import { origineAutorisee } from ${JSON.stringify(new URL("../_shared/cors.ts", import.meta.url).href)};`,
      )
      .replace(
        `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`,
        `import { serve } from "./server_stub.ts";`,
      )
      .replace(
        `import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";`,
        `import { sanitizeErrorForClient } from "./sanitizer_stub.ts";`,
      )
      .replace(
        `import { createClient } from "@supabase/supabase-js";`,
        `import { createClient } from "./supabase_stub.ts";`,
      );

    await Deno.writeTextFile(joinPath(tempDir, "index.ts"), transformedSource);

    await Deno.writeTextFile(
      joinPath(tempDir, "server_stub.ts"),
      `
export function serve(handler) {
  globalThis.__EDGE_HANDLER = handler;
}
`,
    );

    await Deno.writeTextFile(
      joinPath(tempDir, "sanitizer_stub.ts"),
      `
export function sanitizeErrorForClient(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}
`,
    );

    await Deno.writeTextFile(
      joinPath(tempDir, "supabase_stub.ts"),
      `
const calls = globalThis.__SUPABASE_CALLS ??= [];

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = undefined;
    this.payload = undefined;
    this.options = undefined;
    this.selected = undefined;
    this.filters = [];
  }

  select(columns) {
    if (!this.action) this.action = "select";
    this.selected = columns ?? "*";
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ op: "in", column, values });
    return this;
  }

  insert(payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload, options) {
    this.action = "upsert";
    this.payload = payload;
    this.options = options;
    return this;
  }

  update(payload) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  single() {
    return Promise.resolve(resolveResult(this));
  }

  then(resolve, reject) {
    return this.single().then(resolve, reject);
  }
}

function record(query) {
  const action = query.action ?? "select";
  calls.push({
    table: query.table,
    action,
    selected: query.selected,
    filters: clone(query.filters),
    payload: clone(query.payload),
    options: clone(query.options),
  });
  return action;
}

function resolveResult(query) {
  const scenario = globalThis.__SUPABASE_SCENARIO ?? {};
  const action = record(query);

  if (query.table === "email_message_id_registry") {
    if (action === "upsert") {
      return { data: scenario.registryUpsertData ?? null, error: scenario.registryUpsertError ?? null };
    }
    return { data: scenario.registryExisting ?? null, error: scenario.registryError ?? null };
  }

  if (query.table === "categories_taches") {
    return { data: scenario.supportCategory ?? { id: "category-support" }, error: scenario.supportCategoryError ?? null };
  }

  if (query.table === "taches") {
    return { data: scenario.taskData ?? { id: "task-created" }, error: scenario.taskError ?? null };
  }

  if (query.table === "support_tickets") {
    return {
      data: scenario.ticketData ?? { id: "ticket-created", numero_ticket: "SUP-001" },
      error: scenario.ticketError ?? null,
    };
  }

  if (query.table === "user_roles") {
    return {
      data: scenario.supportUsers ?? [{ user_id: "support-user-1" }, { user_id: "admin-user-1" }],
      error: scenario.supportUsersError ?? null,
    };
  }

  if (query.table === "email_threads") {
    if (action === "update") {
      return { data: scenario.threadUpdateData ?? null, error: scenario.threadUpdateError ?? null };
    }
    return { data: scenario.threadData ?? { tags: ["email"] }, error: scenario.threadError ?? null };
  }

  return { data: null, error: null };
}

export function createClient(_url, _key, options) {
  const scenario = globalThis.__SUPABASE_SCENARIO ?? {};

  if (options?.global?.headers?.Authorization) {
    return {
      auth: {
        getUser: async () => {
          globalThis.__AUTH_CALLS.push({ authorization: options.global.headers.Authorization });
          if (scenario.authError) {
            return { data: { user: null }, error: { message: scenario.authError } };
          }
          return {
            data: {
              user: scenario.authUser ?? { id: "authenticated-user", email: "user@example.test" },
            },
            error: null,
          };
        },
      },
    };
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
  };
}
`,
    );

    await Deno.writeTextFile(
      joinPath(tempDir, "runner.ts"),
      `
const scenario = JSON.parse(Deno.env.get("EDGE_TEST_SCENARIO") ?? "{}");

globalThis.__SUPABASE_SCENARIO = scenario;
globalThis.__SUPABASE_CALLS = [];
globalThis.__AUTH_CALLS = [];
globalThis.__FETCH_CALLS = [];

globalThis.fetch = async (input, init = {}) => {
  globalThis.__FETCH_CALLS.push({
    url: String(input),
    method: init.method,
    headers: init.headers,
    body: init.body,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

Deno.env.set("SUPABASE_URL", ${JSON.stringify(TEST_ENV.SUPABASE_URL)});
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", ${JSON.stringify(TEST_ENV.SUPABASE_SERVICE_ROLE_KEY)});
Deno.env.set("SUPABASE_ANON_KEY", ${JSON.stringify(TEST_ENV.SUPABASE_ANON_KEY)});
Deno.env.set("INTERNAL_FUNCTION_SECRET", ${JSON.stringify(TEST_ENV.INTERNAL_FUNCTION_SECRET)});

await import("./index.ts");

const handler = globalThis.__EDGE_HANDLER;
if (!handler) {
  throw new Error("Edge handler was not registered via serve()");
}

const requestInit = {
  method: scenario.method,
  headers: scenario.headers ?? {},
};

if (scenario.body !== undefined) {
  requestInit.body = JSON.stringify(scenario.body);
}

const response = await handler(new Request("http://localhost/create-support-ticket", requestInit));
const text = await response.text();
let parsedBody = null;

if (text) {
  try {
    parsedBody = JSON.parse(text);
  } catch {
    parsedBody = text;
  }
}

console.log(JSON.stringify({
  status: response.status,
  headers: Object.fromEntries(response.headers.entries()),
  body: parsedBody,
  calls: globalThis.__SUPABASE_CALLS,
  authCalls: globalThis.__AUTH_CALLS,
  fetchCalls: globalThis.__FETCH_CALLS,
}));
`,
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", "--no-check", joinPath(tempDir, "runner.ts")],
      cwd: tempDir,
      env: {
        EDGE_TEST_SCENARIO: JSON.stringify(scenario),
      },
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    assertEquals(output.code, 0, `Child process failed.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

    const jsonLine = stdout.trim().split("\n").filter((line) => line.trim().startsWith("{")).at(-1);
    assertExists(jsonLine, `No JSON result emitted.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

    return JSON.parse(jsonLine);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

function findCall(result: { calls: Array<Record<string, unknown>> }, table: string, action: string) {
  return result.calls.find((call) => call.table === table && call.action === action);
}

function findCalls(result: { calls: Array<Record<string, unknown>> }, table: string, action: string) {
  return result.calls.filter((call) => call.table === table && call.action === action);
}

Deno.test("helpers de test détectent les erreurs synchrones et asynchrones", async () => {
  assertThrows(() => {
    throw new Error("boom");
  }, Error, "boom");

  await assertRejects(
    () => Promise.reject(new Error("async boom")),
    Error,
    "async boom",
  );
});

Deno.test("OPTIONS retourne les headers CORS sans authentification ni accès Supabase", async () => {
  const result = await runEdgeFunctionScenario({
    method: "OPTIONS",
    headers: {},
  });

  assertEquals(result.status, 200);
  assertEquals(result.body, null);
  const { listerOriginesAutorisees } = await import(
    new URL("../_shared/cors.ts", import.meta.url).href
  );
  assertEquals(
    listerOriginesAutorisees().includes(result.headers["access-control-allow-origin"]),
    true,
  );
  assertEquals(result.headers["access-control-allow-methods"], "POST, OPTIONS");
  assertEquals(result.headers["access-control-allow-headers"], "authorization, x-client-info, apikey, content-type, x-internal-secret");
  assertEquals(result.calls.length, 0);
  assertEquals(result.authCalls.length, 0);
  assertEquals(result.fetchCalls.length, 0);
});

Deno.test("POST sans secret interne ni JWT retourne 401 et ne crée rien", async () => {
  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { titre: "Incident sans authentification" },
  });

  assertEquals(result.status, 401);
  assertEquals(result.body, {
    error: "Unauthorized",
    message: "Authentication required",
  });
  assertEquals(result.calls.length, 0);
  assertEquals(result.authCalls.length, 0);
  assertEquals(result.fetchCalls.length, 0);
});

Deno.test("POST avec JWT invalide retourne 401 avant tout accès base de données métier", async () => {
  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer invalid-token",
    },
    authError: "JWT expired",
    body: { titre: "Incident avec token expiré" },
  });

  assertEquals(result.status, 401);
  assertEquals(result.body, {
    error: "Unauthorized",
    message: "Invalid or expired token",
  });
  assertEquals(result.authCalls, [{ authorization: "Bearer invalid-token" }]);
  assertEquals(result.calls.length, 0);
  assertEquals(result.fetchCalls.length, 0);
});

Deno.test("skip_if_duplicate retourne skipped=true quand le Message-ID est déjà traité", async () => {
  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": TEST_ENV.INTERNAL_FUNCTION_SECRET,
    },
    registryExisting: { processed_for_support: true },
    body: {
      titre: "Ticket déjà créé",
      email_message_id: "<message-duplicate@example.test>",
      skip_if_duplicate: true,
    },
  });

  assertEquals(result.status, 200);
  assertEquals(result.body, {
    success: true,
    skipped: true,
    reason: "Ticket already exists for this email",
  });

  const registrySelect = findCall(result, "email_message_id_registry", "select");
  assertExists(registrySelect);
  assertEquals(registrySelect.filters, [
    { op: "eq", column: "message_id", value: "<message-duplicate@example.test>" },
  ]);
  assertEquals(findCall(result, "support_tickets", "insert"), undefined);
  assertEquals(findCall(result, "taches", "insert"), undefined);
  assertEquals(result.fetchCalls.length, 0);
});

Deno.test("création réussie d'un ticket critique crée une tâche, un ticket, une notification et tague le thread", async () => {
  const startedAt = Date.now();

  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": TEST_ENV.INTERNAL_FUNCTION_SECRET,
    },
    registryExisting: { processed_for_support: false },
    supportCategory: { id: "category-support" },
    taskData: { id: "task-created" },
    ticketData: { id: "ticket-created", numero_ticket: "SUP-001" },
    supportUsers: [{ user_id: "support-user-1" }, { user_id: "admin-user-1" }],
    threadData: { tags: ["client-important"] },
    body: {
      titre: "Panne bloquante portail",
      description: "Le portail établissement est inaccessible depuis ce matin.",
      type_probleme: "technique",
      priorite: "critique",
      etablissement_id: "etablissement-123",
      email_thread_id: "thread-123",
      email_message_id: "<message-new@example.test>",
      contact_nom: "Marie Support",
      contact_email: "marie@example.test",
      ai_summary: "Portail inaccessible",
      ai_suggested_solution: "Vérifier l'état du service web",
      ai_urgency_score: 91,
    },
  });

  assertEquals(result.status, 200);
  assertEquals(result.body, {
    success: true,
    ticket: {
      id: "ticket-created",
      numero_ticket: "SUP-001",
      tache_id: "task-created",
    },
  });

  const taskInsert = findCall(result, "taches", "insert");
  assertExists(taskInsert);
  assertEquals(taskInsert.payload, {
    etablissement_id: "etablissement-123",
    categorie_id: "category-support",
    titre: "[SUPPORT] Panne bloquante portail",
    description: "Le portail établissement est inaccessible depuis ce matin.",
    priorite: "Critique",
    statut: "À faire",
  });

  const ticketInsert = findCall(result, "support_tickets", "insert");
  assertExists(ticketInsert);
  assertEquals(ticketInsert.payload.email_thread_id, "thread-123");
  assertEquals(ticketInsert.payload.email_message_id, "<message-new@example.test>");
  assertEquals(ticketInsert.payload.etablissement_id, "etablissement-123");
  assertEquals(ticketInsert.payload.partenaire_id, null);
  assertEquals(ticketInsert.payload.tache_id, "task-created");
  assertEquals(ticketInsert.payload.titre, "Panne bloquante portail");
  assertEquals(ticketInsert.payload.description, "Le portail établissement est inaccessible depuis ce matin.");
  assertEquals(ticketInsert.payload.type_probleme, "technique");
  assertEquals(ticketInsert.payload.priorite, "critique");
  assertEquals(ticketInsert.payload.contact_nom, "Marie Support");
  assertEquals(ticketInsert.payload.contact_email, "marie@example.test");
  assertEquals(ticketInsert.payload.ai_summary, "Portail inaccessible");
  assertEquals(ticketInsert.payload.ai_suggested_solution, "Vérifier l'état du service web");
  assertEquals(ticketInsert.payload.ai_urgency_score, 91);

  const slaDeadline = new Date(ticketInsert.payload.sla_deadline).getTime();
  assertEquals(Number.isFinite(slaDeadline), true);
  assertEquals(slaDeadline >= startedAt + 4 * 60 * 60 * 1000 - 60_000, true);
  assertEquals(slaDeadline <= Date.now() + 4 * 60 * 60 * 1000 + 60_000, true);

  const registryUpsert = findCall(result, "email_message_id_registry", "upsert");
  assertExists(registryUpsert);
  assertEquals(registryUpsert.payload, {
    message_id: "<message-new@example.test>",
    processed_for_support: true,
    source_thread_id: "thread-123",
  });
  assertEquals(registryUpsert.options, { onConflict: "message_id" });

  const userRolesSelect = findCall(result, "user_roles", "select");
  assertExists(userRolesSelect);
  assertEquals(userRolesSelect.filters, [
    { op: "in", column: "role", values: ["admin", "support"] },
  ]);

  const threadUpdate = findCall(result, "email_threads", "update");
  assertExists(threadUpdate);
  assertEquals(threadUpdate.payload, {
    tags: ["client-important", "ticket-support"],
    category: "Support",
  });

  assertEquals(result.fetchCalls.length, 1);
  assertEquals(result.fetchCalls[0].url, `${TEST_ENV.SUPABASE_URL}/functions/v1/send-push-notification`);
  assertEquals(result.fetchCalls[0].method, "POST");

  const notificationBody = JSON.parse(result.fetchCalls[0].body);
  assertEquals(notificationBody, {
    user_ids: ["support-user-1", "admin-user-1"],
    title: "🎫 Nouveau ticket support",
    body: "Panne bloquante portail",
    url: "/support",
    type: "task",
    related_id: "ticket-created",
    tag: "ticket-SUP-001",
  });
});

Deno.test("création via JWT valide utilise l'utilisateur authentifié et applique la priorité basse sur la tâche", async () => {
  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer valid-user-token",
    },
    authUser: { id: "user-42", email: "user42@example.test" },
    supportUsers: [],
    threadData: { tags: ["ticket-support"] },
    body: {
      titre: "Question non bloquante",
      description: "Besoin d'aide sur une configuration.",
      priorite: "basse",
      etablissement_id: "etablissement-456",
      email_thread_id: "thread-with-existing-tag",
      create_task: true,
    },
  });

  assertEquals(result.status, 200);
  assertEquals(result.authCalls, [{ authorization: "Bearer valid-user-token" }]);
  assertEquals(result.body.success, true);
  assertEquals(result.body.ticket.tache_id, "task-created");

  const taskInsert = findCall(result, "taches", "insert");
  assertExists(taskInsert);
  assertEquals(taskInsert.payload.priorite, "Basse");
  assertEquals(taskInsert.payload.titre, "[SUPPORT] Question non bloquante");

  const ticketInsert = findCall(result, "support_tickets", "insert");
  assertExists(ticketInsert);
  assertEquals(ticketInsert.payload.priorite, "basse");
  assertEquals(ticketInsert.payload.type_probleme, "autre");
  assertEquals(ticketInsert.payload.email_thread_id, "thread-with-existing-tag");
  assertEquals(ticketInsert.payload.email_message_id, null);

  const threadSelects = findCalls(result, "email_threads", "select");
  assertEquals(threadSelects.length, 1);
  assertEquals(findCall(result, "email_threads", "update"), undefined);
  assertEquals(result.fetchCalls.length, 0);
});

Deno.test("create_task=false n'insère pas de tâche et applique les valeurs par défaut du ticket", async () => {
  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": TEST_ENV.INTERNAL_FUNCTION_SECRET,
    },
    supportUsers: [],
    body: {
      titre: "Demande sans tâche liée",
      etablissement_id: "etablissement-789",
      create_task: false,
    },
  });

  assertEquals(result.status, 200);
  assertEquals(result.body.ticket.tache_id, null);
  assertEquals(findCall(result, "taches", "insert"), undefined);

  const ticketInsert = findCall(result, "support_tickets", "insert");
  assertExists(ticketInsert);
  assertEquals(ticketInsert.payload.titre, "Demande sans tâche liée");
  assertEquals(ticketInsert.payload.etablissement_id, "etablissement-789");
  assertEquals(ticketInsert.payload.tache_id, null);
  assertEquals(ticketInsert.payload.type_probleme, "autre");
  assertEquals(ticketInsert.payload.priorite, "moyenne");
});

Deno.test("erreur d'insertion du ticket retourne 500 avec message sanitisé et sans notification", async () => {
  const result = await runEdgeFunctionScenario({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": TEST_ENV.INTERNAL_FUNCTION_SECRET,
    },
    ticketError: { message: "insert support_tickets failed" },
    body: {
      titre: "Ticket impossible à créer",
      create_task: false,
    },
  });

  assertEquals(result.status, 500);
  assertEquals(result.body, { error: "insert support_tickets failed" });
  assertExists(findCall(result, "support_tickets", "insert"));
  assertEquals(findCall(result, "user_roles", "select"), undefined);
  assertEquals(result.fetchCalls.length, 0);
});