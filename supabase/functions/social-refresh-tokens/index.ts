// Edge Function: social-refresh-tokens
// CRON quotidien — pour chaque connexion active dont expires_at < now() + 7 jours,
// tente un refresh selon la plateforme (FB/IG long-lived, LinkedIn rotate, TikTok refresh_token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorLog } from "../_shared/error-sanitizer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY = Deno.env.get("EMAIL_ENCRYPTION_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

async function decryptTokens(admin: any, connectionId: string) {
  const { data: sec } = await admin
    .from("social_connection_secrets")
    .select("access_token_enc, refresh_token_enc")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!sec) return null;
  const { data: at } = await admin.rpc("decrypt_social_secret", { ciphertext: sec.access_token_enc, encryption_key: ENC_KEY });
  let rt: string | null = null;
  if (sec.refresh_token_enc) {
    const { data } = await admin.rpc("decrypt_social_secret", { ciphertext: sec.refresh_token_enc, encryption_key: ENC_KEY });
    rt = (data as string) || null;
  }
  return { access_token: at as string, refresh_token: rt };
}

async function refreshMeta(token: string): Promise<{ access_token: string; expires_in: number } | null> {
  const r = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${Deno.env.get("META_APP_ID")}&client_secret=${Deno.env.get("META_APP_SECRET")}&fb_exchange_token=${encodeURIComponent(token)}`,
  );
  if (!r.ok) return null;
  return await r.json();
}

async function refreshTikTok(refreshToken: string): Promise<any> {
  const body = new URLSearchParams({
    client_key: Deno.env.get("TIKTOK_CLIENT_KEY")!,
    client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET")!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!r.ok) return null;
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req.headers.get('origin')) });
  const provided = req.headers.get("x-cron-secret") ?? "";
  const eq = (a: string, b: string) => {
    if (!a || !b || a.length !== b.length) return false;
    let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };
  if (!eq(provided, CRON_SECRET)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } });
  }


  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: conns } = await admin
      .from("social_connections")
      .select("id, platform, expires_at")
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.lte.${cutoff}`);

    const results: any[] = [];
    for (const c of (conns || [])) {
      try {
        const toks = await decryptTokens(admin, c.id);
        if (!toks) continue;
        let newAt: string | null = null;
        let newRt: string | null = null;
        let expSec: number | null = null;
        if (c.platform === "facebook" || c.platform === "instagram") {
          const r = await refreshMeta(toks.access_token);
          if (r) { newAt = r.access_token; expSec = r.expires_in; }
        } else if (c.platform === "tiktok" && toks.refresh_token) {
          const r = await refreshTikTok(toks.refresh_token);
          if (r?.access_token) { newAt = r.access_token; newRt = r.refresh_token; expSec = r.expires_in; }
        }
        if (newAt) {
          const { data: atEnc } = await admin.rpc("encrypt_social_secret", { plaintext: newAt, encryption_key: ENC_KEY });
          const update: any = { access_token_enc: atEnc };
          if (newRt) {
            const { data: rtEnc } = await admin.rpc("encrypt_social_secret", { plaintext: newRt, encryption_key: ENC_KEY });
            update.refresh_token_enc = rtEnc;
          }
          await admin.from("social_connection_secrets").update(update).eq("connection_id", c.id);
          await admin.from("social_connections").update({
            expires_at: expSec ? new Date(Date.now() + expSec * 1000).toISOString() : null,
            last_refresh_at: new Date().toISOString(),
            status: "active",
            last_error: null,
          }).eq("id", c.id);
          results.push({ id: c.id, refreshed: true });
        } else {
          results.push({ id: c.id, refreshed: false, reason: "no refresh path" });
        }
      } catch (e: any) {
        results.push({ id: c.id, refreshed: false, error: (e?.message || "").slice(0, 200) });
      }
    }
    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(JSON.stringify(safeErrorLog("social-refresh-tokens", e)));
    return new Response(JSON.stringify({ error: "refresh failed" }), {
      status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
    });
  }
});
