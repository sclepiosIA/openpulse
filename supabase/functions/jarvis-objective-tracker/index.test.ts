import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type {} from "./index.ts";

const moduleUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl);
}

function extractMetricBlock(source: string): string {
  const start = source.indexOf("const METRIC_QUERIES:");
  if (start === -1) {
    throw new Error("METRIC_QUERIES block not found");
  }

  const end = source.indexOf("interface ObjectiveProgress", start);
  if (end === -1) {
    throw new Error("ObjectiveProgress interface marker not found");
  }

  return source.slice(start, end);
}

function extractMetricNames(source: string): string[] {
  const block = extractMetricBlock(source);
  return [...block.matchAll(/'([^']+)':\s*\(/g)].map((match) => match[1]);
}

Deno.test("module defines Supabase Edge Function entrypoint with internal-secret protection", async () => {
  const source = await readModuleSource();

  assertExists(source);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes('import { buildErrorResponse } from "../_shared/error-sanitizer.ts";'), true);
  assertEquals(source.includes('import { requireInternalSecret } from "../_shared/internal-secret.ts";'), true);
  assertEquals(source.includes("serve(async (req) => {"), true);
  assertEquals(source.includes("const denied = requireInternalSecret(req, corsHeaders);"), true);
  assertEquals(source.includes("if (denied) return denied;"), true);
});

Deno.test("CORS preflight branch resolves its headers through the shared module", async () => {
  const source = await readModuleSource();

  // Le durcissement CORS a retire l'objet d'en-tetes local : index.ts importe
  // desormais corsHeaders du module partage, qui refuse '*' par construction,
  // et conserve en commentaire la liste d'en-tetes acceptes d'origine.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false);
  assertEquals(
    source.includes("// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type"),
    true,
  );
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders });"), true);
});

Deno.test("supported objective metrics are stable and complete", async () => {
  const source = await readModuleSource();

  assertEquals(extractMetricNames(source), [
    "ca_mensuel",
    "factures_emises",
    "taches_completees",
    "emails_traites",
    "satisfaction_moyenne",
    "tickets_resolus",
    "nouveaux_etablissements",
    "prospects_convertis",
  ]);
});

Deno.test("metric query builders target the expected business tables and fields", async () => {
  const source = await readModuleSource();
  const block = extractMetricBlock(source);

  const expectedFragments = [
    "table: 'tresorerie_revenus'",
    "select: 'montant_ttc'",
    "gte: { date_paiement: startDate }",
    "lte: { date_paiement: endDate }",

    "table: 'factures'",
    "gte: { date_emission: startDate }",
    "lte: { date_emission: endDate }",

    "table: 'taches'",
    "eq: { statut: 'Terminé' }",
    "gte: { date_realisation: startDate }",
    "lte: { date_realisation: endDate }",

    "table: 'email_threads'",
    "eq: { is_archived: true }",
    "gte: { updated_at: startDate }",
    "lte: { updated_at: endDate }",

    "table: 'enquetes_satisfaction'",
    "select: 'note_globale'",
    "gte: { created_at: startDate }",
    "lte: { created_at: endDate }",

    "table: 'support_tickets'",
    "eq: { statut: 'resolved' }",
    "gte: { resolved_at: startDate }",
    "lte: { resolved_at: endDate }",

    "table: 'etablissements'",
    "gte: { date_signature: startDate }",
    "lte: { date_signature: endDate }",

    "eq: { statut: 'Contractuel' }",
    "gte: { date_passage_contractuel: startDate }",
    "lte: { date_passage_contractuel: endDate }",
  ];

  for (const fragment of expectedFragments) {
    assertEquals(block.includes(fragment), true, `Missing expected metric query fragment: ${fragment}`);
  }
});

Deno.test("progress computation business rules are encoded with expected thresholds", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("const expectedPercent = Math.min(100, (daysElapsed / totalDays) * 100);"), true);
  assertEquals(source.includes("? (currentValue / objective.target_value) * 100"), true);
  assertEquals(source.includes("const isOnTrack = progressPercent >= expectedPercent * 0.9;"), true);
  assertEquals(source.includes("if (gapPercent > 20)"), true);
  assertEquals(source.includes("} else if (gapPercent > 10)"), true);
  assertEquals(source.includes("Rythme nécessaire: ${dailyTargetNeeded.toFixed(1)} ${objective.unit}/jour"), true);
});

Deno.test("metric aggregation rules distinguish averages, amounts, and counts", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("objective.target_metric.includes('moyenne')"), true);
  assertEquals(
    source.includes(
      "currentValue = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;",
    ),
    true,
  );
  assertEquals(source.includes("objective.target_metric.includes('ca') || objective.target_metric.includes('factures')"), true);
  assertEquals(
    source.includes("currentValue = metricData.reduce((sum: number, d: any) => sum + (d.montant_ttc || d.montant_ht || 0), 0);"),
    true,
  );
  assertEquals(source.includes("currentValue = metricData.length;"), true);
});

Deno.test("objective status transitions and milestone updates are preserved", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("if (!milestone.achieved && currentValue >= milestone.value)"), true);
  assertEquals(source.includes("milestone.achieved = true;"), true);
  assertEquals(source.includes("milestone.achieved_at = now.toISOString();"), true);
  assertEquals(source.includes("if (progressPercent >= 100)"), true);
  assertEquals(source.includes("newStatus = 'completed';"), true);
  assertEquals(source.includes("} else if (daysRemaining <= 0)"), true);
  assertEquals(source.includes("newStatus = 'failed';"), true);
});

Deno.test("progress history is capped at 90 points and stores expected value", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("if (Math.abs(currentValue - previousValue) > 0.01)"), true);
  assertEquals(source.includes("delta: currentValue - previousValue"), true);
  assertEquals(source.includes("expected: (expectedPercent / 100) * objective.target_value"), true);
  assertEquals(source.includes("if (progressHistory.length > 90)"), true);
  assertEquals(source.includes("progressHistory.splice(0, progressHistory.length - 90);"), true);
});

Deno.test("proactive alert payload contains expected priority and context fields", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("await supabase.from('jarvis_proactive_alerts').insert({"), true);
  assertEquals(source.includes("type: isOnTrack ? 'objective_milestone' : 'objective_behind'"), true);
  assertEquals(source.includes("priority: isOnTrack ? 'low' : (progressPercent < expectedPercent - 20 ? 'high' : 'medium')"), true);
  assertEquals(source.includes("objectiveId: objective.id"), true);
  assertEquals(source.includes("objectiveTitle: objective.title"), true);
  assertEquals(source.includes("targetValue: objective.target_value"), true);
  assertEquals(source.includes("suggested_action: isOnTrack ? null : `Analyser l'objectif"), true);
});

Deno.test("source parser throws when metric block is missing", () => {
  assertThrows(
    () => extractMetricBlock("const OTHER_CONFIG = {};"),
    Error,
    "METRIC_QUERIES block not found",
  );
});

Deno.test("reading an absent module path rejects with NotFound", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./index.ts.absent", import.meta.url)),
    Deno.errors.NotFound,
  );
});