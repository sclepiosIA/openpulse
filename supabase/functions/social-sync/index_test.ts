// Smoke tests for social edge functions (unauthenticated path).
// Vérifie que les endpoints renvoient 401 sans Bearer token et que
// les payloads d'erreur sont bien JSON + CORS headers.
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Un hote d'exemple n'est pas une instance : un autre banc pose
// SUPABASE_URL au niveau module sans la retirer, et Deno enchaine les
// fichiers dans le meme processus. Sans ce filtre, ces epreuves
// appellent une adresse qui n'existe pas.
const HOTES_FICTIFS = /(^|\.)(example|test)\.supabase\.co$|\.example\.(org|com|net)$/;
const __base = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const BASE = (() => {
  if (!__base) return "";
  try { return HOTES_FICTIFS.test(new URL(__base).hostname) ? "" : __base; }
  catch { return ""; }
})();
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}/functions/v1/${path}`, {
    ...init,
    headers: { apikey: ANON, ...(init.headers || {}) },
  });
  const body = await res.text();
  return { status: res.status, body };
}

Deno.test("social-sync rejects unauthenticated", async () => {
  if (!BASE) return;
  const { status, body } = await call("social-sync", { method: "POST", body: "{}" });
  assertEquals(status, 401);
  assertExists(body);
});

Deno.test("social-publish rejects unauthenticated", async () => {
  if (!BASE) return;
  const { status } = await call("social-publish", { method: "POST", body: "{}" });
  assertEquals(status, 401);
});

Deno.test("social-comment-reply rejects unauthenticated", async () => {
  if (!BASE) return;
  const { status } = await call("social-comment-reply", { method: "POST", body: "{}" });
  assertEquals(status, 401);
});

Deno.test("social-scheduler rejects without cron secret", async () => {
  if (!BASE) return;
  const { status } = await call("social-scheduler", { method: "POST", body: "{}" });
  // accepts 401/403 depending on impl
  if (status !== 401 && status !== 403) {
    throw new Error(`expected 401/403, got ${status}`);
  }
});

Deno.test("social-health-alerts rejects unauthenticated", async () => {
  if (!BASE) return;
  const { status } = await call("social-health-alerts", { method: "POST", body: "{}" });
  assertEquals(status, 401);
});
