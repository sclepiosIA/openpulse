import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "../_shared/google-token-crypto.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Get user from JWT
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get current connection
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: connection, error: connError } = await supabaseAdmin
      .from('user_oauth_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (connError || !connection) {
      throw new Error('No Google connection found');
    }

    const refreshTokenPlain = await decryptToken(connection.refresh_token_encrypted);
    if (!refreshTokenPlain) {
      throw new Error('No refresh token available');
    }

    // Refresh the token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshTokenPlain,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[oauth-google-refresh] Refresh failed:', errorText);
      throw new Error('Failed to refresh token');
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const encryptedAccessToken = await encryptToken(tokens.access_token);

    // Update in database (encrypted at rest)
    const { error: updateError } = await supabaseAdmin
      .from('user_oauth_connections')
      .update({
        access_token_encrypted: encryptedAccessToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    if (updateError) {
      throw new Error('Failed to update token in database');
    }

    console.log('[oauth-google-refresh] Token refreshed for user:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        access_token: tokens.access_token,
        expires_at: expiresAt 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[oauth-google-refresh] Error:', error);
    return buildErrorResponse('oauth-google-refresh', error, corsHeaders, 500);
  }
});
