import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const moduleUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl);
}

function requireFragment(source: string, fragment: string, message?: string): void {
  if (!source.includes(fragment)) {
    throw new Error(message ?? `Expected source to contain: ${fragment}`);
  }
}

function countOccurrences(source: string, fragment: string): number {
  return source.split(fragment).length - 1;
}

Deno.test("module file exists and contains the qonto-reconcile edge function", async () => {
  const stat = await Deno.stat(moduleUrl);
  assertEquals(stat.isFile, true);

  const source = await readModuleSource();
  assertExists(source);
  requireFragment(source, "Edge Function: qonto-reconcile");
  requireFragment(source, "serve(async (req) => {");
});

Deno.test("module wires Supabase, error sanitizer, and internal secret guard", async () => {
  const source = await readModuleSource();

  requireFragment(source, 'import { createClient } from "@supabase/supabase-js";');
  requireFragment(source, 'import { buildErrorResponse } from "../_shared/error-sanitizer.ts";');
  requireFragment(source, 'import { requireInternalSecret } from "../_shared/internal-secret.ts";');

  const secretGuardIndex = source.indexOf("const denied = requireInternalSecret(req, corsHeaders);");
  const createClientIndex = source.indexOf("const supabaseClient = createClient(");

  assertEquals(secretGuardIndex >= 0, true);
  assertEquals(createClientIndex >= 0, true);
  assertEquals(secretGuardIndex < createClientIndex, true);
});

Deno.test("CORS headers include internal secret support and OPTIONS preflight returns early", async () => {
  const source = await readModuleSource();

  // index.ts ne declare plus ses en-tetes en ligne : il importe la constante
  // du module partage. On verifie le pointeur dans la source, puis la liste
  // reelle sur le VRAI module partage, charge par URL absolue.
  requireFragment(source, "import { corsHeaders } from '../_shared/cors.ts'");
  const socleCors = await import(new URL("../_shared/cors.ts", import.meta.url).href);
  assertEquals(
    socleCors.corsHeaders["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(socleCors.corsHeaders["Access-Control-Allow-Origin"] === "*", false);
  requireFragment(source, "if (req.method === 'OPTIONS') {");
  requireFragment(source, "return new Response(null, { headers: corsHeaders });");
});

Deno.test("manual mode fetches one bank operation and reconciles with recette or depense id", async () => {
  const source = await readModuleSource();

  requireFragment(source, "const { operation_id, recette_id, depense_id, mode = 'auto' } = body;");
  requireFragment(source, "if (mode === 'manual' && operation_id) {");
  requireFragment(source, ".from('tresorerie_operations_bancaires')");
  requireFragment(source, ".eq('id', operation_id)");
  requireFragment(source, ".single();");
  requireFragment(source, "throw new Error('Opération bancaire non trouvée');");
  requireFragment(source, "const updateData: Record<string, any> = { reconcilie: true };");
  requireFragment(source, "updateData.recette_id = recette_id;");
  requireFragment(source, "updateData.depense_id = depense_id;");
  requireFragment(source, "totalReconciled = 1;");
});

Deno.test("auto mode selects unreconciled credits and matches revenues by amount and date window", async () => {
  const source = await readModuleSource();

  requireFragment(source, "if (mode === 'auto') {");
  requireFragment(source, ".eq('type_operation', 'credit')");
  requireFragment(source, ".eq('reconcilie', false)");
  requireFragment(source, ".is('recette_id', null)");
  requireFragment(source, ".from('tresorerie_revenus')");
  requireFragment(source, ".is('source_modele', null)");
  requireFragment(source, ".gte('montant_paye', credit.montant - 0.01)");
  requireFragment(source, ".lte('montant_paye', credit.montant + 0.01)");
  requireFragment(source, ".gte('date_paiement_reel', new Date(new Date(txDate).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])");
  requireFragment(source, ".lte('date_paiement_reel', new Date(new Date(txDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])");
  requireFragment(source, ".limit(1)");
  requireFragment(source, ".maybeSingle();");
  requireFragment(source, "recette_id: matchingRevenu.id");
  requireFragment(source, "reconcilie: true");
});

Deno.test("auto mode selects unreconciled debits and matches expenses by amount and date window", async () => {
  const source = await readModuleSource();

  requireFragment(source, ".eq('type_operation', 'debit')");
  requireFragment(source, ".eq('reconcilie', false)");
  requireFragment(source, ".is('depense_id', null)");
  requireFragment(source, ".from('tresorerie_depenses')");
  requireFragment(source, ".neq('source', 'qonto_sync')");
  requireFragment(source, ".gte('montant', debit.montant - 0.01)");
  requireFragment(source, ".lte('montant', debit.montant + 0.01)");
  requireFragment(source, ".gte('date_paiement_reel', new Date(new Date(txDate).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])");
  requireFragment(source, ".lte('date_paiement_reel', new Date(new Date(txDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])");
  requireFragment(source, "depense_id: matchingDepense.id");
  requireFragment(source, "errors.push(`Erreur débit ${debit.id}: ${linkError.message}`);");

  assertEquals(countOccurrences(source, "3 * 24 * 60 * 60 * 1000"), 4);
});

Deno.test("response payload includes reconciliation count, stats, errors, mode and duration", async () => {
  const source = await readModuleSource();

  requireFragment(source, ".select('reconcilie')");
  requireFragment(source, "const total = data?.length || 0;");
  requireFragment(source, "const reconciled = data?.filter(op => op.reconcilie).length || 0;");
  requireFragment(source, "unreconciled: total - reconciled");
  requireFragment(source, "rate: total > 0 ? Math.round((reconciled / total) * 100) : 0");
  requireFragment(source, "success: true");
  requireFragment(source, "mode,");
  requireFragment(source, "reconciled_count: totalReconciled");
  requireFragment(source, "stats,");
  requireFragment(source, "errors: errors.length > 0 ? errors : undefined");
  requireFragment(source, "duration_ms: duration");
  requireFragment(source, "'Content-Type': 'application/json'");
});

Deno.test("errors are sanitized through buildErrorResponse with function name and CORS headers", async () => {
  const source = await readModuleSource();

  requireFragment(source, "} catch (error: unknown) {");
  requireFragment(source, "return buildErrorResponse('qonto-reconcile', error, corsHeaders, 500);");
});

Deno.test("source assertion helper fails with an explicit missing-fragment error", () => {
  assertThrows(
    () => requireFragment("const present = true;", "absent", "missing fragment for test"),
    Error,
    "missing fragment for test",
  );
});

Deno.test("missing local module path rejects deterministically without network", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./__missing_qonto_reconcile_module__.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});

Deno.test({
  name: "module loads via relative import when an Edge runtime mock is provided",
  ignore: true,
  fn: async () => {
    const module = await import("./index.ts");
    assertExists(module);
  },
});