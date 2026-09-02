// CHARGER LE MODULE SANS OUVRIR DE PORT.
//
// `import "./index.ts"` execute `serve(...)`, qui ouvre reellement un serveur
// sur le port 8000 par defaut. Sur une machine ou ce port est pris -- une
// instance en cours d'execution, par exemple -- le banc entier tombe sur
// « AddrInUse », sans rapport avec le code qu'il pretend verifier.
//
// On lit la source, on neutralise l'appel a `serve`, et on charge le resultat
// depuis une URL `data:`. C'est ce que font les quatre-vingts autres bancs.
async function chargerSansServeur(chemin = "./index.ts") {
  const base = new URL(chemin, import.meta.url);
  const source = await Deno.readTextFile(base);
  const neutralise = source
    .replace(
      /import\s*\{\s*serve\s*\}\s*from\s*["'][^"']*http\/server\.ts["'];?/,
      "const serve = (_h: unknown) => Promise.resolve();",
    )
    // Un module `data:` n'a pas de repertoire d'origine : ses specificateurs
    // relatifs ne resolvent contre rien, et Deno refuse le chargement. On les
    // ancre sur l'emplacement reel du module avant de le lui donner.
    .replace(
      /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g,
      (_tout, avant, guillemet, cible) =>
        `${avant}${guillemet}${new URL(cible, base).href}${guillemet}`,
    );
  return await import(
    `data:application/typescript;charset=utf-8,${encodeURIComponent(neutralise)}#${crypto.randomUUID()}`
  );
}

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const moduleUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl);
}

Deno.test("module source exists and contains the Supabase Edge Function entrypoint", async () => {
  const source = await readModuleSource();

  assertExists(source);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes("serve(async (req) => {"), true);
});

Deno.test("le module se charge, sans ouvrir de port", async () => {
  // Cette epreuve exigeait auparavant que le module NE se charge PAS : elle
  // avait fige en contrat le defaut qui rendait la fonction inerte.
  const charge = await chargerSansServeur();
  assertExists(charge);
});

Deno.test("CORS headers include required Supabase client headers", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("'Access-Control-Allow-Origin': origineAutorisee()"), true);
  assertEquals(source.includes("'authorization, x-client-info, apikey, content-type, x-internal-secret"), true);
  assertEquals(source.includes("x-supabase-client-platform"), true);
  assertEquals(source.includes("x-supabase-client-runtime-version"), true);
});

Deno.test("OPTIONS preflight branch is defined before authentication", async () => {
  const source = await readModuleSource();

  const optionsIndex = source.indexOf("if (req.method === 'OPTIONS')");
  const authIndex = source.indexOf("validateServiceOrUser(req)");

  assertEquals(optionsIndex >= 0, true);
  assertEquals(authIndex >= 0, true);
  assertEquals(optionsIndex < authIndex, true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders });"), true);
});

Deno.test("unauthorized requests are configured to return 401 JSON", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("if (!auth.authorized)"), true);
  assertEquals(source.includes("JSON.stringify({ error: 'Unauthorized' })"), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("'Content-Type': 'application/json'"), true);
});

Deno.test("non-service callers are forced to authenticated user id", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("if (!auth.isServiceCall)"), true);
  assertEquals(source.includes("requestBody.user_id = auth.userId;"), true);
});

Deno.test("cron mode queries active push subscriptions and deduplicates users", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("if (!requestBody.user_id)"), true);
  assertEquals(source.includes(".from('push_subscriptions')"), true);
  assertEquals(source.includes(".select('user_id')"), true);
  assertEquals(source.includes(".eq('is_active', true)"), true);
  assertEquals(source.includes("new Set((subs || []).map(s => s.user_id))"), true);
});

Deno.test("notification summary templates match briefing business metrics", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("📋 ${summary.tasksToday} tâche(s)"), true);
  assertEquals(source.includes("⚠️ ${summary.overdueItems} en retard"), true);
  assertEquals(source.includes("📧 ${summary.unreadEmails} email(s) non lu(s)"), true);
  assertEquals(source.includes("📅 ${summary.upcomingMeetings} RDV"), true);
  assertEquals(source.includes("lines.join(' • ')"), true);
});

Deno.test("push notification payload uses expected routing metadata", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("supabase.functions.invoke('send-push-notification'"), true);
  assertEquals(source.includes("title: `☀️ ${b.greeting}`"), true);
  assertEquals(source.includes("type: 'ai_suggestion'"), true);
  assertEquals(source.includes("url: '/'"), true);
  assertEquals(source.includes("tag: `daily-briefing-${b.date}`"), true);
});

Deno.test("malformed JSON request bodies reject with SyntaxError", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid-json",
  });

  await assertRejects(
    () => req.json(),
    SyntaxError,
  );
});

Deno.test("synchronous JSON parsing failures are observable", () => {
  assertThrows(
    () => {
      JSON.parse("{invalid-json");
    },
    SyntaxError,
  );
});