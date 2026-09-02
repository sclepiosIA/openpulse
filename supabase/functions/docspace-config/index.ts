import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * DocSpace Configuration Edge Function
 * 
 * Returns the DocSpace SDK configuration for initializing the editor.
 * Handles authentication via API Key with DocSpace.
 */

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOCSPACE_URL = Deno.env.get("ONLYOFFICE_DOCSPACE_URL");
    const API_KEY = Deno.env.get("ONLYOFFICE_API_KEY");

    if (!DOCSPACE_URL) {
      throw new Error("ONLYOFFICE_DOCSPACE_URL not configured");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = claimsData.user;

    // Get user profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom, prenom")
      .eq("id", user.id)
      .single();

    const userName = profile 
      ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() || user.email || "Utilisateur"
      : user.email || "Utilisateur";

    // Return DocSpace configuration
    return new Response(
      JSON.stringify({
        docSpaceUrl: DOCSPACE_URL,
        hasApiKey: !!API_KEY,
        userId: user.id,
        userName,
        userEmail: user.email,
        sdkUrl: `${DOCSPACE_URL}/static/scripts/sdk/2.0.0/api.js`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('docspace-config', error, corsHeaders, 500);
  }
});
