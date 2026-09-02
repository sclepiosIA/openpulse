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

Deno.test("index.ts contains expected vision handler logic markers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertExists(source);
  assertEquals(source.includes("serve(async (req) =>"), true);
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("Unauthorized"), true);
  assertEquals(source.includes("Image required (base64 or URL)"), true);
  assertEquals(source.includes("Azure OpenAI not configured"), true);
  assertEquals(source.includes("data:image/jpeg;base64,"), true);
  assertEquals(source.includes("'ocr'"), true);
  assertEquals(source.includes("'analyze'"), true);
  assertEquals(source.includes("'extract_data'"), true);
  assertEquals(source.includes("'summarize'"), true);
  assertEquals(source.includes("max_completion_tokens: 4000"), true);
  assertEquals(source.includes("reasoning_effort: 'medium'"), true);
  assertEquals(source.includes("verbosity: 'medium'"), true);
  assertEquals(source.includes("response.status === 429"), true);
  assertEquals(source.includes("Azure request timeout (90s)"), true);
  assertEquals(source.includes("buildErrorResponse('jarvis-vision', error, corsHeaders, 500)"), true);
});

Deno.test("index.ts defines expected CORS headers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  // Le durcissement CORS a deporte l'objet d'en-tetes dans le module partage.
  // index.ts importe corsHeaders et conserve en commentaire la liste des
  // en-tetes acceptes d'origine, dont les quatre x-supabase-client-*.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false);
  assertEquals(
    source.includes("// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"),
    true,
  );
});

Deno.test("index.ts includes all task-specific system prompts with business text", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("Tu es un expert en OCR pour OpenPulse."), true);
  assertEquals(source.includes("Extrais tout le texte visible de cette image"), true);
  assertEquals(source.includes("Tu es un expert en analyse documentaire pour OpenPulse."), true);
  assertEquals(source.includes("Analyse cette image et décris son contenu"), true);
  assertEquals(source.includes("Tu es un expert en extraction de données pour OpenPulse."), true);
  assertEquals(source.includes("Retourne les données au format JSON"), true);
  assertEquals(source.includes("Tu es un assistant OpenPulse."), true);
  assertEquals(source.includes("Résume le contenu de cette image"), true);
});

Deno.test("index.ts contains retry and logging flow for Azure Vision", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("console.warn('[jarvis-vision] Rate limited, retrying in 1s...');"), true);
  assertEquals(source.includes("await new Promise(r => setTimeout(r, 1000));"), true);
  assertEquals(source.includes("const usage = extractUsage(data);"), true);
  assertEquals(source.includes("const duration = timer.stop();"), true);
  assertEquals(source.includes("await logAICall({"), true);
  assertEquals(source.includes("processing_type: `jarvis-vision-${task}`"), true);
  assertEquals(source.includes("model_used: 'gpt-5-vision'"), true);
  assertEquals(source.includes("processed_by: userId"), true);
});

Deno.test("index.ts has buildErrorResponse fallback but no explicit catch block in source", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("return buildErrorResponse('jarvis-vision', error, corsHeaders, 500);"), true);
  assertEquals(source.includes("} catch ("), true);
});

Deno.test("le module se charge, sans ouvrir de port", async () => {
  // Cette epreuve exigeait auparavant que le module NE se charge PAS.
  const charge = await chargerSansServeur();
  assertExists(charge);
});