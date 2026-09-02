/**
 * Edge Function: calculate-payroll-stats
 * 
 * Calcule les statistiques de paie (masse salariale, évolution, KPIs).
 * Utilisé par Jarvis pour l'outil calculate_payroll_kpis.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface StatsRequest {
  period?: string;        // YYYY-MM pour un mois spécifique
  period_start?: string;  // YYYY-MM-DD pour une plage
  period_end?: string;
  compare_previous?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Role check for user callers (payroll is admin/rh/direction only)
    if (!auth.isServiceCall && auth.userId) {
      const { data: roles } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', auth.userId);
      const allowed = (roles || []).some((r: { role: string }) =>
        ['admin', 'rh', 'direction'].includes(r.role)
      );
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body: StatsRequest = await req.json().catch(() => ({}));
    const { 
      period, 
      period_start, 
      period_end, 
      compare_previous = true 
    } = body;

    // Calculer les dates
    const now = new Date();
    const currentMonth = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = period_start || `${currentMonth}-01`;
    const endDate = period_end || `${currentMonth}-31`;

    console.log(`📊 Calcul stats paie: ${startDate} → ${endDate}`);

    // Récupérer les salaires de la période
    const { data: currentSalaires, error: salError } = await supabaseClient
      .from('rh_salaires_mensuels')
      .select('profile_id, mois, salaire_brut, salaire_net, salaire_net_a_payer, cotisations_salariales, cotisations_patronales, cout_employeur, primes, heures_supplementaires')
      .gte('mois', startDate)
      .lte('mois', endDate);

    if (salError) {
      throw new Error(`Erreur récupération salaires: ${salError.message}`);
    }

    // Calculer les KPIs
    const stats = {
      period: { start: startDate, end: endDate },
      count: currentSalaires?.length || 0,
      unique_employees: new Set(currentSalaires?.map(s => s.profile_id)).size,
      
      // Totaux
      total_brut: 0,
      total_net: 0,
      total_net_a_payer: 0,
      total_cotisations_salariales: 0,
      total_cotisations_patronales: 0,
      total_cout_employeur: 0,
      total_primes: 0,
      total_heures_sup: 0,
      
      // Moyennes
      avg_brut: 0,
      avg_net: 0,
      avg_cout_employeur: 0,
      
      // Par mois (pour graphiques)
      by_month: {} as Record<string, {
        brut: number;
        net: number;
        cout_employeur: number;
        count: number;
      }>
    };

    // Agréger les données
    for (const s of currentSalaires || []) {
      stats.total_brut += s.salaire_brut || 0;
      stats.total_net += s.salaire_net || 0;
      stats.total_net_a_payer += s.salaire_net_a_payer || 0;
      stats.total_cotisations_salariales += s.cotisations_salariales || 0;
      stats.total_cotisations_patronales += s.cotisations_patronales || 0;
      stats.total_cout_employeur += s.cout_employeur || 0;
      stats.total_primes += s.primes || 0;
      stats.total_heures_sup += s.heures_supplementaires || 0;

      // Par mois
      const month = s.mois?.substring(0, 7) || 'unknown';
      if (!stats.by_month[month]) {
        stats.by_month[month] = { brut: 0, net: 0, cout_employeur: 0, count: 0 };
      }
      stats.by_month[month].brut += s.salaire_brut || 0;
      stats.by_month[month].net += s.salaire_net || 0;
      stats.by_month[month].cout_employeur += s.cout_employeur || 0;
      stats.by_month[month].count += 1;
    }

    // Moyennes
    if (stats.count > 0) {
      stats.avg_brut = Math.round(stats.total_brut / stats.count);
      stats.avg_net = Math.round(stats.total_net / stats.count);
      stats.avg_cout_employeur = Math.round(stats.total_cout_employeur / stats.count);
    }

    // Comparaison avec période précédente si demandé
    let comparison = null;
    if (compare_previous) {
      const prevStart = new Date(startDate);
      prevStart.setMonth(prevStart.getMonth() - 1);
      const prevEnd = new Date(endDate);
      prevEnd.setMonth(prevEnd.getMonth() - 1);

      const { data: prevSalaires } = await supabaseClient
        .from('rh_salaires_mensuels')
        .select('salaire_brut, salaire_net, cout_employeur')
        .gte('mois', prevStart.toISOString().split('T')[0])
        .lte('mois', prevEnd.toISOString().split('T')[0]);

      const prevBrut = prevSalaires?.reduce((sum, s) => sum + (s.salaire_brut || 0), 0) || 0;
      const prevNet = prevSalaires?.reduce((sum, s) => sum + (s.salaire_net || 0), 0) || 0;
      const prevCout = prevSalaires?.reduce((sum, s) => sum + (s.cout_employeur || 0), 0) || 0;

      comparison = {
        previous_period: {
          start: prevStart.toISOString().split('T')[0],
          end: prevEnd.toISOString().split('T')[0]
        },
        previous_brut: prevBrut,
        previous_net: prevNet,
        previous_cout_employeur: prevCout,
        variation_brut: prevBrut > 0 ? Math.round(((stats.total_brut - prevBrut) / prevBrut) * 100) : 0,
        variation_net: prevNet > 0 ? Math.round(((stats.total_net - prevNet) / prevNet) * 100) : 0,
        variation_cout: prevCout > 0 ? Math.round(((stats.total_cout_employeur - prevCout) / prevCout) * 100) : 0,
      };
    }

    // Ratios utiles
    const ratios = {
      taux_cotisations_salariales: stats.total_brut > 0 
        ? Math.round((stats.total_cotisations_salariales / stats.total_brut) * 100) 
        : 0,
      taux_cotisations_patronales: stats.total_brut > 0 
        ? Math.round((stats.total_cotisations_patronales / stats.total_brut) * 100) 
        : 0,
      ratio_net_brut: stats.total_brut > 0 
        ? Math.round((stats.total_net / stats.total_brut) * 100) 
        : 0,
      cout_moyen_par_employe: stats.unique_employees > 0 
        ? Math.round(stats.total_cout_employeur / stats.unique_employees) 
        : 0,
    };

    console.log(`✅ Stats calculées: ${stats.count} salaires, ${stats.unique_employees} employés`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        ratios,
        comparison,
        calculated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('calculate-payroll-stats', error, corsHeaders, 500);
  }
});
