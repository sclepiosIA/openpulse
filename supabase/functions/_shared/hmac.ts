/**
 * HMAC signature verification helper for Edge Functions.
 *
 * Use this on webhooks/callbacks that accept payloads from third parties
 * (Stripe, DocuSeal, social platforms, internal cron triggers, etc.).
 *
 * Workflow:
 *   1. Sender signs the raw body with a shared secret using HMAC-SHA256.
 *   2. Sender sends `X-Signature: sha256=<hex>` (or just `<hex>`).
 *   3. Receiver reads the raw body, calls `verifyHmacSignature(...)`.
 *
 * The verification is timing-safe (constant-time comparison).
 *
 * Cf. docs/edge-functions-registry.md — Security Hardening Matrix (lot L2).
 */

export interface HmacVerifyOptions {
  /** Algorithm — defaults to SHA-256. */
  algorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512';
  /** Maximum age of the timestamp in seconds (replay protection). 0 disables. */
  maxAgeSeconds?: number;
  /** Timestamp value (Unix seconds or ISO string). Required if maxAgeSeconds > 0. */
  timestamp?: string | number | null;
}

/**
 * Compute the HMAC signature for a payload.
 * Returns the hex-encoded signature.
 */
export async function computeHmacSignature(
  payload: string,
  secret: string,
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison.
 * Avoids leaking timing information about signature mismatch position.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify an HMAC signature against a raw payload.
 *
 * Accepts signatures with or without the `sha256=` prefix.
 * Returns `{ ok: true }` on match, `{ ok: false, reason }` otherwise.
 */
export async function verifyHmacSignature(
  payload: string,
  signature: string | null | undefined,
  secret: string,
  options: HmacVerifyOptions = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!signature) return { ok: false, reason: 'missing_signature' };
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const { algorithm = 'SHA-256', maxAgeSeconds = 0, timestamp } = options;

  // Replay protection (optional).
  if (maxAgeSeconds > 0) {
    if (timestamp === null || timestamp === undefined || timestamp === '') {
      return { ok: false, reason: 'missing_timestamp' };
    }
    const ts =
      typeof timestamp === 'number'
        ? timestamp
        : Math.floor(new Date(timestamp).getTime() / 1000);
    if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid_timestamp' };
    const ageSec = Math.floor(Date.now() / 1000) - ts;
    if (ageSec < -60) return { ok: false, reason: 'timestamp_in_future' };
    if (ageSec > maxAgeSeconds) return { ok: false, reason: 'timestamp_expired' };
  }

  // Normalize "sha256=abcdef" → "abcdef".
  const normalized = signature.includes('=')
    ? signature.split('=', 2)[1].trim().toLowerCase()
    : signature.trim().toLowerCase();

  const expected = await computeHmacSignature(payload, secret, algorithm);
  return timingSafeEqual(normalized, expected)
    ? { ok: true }
    : { ok: false, reason: 'signature_mismatch' };
}

/**
 * Convenience: verify an internal cron/scheduler invocation using a shared
 * secret stored in a Supabase secret (e.g. `INTERNAL_INVOCATION_SECRET`).
 *
 * The caller is expected to pass the secret via the `x-internal-secret`
 * header. This is NOT a substitute for HMAC on third-party webhooks — use
 * `verifyHmacSignature` for those.
 */
export function verifyInternalSecret(
  headerValue: string | null | undefined,
  expectedSecret: string | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!expectedSecret) return { ok: false, reason: 'secret_not_configured' };
  if (!headerValue) return { ok: false, reason: 'missing_header' };
  return timingSafeEqual(headerValue, expectedSecret)
    ? { ok: true }
    : { ok: false, reason: 'secret_mismatch' };
}
