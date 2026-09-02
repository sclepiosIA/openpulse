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

const indexUrl = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(indexUrl);
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);

  assertEquals(start >= 0, true);
  assertEquals(end > start, true);

  return source.slice(start, end);
}

Deno.test("le module se charge, sans ouvrir de port", async () => {
  // Cette epreuve exigeait auparavant que le module NE se charge PAS.
  const charge = await chargerSansServeur();
  assertExists(charge);
});

Deno.test("source exposes the expected predefined workflow identifiers", async () => {
  const source = await readIndexSource();

  const workflowIds = Array.from(
    source.matchAll(/'([^']+)':\s*\{\s*id:\s*'\1'/g),
    (match) => match[1],
  );

  assertEquals(workflowIds, [
    "onboarding_client",
    "cloture_mensuelle",
    "suivi_prospect",
    "weekly_report",
  ]);
});

Deno.test("onboarding workflow contains the expected ordered business steps", async () => {
  const source = await readIndexSource();
  const onboardingBlock = sliceBetween(
    source,
    "'onboarding_client':",
    "'cloture_mensuelle':",
  );

  const stepIds = Array.from(
    onboardingBlock.matchAll(/id:\s*'([^']+)'/g),
    (match) => match[1],
  );

  assertEquals(stepIds, [
    "onboarding_client",
    "create_etab",
    "add_contacts",
    "create_tasks",
    "send_welcome",
    "schedule_kickoff",
  ]);

  assertEquals(onboardingBlock.includes("action: 'create_entity'"), true);
  assertEquals(onboardingBlock.includes("params: { entity_type: 'etablissement' }"), true);
  assertEquals(onboardingBlock.includes("params: { entity_type: 'contact', link_to_prev: true }"), true);
  assertEquals(onboardingBlock.includes("params: { template: 'deploiement' }"), true);
  assertEquals(onboardingBlock.includes("params: { template: 'welcome_client' }"), true);
  assertEquals(onboardingBlock.includes("params: { type: 'kickoff', days_from_now: 7 }"), true);
});

Deno.test("monthly closing workflow keeps treasury report generation unconditional", async () => {
  const source = await readIndexSource();
  const workflowBlock = sliceBetween(
    source,
    "'cloture_mensuelle':",
    "'suivi_prospect':",
  );

  assertEquals(workflowBlock.includes("id: 'sync_qonto'"), true);
  assertEquals(workflowBlock.includes("action: 'sync_qonto_transactions'"), true);
  assertEquals(workflowBlock.includes("params: { days_back: 35 }"), true);

  assertEquals(workflowBlock.includes("id: 'generate_report'"), true);
  assertEquals(workflowBlock.includes("name: 'Générer rapport trésorerie'"), true);
  assertEquals(workflowBlock.includes("action: 'generate_treasury_report'"), true);
  assertEquals(workflowBlock.includes("params: { period: 'last_month' }"), true);
  assertEquals(workflowBlock.includes("condition: { type: 'always' }"), true);
});

Deno.test("prospect follow-up workflow defines the expected custom relaunch thresholds", async () => {
  const source = await readIndexSource();
  const workflowBlock = sliceBetween(
    source,
    "'suivi_prospect':",
    "'weekly_report':",
  );

  assertEquals(workflowBlock.includes("id: 'check_status'"), true);
  assertEquals(workflowBlock.includes("table: 'etablissements'"), true);
  assertEquals(workflowBlock.includes("value: 'Prospect'"), true);

  assertEquals(workflowBlock.includes("id: 'send_relance_3j'"), true);
  assertEquals(workflowBlock.includes("template: 'prospect_relance_soft'"), true);
  assertEquals(workflowBlock.includes("expression: 'days >= 3 && days < 7'"), true);

  assertEquals(workflowBlock.includes("id: 'alert_commercial_7j'"), true);
  assertEquals(workflowBlock.includes("expression: 'days >= 7'"), true);
  assertEquals(workflowBlock.includes("priority: 'high'"), true);
});

Deno.test("weekly report workflow collects crm finance and support data before summary", async () => {
  const source = await readIndexSource();
  const start = source.indexOf("'weekly_report':");

  assertEquals(start >= 0, true);

  const workflowBlock = source.slice(start);
  const stepIds = Array.from(
    workflowBlock.matchAll(/id:\s*'([^']+)'/g),
    (match) => match[1],
  ).slice(0, 6);

  assertEquals(stepIds, [
    "weekly_report",
    "collect_crm_data",
    "collect_finance_data",
    "collect_support_data",
    "generate_summary",
    "send_report",
  ]);

  assertEquals(workflowBlock.includes("params: { agents: ['crm'] }"), true);
  assertEquals(workflowBlock.includes("params: { agents: ['tresorerie'] }"), true);
  assertEquals(workflowBlock.includes("params: { agents: ['support'] }"), true);
  assertEquals(workflowBlock.includes("action: 'generate_weekly_summary'"), true);
  assertEquals(workflowBlock.includes("params: { role: 'all', type: 'weekly_report' }"), true);
});

Deno.test("le bloc d'imports du module est bien forme", async () => {
  // Cette epreuve exigeait auparavant la PRESENCE de l'import imbrique qui
  // empechait le module de se charger : elle certifiait le defaut.
  const source = await readIndexSource();

  const importImbrique = /import\s*\{\s*import\s*\{\s*buildErrorResponse\s*\}/;

  assertEquals(importImbrique.test(source), false);
});

Deno.test("workflow execution model includes rollback and parallelism metadata", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("on_failure?: 'stop' | 'continue' | 'rollback'"), true);
  assertEquals(source.includes("rollback_action?: string"), true);
  assertEquals(source.includes("depends_on?: string[]"), true);
  assertEquals(source.includes("parallel_with?: string[]"), true);
  assertEquals(source.includes("execution_strategy?: 'sequential' | 'parallel' | 'dag'"), true);
  assertEquals(source.includes("parallel_groups_count?: number"), true);
  assertEquals(source.includes("max_parallelism?: number"), true);
});