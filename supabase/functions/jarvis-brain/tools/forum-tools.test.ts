import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeManageForumPost,
  executeManageForumComment,
  executeVoteForumPost,
  executeBookmarkForumPost,
} from "./forum-tools.ts";

type QueryResult = { data?: unknown; error?: unknown };

class SupabaseStub {
  public calls: Array<Record<string, unknown>> = [];
  private responses: Record<string, QueryResult>;
  private throwOnTable: Record<string, Error>;

  constructor(
    responses: Record<string, QueryResult> = {},
    throwOnTable: Record<string, Error> = {},
  ) {
    this.responses = responses;
    this.throwOnTable = throwOnTable;
  }

  from(table: string) {
    if (this.throwOnTable[table]) {
      throw this.throwOnTable[table];
    }
    return new QueryBuilderStub(table, this.calls, this.responses);
  }
}

class QueryBuilderStub {
  private table: string;
  private calls: Array<Record<string, unknown>>;
  private responses: Record<string, QueryResult>;
  private filters: Array<{ type: string; column?: string; value?: unknown; expr?: string }> = [];
  private action = "select";
  private payload: unknown = undefined;
  private selected: unknown = undefined;
  private singleMode: "single" | "maybeSingle" | null = null;
  private orderBy: unknown = undefined;
  private limitBy: unknown = undefined;

  constructor(
    table: string,
    calls: Array<Record<string, unknown>>,
    responses: Record<string, QueryResult>,
  ) {
    this.table = table;
    this.calls = calls;
    this.responses = responses;
  }

  select(columns?: string) {
    this.action = "select";
    this.selected = columns ?? "*";
    return this;
  }

  insert(payload: unknown) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  or(expr: string) {
    this.filters.push({ type: "or", expr });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orderBy = { column, options };
    return this;
  }

  limit(value: number) {
    this.limitBy = value;
    return this;
  }

  single() {
    this.singleMode = "single";
    return Promise.resolve(this.execute());
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return Promise.resolve(this.execute());
  }

  then(
    onfulfilled?: (value: QueryResult) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    const key = this.buildKey();
    const result = this.responses[key] ?? { data: null, error: null };
    this.calls.push({
      table: this.table,
      action: this.action,
      payload: this.payload,
      selected: this.selected,
      filters: structuredClone(this.filters),
      orderBy: this.orderBy,
      limitBy: this.limitBy,
      singleMode: this.singleMode,
      key,
      result: structuredClone(result),
    });
    return result;
  }

  private buildKey() {
    return JSON.stringify({
      table: this.table,
      action: this.action,
      filters: this.filters,
      singleMode: this.singleMode,
    });
  }
}

function makeCtx(stub: SupabaseStub, userId = "user-123") {
  return { supabase: stub as never, userId };
}

Deno.test("module loads", async () => {
  const mod = await import("./forum-tools.ts");
  assertExists(mod);
  assertExists(mod.executeManageForumPost);
  assertExists(mod.executeManageForumComment);
  assertExists(mod.executeVoteForumPost);
  assertExists(mod.executeBookmarkForumPost);
});

Deno.test("executeManageForumPost list returns posts and count", async () => {
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [{ type: "eq", column: "archive", value: false }],
    singleMode: null,
  });
  const posts = [{ id: "p2" }, { id: "p1" }];
  const stub = new SupabaseStub({
    [key]: { data: posts, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub), { action: "list" });

  assertEquals(result.success, true);
  assertEquals(result.data, { posts, count: 2 });
  assertExists(result.execution_time_ms);
  assertEquals(stub.calls.length, 1);
  assertEquals(stub.calls[0].table, "forum_posts");
  assertEquals(stub.calls[0].action, "select");
  assertEquals(stub.calls[0].limitBy, 50);
  assertEquals(stub.calls[0].orderBy, {
    column: "created_at",
    options: { ascending: false },
  });
});

Deno.test("executeManageForumPost get requires post_id", async () => {
  const result = await executeManageForumPost(makeCtx(new SupabaseStub()), { action: "get" });

  assertEquals(result.success, false);
  assertEquals(result.error, "post_id required");
});

