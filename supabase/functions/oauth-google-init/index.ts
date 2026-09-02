import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID not configured');
    }

    // Authenticate the caller (verifies JWT in code)
    const supabaseAuth = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a single-use nonce stored server-side (binds state → user_id in DB)
    const nonce = crypto.randomUUID();
    const supabaseAdmin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const { error: nonceErr } = await supabaseAdmin
      .from('oauth_state_nonces')
      .insert({ nonce, user_id: user.id, provider: 'google' });
    if (nonceErr) {
      console.error('[oauth-google-init] Failed to store nonce:', nonceErr);
      throw new Error('Failed to initialize OAuth state');
    }

    // Build signed state (HMAC-SHA256) — defense in depth alongside DB nonce
    const stateSecret = Deno.env.get('OAUTH_STATE_SECRET') || SERVICE_ROLE_KEY!;
    const payload = { user_id: user.id, timestamp: Date.now(), nonce };
    const payloadB64 = btoa(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(stateSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    const state = `${payloadB64}.${sigB64}`;

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-google-callback`;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    console.log('[oauth-google-init] Generated auth URL for user:', user.id);

    return new Response(
      JSON.stringify({ success: true, authUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[oauth-google-init] Error:', error);
    return buildErrorResponse('oauth-google-init', error, corsHeaders, 500);
  }
});
