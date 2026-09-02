import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateCost,
  createTimer,
  extractUsage,
  getPricingTable,
  logAICall,
} from "./ai-logging.ts";

Deno.test("calculateCost calcule le coût GPT-5 avec arrondi à 6 décimales", () => {
  assertEquals(calculateCost("gpt-5", 123, 45), 0.00258);
  assertEquals(calculateCost("GPT-5", 1, 1), 0.00004);
});

Deno.test("calculateCost utilise la grille par défaut pour un modèle inconnu", () => {
  assertEquals(calculateCost("unknown-model", 10, 20), 0.0007);
});

Deno.test("calculateCost traite les tokens manquants comme zéro", () => {
  assertEquals(calculateCost("gpt-5"), 0);
  assertEquals(calculateCost("", undefined, 10), 0.0003);
  assertEquals(calculateCost("gpt-5", 10, undefined), 0.0001);
});

Deno.test("calculateCost reconnaît les noms de modèles contenant gpt-5", () => {
  assertEquals(calculateCost("azure-openai-gpt-5-deployment", 100, 50), 0.0025);
});

Deno.test("extractUsage extrait les tokens d'une réponse Azure complète", () => {
  const usage = extractUsage({
    id: "response-1",
    usage: {
      prompt_tokens: 120,
      completion_tokens: 35,
      total_tokens: 155,
    },
  });

  assertEquals(usage, {
    prompt_tokens: 120,
    completion_tokens: 35,
    total_tokens: 155,
  });
});

Deno.test("extractUsage retourne des champs undefined si usage est absent", () => {
  assertEquals(extractUsage({ id: "response-1" }), {
    prompt_tokens: undefined,
    completion_tokens: undefined,
    total_tokens: undefined,
  });

  assertEquals(extractUsage(null), {
    prompt_tokens: undefined,
    completion_tokens: undefined,
    total_tokens: undefined,
  });
});

Deno.test("createTimer mesure une durée en millisecondes", () => {
  const originalDateNow = Date.now;
  let now = 1_000;

  try {
    Date.now = () => now;

    const timer = createTimer();
    now = 1_275;

    assertEquals(timer.stop(), 275);
  } finally {
    Date.now = originalDateNow;
  }
});

Deno.test("getPricingTable retourne les tarifs métier attendus", () => {
  const pricing = getPricingTable();

  assertExists(pricing["gpt-5"]);
  assertExists(pricing["gpt-5.2"]);
  assertExists(pricing["gpt-5-mini"]);
  assertExists(pricing["gpt-5-vision"]);
  assertExists(pricing["default"]);

  assertEquals(pricing["gpt-5"], { input: 0.00001, output: 0.00003 });
  assertEquals(pricing["gpt-5.2"], { input: 0.000015, output: 0.00006 });
  assertEquals(pricing["gpt-5-mini"], { input: 0.0000015, output: 0.000006 });
  assertEquals(pricing["gpt-5-vision"], { input: 0.00001, output: 0.00003 });
  assertEquals(pricing["default"], { input: 0.00001, output: 0.00003 });
});

Deno.test("getPricingTable retourne une copie de premier niveau", () => {
  const pricing = getPricingTable();
  pricing["custom-test-model"] = { input: 1, output: 2 };

  const freshPricing = getPricingTable();

  assertEquals(freshPricing["custom-test-model"], undefined);
});

Deno.test("logAICall ne rejette pas et ignore le logging si les credentials Supabase sont absents", async () => {
  const oldUrl = Deno.env.get("SUPABASE_URL");
  const oldServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];

  try {
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    await logAICall({
      processing_type: "classification_email",
      model_used: "gpt-5",
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      processing_duration_ms: 250,
      success: true,
      result: { category: "support" },
      confidence_score: 0.92,
    });

    assertEquals(warnings.length, 1);
    assertEquals(warnings[0][0], "[AI Logging] Missing Supabase credentials, skipping log");
  } finally {
    console.warn = originalWarn;

    if (oldUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", oldUrl);
    }

    if (oldServiceRoleKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", oldServiceRoleKey);
    }
  }
});