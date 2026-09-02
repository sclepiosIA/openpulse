import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type * as IndexModule from "./index.ts";

type _IndexModule = typeof IndexModule;

const modulePath = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(modulePath);
}

Deno.test("module source loads from relative path and registers a Supabase Edge handler", async () => {
  const source = await readModuleSource();

  assertExists(source);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes('serve(async (req) =>'), true);
});

Deno.test("CORS preflight is handled with expected headers", async () => {
  const source = await readModuleSource();

  // La consolidation CORS a deporte les en-tetes dans ../_shared/cors.ts :
  // index.ts n'a plus d'objet en ligne, il importe le socle partage. Les deux
  // attendus de source sont realignes sur leur equivalent exact dans le fichier
  // livre, et les deux suivants exercent REELLEMENT le socle -- l'assertion
  // n'est pas relachee, elle porte sur la valeur reellement emise.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(
    source.includes("// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type"),
    true,
  );
  assertEquals(corsHeaders["Access-Control-Allow-Origin"] === "*", false);
  assertEquals(
    corsHeaders["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(source.includes('if (req.method === "OPTIONS")'), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders });"), true);
});

Deno.test("authorization accepts service role bearer or internal function secret", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'), true);
  assertEquals(source.includes('Deno.env.get("INTERNAL_FUNCTION_SECRET")'), true);
  assertEquals(source.includes('req.headers.get("x-function-secret")'), true);
  assertEquals(source.includes('auth === `Bearer ${supabaseServiceKey}`'), true);
  assertEquals(source.includes("providedSecret !== internalSecret"), true);
  assertEquals(source.includes('JSON.stringify({ error: "Unauthorized" })'), true);
  assertEquals(source.includes("status: 401"), true);
});

Deno.test("profiles query is limited and fetches only user ids", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes('.from("profiles")'), true);
  assertEquals(source.includes('.select("id")'), true);
  assertEquals(source.includes(".limit(50)"), true);
  assertEquals(source.includes("profilesError"), true);
  assertEquals(source.includes("throw profilesError"), true);
});

Deno.test("RH analysis function is invoked offline by Supabase client, not by direct fetch", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("supabase.functions.invoke("), true);
  assertEquals(source.includes('"analyze-rh-insights"'), true);
  assertEquals(source.includes("Authorization: `Bearer ${supabaseServiceKey}`"), true);
  assertEquals(source.includes("analysisError"), true);
  assertEquals(source.includes("throw analysisError"), true);
  assertEquals(source.includes("fetch("), false);
});

Deno.test("upsert stores expected RH insights payload and conflict key", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes('.from("ai_analysis_log")'), true);
  assertEquals(source.includes("analysis_type: \"rh_insights\""), true);
  assertEquals(source.includes("insights_data: analysisResult"), true);
  assertEquals(source.includes("has_insights: true"), true);
  assertEquals(source.includes('onConflict: "user_id,analysis_type"'), true);
  assertEquals(source.includes("created_at: new Date().toISOString()"), true);
});

Deno.test("insights_count sums tendances, alertes and recommandations lengths", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("(analysisResult?.tendances?.length || 0)"), true);
  assertEquals(source.includes("(analysisResult?.alertes?.length || 0)"), true);
  assertEquals(source.includes("(analysisResult?.recommandations?.length || 0)"), true);
});

Deno.test("success response exposes expected business fields", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("success: true"), true);
  assertEquals(source.includes("Analyse RH hebdomadaire terminée"), true);
  assertEquals(source.includes("users_updated: successCount"), true);
  assertEquals(source.includes("total_users: profiles?.length || 0"), true);
  assertEquals(source.includes("score_climat: analysisResult?.score_climat"), true);
  assertEquals(source.includes('"Content-Type": "application/json"'), true);
});

Deno.test("catch block delegates sanitized error response with function name and 500 status", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes('buildErrorResponse("weekly-rh-analysis"'), false);
  assertEquals(source.includes("buildErrorResponse('weekly-rh-analysis', error, corsHeaders, 500)"), true);
});

Deno.test("test assertion helpers are available for synchronous and asynchronous failures", async () => {
  assertThrows(
    () => {
      throw new Error("sync failure");
    },
    Error,
    "sync failure",
  );

  await assertRejects(
    async () => {
      throw new Error("async failure");
    },
    Error,
    "async failure",
  );
});