import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting complete team email mappings...');

    // Définir tous les mappings email de l'équipe
    const teamEmailMappings = [
      // Camille Durand
      { email: 'membre.equipe@example.invalid', profile_email: 'membre.equipe@example.invalid' },
      { email: 'membre.equipe@example.invalid', profile_email: 'membre.equipe@example.invalid' },
      
      // Camille Durand
      { email: 'membre.equipe@example.invalid', profile_email: 'membre.equipe@example.invalid' },
      { email: 'membre.equipe@example.invalid', profile_email: 'membre.equipe@example.invalid' },
      
      // Camille Begné
      { email: 'membre.equipe@example.invalid', profile_email: 'membre.equipe@example.invalid' },
      
      // Président (Camille Martin)
      { email: 'president@exploitant.example.org', profile_email: 'andrei.galindo@exploitant.example.org' },
      { email: 'andrei.galindo@exploitant.example.org', profile_email: 'andrei.galindo@exploitant.example.org' },
      
      // Camille Durand
      { email: 'membre.equipe@example.invalid', profile_email: 'membre.equipe@example.invalid' },
    ];

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Traiter chaque mapping
    for (const mapping of teamEmailMappings) {
      try {
        // Récupérer le profile_id à partir de l'email du profil
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', mapping.profile_email)
          .single();

        if (profileError || !profile) {
          console.error(`❌ Profile not found for ${mapping.profile_email}`);
          errorCount++;
          results.push({
            email: mapping.email,
            profile_email: mapping.profile_email,
            status: 'error',
            message: 'Profile not found',
          });
          continue;
        }

        // Upsert le mapping email avec TOUTES les colonnes nécessaires
        const { error: mappingError } = await supabase
          .from('email_specific_mappings')
          .upsert({
            email_address: mapping.email.toLowerCase(),
            profile_id: profile.id,
            niveau_mapping: 'equipe',
            verified: true,
            confidence_level: 'high',
            etablissement_id: null,
            groupe_id: null,
            partenaire_id: null,
            notes: `Mapping automatique équipe OpenPulse - ${new Date().toISOString()}`
          }, {
            onConflict: 'email_address',
            ignoreDuplicates: false
          });

        if (mappingError) {
          console.error(`❌ Error creating mapping for ${mapping.email}:`, mappingError);
          errorCount++;
          results.push({
            email: mapping.email,
            profile_id: profile.id,
            status: 'error',
            message: mappingError.message,
          });
        } else {
          console.log(`✅ Mapping created/updated for ${mapping.email} -> profile ${profile.id}`);
          successCount++;
          results.push({
            email: mapping.email,
            profile_id: profile.id,
            status: 'success',
          });
        }
      } catch (error) {
        console.error(`❌ Unexpected error for ${mapping.email}:`, error);
        errorCount++;
        results.push({
          email: mapping.email,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`✅ Complete team email mappings finished: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        total: teamEmailMappings.length,
        success_count: successCount,
        error_count: errorCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    return buildErrorResponse('complete-team-email-mappings', error, corsHeaders, 500);
  }
});
