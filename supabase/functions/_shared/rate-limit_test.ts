import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { origineAutorisee } from './cors.ts'
import {
  _resetRateLimitBucketsForTests,
  checkRateLimit,
  extractClientIp,
  rateLimitedResponse,
} from "./rate-limit.ts";

Deno.test("checkRateLimit allows under the limit", () => {
  _resetRateLimitBucketsForTests();
  for (let i = 0; i < 5; i++) {
    const r = checkRateLimit("k1", { limit: 5, windowSec: 60 });
    assertEquals(r.allowed, true);
  }
});

Deno.test("checkRateLimit blocks once limit is exceeded", () => {
  _resetRateLimitBucketsForTests();
  for (let i = 0; i < 3; i++) checkRateLimit("k2", { limit: 3, windowSec: 60 });
  const r = checkRateLimit("k2", { limit: 3, windowSec: 60 });
  assertEquals(r.allowed, false);
  assertEquals(typeof r.retryAfterSec, "number");
  assertEquals(r.remaining, 0);
});

Deno.test("checkRateLimit resets after window expires", async () => {
  _resetRateLimitBucketsForTests();
  checkRateLimit("k3", { limit: 1, windowSec: 1 });
  const blocked = checkRateLimit("k3", { limit: 1, windowSec: 1 });
  assertEquals(blocked.allowed, false);
  await new Promise((r) => setTimeout(r, 1100));
  const after = checkRateLimit("k3", { limit: 1, windowSec: 1 });
  assertEquals(after.allowed, true);
});

Deno.test("extractClientIp picks first x-forwarded-for entry", () => {
  const req = new Request("https://x.test", {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  });
  assertEquals(extractClientIp(req), "203.0.113.7");
});

Deno.test("extractClientIp falls back to cf-connecting-ip then unknown", () => {
  const req1 = new Request("https://x.test", { headers: { "cf-connecting-ip": "198.51.100.5" } });
  assertEquals(extractClientIp(req1), "198.51.100.5");
  const req2 = new Request("https://x.test");
  assertEquals(extractClientIp(req2), "unknown");
});

Deno.test("rateLimitedResponse sets 429 + Retry-After", async () => {
  const resp = rateLimitedResponse(42, { 'Access-Control-Allow-Origin': origineAutorisee() });
  assertEquals(resp.status, 429);
  assertEquals(resp.headers.get("Retry-After"), "42");
  const body = await resp.json();
  assertEquals(body.retry_after, 42);
});
