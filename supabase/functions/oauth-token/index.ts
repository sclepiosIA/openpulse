import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const JWT_SECRET = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
  
  // SECURITY: Fail if JWT_SECRET is not configured - no fallback allowed
  if (!JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "server_error", error_description: "Authentication service misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      body = await req.json();
    }

    const grantType = body.grant_type;
    const clientId = body.client_id;
    const clientSecret = body.client_secret;

    // Verify client credentials
    const { data: app, error: appError } = await supabase
      .from("oauth_apps")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (appError || !app) {
      return new Response(
        JSON.stringify({ error: "invalid_client", error_description: "Unknown client" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify client secret
    const expectedSecretHash = createHmac("sha256", JWT_SECRET)
      .update(clientSecret || "")
      .digest("hex");

    if (app.client_secret_hash !== expectedSecretHash) {
      return new Response(
        JSON.stringify({ error: "invalid_client", error_description: "Invalid client credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different grant types
    if (grantType === "authorization_code") {
      const code = body.code;
      const redirectUri = body.redirect_uri;

      if (!code) {
        return new Response(
          JSON.stringify({ error: "invalid_request", error_description: "Missing authorization code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify authorization code
      const { data: authCode, error: codeError } = await supabase
        .from("oauth_authorization_codes")
        .select("*")
        .eq("code", code)
        .eq("client_id", clientId)
        .single();

      if (codeError || !authCode) {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Invalid authorization code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if code is expired
      if (new Date(authCode.expires_at) < new Date()) {
        await supabase.from("oauth_authorization_codes").delete().eq("code", code);
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Authorization code expired" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if code was already used
      if (authCode.used_at) {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Authorization code already used" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify redirect_uri matches
      if (authCode.redirect_uri !== redirectUri) {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Redirect URI mismatch" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark code as used
      await supabase
        .from("oauth_authorization_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("code", code);

      // Generate tokens
      const accessToken = generateToken();
      const refreshToken = generateToken();
      const expiresIn = 3600; // 1 hour
      const refreshExpiresIn = 30 * 24 * 3600; // 30 days

      // Store hashed tokens (raw tokens are returned to client only)
      await supabase.from("oauth_access_tokens").insert({
        token: await hashToken(accessToken),
        client_id: clientId,
        user_id: authCode.user_id,
        scope: authCode.scope,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });

      await supabase.from("oauth_refresh_tokens").insert({
        token: await hashToken(refreshToken),
        client_id: clientId,
        user_id: authCode.user_id,
        scope: authCode.scope,
        expires_at: new Date(Date.now() + refreshExpiresIn * 1000).toISOString(),
      });

      return new Response(
        JSON.stringify({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: expiresIn,
          refresh_token: refreshToken,
          scope: authCode.scope,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (grantType === "refresh_token") {
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: "invalid_request", error_description: "Missing refresh token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify refresh token (hash lookup)
      const refreshTokenHash = await hashToken(refreshToken);
      const { data: storedToken, error: tokenError } = await supabase
        .from("oauth_refresh_tokens")
        .select("*")
        .eq("token", refreshTokenHash)
        .eq("client_id", clientId)
        .single();

      if (tokenError || !storedToken) {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Invalid refresh token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if token is expired
      if (new Date(storedToken.expires_at) < new Date()) {
        await supabase.from("oauth_refresh_tokens").delete().eq("token", refreshTokenHash);
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Refresh token expired" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new access token
      const newAccessToken = generateToken();
      const expiresIn = 3600;

      await supabase.from("oauth_access_tokens").insert({
        token: await hashToken(newAccessToken),
        client_id: clientId,
        user_id: storedToken.user_id,
        scope: storedToken.scope,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });

      return new Response(
        JSON.stringify({
          access_token: newAccessToken,
          token_type: "Bearer",
          expires_in: expiresIn,
          scope: storedToken.scope,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (grantType === "client_credentials") {
      // Generate access token for machine-to-machine
      const accessToken = generateToken();
      const expiresIn = 3600;
      const scope = body.scope || "read";

      await supabase.from("oauth_access_tokens").insert({
        token: await hashToken(accessToken),
        client_id: clientId,
        scope: scope,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });

      return new Response(
        JSON.stringify({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: expiresIn,
          scope: scope,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "unsupported_grant_type", error_description: "Grant type not supported" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in oauth-token:", error);
    return buildErrorResponse('oauth-token', error, corsHeaders, 500);
  }
});

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
