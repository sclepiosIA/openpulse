/**
 * Edge Function: export-paie
 * 
 * Exporte les données de paie pour une période donnée au format JSON ou CSV.
 * Utilisé par Jarvis pour l'outil export de données RH.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface ExportRequest {
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  format?: 'json' | 'csv';
  include_details?: boolean;
  profile_ids?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier les droits RH/Admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasAccess = roles?.some(r => ['admin', 'rh', 'direction'].includes(r.role));
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Accès non autorisé - rôle RH/Admin requis' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ExportRequest = await req.json();
    const { 
      period_start, 
      period_end, 
      format = 'json', 
      include_details = true,
      profile_ids 
    } = body;

    if (!period_start || !period_end) {
      throw new Error('Période requise (period_start, period_end)');
    }

    console.log(`📊 Export paie: ${period_start} → ${period_end}`);

    // Récupérer les salaires
    let query = supabaseClient
      .from('rh_salaires_mensuels')
      .select(`
        *,
        profiles!inner (
          id,
          prenom,
          nom,
          email,
          fonction,
          date_entree
        )
      `)
      .gte('mois', period_start)
      .lte('mois', period_end)
      .order('mois', { ascending: true });

    if (profile_ids && profile_ids.length > 0) {
      query = query.in('profile_id', profile_ids);
    }

    const { data: salaires, error: salairesError } = await query;

    if (salairesError) {
      throw new Error(`Erreur récupération salaires: ${salairesError.message}`);
    }

    console.log(`✅ ${salaires?.length || 0} enregistrements trouvés`);

    // Calculer les totaux
    const totals = {
      total_brut: 0,
      total_net: 0,
      total_net_a_payer: 0,
      total_cotisations_salariales: 0,
      total_cotisations_patronales: 0,
      total_cout_employeur: 0,
      total_primes: 0,
      count: salaires?.length || 0
    };

    const exportData = salaires?.map(s => {
      totals.total_brut += s.salaire_brut || 0;
      totals.total_net += s.salaire_net || 0;
      totals.total_net_a_payer += s.salaire_net_a_payer || 0;
      totals.total_cotisations_salariales += s.cotisations_salariales || 0;
      totals.total_cotisations_patronales += s.cotisations_patronales || 0;
      totals.total_cout_employeur += s.cout_employeur || 0;
      totals.total_primes += s.primes || 0;

      const base = {
        mois: s.mois,
        employe_nom: s.profiles?.nom,
        employe_prenom: s.profiles?.prenom,
        employe_email: s.profiles?.email,
        fonction: s.profiles?.fonction,
        salaire_brut: s.salaire_brut,
        salaire_net: s.salaire_net,
        salaire_net_a_payer: s.salaire_net_a_payer,
        cout_employeur: s.cout_employeur,
      };

      if (include_details) {
        return {
          ...base,
          cotisations_salariales: s.cotisations_salariales,
          cotisations_patronales: s.cotisations_patronales,
          primes: s.primes,
          heures_supplementaires: s.heures_supplementaires,
          heures_travaillees: s.heures_travaillees,
          taux_horaire: s.taux_horaire,
          source: s.source,
          created_at: s.created_at
        };
      }

      return base;
    }) || [];

    // Format CSV si demandé
    if (format === 'csv') {
      const headers = Object.keys(exportData[0] || {});
      const csvLines = [
        headers.join(';'),
        ...exportData.map(row => 
          headers.map(h => {
            const val = row[h as keyof typeof row];
            return val === null || val === undefined ? '' : String(val);
          }).join(';')
        )
      ];
      const csvContent = csvLines.join('\n');

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="export_paie_${period_start}_${period_end}.csv"`
        }
      });
    }

    // Format JSON (par défaut)
    return new Response(
      JSON.stringify({
        success: true,
        period: { start: period_start, end: period_end },
        totals,
        data: exportData,
        exported_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('export-paie', error, corsHeaders, 500);
  }
});
