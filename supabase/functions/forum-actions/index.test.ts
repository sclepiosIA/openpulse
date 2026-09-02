import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

let harnessPromise: Promise<any> | undefined;

async function loadHarness(): Promise<any> {
  if (harnessPromise) return await harnessPromise;

  harnessPromise = (async () => {
    const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

    const transformed = source
      .replace(`import { corsHeaders } from '../_shared/cors.ts'\n`, `const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:8080', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };\n`)
      .replace(`import { serve } from "https://deno.land/std@0.168.0/http/server.ts";\n`, "")
      .replace(`import { createClient } from "@supabase/supabase-js";\n`, "")
      .replace(`import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";\n`, "")
      .replace(
        "function clean(value: unknown, max: number): string | null",
        "export function clean(value: unknown, max: number): string | null",
      )
      .replace(
        "serve(async (req) => {",
        "export const handler = async (req: Request): Promise<Response> => {",
      )
      .replace(/\n\}\);\s*$/, "\n};\n");

    assertEquals(transformed.includes("export function clean"), true);
    assertEquals(transformed.includes("export const handler"), true);

    const prelude = `
let __serviceClient: any = undefined;

export function __setServiceClient(client: any) {
  __serviceClient = client;
}

function createClient(_url: string, _key: string) {
  return __serviceClient;
}

function sanitizeErrorForClient(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
`;

    const url = `data:application/typescript;charset=utf-8,${
      encodeURIComponent(`${prelude}\n${transformed}`)
    }#${crypto.randomUUID()}`;

    return await import(url);
  })();

  return await harnessPromise;
}

async function withSupabaseEnv<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = new Map(keys.map((key) => [key, Deno.env.get(key)]));

  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "unit-test-service-role-key");

  try {
    return await fn();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createSupabaseStub(options: any = {}) {
  const calls: any[] = [];

  function resolveResult(state: any) {
    if (typeof options.resultFor === "function") {
      const custom = options.resultFor(state);
      if (custom !== undefined) return custom;
    }

    if (state.action === "insert") {
      return {
        data: options.insertData ?? { id: "generated-id" },
        error: options.insertError ?? null,
      };
    }

    if (state.action === "update") {
      return {
        data: options.updateData ?? null,
        error: options.updateError ?? null,
      };
    }

    if (state.selectColumns === "nombre_commentaires") {
      return {
        data: options.postData ?? { nombre_commentaires: options.nombreCommentaires ?? 0 },
        error: null,
      };
    }

    if (state.selectColumns === "upvotes") {
      return {
        data: options.voteData ?? { upvotes: options.upvotes ?? 0 },
        error: null,
      };
    }

    return { data: null, error: null };
  }

  function makeBuilder(table: string) {
    const state: any = {
      table,
      action: null,
      payload: null,
      selectColumns: null,
      filters: [],
    };

    const builder: any = {
      insert(payload: unknown) {
        state.action = "insert";
        state.payload = payload;
        calls.push({ type: "insert", table, payload });
        return builder;
      },
      update(payload: unknown) {
        state.action = "update";
        state.payload = payload;
        calls.push({ type: "update", table, payload });
        return builder;
      },
      select(columns: string) {
        state.selectColumns = columns;
        calls.push({ type: "select", table, columns });
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push({ column, value });
        calls.push({ type: "eq", table, column, value });
        return builder;
      },
      single() {
        calls.push({ type: "single", table });
        return Promise.resolve(resolveResult(state));
      },
      then(resolve: any, reject: any) {
        return Promise.resolve(resolveResult(state)).then(resolve, reject);
      },
    };

    return builder;
  }

  const client = {
    from(table: string) {
      calls.push({ type: "from", table });
      return makeBuilder(table);
    },
  };

  return { client, calls };
}

Deno.test("source module is read from ./index.ts and exposes the expected serve structure", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes(`serve(async (req) => {`), true);
  assertEquals(source.includes(`function clean(value: unknown, max: number): string | null`), true);
  assertEquals(source.includes(`const ALLOWED_THEMES = new Set([`), true);
  assertEquals(source.includes(`'pmsi'`), true);
  assertEquals(source.includes(`'autre'`), true);
});

Deno.test("clean trims values, rejects invalid input and truncates to max length", async () => {
  const mod = await loadHarness();

  assertEquals(mod.clean("  Bonjour forum  ", 200), "Bonjour forum");
  assertEquals(mod.clean("   ", 200), null);
  assertEquals(mod.clean(123, 200), null);
  assertEquals(mod.clean(null, 200), null);
  assertEquals(mod.clean("abcdef", 3), "abc");
});

Deno.test("clean preserves internal whitespace while trimming external whitespace", async () => {
  const mod = await loadHarness();

  assertEquals(mod.clean("  Bonjour   le forum\npublic  ", 100), "Bonjour   le forum\npublic");
  assertEquals(mod.clean("\tAlice\t", 100), "Alice");
});

