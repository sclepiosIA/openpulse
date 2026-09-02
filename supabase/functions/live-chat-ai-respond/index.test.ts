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

Deno.test("le module se charge, sans ouvrir de port", async () => {
  // Ce banc entier exigeait auparavant que le module NE se charge PAS : il
  // avait fige en contrat l'erreur de syntaxe qui rendait la fonction inerte.
  const charge = await chargerSansServeur();
  assertExists(charge);
});

Deno.test("deux chargements successifs donnent le meme module", async () => {
  const premier = await chargerSansServeur();
  const second = await chargerSansServeur();

  assertExists(premier);
  assertExists(second);
  assertEquals(Object.keys(premier).sort(), Object.keys(second).sort());
});

Deno.test("module import still rejects when Azure env vars are absent", async () => {
  const originalEnv = {
    AZURE_OPENAI_ENDPOINT: Deno.env.get("AZURE_OPENAI_ENDPOINT"),
    AZURE_OPENAI_API_KEY: Deno.env.get("AZURE_OPENAI_API_KEY"),
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };

  try {
    Deno.env.delete("AZURE_OPENAI_ENDPOINT");
    Deno.env.delete("AZURE_OPENAI_API_KEY");
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    // Le chargement ne doit dependre d'aucune variable d'environnement : la
    // fonction lit Azure a l'appel, pas a l'import.
    const charge = await chargerSansServeur();
    assertExists(charge);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});

Deno.test("assert utilities behave as expected in harness sanity checks", async () => {
  assertThrows(() => {
    throw new TypeError("boom");
  }, TypeError);

  await assertRejects(
    async () => {
      throw new Error("async boom");
    },
    Error,
  );
});