import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateUserAuth } from "../_shared/auth-helpers.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication
    const auth = await validateUserAuth(req);
    if ('error' in auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { profile_id, date_debut, date_fin, type_absence } = await req.json();
    console.log(`[check-absence-conflicts] Checking conflicts for ${profile_id} from ${date_debut} to ${date_fin}`);

    if (!profile_id || !date_debut || !date_fin) {
      throw new Error('Missing required parameters');
    }

    // Validate strict ISO date format (YYYY-MM-DD) to prevent PostgREST filter injection
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!ISO_DATE.test(date_debut) || !ISO_DATE.test(date_fin)) {
      return new Response(JSON.stringify({ error: 'Invalid date format (expected YYYY-MM-DD)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // Validate UUID for profile_id
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile_id)) {
      return new Response(JSON.stringify({ error: 'Invalid profile_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client (service role for cross-team queries)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authorization: caller may only query own profile, unless admin/RH
    if (profile_id !== auth.userId) {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );
      const { data: canManage } = await userClient.rpc('can_manage_rh_data');
      if (!canManage) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. Récupérer le profil de l'employé
    const { data: profile } = await supabase
      .from('profiles')
      .select('prenom, nom, email')
      .eq('id', profile_id)
      .single();

    // 2. Récupérer les autres absences qui chevauchent cette période
    const { data: overlappingAbsences } = await supabase
      .from('rh_absences')
      .select(`
        *,
        profiles!rh_absences_profile_id_fkey (prenom, nom)
      `)
      .or(`and(date_debut.lte.${date_fin},date_fin.gte.${date_debut})`)
      .neq('profile_id', profile_id)
      .in('statut', ['validee', 'en_attente'])
      .limit(100); // Safety limit

    // 3. Récupérer l'historique d'absences de cet employé sur les 12 derniers mois
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data: employeeHistory } = await supabase
      .from('rh_absences')
      .select('type_absence, nombre_jours, date_debut, date_fin')
      .eq('profile_id', profile_id)
      .eq('statut', 'validee')
      .gte('date_debut', oneYearAgo.toISOString().split('T')[0])
      .limit(100); // Safety limit

    // 4. Vérifier si c'est une période critique (fin de mois, deadline projet)
    const requestedStart = new Date(date_debut);
    const requestedEnd = new Date(date_fin);
    
    // Fin de mois = dernière semaine
    const isEndOfMonth = requestedStart.getDate() > 24 || requestedEnd.getDate() > 24;
    
    // Préparer le contexte pour GPT-5
    const contextData = {
      employee: profile?.prenom + ' ' + profile?.nom || 'Employé',
      requestedPeriod: {
        start: date_debut,
        end: date_fin,
        type: type_absence
      },
      overlappingTeamAbsences: overlappingAbsences?.map(a => ({
        employee: a.profiles?.prenom + ' ' + a.profiles?.nom,
        dates: `${a.date_debut} - ${a.date_fin}`,
        type: a.type_absence,
        status: a.statut
      })) || [],
      employeeHistoryLast12Months: {
        totalDays: employeeHistory?.reduce((sum, a) => sum + (a.nombre_jours || 0), 0) || 0,
        absences: employeeHistory?.length || 0
      },
      criticalPeriod: {
        isEndOfMonth,
        month: requestedStart.getMonth() + 1
      }
    };

    // 5. Appeler GPT-5 pour analyser les conflits
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      console.log('[check-absence-conflicts] Azure OpenAI not configured, returning basic analysis');
      
      // Analyse basique sans IA
      const warnings: string[] = [];
      let riskScore = 0;

      if (overlappingAbsences && overlappingAbsences.length > 0) {
        warnings.push(`${overlappingAbsences.length} collègue(s) absent(s) sur cette période`);
        riskScore += 30 * overlappingAbsences.length;
      }

      if (isEndOfMonth) {
        warnings.push("Période de fin de mois (clôtures comptables)");
        riskScore += 15;
      }

      return new Response(JSON.stringify({
        hasConflict: warnings.length > 0,
        riskScore: Math.min(100, riskScore),
        warnings,
        recommendation: warnings.length > 0 
          ? "Quelques points d'attention identifiés, la demande peut être soumise"
          : "Aucun conflit détecté, la demande peut être validée"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `Tu es un assistant RH expert en gestion des absences et planification d'équipe.
Analyse la demande de congé suivante et identifie les risques potentiels.

Évalue:
1. Chevauchements avec d'autres absences (risque de sous-effectif)
2. Périodes critiques (fin de mois, périodes de pic d'activité)
3. Historique de l'employé (a-t-il déjà beaucoup de congés cette année?)
4. Impact sur l'équipe

Retourne un JSON avec:
{
  "hasConflict": boolean,
  "riskScore": number (0-100),
  "warnings": string[],
  "recommendation": string (max 100 caractères)
}`;

    const userPrompt = `Analyse cette demande de congé:
${JSON.stringify(contextData, null, 2)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_completion_tokens: 500,
          reasoning_effort: "low",
          verbosity: "low",
          response_format: { type: "json_object" }
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (azureResponse.status === 429) {
        console.log('[check-absence-conflicts] Rate limited, waiting 1s and retrying...');
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_completion_tokens: 500,
            reasoning_effort: "low",
            verbosity: "low",
            response_format: { type: "json_object" }
          }),
        });
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('[check-absence-conflicts] Azure request timeout');
        throw new Error('Azure request timeout (30s)');
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('[check-absence-conflicts] Azure error:', azureResponse.status, errorText);
      throw new Error(`Azure API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Azure response');
    }

    const analysis = JSON.parse(content);
    console.log('[check-absence-conflicts] Analysis result:', analysis);

    return new Response(JSON.stringify({
      hasConflict: analysis.hasConflict || false,
      riskScore: Math.min(100, Math.max(0, analysis.riskScore || 0)),
      warnings: analysis.warnings || [],
      recommendation: analysis.recommendation || "Analyse terminée"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[check-absence-conflicts] Error:', error);
    return new Response(JSON.stringify({ 
      error: sanitizeErrorForClient(error),
      hasConflict: false,
      riskScore: 0,
      warnings: [],
      recommendation: "Impossible d'analyser les conflits"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
