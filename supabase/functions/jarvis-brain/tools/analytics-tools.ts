/**
 * JARVIS 12.0 - Analytics & Insights Tools
 * 
 * Outils avancés pour analyses, dashboards, et insights proactifs.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

/**
 * get_dashboard_summary - Résumé complet du tableau de bord
 */
export async function executeGetDashboardSummary(ctx: ToolContext, args: { include_trends?: boolean }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // CRM Stats
    const { data: etablissements } = await ctx.supabase.from('etablissements').select('statut, ca_previsionnel');
    const pipelineValue = (etablissements || [])
      .filter(e => ['prospect', 'qualification', 'proposition', 'negociation'].includes(e.statut))
      .reduce((sum, e) => sum + (e.ca_previsionnel || 0), 0);
    const clientsActifs = (etablissements || []).filter(e => e.statut === 'production').length;

    // Tâches
    const { count: tasksTotal } = await ctx.supabase.from('taches').select('*', { count: 'exact', head: true });
    const { count: tasksUrgent } = await ctx.supabase.from('taches').select('*', { count: 'exact', head: true }).in('priorite', ['haute', 'critique']).in('statut', ['en_attente', 'en_cours']);
    const { count: tasksOverdue } = await ctx.supabase.from('taches').select('*', { count: 'exact', head: true }).lt('echeance', today.toISOString()).in('statut', ['en_attente', 'en_cours']);

    // Emails non lus
    const { count: emailsUnread } = await ctx.supabase.from('email_threads').select('*', { count: 'exact', head: true }).gt('unread_count', 0).eq('is_deleted', false);

    // Tickets support ouverts
    const { count: ticketsOpen } = await ctx.supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']);

    // Réunions aujourd'hui
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    const { count: meetingsToday } = await ctx.supabase.from('calendar_events').select('*', { count: 'exact', head: true }).gte('start_time', todayStart).lte('start_time', todayEnd);

    // CA du mois
    const { data: revenus } = await ctx.supabase.from('tresorerie_revenus').select('montant').gte('date', thisMonth.toISOString());
    const caThisMonth = (revenus || []).reduce((sum, r) => sum + (r.montant || 0), 0);

    const summary = {
      crm: {
        pipeline_value: pipelineValue,
        clients_actifs: clientsActifs,
        prospects: (etablissements || []).filter(e => e.statut === 'prospect').length
      },
      taches: {
        total: tasksTotal || 0,
        urgentes: tasksUrgent || 0,
        en_retard: tasksOverdue || 0
      },
      communication: {
        emails_non_lus: emailsUnread || 0,
        tickets_ouverts: ticketsOpen || 0,
        reunions_aujourdhui: meetingsToday || 0
      },
      tresorerie: {
        ca_mois: caThisMonth
      },
      alerts: [] as string[]
    };

    // Générer des alertes
    if ((tasksOverdue || 0) > 0) summary.alerts.push(`⚠️ ${tasksOverdue} tâche(s) en retard`);
    if ((ticketsOpen || 0) > 5) summary.alerts.push(`🎫 ${ticketsOpen} tickets support ouverts`);
    if ((emailsUnread || 0) > 20) summary.alerts.push(`📧 ${emailsUnread} emails non lus`);

    return { success: true, data: summary, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Dashboard summary failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * get_daily_digest - Résumé quotidien des activités
 */
export async function executeGetDailyDigest(ctx: ToolContext, args: { date?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const targetDate = args.date ? new Date(args.date) : new Date();
    const dayStart = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    // Tâches échues aujourd'hui
    const { data: tasksDue } = await ctx.supabase.from('taches').select('id, titre, priorite, etablissement_id').gte('echeance', dayStart).lte('echeance', dayEnd).in('statut', ['en_attente', 'en_cours']);

    // Réunions du jour
    const { data: meetings } = await ctx.supabase.from('calendar_events').select('id, title, start_time, end_time, location').gte('start_time', dayStart).lte('start_time', dayEnd).order('start_time', { ascending: true });

    // Nouveaux emails
    const { data: newEmails } = await ctx.supabase.from('email_threads').select('id, subject, ai_generated_title, category, last_message_date').gte('last_message_date', dayStart).order('last_message_date', { ascending: false }).limit(10);

    // Tickets créés aujourd'hui
    const { data: newTickets } = await ctx.supabase.from('support_tickets').select('id, titre, priority, status').gte('created_at', dayStart);

    // Factures échues
    const { data: invoicesDue } = await ctx.supabase.from('factures').select('id, numero, montant_ttc, client_nom').eq('date_echeance', targetDate.toISOString().split('T')[0]).eq('statut', 'envoyee');

    const digest = {
      date: targetDate.toISOString().split('T')[0],
      summary: {
        tasks_due: tasksDue?.length || 0,
        meetings: meetings?.length || 0,
        new_emails: newEmails?.length || 0,
        new_tickets: newTickets?.length || 0,
        invoices_due: invoicesDue?.length || 0
      },
      details: {
        tasks: tasksDue?.map(t => ({ id: t.id, titre: t.titre, priorite: t.priorite })) || [],
        meetings: meetings?.map(m => ({ id: m.id, title: m.title, time: m.start_time, location: m.location })) || [],
        emails: newEmails?.map(e => ({ id: e.id, subject: e.ai_generated_title || e.subject, category: e.category })) || [],
        tickets: newTickets?.map(t => ({ id: t.id, titre: t.titre, priority: t.priority })) || [],
        invoices: invoicesDue?.map(f => ({ id: f.id, numero: f.numero, montant: f.montant_ttc, client: f.client_nom })) || []
      },
      recommendations: [] as string[]
    };

    // Générer des recommandations
    if ((tasksDue?.length || 0) > 5) digest.recommendations.push("Beaucoup de tâches aujourd'hui - priorisez les plus critiques");
    if ((meetings?.length || 0) > 4) digest.recommendations.push("Journée chargée en réunions - bloquez du temps pour les tâches");
    if ((invoicesDue?.length || 0) > 0) digest.recommendations.push("Relancez les factures échues pour maintenir la trésorerie");

    return { success: true, data: digest, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Daily digest failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * get_performance_report - Rapport de performance équipe/individuel
 */
export async function executeGetPerformanceReport(ctx: ToolContext, args: { user_id?: string; period: string; type: 'individual' | 'team' }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodStart = new Date(args.period);
    const periodEnd = new Date();
    
    if (args.type === 'individual') {
      const targetUserId = args.user_id || ctx.userId;
      
      // Tâches complétées
      const { data: tasksCompleted } = await ctx.supabase.from('taches').select('id, date_realisation').eq('responsable_id', targetUserId).eq('statut', 'terminee').gte('date_realisation', periodStart.toISOString());
      
      // Emails envoyés
      const { data: emailsSent } = await ctx.supabase.from('email_messages').select('id').eq('sender_user_id', targetUserId).gte('sent_at', periodStart.toISOString());
      
      // Tickets résolus
      const { data: ticketsResolved } = await ctx.supabase.from('support_tickets').select('id').eq('resolved_by', targetUserId).gte('resolved_at', periodStart.toISOString());
      
      // Réunions organisées
      const { data: meetings } = await ctx.supabase.from('calendar_events').select('id').eq('created_by', targetUserId).gte('start_time', periodStart.toISOString());

      return {
        success: true,
        data: {
          type: 'individual',
          user_id: targetUserId,
          period: { from: periodStart.toISOString(), to: periodEnd.toISOString() },
          metrics: {
            tasks_completed: tasksCompleted?.length || 0,
            emails_sent: emailsSent?.length || 0,
            tickets_resolved: ticketsResolved?.length || 0,
            meetings_organized: meetings?.length || 0
          }
        },
        execution_time_ms: Date.now() - start
      };
    } else {
      // Team performance
      const { data: allTasks } = await ctx.supabase.from('taches').select('responsable_id, statut').gte('created_at', periodStart.toISOString());
      
      const byUser: Record<string, { completed: number; pending: number }> = {};
      for (const task of allTasks || []) {
        if (task.responsable_id) {
          if (!byUser[task.responsable_id]) byUser[task.responsable_id] = { completed: 0, pending: 0 };
          if (task.statut === 'terminee') byUser[task.responsable_id].completed++;
          else byUser[task.responsable_id].pending++;
        }
      }

      return {
        success: true,
        data: {
          type: 'team',
          period: { from: periodStart.toISOString(), to: periodEnd.toISOString() },
          performance_by_user: byUser,
          total_tasks: allTasks?.length || 0
        },
        execution_time_ms: Date.now() - start
      };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Performance report failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * analyze_trends - Analyse des tendances sur une période
 */
export async function executeAnalyzeTrends(ctx: ToolContext, args: { metric: string; period_days: number }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodStart = new Date(Date.now() - args.period_days * 24 * 60 * 60 * 1000);
    const trends: Record<string, unknown> = { metric: args.metric, period_days: args.period_days };

    switch (args.metric) {
      case 'pipeline': {
        const { data: etablissements } = await ctx.supabase.from('etablissements').select('statut, ca_previsionnel, created_at, updated_at').gte('updated_at', periodStart.toISOString());
        const byStatus: Record<string, { count: number; value: number }> = {};
        for (const e of etablissements || []) {
          if (!byStatus[e.statut]) byStatus[e.statut] = { count: 0, value: 0 };
          byStatus[e.statut].count++;
          byStatus[e.statut].value += e.ca_previsionnel || 0;
        }
        trends.pipeline = byStatus;
        break;
      }
      case 'tasks': {
        const { data: tasks } = await ctx.supabase.from('taches').select('statut, created_at, date_realisation').gte('created_at', periodStart.toISOString());
        trends.created = tasks?.length || 0;
        trends.completed = tasks?.filter(t => t.statut === 'terminee').length || 0;
        trends.completion_rate = trends.created ? Math.round((trends.completed as number / (trends.created as number)) * 100) : 0;
        break;
      }
      case 'support': {
        const { data: tickets } = await ctx.supabase.from('support_tickets').select('priority, status, created_at, resolved_at').gte('created_at', periodStart.toISOString());
        trends.total = tickets?.length || 0;
        trends.by_priority = (tickets || []).reduce((acc: Record<string, number>, t) => {
          acc[t.priority] = (acc[t.priority] || 0) + 1;
          return acc;
        }, {});
        trends.resolved = tickets?.filter(t => ['resolved', 'closed'].includes(t.status)).length || 0;
        break;
      }
      case 'revenue': {
        const { data: revenus } = await ctx.supabase.from('tresorerie_revenus').select('montant, date, categorie').gte('date', periodStart.toISOString());
        trends.total = (revenus || []).reduce((sum, r) => sum + (r.montant || 0), 0);
        trends.by_category = (revenus || []).reduce((acc: Record<string, number>, r) => {
          const cat = r.categorie || 'autre';
          acc[cat] = (acc[cat] || 0) + (r.montant || 0);
          return acc;
        }, {});
        break;
      }
      default:
        trends.message = `Trend analysis for '${args.metric}' not implemented`;
    }

    return { success: true, data: trends, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Trend analysis failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * get_smart_suggestions - Suggestions intelligentes basées sur le contexte
 */
export async function executeGetSmartSuggestions(ctx: ToolContext, args: { context?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const suggestions: Array<{ type: string; priority: string; message: string; action?: string }> = [];
    const today = new Date();

    // Vérifier les tâches en retard
    const { data: overdueTasks } = await ctx.supabase.from('taches').select('id, titre').lt('echeance', today.toISOString()).in('statut', ['en_attente', 'en_cours']).limit(5);
    if (overdueTasks && overdueTasks.length > 0) {
      suggestions.push({
        type: 'task',
        priority: 'high',
        message: `${overdueTasks.length} tâche(s) en retard nécessitent votre attention`,
        action: 'query_database pour voir les détails'
      });
    }

    // Vérifier les emails non classifiés
    const { count: unclassifiedEmails } = await ctx.supabase.from('email_threads').select('*', { count: 'exact', head: true }).is('etablissement_id', null).gt('unread_count', 0).eq('is_deleted', false);
    if ((unclassifiedEmails || 0) > 5) {
      suggestions.push({
        type: 'email',
        priority: 'medium',
        message: `${unclassifiedEmails} emails non classifiés - associez-les à des établissements`,
        action: 'query_database table email_threads'
      });
    }

    // Vérifier les prospects sans activité récente
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: coldProspects } = await ctx.supabase.from('etablissements').select('id, nom').eq('statut', 'prospect').lt('updated_at', thirtyDaysAgo).limit(5);
    if (coldProspects && coldProspects.length > 0) {
      suggestions.push({
        type: 'crm',
        priority: 'medium',
        message: `${coldProspects.length} prospect(s) sans activité depuis 30 jours`,
        action: 'Planifier des relances'
      });
    }

    // Vérifier les factures impayées
    const { data: unpaidInvoices } = await ctx.supabase.from('factures').select('id, numero, montant_ttc').eq('statut', 'envoyee').lt('date_echeance', today.toISOString().split('T')[0]).limit(5);
    if (unpaidInvoices && unpaidInvoices.length > 0) {
      const totalDue = unpaidInvoices.reduce((sum, f) => sum + (f.montant_ttc || 0), 0);
      suggestions.push({
        type: 'treasury',
        priority: 'high',
        message: `${unpaidInvoices.length} facture(s) impayée(s) pour ${totalDue.toLocaleString('fr-FR')}€`,
        action: 'Envoyer des relances'
      });
    }

    // Vérifier les absences à venir
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: upcomingAbsences } = await ctx.supabase.from('rh_absences').select('id, profile_id, date_debut').gte('date_debut', today.toISOString()).lte('date_debut', nextWeek).eq('statut', 'approved').limit(10);
    if (upcomingAbsences && upcomingAbsences.length > 0) {
      suggestions.push({
        type: 'rh',
        priority: 'low',
        message: `${upcomingAbsences.length} absence(s) prévue(s) cette semaine - planifiez en conséquence`,
        action: 'query_database table rh_absences'
      });
    }

    return { success: true, data: { suggestions, generated_at: new Date().toISOString() }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Smart suggestions failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * compare_periods - Compare deux périodes
 */
export async function executeComparePeriods(ctx: ToolContext, args: { metric: string; period1_start: string; period1_end: string; period2_start: string; period2_end: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const getMetricValue = async (startDate: string, endDate: string): Promise<number> => {
      switch (args.metric) {
        case 'revenue': {
          const { data } = await ctx.supabase.from('tresorerie_revenus').select('montant').gte('date', startDate).lte('date', endDate);
          return (data || []).reduce((sum, r) => sum + (r.montant || 0), 0);
        }
        case 'tasks_completed': {
          const { count } = await ctx.supabase.from('taches').select('*', { count: 'exact', head: true }).eq('statut', 'terminee').gte('date_realisation', startDate).lte('date_realisation', endDate);
          return count || 0;
        }
        case 'tickets_resolved': {
          const { count } = await ctx.supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['resolved', 'closed']).gte('resolved_at', startDate).lte('resolved_at', endDate);
          return count || 0;
        }
        default:
          return 0;
      }
    };

    const period1Value = await getMetricValue(args.period1_start, args.period1_end);
    const period2Value = await getMetricValue(args.period2_start, args.period2_end);
    const change = period1Value > 0 ? Math.round(((period2Value - period1Value) / period1Value) * 100) : 0;

    return {
      success: true,
      data: {
        metric: args.metric,
        period1: { start: args.period1_start, end: args.period1_end, value: period1Value },
        period2: { start: args.period2_start, end: args.period2_end, value: period2Value },
        change_percent: change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Period comparison failed', execution_time_ms: Date.now() - start };
  }
}
