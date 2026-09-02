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

function extractStringArrayConstant(source: string, constantName: string): string[] {
  const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) {
    throw new Error(`Missing array constant: ${constantName}`);
  }

  return [...match[1].matchAll(/'((?:\\'|[^'])*)'/g)].map((entry) => entry[1].replace(/\\'/g, "'"));
}

function extractAgentKeywords(source: string): Record<string, string[]> {
  const objectMatch = source.match(/const\s+AGENT_KEYWORDS\s*:\s*Record<string,\s*string\[\]>\s*=\s*\{([\s\S]*?)\};/);
  if (!objectMatch) {
    throw new Error("Missing AGENT_KEYWORDS catalog");
  }

  const result: Record<string, string[]> = {};
  const entryRegex = /(\w+)\s*:\s*\[([\s\S]*?)\],/g;

  for (const match of objectMatch[1].matchAll(entryRegex)) {
    result[match[1]] = [...match[2].matchAll(/'((?:\\'|[^'])*)'/g)].map((entry) => entry[1].replace(/\\'/g, "'"));
  }

  return result;
}

Deno.test("source parser fails explicitly when an expected catalog is absent", () => {
  assertThrows(
    () => extractStringArrayConstant("const OTHER = ['briefing'];", "CONFERENCE_TRIGGERS"),
    Error,
    "CONFERENCE_TRIGGERS",
  );
});

Deno.test("agent keyword catalog contains the expected business routing targets", async () => {
  const source = await readModuleSource();
  const keywords = extractAgentKeywords(source);

  assertEquals(Object.keys(keywords).sort(), ["alex", "emma", "marcus", "noah", "olivia", "prime", "sophia"].sort());

  assertEquals(keywords.prime.includes("jarvis"), true);
  assertEquals(keywords.prime.includes("briefing"), true);

  assertEquals(keywords.sophia.includes("client"), true);
  assertEquals(keywords.sophia.includes("crm"), true);
  assertEquals(keywords.sophia.includes("contrat"), true);

  assertEquals(keywords.marcus.includes("rh"), true);
  assertEquals(keywords.marcus.includes("congé"), true);
  assertEquals(keywords.marcus.includes("salaire"), true);

  assertEquals(keywords.olivia.includes("trésorerie"), true);
  assertEquals(keywords.olivia.includes("paiement"), true);
  assertEquals(keywords.olivia.includes("qonto"), true);

  assertEquals(keywords.noah.includes("r&d"), true);
  assertEquals(keywords.noah.includes("backlog"), true);
  assertEquals(keywords.noah.includes("bug"), true);

  assertEquals(keywords.emma.includes("support"), true);
  assertEquals(keywords.emma.includes("incident"), true);

  assertEquals(keywords.alex.includes("kpi"), true);
  assertEquals(keywords.alex.includes("dashboard"), true);
});

Deno.test("conference trigger catalog includes multi-agent meeting phrases", async () => {
  const source = await readModuleSource();
  const triggers = extractStringArrayConstant(source, "CONFERENCE_TRIGGERS");

  assertEquals(triggers.length, 8);
  assertEquals(triggers.includes("briefing"), true);
  assertEquals(triggers.includes("point complet"), true);
  assertEquals(triggers.includes("tour de table"), true);
  assertEquals(triggers.includes("réunion équipe"), true);
  assertEquals(triggers.includes("tout le monde"), true);
  assertEquals(triggers.includes("équipe complète"), true);
  assertEquals(triggers.includes("avis de tous"), true);
  assertEquals(triggers.includes("qu'en pensez-vous tous"), true);
});

Deno.test("direct handoff trigger catalog includes expected voice commands", async () => {
  const source = await readModuleSource();
  const triggers = extractStringArrayConstant(source, "HANDOFF_TRIGGERS");

  assertEquals(triggers.length, 8);
  assertEquals(triggers.includes("appelle"), true);
  assertEquals(triggers.includes("passe à"), true);
  assertEquals(triggers.includes("demande à"), true);
  assertEquals(triggers.includes("qu'en pense"), true);
  assertEquals(triggers.includes("avis de"), true);
  assertEquals(triggers.includes("parle à"), true);
  assertEquals(triggers.includes("passe-moi"), true);
  assertEquals(triggers.includes("je veux parler à"), true);
});

Deno.test("normalization helper is designed to lowercase, remove accents and trim text", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/function\s+normalizeText\s*\(\s*text:\s*string\s*\):\s*string/));
  assertEquals(source.includes(".toLowerCase()"), true);
  assertEquals(source.includes(".normalize('NFD')"), true);
  assertEquals(source.includes(".replace(/[\\u0300-\\u036f]/g, '')"), true);
  assertEquals(source.includes(".trim()"), true);
});

Deno.test("intent response contract defines conference and fallback question behaviours", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("type: 'conference'"), true);
  assertEquals(source.includes("conferenceAgents: ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex']"), true);
  assertEquals(source.includes("confidence: 0.95"), true);
  assertEquals(source.includes("Je lance le briefing d'équipe. Chaque membre va intervenir."), true);

  assertEquals(source.includes("type: 'question'"), true);
  assertEquals(source.includes("targetAgent: currentAgent || 'prime'"), true);
  assertEquals(source.includes("confidence: 0.7"), true);
});

Deno.test("le module se charge, sans ouvrir de port", async () => {
  // Cette epreuve exigeait auparavant que le module NE se charge PAS, et que
  // sa reponse d'erreur porte `logError` -- la variable du catch imbrique,
  // qui n'existe pas a cet endroit.
  const source = await readModuleSource();

  assertEquals(source.includes("serve(async (req) =>"), true);
  assertEquals(source.includes("return buildErrorResponse('jarvis-voice-intent', error, corsHeaders, 500);"), true);

  const charge = await chargerSansServeur();
  assertExists(charge);
});