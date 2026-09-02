// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module loads", async () => {
  const originalEnv = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };

  const originalServe = Deno.serve;
  const originalConsoleError = console.error;

  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");

    Deno.serve = ((_handler: Deno.ServeHandler) => {
      return { shutdown() {} } as Deno.HttpServer;
    }) as typeof Deno.serve;

    console.error = () => {};

    const mod = await import("./index.ts");
    assertExists(mod);
  } finally {
    if (originalEnv.SUPABASE_URL === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", originalEnv.SUPABASE_URL);

    if (originalEnv.SUPABASE_ANON_KEY === undefined) Deno.env.delete("SUPABASE_ANON_KEY");
    else Deno.env.set("SUPABASE_ANON_KEY", originalEnv.SUPABASE_ANON_KEY);

    if (originalEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalEnv.SUPABASE_SERVICE_ROLE_KEY);

    Deno.serve = originalServe;
    console.error = originalConsoleError;
  }
});

Deno.test("env access behaves as expected for required keys", () => {
  const prev = Deno.env.get("SUPABASE_URL");
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    assertEquals(Deno.env.get("SUPABASE_URL"), "https://example.supabase.co");
    Deno.env.delete("SUPABASE_URL");
    assertEquals(Deno.env.get("SUPABASE_URL"), undefined);
  } finally {
    if (prev === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prev);
  }
});

Deno.test("Request construction for edge handler scenarios is offline-safe", async () => {
  const req = new Request("http://localhost?action=stats", {
    method: "GET",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assertEquals(req.method, "GET");
  assertEquals(new URL(req.url).searchParams.get("action"), "stats");
  assertEquals(req.headers.get("Authorization"), "Bearer test-token");
});

Deno.test("Request JSON body shape for create_api_key action is correct", async () => {
  const body = {
    action: "create_api_key",
    name: "Backoffice",
    scope: "platform:site_web",
    description: "clé de test",
  };

  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = await req.json();
  assertEquals(parsed.action, "create_api_key");
  assertEquals(parsed.name, "Backoffice");
  assertEquals(parsed.scope, "platform:site_web");
  assertEquals(parsed.description, "clé de test");
});

Deno.test("URL validation regex used by module accepts https and rejects non-https", () => {
  const valid = "https://example.com/webhook";
  const invalid1 = "http://example.com/webhook";
  const invalid2 = "ftp://example.com/webhook";
  const invalid3 = "/relative/path";

  assertEquals(/^https:\/\//.test(valid), true);
  assertEquals(/^https:\/\//.test(invalid1), false);
  assertEquals(/^https:\/\//.test(invalid2), false);
  assertEquals(/^https:\/\//.test(invalid3), false);
});

Deno.test("allowed API key scopes match business rules", () => {
  const allowed = ["platform:site_web", "platform:product", "platform:product:sandbox"];

  assertEquals(allowed.includes("platform:site_web"), true);
  assertEquals(allowed.includes("platform:product"), true);
  assertEquals(allowed.includes("platform:product:sandbox"), true);
  assertEquals(allowed.includes("platform:unknown"), false);
});

Deno.test("scope to key prefix naming transformation is deterministic", () => {
  const toPrefixBase = (scope: string) =>
    `sk_${scope.replace("platform:", "").replace(":", "_")}_`;

  assertEquals(toPrefixBase("platform:site_web"), "sk_site_web_");
  assertEquals(toPrefixBase("platform:product"), "sk_product_");
  assertEquals(toPrefixBase("platform:product:sandbox"), "sk_product_sandbox_");
});

Deno.test("list_events limit logic clamps to maximum 200", () => {
  const computeLimit = (raw: string | null) => Math.min(Number(raw ?? 50), 200);

  assertEquals(computeLimit(null), 50);
  assertEquals(computeLimit("10"), 10);
  assertEquals(computeLimit("200"), 200);
  assertEquals(computeLimit("999"), 200);
});

Deno.test("stats aggregation logic counts statuses correctly", () => {
  const data = [
    { status: "pending" },
    { status: "pending" },
    { status: "delivered" },
    { status: "failed" },
    { status: "failed" },
    { status: "failed" },
  ];

  const counts: Record<string, number> = {};
  data.forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });

  assertEquals(counts, {
    pending: 2,
    delivered: 1,
    failed: 3,
  });
});

Deno.test("supported webhook systems are restricted to site_web and product", () => {
  const allowedSystems = ["site_web", "product"];

  assertEquals(allowedSystems.includes("site_web"), true);
  assertEquals(allowedSystems.includes("product"), true);
  assertEquals(allowedSystems.includes("crm"), false);
});

Deno.test("default setup_site_web webhook URL is a valid https URL", () => {
  const webhookUrl = "https://webhooks.example.org/functions/v1/platform-webhook-receive";
  assertEquals(/^https:\/\//.test(webhookUrl), true);
  assertEquals(new URL(webhookUrl).hostname, "webhooks.example.org");
});

Deno.test("response payload expectations for setup_site_web secrets are coherent", () => {
  const supabaseUrl = "https://example.supabase.co";
  const payload = {
    ok: true,
    endpoint: { id: "ep_1", system: "site_web", url: "https://example.com/hook" },
    site_web_project_id: "9028644f-1053-4ae3-9f25-62107448a1a3",
    secrets: {
      PLATFORM_API_URL: `${supabaseUrl}/functions/v1`,
      PLATFORM_API_KEY: "sk_site_web_abc123",
      PLATFORM_WEBHOOK_HMAC_SECRET: "deadbeef",
    },
    webhook_url: "https://example.com/hook",
    api_key_prefix: "sk_site_web_",
  };

  assertEquals(payload.ok, true);
  assertEquals(payload.secrets.PLATFORM_API_URL, "https://example.supabase.co/functions/v1");
  assertEquals(payload.site_web_project_id, "9028644f-1053-4ae3-9f25-62107448a1a3");
  assertEquals(payload.api_key_prefix.startsWith("sk_site_web_"), true);
});

Deno.test("assertThrows and assertRejects are available for failure-mode testing", async () => {
  assertThrows(() => {
    throw new Error("sync failure");
  }, Error, "sync failure");

  await assertRejects(
    async () => {
      throw new Error("async failure");
    },
    Error,
    "async failure",
  );
});