Deno.test("OPTIONS request returns CORS headers without creating a Supabase client", async () => {
  const mod = await loadHarness();

  mod.__setServiceClient(undefined);

  const response = await mod.handler(new Request("http://localhost", { method: "OPTIONS" }));

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers")?.includes("authorization"),
    true,
  );
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers")?.includes("content-type"),
    true,
  );
});

Deno.test("create_post validates, sanitizes and inserts a public forum post", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ insertData: { id: "post-123" } });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_post",
      titre: `  ${"T".repeat(250)}  `,
      contenu: "  Contenu utile du message  ",
      theme: "theme_invalide",
      author_nom: `  ${"N".repeat(150)}  `,
      author_prenom: 42,
      author_etablissement_nom: "  CH Test  ",
    }));

    const json = await response.json();

    assertEquals(response.status, 200);
    assertEquals(json, { success: true, id: "post-123" });

    const insert = calls.find((call) =>
      call.type === "insert" && call.table === "forum_posts"
    );

    assertExists(insert);
    assertEquals(insert.payload.titre.length, 200);
    assertEquals(insert.payload.titre, "T".repeat(200));
    assertEquals(insert.payload.contenu, "Contenu utile du message");
    assertEquals(insert.payload.theme, "autre");
    assertEquals(insert.payload.visibilite, "publique");
    assertEquals(insert.payload.author_nom, "N".repeat(100));
    assertEquals(insert.payload.author_prenom, null);
    assertEquals(insert.payload.author_etablissement_nom, "CH Test");
    assertEquals(insert.payload.upvotes, 0);
    assertEquals(insert.payload.nombre_commentaires, 0);

    assertEquals(
      calls.some((call) =>
        call.type === "select" && call.table === "forum_posts" && call.columns === "id"
      ),
      true,
    );
    assertEquals(
      calls.some((call) => call.type === "single" && call.table === "forum_posts"),
      true,
    );
  });
});

Deno.test("create_post keeps an allowed theme", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ insertData: { id: "post-theme" } });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_post",
      titre: "Titre SMR",
      contenu: "Question sur le SMR",
      theme: "smr",
    }));

    const json = await response.json();
    const insert = calls.find((call) =>
      call.type === "insert" && call.table === "forum_posts"
    );

    assertEquals(response.status, 200);
    assertEquals(json, { success: true, id: "post-theme" });
    assertExists(insert);
    assertEquals(insert.payload.theme, "smr");
  });
});

Deno.test("create_post rejects missing title before inserting", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_post",
      titre: "   ",
      contenu: "Contenu présent",
      theme: "pmsi",
    }));

    const json = await response.json();

    assertEquals(response.status, 400);
    assertEquals(json, { error: "titre et contenu requis" });
    assertEquals(calls.some((call) => call.type === "insert"), false);
  });
});

Deno.test("create_post rejects missing content before inserting", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_post",
      titre: "Titre présent",
      contenu: "\n\t  ",
      theme: "bugs",
    }));

    const json = await response.json();

    assertEquals(response.status, 400);
    assertEquals(json, { error: "titre et contenu requis" });
    assertEquals(calls.some((call) => call.type === "insert"), false);
  });
});

Deno.test("create_comment inserts comment and increments post comment counter", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ nombreCommentaires: 7 });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_comment",
      post_id: "post-1",
      contenu: "  Merci pour ce retour  ",
      author_nom: "  Dupont  ",
      author_prenom: "  Alice  ",
      author_etablissement_nom: "  CHU  ",
    }));

    const json = await response.json();

    assertEquals(response.status, 200);
    assertEquals(json, { success: true });

    const commentInsert = calls.find((call) =>
      call.type === "insert" && call.table === "forum_comments"
    );
    const postUpdate = calls.find((call) =>
      call.type === "update" && call.table === "forum_posts"
    );

    assertExists(commentInsert);
    assertEquals(commentInsert.payload.post_id, "post-1");
    assertEquals(commentInsert.payload.contenu, "Merci pour ce retour");
    assertEquals(commentInsert.payload.author_nom, "Dupont");
    assertEquals(commentInsert.payload.author_prenom, "Alice");
    assertEquals(commentInsert.payload.author_etablissement_nom, "CHU");
    assertEquals(commentInsert.payload.upvotes, 0);

    assertExists(postUpdate);
    assertEquals(postUpdate.payload, { nombre_commentaires: 8 });
    assertEquals(
      calls.some((call) =>
        call.type === "select" && call.table === "forum_posts" &&
        call.columns === "nombre_commentaires"
      ),
      true,
    );
    assertEquals(
      calls.some((call) =>
        call.type === "eq" && call.table === "forum_posts" && call.column === "id" &&
        call.value === "post-1"
      ),
      true,
    );
  });
});

