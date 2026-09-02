import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { encryptToken } from "../_shared/google-token-crypto.ts";
import { safeErrorLog } from "../_shared/error-sanitizer.ts";


const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function getAppUrl(): string {
  return 'https://pp-gestion.exploitant.example.org';
}

// Constant-time comparison to avoid timing leaks on signature checks
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (oauthError) {
      console.error('[oauth-google-callback] OAuth provider error:', oauthError);
      return Response.redirect(`${getAppUrl()}/parametres/visioconference?error=${encodeURIComponent(oauthError)}`, 302);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // 1. Verify HMAC signature on state (defense in depth)
    let stateData: { user_id: string; timestamp: number; nonce: string };
    try {
      const parts = state.split('.');
      if (parts.length !== 2) throw new Error('malformed');
      const [payloadB64, sigB64] = parts;
      const stateSecret = Deno.env.get('OAUTH_STATE_SECRET') || SERVICE_ROLE_KEY;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(stateSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const expected = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
      );
      const provided = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
      if (!timingSafeEqual(expected, provided)) throw new Error('bad signature');
      stateData = JSON.parse(atob(payloadB64));
    } catch (e) {
      console.error('[oauth-google-callback] State signature invalid:', (e as Error).message);
      throw new Error('Invalid state parameter');
    }

    const { user_id, timestamp, nonce } = stateData ?? ({} as Record<string, unknown>);
    if (typeof user_id !== 'string' || typeof timestamp !== 'number' || typeof nonce !== 'string') {
      throw new Error('Invalid state payload');
    }

    if (Date.now() - timestamp > 10 * 60 * 1000) {
      throw new Error('State expired');
    }

    // 2. Verify the nonce exists, is unconsumed, and is bound to this user_id (server-side ground truth)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: nonceRow, error: nonceFetchErr } = await supabaseAdmin
      .from('oauth_state_nonces')
      .select('nonce, user_id, provider, consumed_at, created_at')
      .eq('nonce', nonce)
      .maybeSingle();

    if (nonceFetchErr || !nonceRow) {
      console.error('[oauth-google-callback] Unknown nonce', { nonceFetchErr });
      throw new Error('Invalid or unknown OAuth state');
    }
    if (nonceRow.consumed_at) {
      console.error('[oauth-google-callback] Replay detected on nonce');
      throw new Error('OAuth state already used');
    }
    if (nonceRow.user_id !== user_id || nonceRow.provider !== 'google') {
      console.error('[oauth-google-callback] State user_id/provider mismatch');
      throw new Error('Invalid OAuth state binding');
    }

    // 3. Atomically consume the nonce (prevents race conditions / replay)
    const { data: consumed, error: consumeErr } = await supabaseAdmin
      .from('oauth_state_nonces')
      .update({ consumed_at: new Date().toISOString() })
      .eq('nonce', nonce)
      .is('consumed_at', null)
      .select('nonce')
      .maybeSingle();

    if (consumeErr || !consumed) {
      console.error('[oauth-google-callback] Failed to consume nonce', { consumeErr });
      throw new Error('OAuth state already used');
    }

    // 4. Exchange code for tokens — use the trusted user_id from the DB row, never from state alone
    const trustedUserId = nonceRow.user_id;
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-google-callback`;

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[oauth-google-callback] Token exchange failed:', errorText);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userInfoResponse.json();

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const encryptedAccessToken = await encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token)
      : null;

    const { error: upsertError } = await supabaseAdmin
      .from('user_oauth_connections')
      .upsert({
        user_id: trustedUserId,
        provider: 'google',
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        provider_email: userInfo.email,
        provider_user_id: userInfo.id,
        scopes: ['calendar.events', 'userinfo.email', 'openid'],
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' });

    if (upsertError) {
      console.error('[oauth-google-callback] Database error:', upsertError);
      throw new Error('Failed to store OAuth tokens');
    }

    console.log('[oauth-google-callback] Stored tokens for:', trustedUserId);

    // Best-effort cleanup of expired nonces
    supabaseAdmin.rpc('cleanup_oauth_state_nonces').then(() => {}, () => {});

    return Response.redirect(`${getAppUrl()}/parametres/visioconference?success=google`, 302);

  } catch (error: unknown) {
    console.error('[oauth-google-callback] Error:', safeErrorLog('oauth-google-callback', error));
    return Response.redirect(`${getAppUrl()}/parametres/visioconference?error=oauth_failed`, 302);
  }

});
