import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeManageEpic,
  executeManageUserStory,
  executeManageSprint,
  executeMoveStoryToSprint,
  executeCalculateRdMetrics,
  executeManageRdComment,
  executeManageRdLabel,
  executeAiAssistStory,
} from "./rd-tools.ts";

type QueryConfig = {
  result?: unknown;
  error?: unknown;
};

function createSupabaseStub(config: Record<string, QueryConfig> = {}) {
  const calls: Array<Record<string, unknown>> = [];

  class QueryBuilder {
    table: string;
    operation = "select";
    payload: unknown = undefined;
    filters: Array<{ type: string; column?: string; value?: unknown; field?: string; options?: unknown }> = [];
    selected: unknown = undefined;
    singleMode = false;

    constructor(table: string) {
      this.table = table;
    }

    select(selection?: unknown) {
      this.selected = selection;
      calls.push({ table: this.table, method: "select", args: [selection] });
      return this;
    }

    insert(payload: unknown) {
      this.operation = "insert";
      this.payload = payload;
      calls.push({ table: this.table, method: "insert", args: [payload] });
      return this;
    }

    update(payload: unknown) {
      this.operation = "update";
      this.payload = payload;
      calls.push({ table: this.table, method: "update", args: [payload] });
      return this;
    }

    delete() {
      this.operation = "delete";
      calls.push({ table: this.table, method: "delete", args: [] });
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ type: "eq", column, value });
      calls.push({ table: this.table, method: "eq", args: [column, value] });
      return this;
    }

    order(field: string, options?: unknown) {
      this.filters.push({ type: "order", field, options });
      calls.push({ table: this.table, method: "order", args: [field, options] });
      return this;
    }

    limit(value: number) {
      this.filters.push({ type: "limit", value });
      calls.push({ table: this.table, method: "limit", args: [value] });
      return this;
    }

    single() {
      this.singleMode = true;
      calls.push({ table: this.table, method: "single", args: [] });
      return Promise.resolve(this.resolve());
    }

    then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(this.resolve()).then(onFulfilled, onRejected);
    }

    resolve() {
      const key = `${this.table}:${this.operation}`;
      const conf = config[key] ?? config[this.table] ?? {};
      return {
        data: conf.result ?? null,
        error: conf.error ?? null,
      };
    }
  }

  const supabase = {
    from(table: string) {
      calls.push({ table, method: "from", args: [table] });
      return new QueryBuilder(table);
    },
    functions: {
      invoke(name: string, options: unknown) {
        calls.push({ method: "functions.invoke", args: [name, options] });
        const conf = config[`functions:${name}`] ?? {};
        return Promise.resolve({
          data: conf.result ?? null,
          error: conf.error ?? null,
        });
      },
    },
  };

  return { supabase, calls };
}

Deno.test("executeManageEpic list retourne les epics et le count", async () => {
  const epics = [
    { id: "e1", title: "Epic 1", rd_user_stories: [{ id: "s1", title: "Story A", points: 3, status: "done" }] },
    { id: "e2", title: "Epic 2", rd_user_stories: [] },
  ];
  const { supabase, calls } = createSupabaseStub({
    "rd_epics:select": { result: epics },
  });

  const result = await executeManageEpic(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { epics, count: 2 });
  assertExists(result.execution_time_ms);
  assertEquals(calls.some((c) => c.method === "order" && c.table === "rd_epics"), true);
});