Deno.test("create_comment increments from zero when the post count is absent", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ postData: null });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_comment",
      post_id: "post-without-count",
      contenu: "Premier commentaire",
    }));

    const json = await response.json();
    const postUpdate = calls.find((call) =>
      call.type === "update" && call.table === "forum_posts"
    );

    assertEquals(response.status, 200);
    assertEquals(json, { success: true });
    assertExists(postUpdate);
    assertEquals(postUpdate.payload, { nombre_commentaires: 1 });
  });
});

Deno.test("create_comment rejects invalid post_id or content", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_comment",
      post_id: 123,
      contenu: "Commentaire",
    }));

    const json = await response.json();

    assertEquals(response.status, 400);
    assertEquals(json, { error: "post_id et contenu requis" });
    assertEquals(calls.some((call) => call.type === "insert"), false);
  });
});

Deno.test("upvote_post increments existing post upvotes", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ upvotes: 41 });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "upvote_post",
      post_id: "post-upvote",
    }));

    const json = await response.json();

    assertEquals(response.status, 200);
    assertEquals(json, { success: true });

    const update = calls.find((call) =>
      call.type === "update" && call.table === "forum_posts"
    );

    assertExists(update);
    assertEquals(update.payload, { upvotes: 42 });
    assertEquals(
      calls.some((call) =>
        call.type === "select" && call.table === "forum_posts" &&
        call.columns === "upvotes"
      ),
      true,
    );
    assertEquals(
      calls.some((call) =>
        call.type === "eq" && call.table === "forum_posts" && call.column === "id" &&
        call.value === "post-upvote"
      ),
      true,
    );
  });
});

Deno.test("upvote_post starts at one when the selected post is absent", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ voteData: null });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "upvote_post",
      post_id: "missing-post",
    }));

    const json = await response.json();
    const update = calls.find((call) =>
      call.type === "update" && call.table === "forum_posts"
    );

    assertEquals(response.status, 200);
    assertEquals(json, { success: true });
    assertExists(update);
    assertEquals(update.payload, { upvotes: 1 });
  });
});

Deno.test("upvote_comment increments existing comment upvotes", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub({ upvotes: 4 });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "upvote_comment",
      comment_id: "comment-1",
    }));

    const json = await response.json();

    assertEquals(response.status, 200);
    assertEquals(json, { success: true });

    const update = calls.find((call) =>
      call.type === "update" && call.table === "forum_comments"
    );

    assertExists(update);
    assertEquals(update.payload, { upvotes: 5 });
    assertEquals(
      calls.some((call) =>
        call.type === "select" && call.table === "forum_comments" &&
        call.columns === "upvotes"
      ),
      true,
    );
    assertEquals(
      calls.some((call) =>
        call.type === "eq" && call.table === "forum_comments" &&
        call.column === "id" && call.value === "comment-1"
      ),
      true,
    );
  });
});

Deno.test("upvote_post rejects missing post_id", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "upvote_post",
      post_id: "",
    }));

    const json = await response.json();

    assertEquals(response.status, 400);
    assertEquals(json, { error: "post_id requis" });
    assertEquals(calls.some((call) => call.type === "update"), false);
  });
});

Deno.test("upvote_comment rejects missing comment_id", async () => {
  const mod = await loadHarness();
  const { client, calls } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "upvote_comment",
      comment_id: null,
    }));

    const json = await response.json();

    assertEquals(response.status, 400);
    assertEquals(json, { error: "comment_id requis" });
    assertEquals(calls.some((call) => call.type === "update"), false);
  });
});

Deno.test("unknown action returns a 400 JSON error", async () => {
  const mod = await loadHarness();
  const { client } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "not_supported",
    }));

    const json = await response.json();

    assertEquals(response.status, 400);
    assertEquals(json, { error: "Action inconnue: not_supported" });
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  });
});

Deno.test("database insert failure is converted to a 500 JSON response", async () => {
  const mod = await loadHarness();
  const { client } = createSupabaseStub({
    insertError: new Error("database exploded"),
  });
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(jsonRequest({
      action: "create_post",
      titre: "Titre valide",
      contenu: "Contenu valide",
      theme: "pmsi",
    }));

    const json = await response.json();

    assertEquals(response.status, 500);
    assertEquals(json, { error: "database exploded" });
    assertEquals(response.headers.get("Content-Type"), "application/json");
  });
});

Deno.test("malformed JSON body is converted to a sanitized 500 JSON response", async () => {
  const mod = await loadHarness();
  const { client } = createSupabaseStub();
  mod.__setServiceClient(client);

  await withSupabaseEnv(async () => {
    const response = await mod.handler(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    }));

    const json = await response.json();

    assertEquals(response.status, 500);
    assertEquals(typeof json.error, "string");
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  });
});