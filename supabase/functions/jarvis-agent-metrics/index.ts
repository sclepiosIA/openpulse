/**
 * jarvis-agent-metrics - Métriques de performance par agent
 * 
 * JARVIS 6.0: Calcule les KPIs de chaque agent spécialisé
 * pour le dashboard analytics
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

interface AgentMetrics {
  agentId: string;
  totalInteractions: number;
  avgResponseTimeMs: number;
  successRate: number;
  satisfactionScore: number | null;
  topTools: { name: string; count: number }[];
  recentActivity: { date: string; count: number }[];
  domainKPIs: Record<string, number | string>;
}

/**
 * Calcule les métriques pour un agent spécifique
 */
async function calculateAgentMetrics(
  supabase: any,
  agentId: string,
  userId: string,
  days: number = 30
): Promise<AgentMetrics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  // Get interactions
  const { data: interactions, error } = await supabase
    .from('jarvis_agent_interactions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[jarvis-agent-metrics] Error fetching interactions:', error);
  }

  const interactionList = interactions || [];

  // Calculate basic metrics
  const totalInteractions = interactionList.length;
  const avgResponseTimeMs = interactionList.length > 0
    ? interactionList.reduce((sum: number, i: any) => sum + (i.execution_time_ms || 0), 0) / interactionList.length
    : 0;
  
  // Success rate (assuming null satisfaction = success)
  const successfulInteractions = interactionList.filter((i: any) => 
    i.satisfaction_score === null || i.satisfaction_score >= 3
  ).length;
  const successRate = totalInteractions > 0 ? successfulInteractions / totalInteractions : 1;

  // Average satisfaction (only from rated interactions)
  const ratedInteractions = interactionList.filter((i: any) => i.satisfaction_score !== null);
  const satisfactionScore = ratedInteractions.length > 0
    ? ratedInteractions.reduce((sum: number, i: any) => sum + i.satisfaction_score, 0) / ratedInteractions.length
    : null;

  // Top tools used
  const toolCounts: Record<string, number> = {};
  interactionList.forEach((i: any) => {
    if (i.tool_calls) {
      const calls = Array.isArray(i.tool_calls) ? i.tool_calls : [];
      calls.forEach((tc: any) => {
        const toolName = tc.name || 'unknown';
        toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
      });
    }
  });
  
  const topTools = Object.entries(toolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent activity by day
  const activityByDay: Record<string, number> = {};
  interactionList.forEach((i: any) => {
    const date = i.created_at.split('T')[0];
    activityByDay[date] = (activityByDay[date] || 0) + 1;
  });
  
  const recentActivity = Object.entries(activityByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  // Domain-specific KPIs
  const domainKPIs = await calculateDomainKPIs(supabase, agentId, userId, startDateStr);

  return {
    agentId,
    totalInteractions,
    avgResponseTimeMs: Math.round(avgResponseTimeMs),
    successRate: Math.round(successRate * 100) / 100,
    satisfactionScore: satisfactionScore ? Math.round(satisfactionScore * 10) / 10 : null,
    topTools,
    recentActivity,
    domainKPIs,
  };
}

/**
 * Calcule les KPIs spécifiques au domaine de l'agent
 */
async function calculateDomainKPIs(
  supabase: any,
  agentId: string,
  userId: string,
  startDate: string
): Promise<Record<string, number | string>> {
  const kpis: Record<string, number | string> = {};

  switch (agentId) {
    case 'sophia': {
      // CRM KPIs
      const { count: newProspects } = await supabase
        .from('etablissements')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'prospect')
        .gte('created_at', startDate);
      
      const { count: closedDeals } = await supabase
        .from('etablissements')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'contractuel')
        .gte('date_signature', startDate);

      kpis.nouveauxProspects = newProspects || 0;
      kpis.contratsSignes = closedDeals || 0;
      break;
    }

    case 'marcus': {
      // RH KPIs
      const { count: activeEmployees } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('est_actif', true);

      const { count: pendingAbsences } = await supabase
        .from('absences')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'en_attente');

      kpis.collaborateursActifs = activeEmployees || 0;
      kpis.absencesEnAttente = pendingAbsences || 0;
      break;
    }

    case 'olivia': {
      // Finance KPIs
      const { data: factures } = await supabase
        .from('factures')
        .select('montant_ttc, statut')
        .gte('created_at', startDate);

      const totalFacture = factures?.reduce((sum: number, f: any) => sum + (f.montant_ttc || 0), 0) || 0;
      const impayees = factures?.filter((f: any) => f.statut === 'en_attente').length || 0;

      kpis.totalFacture = Math.round(totalFacture);
      kpis.facturesImpayees = impayees;
      break;
    }

    case 'noah': {
      // R&D KPIs
      const { data: stories } = await supabase
        .from('rd_user_stories')
        .select('statut, story_points')
        .gte('created_at', startDate);

      const completed = stories?.filter((s: any) => s.statut === 'done') || [];
      const velocite = completed.reduce((sum: number, s: any) => sum + (s.story_points || 0), 0);

      kpis.storiesCompletees = completed.length;
      kpis.velocite = velocite;
      break;
    }

    case 'emma': {
      // Support KPIs
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('statut, created_at, closed_at')
        .gte('created_at', startDate);

      const resolved = tickets?.filter((t: any) => t.statut === 'closed') || [];
      const avgResolutionTime = resolved.length > 0
        ? resolved.reduce((sum: number, t: any) => {
            const created = new Date(t.created_at).getTime();
            const closed = new Date(t.closed_at || Date.now()).getTime();
            return sum + (closed - created);
          }, 0) / resolved.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      kpis.ticketsResolus = resolved.length;
      kpis.tempsResolutionMoyen = `${Math.round(avgResolutionTime)}h`;
      break;
    }

    case 'alex': {
      // Analytics KPIs
      const { count: predictions } = await supabase
        .from('jarvis_predictions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startDate);

      const { count: insights } = await supabase
        .from('ai_analysis_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('has_insights', true)
        .gte('created_at', startDate);

      kpis.predictionsGenerees = predictions || 0;
      kpis.insightsDecouverts = insights || 0;
      break;
    }
  }

  return kpis;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { agentId, days = 30 } = body;
    // Force userId from JWT for non-service callers (prevent IDOR)
    const userId = auth.isServiceCall ? body.userId : auth.userId;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[jarvis-agent-metrics] Calculating metrics for:', userId, 'agent:', agentId || 'all');

    const agentIds = agentId 
      ? [agentId] 
      : ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];

    const metrics: AgentMetrics[] = [];

    for (const id of agentIds) {
      const agentMetrics = await calculateAgentMetrics(supabase, id, userId, days);
      metrics.push(agentMetrics);
    }

    // Calculate team totals
    const teamTotals = {
      totalInteractions: metrics.reduce((sum, m) => sum + m.totalInteractions, 0),
      avgResponseTimeMs: Math.round(
        metrics.reduce((sum, m) => sum + m.avgResponseTimeMs, 0) / metrics.length
      ),
      avgSuccessRate: Math.round(
        metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length * 100
      ) / 100,
      avgSatisfaction: (() => {
        const rated = metrics.filter(m => m.satisfactionScore !== null);
        return rated.length > 0
          ? Math.round(rated.reduce((sum, m) => sum + (m.satisfactionScore || 0), 0) / rated.length * 10) / 10
          : null;
      })(),
    };

    // Store metrics snapshot
    await supabase.from('jarvis_agent_metrics').insert({
      user_id: userId,
      agent_id: agentId || 'team',
      metrics_data: agentId ? metrics[0] : { agents: metrics, totals: teamTotals },
      period_days: days,
    });

    return new Response(
      JSON.stringify({
        success: true,
        metrics: agentId ? metrics[0] : metrics,
        teamTotals: agentId ? undefined : teamTotals,
        period: { days, startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[jarvis-agent-metrics] Error:', error);
    return buildErrorResponse('jarvis-agent-metrics', error, corsHeaders, 500);
  }
});