Deno.test("executeManageEpic create insère title, description, status backlog et created_by", async () => {
  const createdEpic = { id: "e-new", title: "Nouveau", description: "Desc", status: "backlog", created_by: "user-42" };
  const { supabase, calls } = createSupabaseStub({
    "rd_epics:insert": { result: createdEpic },
  });

  const result = await executeManageEpic(
    { supabase: supabase as never, userId: "user-42" },
    { action: "create", data: { title: "Nouveau", description: "Desc" } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Epic créé", epic: createdEpic });

  const insertCall = calls.find((c) => c.method === "insert" && c.table === "rd_epics");
  assertExists(insertCall);
  assertEquals(insertCall.args?.[0], {
    title: "Nouveau",
    description: "Desc",
    status: "backlog",
    created_by: "user-42",
  });
});

Deno.test("executeManageEpic retourne success false quand Supabase renvoie une erreur", async () => {
  const { supabase } = createSupabaseStub({
    "rd_epics:select": { error: new Error("db epic failed") },
  });

  const result = await executeManageEpic(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db epic failed");
});

Deno.test("executeManageUserStory list retourne les stories et limite à 100", async () => {
  const stories = [
    { id: "s1", title: "Story 1", rd_epics: { title: "Epic A" }, rd_sprints: { name: "Sprint 1" } },
  ];
  const { supabase, calls } = createSupabaseStub({
    "rd_user_stories:select": { result: stories },
  });

  const result = await executeManageUserStory(
    { supabase: supabase as never, userId: "user-1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { stories, count: 1 });
  assertEquals(calls.some((c) => c.method === "limit" && c.table === "rd_user_stories" && c.args?.[0] === 100), true);
});

Deno.test("executeManageUserStory create applique points par défaut à 0", async () => {
  const createdStory = { id: "st-1", title: "Story sans points", points: 0, status: "backlog", created_by: "u1" };
  const { supabase, calls } = createSupabaseStub({
    "rd_user_stories:insert": { result: createdStory },
  });

  const result = await executeManageUserStory(
    { supabase: supabase as never, userId: "u1" },
    { action: "create", data: { title: "Story sans points", description: "Détail" } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "User Story créée", story: createdStory });

  const insertCall = calls.find((c) => c.method === "insert" && c.table === "rd_user_stories");
  assertExists(insertCall);
  assertEquals(insertCall.args?.[0], {
    title: "Story sans points",
    description: "Détail",
    points: 0,
    status: "backlog",
    created_by: "u1",
  });
});

Deno.test("executeManageSprint start retourne une erreur métier si sprint_id absent", async () => {
  const { supabase } = createSupabaseStub();

  const result = await executeManageSprint(
    { supabase: supabase as never, userId: "u1" },
    { action: "start" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "sprint_id required");
});

Deno.test("executeManageSprint start met le sprint en active avec started_at", async () => {
  const updatedSprint = { id: "sp-1", status: "active" };
  const { supabase, calls } = createSupabaseStub({
    "rd_sprints:update": { result: updatedSprint },
  });

  const result = await executeManageSprint(
    { supabase: supabase as never, userId: "u1" },
    { action: "start", sprint_id: "sp-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Sprint démarré");
  assertEquals((result.data as Record<string, unknown>).sprint, updatedSprint);

  const updateCall = calls.find((c) => c.method === "update" && c.table === "rd_sprints");
  assertExists(updateCall);
  const payload = updateCall.args?.[0] as Record<string, unknown>;
  assertEquals(payload.status, "active");
  assertEquals(typeof payload.started_at, "string");
});

Deno.test("executeManageSprint close met le sprint en completed avec closed_at", async () => {
  const updatedSprint = { id: "sp-2", status: "completed" };
  const { supabase, calls } = createSupabaseStub({
    "rd_sprints:update": { result: updatedSprint },
  });

  const result = await executeManageSprint(
    { supabase: supabase as never, userId: "u1" },
    { action: "close", sprint_id: "sp-2" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data?.message, "Sprint clôturé");
  assertEquals((result.data as Record<string, unknown>).sprint, updatedSprint);

  const updateCall = calls.find((c) => c.method === "update" && c.table === "rd_sprints");
  assertExists(updateCall);
  const payload = updateCall.args?.[0] as Record<string, unknown>;
  assertEquals(payload.status, "completed");
  assertEquals(typeof payload.closed_at, "string");
});

Deno.test("executeMoveStoryToSprint déplace une story vers un sprint", async () => {
  const updatedStory = { id: "story-9", sprint_id: "sprint-3", rd_sprints: { name: "Sprint 3" } };
  const { supabase, calls } = createSupabaseStub({
    "rd_user_stories:update": { result: updatedStory },
  });

  const result = await executeMoveStoryToSprint(
    { supabase: supabase as never, userId: "u1" },
    { story_id: "story-9", sprint_id: "sprint-3" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    message: "Story déplacée dans le sprint",
    story: updatedStory,
  });

  const updateCall = calls.find((c) => c.method === "update" && c.table === "rd_user_stories");
  assertExists(updateCall);
  assertEquals(updateCall.args?.[0], { sprint_id: "sprint-3" });
});

Deno.test("executeCalculateRdMetrics calcule la velocity moyenne sur les stories done uniquement", async () => {
  const sprints = [
    {
      id: "sp1",
      name: "Sprint 1",
      rd_user_stories: [
        { status: "done", points: 3 },
        { status: "done", points: 5 },
        { status: "in_progress", points: 8 },
      ],
    },
    {
      id: "sp2",
      name: "Sprint 2",
      rd_user_stories: [
        { status: "done", points: 2 },
        { status: "done", points: 1 },
      ],
    },
    {
      id: "sp3",
      name: "Sprint 3",
      rd_user_stories: [],
    },
  ];
  const { supabase, calls } = createSupabaseStub({
    "rd_sprints:select": { result: sprints },
  });

  const result = await executeCalculateRdMetrics(
    { supabase: supabase as never, userId: "u1" },
    { metric_type: "velocity" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    velocity: {
      history: [
        { sprint: "Sprint 1", points_completed: 8 },
        { sprint: "Sprint 2", points_completed: 3 },
        { sprint: "Sprint 3", points_completed: 0 },
      ],
      average: 11 / 3,
    },
  });

  assertEquals(calls.some((c) => c.method === "eq" && c.table === "rd_sprints" && c.args?.[0] === "status" && c.args?.[1] === "completed"), true);
  assertEquals(calls.some((c) => c.method === "limit" && c.table === "rd_sprints" && c.args?.[0] === 6), true);
});

Deno.test("executeCalculateRdMetrics retourne un objet vide si metric_type non pris en charge", async () => {
  const { supabase } = createSupabaseStub();

  const result = await executeCalculateRdMetrics(
    { supabase: supabase as never, userId: "u1" },
    { metric_type: "unknown" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {});
});

Deno.test("executeManageRdComment list filtre par story_id et epic_id", async () => {
  const comments = [
    { id: "c1", content: "Premier commentaire", profiles: { nom: "Doe", prenom: "Jane" } },
  ];
  const { supabase, calls } = createSupabaseStub({
    "rd_comments:select": { result: comments },
  });

  const result = await executeManageRdComment(
    { supabase: supabase as never, userId: "u1" },
    { action: "list", story_id: "story-1", epic_id: "epic-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { comments, count: 1 });
  assertEquals(calls.some((c) => c.method === "eq" && c.table === "rd_comments" && c.args?.[0] === "story_id" && c.args?.[1] === "story-1"), true);
  assertEquals(calls.some((c) => c.method === "eq" && c.table === "rd_comments" && c.args?.[0] === "epic_id" && c.args?.[1] === "epic-1"), true);
});

Deno.test("executeManageRdComment create ajoute user_id et liens story/epic", async () => {
  const createdComment = { id: "c2", content: "Texte", user_id: "user-99", story_id: "story-1", epic_id: "epic-1" };
  const { supabase, calls } = createSupabaseStub({
    "rd_comments:insert": { result: createdComment },
  });

  const result = await executeManageRdComment(
    { supabase: supabase as never, userId: "user-99" },
    { action: "create", story_id: "story-1", epic_id: "epic-1", data: { content: "Texte" } },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Commentaire ajouté", comment: createdComment });

  const insertCall = calls.find((c) => c.method === "insert" && c.table === "rd_comments");
  assertExists(insertCall);
  assertEquals(insertCall.args?.[0], {
    story_id: "story-1",
    epic_id: "epic-1",
    user_id: "user-99",
    content: "Texte",
  });
});

Deno.test("executeManageRdComment delete exige comment_id", async () => {
  const { supabase } = createSupabaseStub();

  const result = await executeManageRdComment(
    { supabase: supabase as never, userId: "u1" },
    { action: "delete" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "comment_id required");
});

Deno.test("executeManageRdLabel list retourne les labels triés", async () => {
  const labels = [
    { id: "l1", name: "backend" },
    { id: "l2", name: "frontend" },
  ];
  const { supabase, calls } = createSupabaseStub({
    "rd_labels:select": { result: labels },
  });

  const result = await executeManageRdLabel(
    { supabase: supabase as never, userId: "u1" },
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { labels, count: 2 });
  assertEquals(calls.some((c) => c.method === "order" && c.table === "rd_labels" && c.args?.[0] === "name"), true);
});

Deno.test("executeManageRdLabel assign exige story_id et label_id", async () => {
  const { supabase } = createSupabaseStub();

  const result = await executeManageRdLabel(
    { supabase: supabase as never, userId: "u1" },
    { action: "assign", story_id: "story-1" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "story_id and label_id required");
});

Deno.test("executeManageRdLabel assign crée une assignation", async () => {
  const assignment = { id: "a1", story_id: "story-1", label_id: "label-1" };
  const { supabase, calls } = createSupabaseStub({
    "rd_story_labels:insert": { result: assignment },
  });

  const result = await executeManageRdLabel(
    { supabase: supabase as never, userId: "u1" },
    { action: "assign", story_id: "story-1", label_id: "label-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Label assigné", assignment });

  const insertCall = calls.find((c) => c.method === "insert" && c.table === "rd_story_labels");
  assertExists(insertCall);
  assertEquals(insertCall.args?.[0], { story_id: "story-1", label_id: "label-1" });
});

Deno.test("executeManageRdLabel unassign supprime par story_id et label_id", async () => {
  const { supabase, calls } = createSupabaseStub({
    "rd_story_labels:delete": { result: null },
  });

  const result = await executeManageRdLabel(
    { supabase: supabase as never, userId: "u1" },
    { action: "unassign", story_id: "story-77", label_id: "label-77" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, { message: "Label retiré" });
  assertEquals(calls.some((c) => c.method === "eq" && c.table === "rd_story_labels" && c.args?.[0] === "story_id" && c.args?.[1] === "story-77"), true);
  assertEquals(calls.some((c) => c.method === "eq" && c.table === "rd_story_labels" && c.args?.[0] === "label_id" && c.args?.[1] === "label-77"), true);
});

Deno.test("executeAiAssistStory appelle la fonction Supabase avec action par défaut improve", async () => {
  const aiResponse = {
    improved_title: "Titre amélioré",
    improved_description: "Description enrichie",
    acceptance_criteria: ["Critère 1", "Critère 2"],
    suggestions: ["Suggestion A"],
  };
  const { supabase, calls } = createSupabaseStub({
    "functions:rd-ai-assist": { result: aiResponse },
  });

  const result = await executeAiAssistStory(
    { supabase: supabase as never, userId: "u1" },
    { titre: "Titre brut", description: "Description brute" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data, {
    action: "improve",
    original_title: "Titre brut",
    improved_title: "Titre amélioré",
    improved_description: "Description enrichie",
    acceptance_criteria: ["Critère 1", "Critère 2"],
    suggestions: ["Suggestion A"],
  });

  const invokeCall = calls.find((c) => c.method === "functions.invoke");
  assertExists(invokeCall);
  assertEquals(invokeCall.args?.[0], "rd-ai-assist");
  assertEquals(invokeCall.args?.[1], {
    body: {
      action: "improve",
      titre: "Titre brut",
      description: "Description brute",
    },
  });
});

Deno.test("executeAiAssistStory propage le message d'erreur de la fonction AI", async () => {
  const { supabase } = createSupabaseStub({
    "functions:rd-ai-assist": { error: new Error("AI unavailable") },
  });

  const result = await executeAiAssistStory(
    { supabase: supabase as never, userId: "u1" },
    { titre: "Titre brut", action: "split" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "AI unavailable");
});

Deno.test("sanity assert imports available", () => {
  assertExists(assertThrows);
  assertExists(assertRejects);
});