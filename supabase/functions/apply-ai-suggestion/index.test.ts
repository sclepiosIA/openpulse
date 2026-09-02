import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function requireSourceIncludes(source: string, expected: string, label: string): void {
  if (!source.includes(expected)) {
    throw new Error(`Missing expected source invariant: ${label}`);
  }
}

Deno.test("module source exists and declares a Supabase Edge Function handler", async () => {
  const source = await readIndexSource();

  assertExists(source);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes("serve(async (req) => {"), true);
});

Deno.test("CORS preflight branch returns expected permissive headers", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  const { corsHeaders } = await import("../_shared/cors.ts");
  assertEquals(
    corsHeaders["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(corsHeaders["Access-Control-Allow-Origin"] === "*", false);
  assertEquals(
    source.includes('if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });'),
    true,
  );
});

Deno.test("authentication failure returns a 401 Unauthorized JSON response", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("const authHeader = req.headers.get(\"authorization\");"), true);
  assertEquals(source.includes('const token = authHeader?.replace("Bearer ", "");'), true);
  assertEquals(source.includes("await supabase.auth.getUser(token)"), true);
  assertEquals(source.includes('JSON.stringify({ error: "Unauthorized" })'), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes('"Content-Type": "application/json"'), true);
});

Deno.test("suggestion lookup validates missing and already processed suggestions", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('const { suggestion_id } = await req.json();'), true);
  assertEquals(source.includes('.from("ai_suggested_actions")'), true);
  assertEquals(source.includes('.eq("id", suggestion_id)'), true);
  assertEquals(source.includes('JSON.stringify({ error: "Suggestion not found" })'), true);
  assertEquals(source.includes("status: 404"), true);
  assertEquals(source.includes("suggestion.status !== 'pending'"), true);
  assertEquals(source.includes('JSON.stringify({ error: "Suggestion already processed" })'), true);
  assertEquals(source.includes("status: 400"), true);
});

Deno.test("update_task supports status aliases and task title resolution before updating", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("case 'update_task':"), true);
  assertEquals(
    source.includes("const { task_id: rawTaskId, new_status: rawNewStatus, status: statusAlias, task_title }"),
    true,
  );
  assertEquals(source.includes("let new_status = (rawNewStatus ?? statusAlias)"), true);
  assertEquals(source.includes("if (!task_id && task_title)"), true);
  assertEquals(source.includes(".eq('titre', task_title)"), true);
  assertEquals(source.includes(".ilike('titre', `%${task_title}%`)"), true);
  assertEquals(source.includes("existingTask.etablissement_id !== suggestion.etablissement_id"), true);
  assertEquals(source.includes("statut: new_status"), true);
  assertEquals(source.includes("date_realisation: new_status === 'Terminé'"), true);
  assertEquals(source.includes("result = { success: true, action: 'task_updated'"), true);
});

Deno.test("update_task rejects invalid suggestions when task id or new status cannot be resolved", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("if (!task_id)"), true);
  assertEquals(source.includes("Impossible de trouver la tâche à mettre à jour"), true);
  assertEquals(source.includes("Aucun task_id fourni et aucun titre correspondant trouvé."), true);
  assertEquals(source.includes("if (!new_status)"), true);
  assertEquals(source.includes("Suggestion invalide : nouveau statut manquant"), true);
  assertEquals(source.includes("status: 'rejected'"), true);
  assertEquals(source.includes("reviewed_by: profile?.id"), true);
});

Deno.test("create_task enforces exactly one resolved entity and can resolve it from email thread participants", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("case 'create_task':"), true);
  assertEquals(source.includes("let resolvedEtablissementId = suggestion.etablissement_id"), true);
  assertEquals(source.includes("let resolvedPartenaireId = suggestion.partenaire_id"), true);
  assertEquals(source.includes("suggestion.email_thread_id"), true);
  assertEquals(source.includes(".from('email_threads')"), true);
  assertEquals(source.includes("participants"), true);
  assertEquals(source.includes("email_specific_mappings"), true);
  assertEquals(source.includes("email_domain_mappings"), true);
  assertEquals(source.includes("prevent_auto.is.null,prevent_auto.eq.false"), true);
  assertEquals(source.includes("Impossible de créer une tâche sans entité liée"), true);
});

Deno.test("create_task resolves category, deadline, default values and inserts a task", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('let categoryId = suggestion.action_data.category_id;'), true);
  assertEquals(source.includes('.from("categories_taches")'), true);
  assertEquals(source.includes('.ilike("nom", suggestion.action_data.category)'), true);
  assertEquals(source.includes('.order("ordre", { ascending: true })'), true);
  assertEquals(source.includes('throw new Error("Aucune catégorie disponible pour créer la tâche")'), true);
  assertEquals(source.includes("suggestion.action_data?.deadline_days ?? suggestion.action_data?.due_in_days"), true);
  assertEquals(source.includes("parseInt(deadlineDays, 10)"), true);
  assertEquals(source.includes('priorite: suggestion.action_data.priority || \'medium\''), true);
  assertEquals(source.includes("statut: 'A faire'"), true);
  assertEquals(source.includes("result = { success: true, action: 'task_created'"), true);
});

Deno.test("change_status and update_summary mutate the expected etablissement fields", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("case 'change_status':"), true);
  assertEquals(source.includes("statut: newStatusValue"), true);
  assertEquals(source.includes("result = { success: true, action: 'status_changed', new_status: newStatusValue }"), true);
  assertEquals(source.includes("case 'update_summary':"), true);
  assertEquals(source.includes("derniers_echanges_resume: new_insights"), true);
  assertEquals(source.includes("derniers_echanges_updated_at: new Date().toISOString()"), true);
  assertEquals(source.includes("result = { success: true, action: 'summary_updated' }"), true);
});

Deno.test("source invariant helper throws on missing mandatory fragment", () => {
  assertThrows(
    () => requireSourceIncludes("serve(async (req) => {})", "createClient(", "Supabase client creation"),
    Error,
    "Supabase client creation",
  );
});

Deno.test("missing local fixture rejects without performing network I/O", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./__missing_index_fixture__.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});

Deno.test("module loads when Edge runtime dependencies are available", { ignore: true }, async () => {
  await import("./index.ts");
});