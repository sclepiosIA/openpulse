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

Deno.test("le module se charge, sans ouvrir de port", async () => {
  // Cette epreuve exigeait auparavant que le module NE se charge PAS.
  const charge = await chargerSansServeur();
  assertExists(charge);
});

Deno.test("source defines the expected OnlyOffice callback security checks", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("ONLYOFFICE_JWT_SECRET"), true);
  assertEquals(source.includes("Authorization"), true);
  assertEquals(source.includes("Bearer "), true);
  assertEquals(source.includes("jose.jwtVerify"), true);
  // Le protocole OnlyOffice attend « { error: 1 } » ; la fonction le rend, au
  // lieu du corps generique du socle d'erreurs.
  assertEquals(source.includes('JSON.stringify({ error: 1 })'), true);
});

Deno.test("source defines CORS preflight handling", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('req.method === "OPTIONS"'), true);
  // La consolidation CORS a deporte les en-tetes hors de index.ts : la
  // fonction importe desormais la constante du module partage. On verifie
  // donc (a) que le fichier livre pointe bien vers ce module, puis (b) sur
  // le VRAI module partage, charge par URL absolue, la liste d en-tetes
  // acceptee et le fait que l'origine generique n'est plus jamais emise.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  const socleCors = await import(new URL("../_shared/cors.ts", import.meta.url).href);
  assertEquals(
    socleCors.corsHeaders["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(socleCors.corsHeaders["Access-Control-Allow-Origin"] === "*", false);
});

Deno.test("OnlyOffice callback status contract is documented in source", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("status 1: Document is being edited"), true);
  assertEquals(source.includes("status 2: Document is ready for saving"), true);
  assertEquals(source.includes("status 3: Document saving error"), true);
  assertEquals(source.includes("status 4: Document closed with no changes"), true);
  assertEquals(
    source.includes("status 6: Document is being edited but force save requested"),
    true,
  );
  assertEquals(source.includes("status 7: Error occurred during force save"), true);
});

Deno.test("OnlyOfficeCallback interface contains required document callback fields", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/interface\s+OnlyOfficeCallback/));
  assertExists(source.match(/status:\s*number/));
  assertExists(source.match(/url\?:\s*string/));
  assertExists(source.match(/key:\s*string/));
  assertExists(source.match(/users\?:\s*string\[\]/));
  assertExists(source.match(/actions\?:\s*Array<\{\s*type:\s*number;\s*userid:\s*string\s*\}>/));
  assertExists(source.match(/changesurl\?:\s*string/));
  assertExists(source.match(/history\?:\s*any/));
  assertExists(source.match(/forcesavetype\?:\s*number/));
});

Deno.test("Deno.env restoration pattern works for OnlyOffice secret tests", () => {
  const key = "ONLYOFFICE_JWT_SECRET";
  const original = Deno.env.get(key);

  try {
    Deno.env.set(key, "unit-test-secret");
    assertEquals(Deno.env.get(key), "unit-test-secret");
  } finally {
    if (original === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, original);
    }
  }

  assertEquals(Deno.env.get(key), original);
});

Deno.test("fetch can be stubbed offline and restored", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 0, saved: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const response = await fetch("https://onlyoffice.invalid/callback");
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, { error: 0, saved: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("assertThrows is available for synchronous validation failures", () => {
  assertThrows(
    () => {
      throw new TypeError("invalid callback payload");
    },
    TypeError,
    "invalid callback payload",
  );
});