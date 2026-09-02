// Shared HMAC helpers for email tracking endpoints (click + open pixel).
// Signing uses EMAIL_TRACKING_HMAC_SECRET. Endpoints must reject requests
// whose signature does not match — this prevents external actors from forging
// open/click events for known thread UUIDs.

const HMAC_SECRET = Deno.env.get("EMAIL_TRACKING_HMAC_SECRET") ?? "";

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey | null> {
  if (!HMAC_SECRET) return null;
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

export function buildOpenPayload(threadId: string | null, messageId: string | null): string {
  return `open|${threadId ?? ""}|${messageId ?? ""}`;
}

export async function signOpenPayload(
  threadId: string | null,
  messageId: string | null,
): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildOpenPayload(threadId, messageId)),
  );
  return b64urlFromBytes(new Uint8Array(sig));
}

export async function verifyOpenSignature(
  threadId: string | null,
  messageId: string | null,
  signature: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await signOpenPayload(threadId, messageId);
  if (!expected || expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export function isTrackingHmacConfigured(): boolean {
  return !!HMAC_SECRET;
}
