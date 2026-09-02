// Session 10 — Lot C: réécriture des liens d'un email HTML vers track-email-click.
// Ignore mailto:, tel:, javascript:, ancres internes (#...) et liens de désabonnement.
//
// Sécurité: chaque URL réécrite est signée HMAC-SHA256 (param `s`) pour empêcher
// que le endpoint `track-email-click` soit utilisé comme open redirect.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const TRACK_ENDPOINT = `${SUPABASE_URL}/functions/v1/track-email-click`;
const HMAC_SECRET = Deno.env.get("EMAIL_TRACKING_HMAC_SECRET") ?? "";

const SKIP_HOSTS = new Set<string>([
  // hôtes connus marque à ne pas tracker (désabonnement, public)
]);

function b64urlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

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
    ["sign"]
  );
  return cachedKey;
}

async function signPayload(payload: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlFromBytes(new Uint8Array(sig));
}

function shouldSkip(url: string): boolean {
  if (!url) return true;
  const lower = url.trim().toLowerCase();
  if (lower.startsWith("mailto:")) return true;
  if (lower.startsWith("tel:")) return true;
  if (lower.startsWith("javascript:")) return true;
  if (lower.startsWith("#")) return true;
  if (lower.startsWith("{{") || lower.startsWith("${")) return true; // variables non résolues
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return true;
    if (u.pathname.includes("/unsubscribe") || u.pathname.includes("/desabonnement")) return true;
    if (SKIP_HOSTS.has(u.host)) return true;
    if (u.host.includes(new URL(SUPABASE_URL || "https://x").host)) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Réécrit les `href` des balises `<a>` pour passer par track-email-click.
 * @param html HTML de l'email
 * @param threadId UUID du thread (optionnel, pour corrélation)
 */
export async function rewriteLinksForTracking(html: string, threadId?: string): Promise<string> {
  if (!html || !SUPABASE_URL) return html;
  // Si le secret HMAC n'est pas configuré, ne réécrit pas (sinon les liens
  // produiraient une 403 côté tracker). Le tracking est désactivé en attendant
  // que `EMAIL_TRACKING_HMAC_SECRET` soit défini.
  if (!HMAC_SECRET) return html;

  const matches: Array<{ match: string; prefix: string; url: string; suffix: string }> = [];
  const regex = /(<a\b[^>]*\bhref\s*=\s*["'])([^"']+)(["'])/gi;
  html.replace(regex, (match, prefix, url, suffix) => {
    matches.push({ match, prefix, url, suffix });
    return match;
  });

  const replacements = new Map<string, string>();
  for (const { match, prefix, url, suffix } of matches) {
    if (shouldSkip(url)) continue;
    const encoded = b64urlEncode(url);
    const t = threadId ?? "";
    const payload = `${encoded}|${t}|`;
    const sig = await signPayload(payload);
    if (!sig) continue;
    const params = new URLSearchParams();
    params.set("u", encoded);
    if (threadId) params.set("t", threadId);
    params.set("s", sig);
    const tracked = `${TRACK_ENDPOINT}?${params.toString()}`;
    replacements.set(match, `${prefix}${tracked}${suffix}`);
  }

  return html.replace(regex, (match) => replacements.get(match) ?? match);
}
