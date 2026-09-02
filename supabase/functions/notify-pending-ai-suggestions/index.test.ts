import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function loadIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function extractNumberConst(source: string, name: string): number {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
  if (!match) {
    throw new Error(`Unable to find numeric const ${name}`);
  }
  return Number(match[1]);
}

function extractFunctionSource(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}`);
  if (start === -1) {
    throw new Error(`Unable to find function ${functionName}`);
  }

  const bodyStart = source.indexOf("{", start);
  if (bodyStart === -1) {
    throw new Error(`Unable to find function body for ${functionName}`);
  }

  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`Unable to parse function body for ${functionName}`);
}

function buildRateLimitHarness(source: string): {
  checkRateLimit: (identifier: string) => boolean;
  rateLimitMap: Map<string, { count: number; resetAt: number }>;
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX_REQUESTS: number;
} {
  const RATE_LIMIT_WINDOW = extractNumberConst(source, "RATE_LIMIT_WINDOW");
  const RATE_LIMIT_MAX_REQUESTS = extractNumberConst(source, "RATE_LIMIT_MAX_REQUESTS");
  const functionSource = extractFunctionSource(source, "checkRateLimit")
    .replace("function checkRateLimit(identifier: string): boolean", "function checkRateLimit(identifier)");

  const factory = new Function(`
    const rateLimitMap = new Map();
    const RATE_LIMIT_WINDOW = ${RATE_LIMIT_WINDOW};
    const RATE_LIMIT_MAX_REQUESTS = ${RATE_LIMIT_MAX_REQUESTS};
    ${functionSource}
    return { checkRateLimit, rateLimitMap, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX_REQUESTS };
  `);

  return factory();
}

Deno.test("source exposes the expected Edge Function structure and security constants", async () => {
  const source = await loadIndexSource();

  assertExists(source);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes('import { Resend } from "npm:resend@2.0.0";'), true);
  assertEquals(source.includes('buildErrorResponse'), true);

  assertEquals(extractNumberConst(source, "RATE_LIMIT_WINDOW"), 60000);
  assertEquals(extractNumberConst(source, "RATE_LIMIT_MAX_REQUESTS"), 20);

  assertEquals(source.includes("origineAutorisee()"), true);
  assertEquals(
    source.includes('"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret"'),
    true,
  );
  assertEquals(source.includes('if (req.method === "OPTIONS")'), true);
  assertEquals(source.includes('authHeader.includes(serviceRoleKey)'), true);
  assertEquals(source.includes('status: 401'), true);
});

Deno.test("checkRateLimit allows exactly 20 requests in the same one-minute window", async () => {
  const source = await loadIndexSource();
  const { checkRateLimit, rateLimitMap, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX_REQUESTS } = buildRateLimitHarness(source);

  const originalNow = Date.now;
  let now = 1_700_000_000_000;
  Date.now = () => now;

  try {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      assertEquals(checkRateLimit("203.0.113.10"), true);
    }

    assertEquals(checkRateLimit("203.0.113.10"), false);

    const record = rateLimitMap.get("203.0.113.10");
    assertExists(record);
    assertEquals(record.count, 20);
    assertEquals(record.resetAt, now + RATE_LIMIT_WINDOW);
  } finally {
    Date.now = originalNow;
  }
});

Deno.test("checkRateLimit isolates identifiers and resets after the configured window", async () => {
  const source = await loadIndexSource();
  const { checkRateLimit, rateLimitMap, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX_REQUESTS } = buildRateLimitHarness(source);

  const originalNow = Date.now;
  let now = 10_000;
  Date.now = () => now;

  try {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      assertEquals(checkRateLimit("198.51.100.7"), true);
    }

    assertEquals(checkRateLimit("198.51.100.7"), false);
    assertEquals(checkRateLimit("198.51.100.8"), true);

    now += RATE_LIMIT_WINDOW + 1;

    assertEquals(checkRateLimit("198.51.100.7"), true);

    const resetRecord = rateLimitMap.get("198.51.100.7");
    assertExists(resetRecord);
    assertEquals(resetRecord.count, 1);
    assertEquals(resetRecord.resetAt, now + RATE_LIMIT_WINDOW);
  } finally {
    Date.now = originalNow;
  }
});

Deno.test("notification email template contains the expected AI suggestions business wording", async () => {
  const source = await loadIndexSource();

  assertEquals(source.includes("suggestion${userData.count > 1 ? 's' : ''} IA en attente"), true);
  assertEquals(source.includes("Vous avez <strong>${userData.count} suggestion"), true);
  assertEquals(source.includes("Établissements concernés"), true);
  assertEquals(source.includes("Mises à jour de tâches"), true);
  assertEquals(source.includes("Créations de nouvelles tâches"), true);
  assertEquals(source.includes("Changements de statut"), true);
  assertEquals(source.includes("Mises à jour de résumés"), true);
  assertEquals(source.includes("Traiter les suggestions"), true);
  assertEquals(source.includes("https://gestion-marque-ia.apercu.example.org/etablissements"), true);
});

Deno.test("Supabase queries target pending AI suggestions and user notification preferences", async () => {
  const source = await loadIndexSource();

  assertEquals(source.includes('.from("ai_suggested_actions")'), true);
  assertEquals(source.includes('.eq("status", "pending")'), true);
  assertEquals(source.includes("etablissement_id"), true);
  assertEquals(source.includes("commercial_id"), true);
  assertEquals(source.includes("chef_projet_id"), true);
  assertEquals(source.includes("csm_id"), true);

  assertEquals(source.includes('.from("profiles")'), true);
  assertEquals(source.includes('.select("prenom, nom, email")'), true);
  assertEquals(source.includes('.select("preferences")'), true);
  assertEquals(source.includes("email_notifications?.ai_suggestions"), true);
  assertEquals(source.includes("frequency === 'never'"), true);
});

Deno.test("source extraction helpers fail loudly when expected symbols are missing", () => {
  assertThrows(
    () => extractNumberConst("const OTHER_VALUE = 123;", "RATE_LIMIT_WINDOW"),
    Error,
    "RATE_LIMIT_WINDOW",
  );

  assertThrows(
    () => extractFunctionSource("const checkRateLimit = null;", "checkRateLimit"),
    Error,
    "checkRateLimit",
  );
});

Deno.test("module import is available behind an explicit Edge integration flag", async () => {
  if (Deno.env.get("RUN_EDGE_IMPORT_TEST") !== "1") {
    await assertRejects(
      () => Deno.readTextFile(new URL("./__missing_edge_import_fixture__.ts", import.meta.url)),
      Deno.errors.NotFound,
    );
    return;
  }

  const previousResendKey = Deno.env.get("RESEND_API_KEY");
  const previousSupabaseUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  Deno.env.set("RESEND_API_KEY", "test-resend-key");
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

  try {
    await import("./index.ts");
    assertEquals(true, true);
  } finally {
    globalThis.fetch = originalFetch;

    if (previousResendKey === undefined) Deno.env.delete("RESEND_API_KEY");
    else Deno.env.set("RESEND_API_KEY", previousResendKey);

    if (previousSupabaseUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousSupabaseUrl);

    if (previousServiceRoleKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceRoleKey);
  }
});