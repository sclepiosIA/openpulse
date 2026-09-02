/**
 * JARVIS Metrics Tools - KPIs and business metrics calculations
 */

import type { ToolExecutionContext, ToolResult } from "./core-tools.ts";

// ============================================================
// TOOL: calculate_metrics
// ============================================================
export async function executeCalculateMetrics(
  ctx: ToolExecutionContext,
  args: {
    metric_type: string;
    filters?: {
      date_from?: string;
      date_to?: string;
      etablissement_id?: string;
      user_id?: string;
    };
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const metrics: Record<string, unknown> = {};
    const { date_from, date_to, etablissement_id } = args.filters || {};
    
    switch (args.metric_type) {
      case 'ca': {
        // Calculate revenue (CA)
        let query = ctx.supabase
          .from('factures')
          .select('montant_ttc, date_emission, statut');
        
        if (date_from) query = query.gte('date_emission', date_from);
        if (date_to) query = query.lte('date_emission', date_to);
        if (etablissement_id) query = query.eq('etablissement_id', etablissement_id);
        
        const { data: factures } = await query;
        
        const total = factures?.reduce((sum, f) => sum + (f.montant_ttc || 0), 0) || 0;
        const paye = factures?.filter(f => f.statut === 'payee')
          .reduce((sum, f) => sum + (f.montant_ttc || 0), 0) || 0;
        
        metrics.ca_total = total;
        metrics.ca_encaisse = paye;
        metrics.ca_en_attente = total - paye;
        metrics.taux_encaissement = total > 0 ? Math.round((paye / total) * 100) : 0;
        break;
      }
      
      case 'tasks': {
        // Task metrics
        let query = ctx.supabase
          .from('taches')
          .select('id, statut, priorite, created_at, updated_at');
        
        if (date_from) query = query.gte('created_at', date_from);
        if (etablissement_id) query = query.eq('etablissement_id', etablissement_id);
        
        const { data: taches } = await query;
        
        metrics.total = taches?.length || 0;
        metrics.terminees = taches?.filter(t => t.statut === 'Terminé').length || 0;
        metrics.en_cours = taches?.filter(t => t.statut === 'En cours').length || 0;
        metrics.a_faire = taches?.filter(t => t.statut === 'A faire').length || 0;
        metrics.taux_completion = metrics.total > 0 
          ? Math.round(((metrics.terminees as number) / (metrics.total as number)) * 100) 
          : 0;
        break;
      }
      
      case 'support': {
        // Support ticket metrics
        let query = ctx.supabase
          .from('support_tickets')
          .select('id, status, priority, created_at, resolved_at');
        
        if (date_from) query = query.gte('created_at', date_from);
        if (etablissement_id) query = query.eq('etablissement_id', etablissement_id);
        
        const { data: tickets } = await query;
        
        metrics.total = tickets?.length || 0;
        metrics.ouverts = tickets?.filter(t => t.status === 'open').length || 0;
        metrics.resolus = tickets?.filter(t => t.status === 'resolved').length || 0;
        
        // Calculate average resolution time
        const resolvedWithTime = tickets?.filter(t => t.resolved_at && t.created_at) || [];
        if (resolvedWithTime.length > 0) {
          const avgTime = resolvedWithTime.reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const resolved = new Date(t.resolved_at!).getTime();
            return sum + (resolved - created);
          }, 0) / resolvedWithTime.length;
          metrics.temps_resolution_moyen_heures = Math.round(avgTime / (1000 * 60 * 60));
        }
        break;
      }
      
      case 'emails': {
        // Email metrics
        let query = ctx.supabase
          .from('email_threads')
          .select('id, unread_count, category, last_message_date');
        
        if (date_from) query = query.gte('last_message_date', date_from);
        
        const { data: threads } = await query;
        
        metrics.total = threads?.length || 0;
        metrics.non_lus = threads?.filter(t => (t.unread_count || 0) > 0).length || 0;
        metrics.par_categorie = threads?.reduce((acc: Record<string, number>, t) => {
          const cat = t.category || 'other';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});
        break;
      }
      
      case 'rh': {
        // HR metrics (payroll)
        const currentMonth = new Date().toISOString().substring(0, 7);
        
        const { data: salaires } = await ctx.supabase
          .from('rh_salaires_mensuels')
          .select('salaire_net, salaire_brut, cout_total_employeur')
          .eq('mois', date_from || currentMonth);
        
        metrics.masse_salariale_nette = salaires?.reduce((sum, s) => sum + (s.salaire_net || 0), 0) || 0;
        metrics.masse_salariale_brute = salaires?.reduce((sum, s) => sum + (s.salaire_brut || 0), 0) || 0;
        metrics.cout_employeur = salaires?.reduce((sum, s) => sum + (s.cout_total_employeur || 0), 0) || 0;
        metrics.effectif = salaires?.length || 0;
        break;
      }
      
      case 'pipeline': {
        // Sales pipeline
        const { data: etablissements } = await ctx.supabase
          .from('etablissements')
          .select('id, statut, valeur_estimee, probabilite');
        
        const prospects = etablissements?.filter(e => 
          ['prospect', 'qualification', 'proposition'].includes(e.statut || '')
        ) || [];
        
        metrics.total_prospects = prospects.length;
        metrics.valeur_pipeline = prospects.reduce((sum, e) => sum + (e.valeur_estimee || 0), 0);
        metrics.valeur_ponderee = prospects.reduce((sum, e) => {
          const val = e.valeur_estimee || 0;
          const prob = (e.probabilite || 0) / 100;
          return sum + (val * prob);
        }, 0);
        break;
      }
      
      default:
        return {
          success: false,
          error: `Type de métrique inconnu: ${args.metric_type}. Types disponibles: ca, tasks, support, emails, rh, pipeline`,
          execution_time_ms: Date.now() - start
        };
    }
    
    return {
      success: true,
      data: {
        metric_type: args.metric_type,
        filters: args.filters,
        metrics,
        calculated_at: new Date().toISOString()
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate metrics',
      execution_time_ms: Date.now() - start
    };
  }
}
