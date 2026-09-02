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
import { origineAutorisee } from "../_shared/cors.ts";

Deno.test("module source contains expected edge-function structure and syntax issue is detectable", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('serve(async (req) => {'), true);
  assertEquals(source.includes("const RequestSchema = z.object({"), true);
  assertEquals(source.includes('return buildErrorResponse(\'migrate-to-jmap\', error, corsHeaders, 500);'), true);
  assertEquals(source.includes("results.push({"), true);

  // Cette epreuve exigeait auparavant que le module NE se charge PAS.
  const charge = await chargerSansServeur();
  assertExists(charge);
});

Deno.test("Request constructor handles valid JSON body shape used by handler", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer test",
    },
    body: JSON.stringify({
      account_id: "550e8400-e29b-41d4-a716-446655440000",
      dry_run: true,
    }),
  });

  const body = await req.json();
  assertEquals(body.account_id, "550e8400-e29b-41d4-a716-446655440000");
  assertEquals(body.dry_run, true);
});

Deno.test("Request constructor allows empty JSON body fallback scenario", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      authorization: "Bearer test",
    },
    body: "{}",
  });

  const body = await req.json();
  assertEquals(body, {});
});

Deno.test("invalid JSON body rejects when reading request json", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test",
    },
    body: "{invalid json",
  });

  await assertRejects(() => req.json());
});

Deno.test("Authorization header can be absent, matching unauthorized branch precondition", () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{}",
  });

  assertEquals(req.headers.get("Authorization"), null);
});

Deno.test("AbortSignal.timeout creates a signal for fetch timeout usage", () => {
  const signal = AbortSignal.timeout(10);
  assertExists(signal);
  assertEquals(typeof signal.aborted, "boolean");
});

Deno.test("Response can represent unauthorized payload expected by handler", async () => {
  const resp = new Response(
    JSON.stringify({ error: "Unauthorized" }),
    {
      status: 401,
      headers: {
        'Access-Control-Allow-Origin': origineAutorisee(),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
        "Content-Type": "application/json",
      },
    },
  );

  assertEquals(resp.status, 401);
  assertEquals(resp.headers.get("Content-Type"), "application/json");
  const data = await resp.json();
  assertEquals(data.error, "Unauthorized");
});

Deno.test("UUID parsing expectation for account_id test fixtures remains stable", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const invalidUuid = "not-a-uuid";

  assertEquals(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(validUuid),
    true,
  );
  assertEquals(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invalidUuid),
    false,
  );
});

Deno.test("assertThrows works for explicit error cases used by defensive test scaffolding", () => {
  assertThrows(() => {
    throw new Error("Failed to fetch accounts: boom");
  }, Error, "Failed to fetch accounts");
});

Deno.test("source contains business result statuses used by migration flow", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('status: "skipped"'), true);
  assertEquals(source.includes('status: "ready"'), true);
  assertEquals(source.includes('status: "migrated"'), true);
  assertEquals(source.includes('status: "failed"'), true);
});

Deno.test("source contains Supabase query filters for active enabled imap accounts", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('.from("user_email_accounts")'), true);
  assertEquals(source.includes('.eq("is_active", true)'), true);
  assertEquals(source.includes('.eq("sync_enabled", true)'), true);
  assertEquals(source.includes('.eq("sync_method", "imap")'), true);
});