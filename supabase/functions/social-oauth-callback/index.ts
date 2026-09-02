// Edge Function: social-oauth-callback
// Reçoit le code OAuth, échange contre un access token, chiffre et stocke.
// Crée social_connections + social_connection_secrets + social_accounts (best-effort).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorLog } from "../_shared/error-sanitizer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY = Deno.env.get("EMAIL_ENCRYPTION_KEY")!; // réutilisé pour secrets sociaux
const APP_BASE = "https://gestion.exploitant.example.org";

interface TokenResp {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

async function exchangeMeta(code: string, redirectUri: string): Promise<TokenResp> {
  const params = new URLSearchParams({
    client_id: Deno.env.get("META_APP_ID")!,
    client_secret: Deno.env.get("META_APP_SECRET")!,
    redirect_uri: redirectUri,
    code,
  });
  const r = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`);
  if (!r.ok) throw new Error(`Meta token exchange failed: ${await r.text()}`);
  return await r.json();
}

async function exchangeLinkedIn(code: string, redirectUri: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: Deno.env.get("LINKEDIN_CLIENT_ID")!,
    client_secret: Deno.env.get("LINKEDIN_CLIENT_SECRET")!,
  });
  const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`LinkedIn token exchange failed: ${await r.text()}`);
  return await r.json();
}

async function exchangeTikTok(code: string, redirectUri: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    client_key: Deno.env.get("TIKTOK_CLIENT_KEY")!,
    client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET")!,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`TikTok token exchange failed: ${await r.text()}`);
  const j = await r.json();
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_in: j.expires_in,
    scope: j.scope,
  };
}

async function fetchProfile(platform: string, token: string): Promise<{ external_id: string; name: string }> {
  if (platform === "linkedin") {
    const r = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { external_id: "unknown", name: "LinkedIn user" };
    const j = await r.json();
    return { external_id: String(j.sub || "unknown"), name: String(j.name || j.email || "LinkedIn user") };
  }
  if (platform === "facebook" || platform === "instagram") {
    const r = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return { external_id: "unknown", name: "Meta user" };
    const j = await r.json();
    return { external_id: String(j.id), name: String(j.name || "Meta user") };
  }
  if (platform === "tiktok") {
    const r = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { external_id: "unknown", name: "TikTok user" };
    const j = await r.json();
    const u = j.data?.user || {};
    return { external_id: String(u.open_id || "unknown"), name: String(u.display_name || "TikTok user") };
  }
  return { external_id: "unknown", name: "Unknown" };
}

const escHtml = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function htmlResponse(status: "ok" | "error", message: string, returnTo: string): Response {
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>OAuth ${status}</title>
<style>body{font-family:system-ui;padding:2rem;max-width:560px;margin:0 auto;color:#111}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem;background:#fff}
.ok{color:#059669}.err{color:#dc2626}a{color:#4f46e5}</style></head>
<body><div class="card">
<h2 class="${status === "ok" ? "ok" : "err"}">${status === "ok" ? "Connexion réussie" : "Échec de connexion"}</h2>
<p>${escHtml(message)}</p>
<p><a href="${escHtml(APP_BASE + safeReturnTo)}">Retour aux paramètres</a></p>
<script>setTimeout(()=>{try{window.close()}catch(e){};location.href=${JSON.stringify(APP_BASE + safeReturnTo)}},2500)</script>
</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req.headers.get('origin')) });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return htmlResponse("error", `Provider error: ${errorParam}`, "/parametres/social");
  if (!code || !state) return htmlResponse("error", "Paramètres OAuth manquants", "/parametres/social");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const { data: st, error: stErr } = await admin
      .from("social_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (stErr || !st) throw new Error("Invalid or expired state");
    if (new Date(st.expires_at).getTime() < Date.now()) throw new Error("State expired");

    const redirectUri = `${SUPABASE_URL}/functions/v1/social-oauth-callback`;
    let tok: TokenResp;
    if (st.platform === "facebook" || st.platform === "instagram") tok = await exchangeMeta(code, redirectUri);
    else if (st.platform === "linkedin") tok = await exchangeLinkedIn(code, redirectUri);
    else if (st.platform === "tiktok") tok = await exchangeTikTok(code, redirectUri);
    else throw new Error(`Unsupported platform ${st.platform}`);

    const profile = await fetchProfile(st.platform, tok.access_token);

    // Chiffrement
    const { data: accessEnc } = await admin.rpc("encrypt_social_secret", {
      plaintext: tok.access_token,
      encryption_key: ENC_KEY,
    });
    let refreshEnc: string | null = null;
    if (tok.refresh_token) {
      const { data } = await admin.rpc("encrypt_social_secret", {
        plaintext: tok.refresh_token,
        encryption_key: ENC_KEY,
      });
      refreshEnc = (data as string) || null;
    }

    const expiresAt = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;
    const scopes = (tok.scope || "").split(/[ ,]+/).filter(Boolean);

    // Upsert connection
    const { data: conn, error: connErr } = await admin
      .from("social_connections")
      .upsert(
        {
          brand_id: st.brand_id,
          platform: st.platform,
          status: "active",
          scopes,
          external_user_id: profile.external_id,
          external_user_name: profile.name,
          expires_at: expiresAt,
          last_refresh_at: new Date().toISOString(),
          last_error: null,
          connected_by: st.user_id,
        },
        { onConflict: "brand_id,platform" },
      )
      .select("id")
      .single();
    if (connErr) throw connErr;

    await admin.from("social_connection_secrets").upsert({
      connection_id: conn.id,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
    });

    // Cleanup state
    await admin.from("social_oauth_states").delete().eq("state", state);

    return htmlResponse("ok", `Compte ${st.platform} connecté à la marque.`, st.redirect_uri || "/parametres/social");
  } catch (e) {
    console.error(JSON.stringify(safeErrorLog("social-oauth-callback", e)));
    return htmlResponse("error", "Connexion échouée. Vérifiez les permissions et réessayez.", "/parametres/social");
  }
});
