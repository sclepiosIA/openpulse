import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * Weekly RH Analysis CRON Job
 * Runs every Monday at 8:00 AM to refresh RH insights for all users
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret = req.headers.get("x-function-secret");
  const auth = req.headers.get("authorization") ?? "";
  const isServiceRole = auth === `Bearer ${supabaseServiceKey}`;
  if (!isServiceRole && (!internalSecret || providedSecret !== internalSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[weekly-rh-analysis] Démarrage du CRON hebdomadaire RH");

    // Récupérer tous les utilisateurs actifs (avec profil)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .limit(50);

    if (profilesError) {
      console.error("[weekly-rh-analysis] Erreur récupération profiles:", profilesError);
      throw profilesError;
    }

    console.log(`[weekly-rh-analysis] ${profiles?.length || 0} utilisateurs à traiter`);

    // Appeler analyze-rh-insights une seule fois (analyse globale)
    // L'analyse est la même pour tous les utilisateurs de l'entreprise
    const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
      "analyze-rh-insights",
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    if (analysisError) {
      console.error("[weekly-rh-analysis] Erreur analyse RH:", analysisError);
      throw analysisError;
    }

    // Sauvegarder pour chaque utilisateur
    const upsertPromises = (profiles || []).map(async (profile) => {
      const { error } = await supabase
        .from("ai_analysis_log")
        .upsert({
          user_id: profile.id,
          analysis_type: "rh_insights",
          insights_data: analysisResult,
          insights_count: (analysisResult?.tendances?.length || 0) + 
                          (analysisResult?.alertes?.length || 0) + 
                          (analysisResult?.recommandations?.length || 0),
          has_insights: true,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,analysis_type",
        });

      if (error) {
        console.error(`[weekly-rh-analysis] Erreur sauvegarde pour ${profile.id}:`, error);
      }
      return { userId: profile.id, success: !error };
    });

    const results = await Promise.all(upsertPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`[weekly-rh-analysis] Terminé: ${successCount}/${profiles?.length || 0} utilisateurs mis à jour`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Analyse RH hebdomadaire terminée`,
        users_updated: successCount,
        total_users: profiles?.length || 0,
        score_climat: analysisResult?.score_climat,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('weekly-rh-analysis', error, corsHeaders, 500);
  }

});
