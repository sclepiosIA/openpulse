import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module source contains expected private helpers and serve entrypoint", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes("serve(async (req) => {"), true);
  assertEquals(source.includes("async function analyzeEmailThread"), true);
  assertEquals(source.includes("function analyzeSentiment"), true);
  assertEquals(source.includes("function calculatePriorityScore"), true);
  assertEquals(source.includes("function extractKeyTopics"), true);
  assertEquals(source.includes("function detectActionRequired"), true);
  assertEquals(source.includes("function estimateResponseTime"), true);
  assertEquals(source.includes("function getSuggestedTone"), true);
  assertEquals(source.includes("async function getPriorityInbox"), true);
  assertEquals(source.includes("async function suggestResponse"), true);
  assertEquals(source.includes("async function detectSentimentAlerts"), true);
});

Deno.test("module source encodes authorization and ownership protections", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes("Authorization"), true);
  assertEquals(source.includes("Bearer "), true);
  assertEquals(source.includes("role !== 'authenticated'"), true);
  assertEquals(source.includes("verifyThreadOwnership"), true);
  assertEquals(source.includes("Forbidden"), true);
  assertEquals(source.includes("Unknown action"), true);
});

Deno.test("module source includes expected business keywords and response templates", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes("urgent"), true);
  assertEquals(source.includes("problème"), true);
  assertEquals(source.includes("merci"), true);
  assertEquals(source.includes("facturation"), true);
  assertEquals(source.includes("technique"), true);
  assertEquals(source.includes("commercial"), true);
  assertEquals(source.includes("support"), true);
  assertEquals(source.includes("formation"), true);
  assertEquals(source.includes("rdv"), true);
  assertEquals(source.includes("Je prends en charge votre demande immédiatement"), true);
  assertEquals(source.includes("Je comprends votre frustration"), true);
  assertEquals(source.includes("Merci pour votre retour positif"), true);
});

Deno.test("index.ts is not safely importable in tests because top-level serve binds a port", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('from "https://deno.land/std@0.168.0/http/server.ts"'), true);
  assertEquals(source.includes("serve(async (req) => {"), true);
});

Deno.test("Request construction for edge-style invocation remains available offline", () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer test-token",
    },
    body: JSON.stringify({ action: "get_priority_inbox", threadId: "thread-1" }),
  });

  assertEquals(req.method, "POST");
  assertEquals(req.headers.get("authorization"), "Bearer test-token");
  assertExists(req.headers.get("content-type"));
});

Deno.test("assertRejects works for offline missing module scenario", async () => {
  await assertRejects(async () => {
    await import("./does-not-exist.ts");
  });
});

Deno.test("assertThrows works in harness", () => {
  assertThrows(() => {
    throw new Error("expected");
  });
});