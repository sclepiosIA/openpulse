/**
 * Best-effort in-memory rate limiter for Supabase Edge Functions.
 *
 * Limitations (read before using on critical endpoints):
 *  - Per-isolate state: Deno Deploy may run multiple isolates concurrently,
 *    so the effective limit can be N × the configured one when traffic
 *    spreads across isolates. Treat this as a courtesy throttle, not a
 *    hard security control. For strict quotas, back it with a DB counter.
 *  - State is lost on cold start: a burst right after deploy bypasses the
 *    limiter. Good enough for anti-spam, not for billing.
 *
 * Use the higher-level `checkRateLimit(key, opts)` helper. It returns
 * `{ allowed: true }` on success or `{ allowed: false, retryAfterSec }`
 * when the bucket is empty.
 *
 * Recommended keys:
 *  - `${functionName}:${ip}` for anonymous public endpoints
 *  - `${functionName}:${userId}` for authenticated endpoints
 *  - `${functionName}:${ip}:${action}` when one EF serves multiple actions
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();

// Garbage-collect expired buckets at most once per minute.
let lastGc = 0;
function maybeGc(now: number) {
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitOptions {
  /** Max requests allowed per window. Must be >= 1. */
  limit: number;
  /** Window length in seconds. Must be >= 1. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** When denied, seconds the client should wait before retrying. */
  retryAfterSec?: number;
  /** Remaining requests in the current window (informational). */
  remaining: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeGc(now);

  const windowMs = Math.max(1, opts.windowSec) * 1000;
  const limit = Math.max(1, opts.limit);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count };
}

/**
 * Extracts the best-available client IP from common headers. Returns
 * `"unknown"` when nothing usable is present (the limiter then degrades
 * to a per-deployment global bucket — still better than nothing).
 */
export function extractClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Returns a 429 Response with `Retry-After` set. Caller supplies CORS
 * headers so the response is consistent with the rest of the function.
 */
export function rateLimitedResponse(
  retryAfterSec: number,
  corsHeaders: Record<string, string>,
  message = "Trop de requêtes, veuillez réessayer plus tard.",
): Response {
  return new Response(JSON.stringify({ error: message, retry_after: retryAfterSec }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSec),
    },
  });
}

// Test-only: reset all buckets (do not call from production code paths).
export function _resetRateLimitBucketsForTests(): void {
  buckets.clear();
  lastGc = 0;
}