Deno.test("executeManageForumPost get returns one post", async () => {
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [{ type: "eq", column: "id", value: "post-1" }],
    singleMode: "single",
  });
  const post = { id: "post-1", titre: "Hello" };
  const stub = new SupabaseStub({
    [key]: { data: post, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub), {
    action: "get",
    post_id: "post-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { post });
});

Deno.test("executeManageForumPost create injects user_id and returns created message", async () => {
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [],
    singleMode: "single",
  });
  const created = { id: "new-post", titre: "Titre", user_id: "user-abc" };
  const stub = new SupabaseStub({
    [key]: { data: created, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub, "user-abc"), {
    action: "create",
    data: { titre: "Titre", contenu: "Texte" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Post créé", post: created });
  assertEquals(stub.calls[0].action, "select");
  assertEquals(stub.calls[0].singleMode, "single");
  assertEquals(stub.calls[0].payload, {
    titre: "Titre",
    contenu: "Texte",
    user_id: "user-abc",
  });
  assertEquals(stub.calls[0].result, { data: created, error: null });
});

Deno.test("executeManageForumPost update requires post_id", async () => {
  const result = await executeManageForumPost(makeCtx(new SupabaseStub()), {
    action: "update",
    data: { titre: "X" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "post_id required");
});

Deno.test("executeManageForumPost update sends payload and id filter", async () => {
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [{ type: "eq", column: "id", value: "post-9" }],
    singleMode: "single",
  });
  const updated = { id: "post-9", titre: "Nouveau" };
  const stub = new SupabaseStub({
    [key]: { data: updated, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub), {
    action: "update",
    post_id: "post-9",
    data: { titre: "Nouveau" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Post mis à jour", post: updated });
  assertEquals(stub.calls[0].action, "select");
  assertEquals(stub.calls[0].payload, { titre: "Nouveau" });
  assertEquals(stub.calls[0].filters, [{ type: "eq", column: "id", value: "post-9" }]);
});

Deno.test("executeManageForumPost delete archives post", async () => {
  const key = JSON.stringify({
    table: "forum_posts",
    action: "update",
    filters: [{ type: "eq", column: "id", value: "post-7" }],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [key]: { data: null, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub), {
    action: "delete",
    post_id: "post-7",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Post archivé" });
  assertEquals(stub.calls[0].payload, { archive: true });
});

Deno.test("executeManageForumPost search requires query", async () => {
  const result = await executeManageForumPost(makeCtx(new SupabaseStub()), {
    action: "search",
    data: {},
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "query required in data");
});

Deno.test("executeManageForumPost search returns empty when sanitized term is blank", async () => {
  const result = await executeManageForumPost(makeCtx(new SupabaseStub()), {
    action: "search",
    data: { query: '()"%*:\\\\,.' },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { posts: [], count: 0 });
});

Deno.test("executeManageForumPost search sanitizes query and limits results", async () => {
  const raw = 'hello,("world")%test*';
  const sanitized = raw.replace(/[(),".\\%*:]/g, " ").trim().substring(0, 200);
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [
      { type: "or", expr: `titre.ilike.%${sanitized}%,contenu.ilike.%${sanitized}%` },
      { type: "eq", column: "archive", value: false },
    ],
    singleMode: null,
  });
  const posts = [{ id: "a" }];
  const stub = new SupabaseStub({
    [key]: { data: posts, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub), {
    action: "search",
    data: { query: raw },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { posts, count: 1 });
  assertEquals(stub.calls[0].limitBy, 30);
  assertEquals(stub.calls[0].filters, [
    { type: "or", expr: `titre.ilike.%${sanitized}%,contenu.ilike.%${sanitized}%` },
    { type: "eq", column: "archive", value: false },
  ]);
});

Deno.test("executeManageForumPost search truncates sanitized term to 200 chars", async () => {
  const raw = "a".repeat(250);
  const sanitized = raw.replace(/[(),".\\%*:]/g, " ").trim().substring(0, 200);
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [
      { type: "or", expr: `titre.ilike.%${sanitized}%,contenu.ilike.%${sanitized}%` },
      { type: "eq", column: "archive", value: false },
    ],
    singleMode: null,
  });
  const posts = [{ id: "long-search" }];
  const stub = new SupabaseStub({
    [key]: { data: posts, error: null },
  });

  const result = await executeManageForumPost(makeCtx(stub), {
    action: "search",
    data: { query: raw },
  });

  assertEquals(result.success, true);
  assertEquals((stub.calls[0].filters as Array<unknown>)[0], {
    type: "or",
    expr: `titre.ilike.%${sanitized}%,contenu.ilike.%${sanitized}%`,
  });
  assertEquals(sanitized.length, 200);
  assertEquals(result.data, { posts, count: 1 });
});

Deno.test("executeManageForumPost returns failure when supabase query has error", async () => {
  const key = JSON.stringify({
    table: "forum_posts",
    action: "select",
    filters: [{ type: "eq", column: "archive", value: false }],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [key]: { data: null, error: new Error("db exploded") },
  });

  const result = await executeManageForumPost(makeCtx(stub), { action: "list" });

  assertEquals(result.success, false);
  assertEquals(result.error, "db exploded");
});

Deno.test("executeManageForumPost default action returns not implemented", async () => {
  const result = await executeManageForumPost(makeCtx(new SupabaseStub()), {
    action: "pin",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action pin not implemented" });
});

Deno.test("executeManageForumComment list requires post_id", async () => {
  const result = await executeManageForumComment(makeCtx(new SupabaseStub()), {
    action: "list",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "post_id required");
});

Deno.test("executeManageForumComment list returns ordered comments", async () => {
  const key = JSON.stringify({
    table: "forum_comments",
    action: "select",
    filters: [{ type: "eq", column: "post_id", value: "post-1" }],
    singleMode: null,
  });
  const comments = [{ id: "c1" }, { id: "c2" }];
  const stub = new SupabaseStub({
    [key]: { data: comments, error: null },
  });

  const result = await executeManageForumComment(makeCtx(stub), {
    action: "list",
    post_id: "post-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { comments, count: 2 });
  assertEquals(stub.calls[0].orderBy, {
    column: "created_at",
    options: { ascending: true },
  });
});

Deno.test("executeManageForumComment create requires post_id", async () => {
  const result = await executeManageForumComment(makeCtx(new SupabaseStub()), {
    action: "create",
    data: { contenu: "Salut" },
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "post_id required");
});

Deno.test("executeManageForumComment create injects post_id and user_id", async () => {
  const key = JSON.stringify({
    table: "forum_comments",
    action: "select",
    filters: [],
    singleMode: "single",
  });
  const comment = { id: "c9", contenu: "Salut", user_id: "u1", post_id: "p1" };
  const stub = new SupabaseStub({
    [key]: { data: comment, error: null },
  });

  const result = await executeManageForumComment(makeCtx(stub, "u1"), {
    action: "create",
    post_id: "p1",
    data: { contenu: "Salut" },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Commentaire ajouté", comment });
  assertEquals(stub.calls[0].action, "select");
  assertEquals(stub.calls[0].singleMode, "single");
  assertEquals(stub.calls[0].payload, {
    post_id: "p1",
    user_id: "u1",
    contenu: "Salut",
  });
  assertEquals(stub.calls[0].result, { data: comment, error: null });
});

Deno.test("executeManageForumComment delete requires comment_id", async () => {
  const result = await executeManageForumComment(makeCtx(new SupabaseStub()), {
    action: "delete",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "comment_id required");
});

Deno.test("executeManageForumComment delete removes comment by id", async () => {
  const key = JSON.stringify({
    table: "forum_comments",
    action: "delete",
    filters: [{ type: "eq", column: "id", value: "comment-1" }],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [key]: { data: null, error: null },
  });

  const result = await executeManageForumComment(makeCtx(stub), {
    action: "delete",
    comment_id: "comment-1",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Commentaire supprimé" });
});

Deno.test("executeManageForumComment default action returns not implemented", async () => {
  const result = await executeManageForumComment(makeCtx(new SupabaseStub()), {
    action: "edit",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Action edit not implemented" });
});

Deno.test("executeVoteForumPost removes existing vote", async () => {
  const keySelect = JSON.stringify({
    table: "forum_votes",
    action: "select",
    filters: [
      { type: "eq", column: "post_id", value: "post-2" },
      { type: "eq", column: "user_id", value: "user-5" },
    ],
    singleMode: "maybeSingle",
  });
  const keyDelete = JSON.stringify({
    table: "forum_votes",
    action: "delete",
    filters: [{ type: "eq", column: "id", value: "vote-1" }],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [keySelect]: { data: { id: "vote-1" }, error: null },
    [keyDelete]: { data: null, error: null },
  });

  const result = await executeVoteForumPost(makeCtx(stub, "user-5"), {
    post_id: "post-2",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Vote retiré", action: "removed" });
  assertEquals(stub.calls.length, 2);
});

Deno.test("executeVoteForumPost adds vote when none exists", async () => {
  const keySelect = JSON.stringify({
    table: "forum_votes",
    action: "select",
    filters: [
      { type: "eq", column: "post_id", value: "post-3" },
      { type: "eq", column: "user_id", value: "user-6" },
    ],
    singleMode: "maybeSingle",
  });
  const keyInsert = JSON.stringify({
    table: "forum_votes",
    action: "insert",
    filters: [],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [keySelect]: { data: null, error: null },
    [keyInsert]: { data: null, error: null },
  });

  const result = await executeVoteForumPost(makeCtx(stub, "user-6"), {
    post_id: "post-3",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Vote ajouté", action: "added" });
  assertEquals(stub.calls[1].payload, { post_id: "post-3", user_id: "user-6" });
});

Deno.test("executeVoteForumPost returns failure when supabase throws", async () => {
  const stub = new SupabaseStub({}, { forum_votes: new Error("vote backend down") });

  const result = await executeVoteForumPost(makeCtx(stub), {
    post_id: "post-4",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "vote backend down");
});

Deno.test("executeBookmarkForumPost removes existing bookmark", async () => {
  const keySelect = JSON.stringify({
    table: "forum_bookmarks",
    action: "select",
    filters: [
      { type: "eq", column: "post_id", value: "post-8" },
      { type: "eq", column: "user_id", value: "user-8" },
    ],
    singleMode: "maybeSingle",
  });
  const keyDelete = JSON.stringify({
    table: "forum_bookmarks",
    action: "delete",
    filters: [{ type: "eq", column: "id", value: "bm-1" }],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [keySelect]: { data: { id: "bm-1" }, error: null },
    [keyDelete]: { data: null, error: null },
  });

  const result = await executeBookmarkForumPost(makeCtx(stub, "user-8"), {
    post_id: "post-8",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Favori retiré", action: "removed" });
});

Deno.test("executeBookmarkForumPost adds bookmark when none exists", async () => {
  const keySelect = JSON.stringify({
    table: "forum_bookmarks",
    action: "select",
    filters: [
      { type: "eq", column: "post_id", value: "post-9" },
      { type: "eq", column: "user_id", value: "user-9" },
    ],
    singleMode: "maybeSingle",
  });
  const keyInsert = JSON.stringify({
    table: "forum_bookmarks",
    action: "insert",
    filters: [],
    singleMode: null,
  });
  const stub = new SupabaseStub({
    [keySelect]: { data: null, error: null },
    [keyInsert]: { data: null, error: null },
  });

  const result = await executeBookmarkForumPost(makeCtx(stub, "user-9"), {
    post_id: "post-9",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Favori ajouté", action: "added" });
  assertEquals(stub.calls[1].payload, { post_id: "post-9", user_id: "user-9" });
});

Deno.test("executeBookmarkForumPost returns failure when supabase throws", async () => {
  const stub = new SupabaseStub({}, { forum_bookmarks: new Error("bookmark backend down") });

  const result = await executeBookmarkForumPost(makeCtx(stub), {
    post_id: "post-10",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "bookmark backend down");
});

Deno.test("assert imports are available and behave on simple cases", async () => {
  assertThrows(() => {
    throw new Error("boom");
  }, Error, "boom");

  await assertRejects(
    async () => {
      throw new Error("async boom");
    },
    Error,
    "async boom",
  );
});