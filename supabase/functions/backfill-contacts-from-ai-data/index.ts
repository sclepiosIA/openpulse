import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Vérifier que l'utilisateur est admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔄 Starting contacts backfill from AI data...");

    // Récupérer tous les threads avec établissement ET contacts dans ai_extracted_data
    const { data: threads, error: threadsError } = await supabaseAdmin
      .from('email_threads')
      .select('id, etablissement_id, ai_extracted_data')
      .not('etablissement_id', 'is', null)
      .not('ai_extracted_data', 'is', null);

    if (threadsError) {
      console.error("Error fetching threads:", threadsError);
      throw threadsError;
    }

    console.log(`📊 Found ${threads?.length || 0} threads with establishments`);

    // Filtrer ceux qui ont des contacts
    const threadsWithContacts = threads?.filter(t => {
      const contacts = t.ai_extracted_data?.contacts;
      return Array.isArray(contacts) && contacts.length > 0;
    }) || [];

    console.log(`📇 Found ${threadsWithContacts.length} threads with contacts in AI data`);

    if (threadsWithContacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No threads with contacts found",
          threads_processed: 0,
          etablissements_processed: 0,
          total_contacts_created: 0,
          total_contacts_updated: 0,
          total_contacts_skipped: 0,
          total_errors: 0,
          report: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Grouper par établissement pour un rapport structuré
    const threadsByEtablissement = new Map<string, typeof threadsWithContacts>();
    for (const thread of threadsWithContacts) {
      const etablissementId = thread.etablissement_id;
      if (!threadsByEtablissement.has(etablissementId)) {
        threadsByEtablissement.set(etablissementId, []);
      }
      threadsByEtablissement.get(etablissementId)!.push(thread);
    }

    console.log(`🏥 Processing ${threadsByEtablissement.size} establishments`);

    const report: any[] = [];
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Traiter chaque établissement
    for (const [etablissementId, etablissementThreads] of threadsByEtablissement) {
      console.log(`\n🏥 Processing etablissement ${etablissementId} (${etablissementThreads.length} threads)`);

      // Récupérer les infos de l'établissement
      const { data: etablissement } = await supabaseAdmin
        .from('etablissements')
        .select('nom, ville')
        .eq('id', etablissementId)
        .single();

      let etablissementCreated = 0;
      let etablissementUpdated = 0;
      let etablissementSkipped = 0;
      let etablissementErrors = 0;

      // Traiter chaque thread
      for (const thread of etablissementThreads) {
        const contacts = thread.ai_extracted_data?.contacts || [];
        
        // Filtrer les contacts avec confidence >= 0.7
        const highConfidenceContacts = contacts.filter((c: any) => (c.confidence || 0) >= 0.7);

        if (highConfidenceContacts.length === 0) {
          continue;
        }

        try {
          const { data: result, error: createError } = await supabaseAdmin.functions.invoke(
            'auto-create-contacts-from-email',
            {
              body: {
                thread_id: thread.id,
                etablissement_id: etablissementId,
                contacts: highConfidenceContacts
              }
            }
          );

          if (createError) {
            console.error(`Error creating contacts for thread ${thread.id}:`, createError);
            etablissementErrors += highConfidenceContacts.length;
          } else {
            etablissementCreated += result?.created_count || 0;
            etablissementUpdated += result?.updated_count || 0;
            etablissementSkipped += result?.skipped_count || 0;
            etablissementErrors += result?.error_count || 0;
          }
        } catch (err) {
          console.error(`Exception processing thread ${thread.id}:`, err);
          etablissementErrors += highConfidenceContacts.length;
        }
      }

      totalCreated += etablissementCreated;
      totalUpdated += etablissementUpdated;
      totalSkipped += etablissementSkipped;
      totalErrors += etablissementErrors;

      report.push({
        etablissement_id: etablissementId,
        etablissement_nom: etablissement?.nom || 'Inconnu',
        etablissement_ville: etablissement?.ville || 'Inconnue',
        threads_processed: etablissementThreads.length,
        contacts_created: etablissementCreated,
        contacts_updated: etablissementUpdated,
        contacts_skipped: etablissementSkipped,
        contacts_errors: etablissementErrors
      });

      console.log(`✅ Etablissement ${etablissement?.nom}: ${etablissementCreated} créés, ${etablissementUpdated} enrichis, ${etablissementSkipped} ignorés, ${etablissementErrors} erreurs`);
    }

    console.log(`\n📊 Final report:`);
    console.log(`  - Threads processed: ${threadsWithContacts.length}`);
    console.log(`  - Establishments processed: ${threadsByEtablissement.size}`);
    console.log(`  - Total contacts created: ${totalCreated}`);
    console.log(`  - Total contacts updated: ${totalUpdated}`);
    console.log(`  - Total contacts skipped: ${totalSkipped}`);
    console.log(`  - Total errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill completed: ${totalCreated} contacts created, ${totalUpdated} enriched, ${totalSkipped} skipped, ${totalErrors} errors`,
        threads_processed: threadsWithContacts.length,
        etablissements_processed: threadsByEtablissement.size,
        total_contacts_created: totalCreated,
        total_contacts_updated: totalUpdated,
        total_contacts_skipped: totalSkipped,
        total_errors: totalErrors,
        report
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('backfill-contacts-from-ai-data', error, corsHeaders, 500);
  }
});
