/**
 * JARVIS 13.0 - Intelligence Tools
 * 
 * Outils d'intelligence avancée pour analyse contextuelle,
 * comparaisons, insights automatiques et recommandations.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  adminClient?: SupabaseClient;
  userId: string;
  authUserId?: string;
}

/**
 * Génère un briefing intelligent personnalisé
 */
export async function executeGenerateBriefing(
  ctx: ToolContext,
  args: {
    briefing_type: 'daily' | 'weekly' | 'monthly' | 'custom';
    focus_areas?: string[];
    include_recommendations?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const now = new Date();
    let startDate: Date;
    
    switch (args.briefing_type) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Récupérer toutes les données en parallèle
    const [
      tasksResult,
      emailsResult,
      ticketsResult,
      eventsResult,
      revenueResult,
      etablissementsResult
    ] = await Promise.all([
      // Tâches
      ctx.supabase
        .from('taches')
        .select('id, titre, statut, priorite, echeance, created_at, updated_at')
        .or(`updated_at.gte.${startDate.toISOString()},created_at.gte.${startDate.toISOString()}`)
        .order('updated_at', { ascending: false })
        .limit(50),
      
      // Emails
      ctx.supabase
        .from('email_threads')
        .select('id, subject, last_message_date, unread_count, category, sentiment_score')
        .gte('last_message_date', startDate.toISOString())
        .order('last_message_date', { ascending: false })
        .limit(30),
      
      // Tickets support
      ctx.supabase
        .from('support_tickets')
        .select('id, titre, status, priority, created_at, resolved_at')
        .gte('created_at', startDate.toISOString())
        .limit(30),
      
      // Événements
      ctx.supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time, status')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20),
      
      // Revenus
      ctx.supabase
        .from('tresorerie_revenus')
        .select('id, montant, date_reception, statut')
        .gte('date_reception', startDate.toISOString()),
      
      // Établissements modifiés
      ctx.supabase
        .from('etablissements')
        .select('id, nom, statut, updated_at')
        .gte('updated_at', startDate.toISOString())
        .limit(20)
    ]);

    const tasks = tasksResult.data || [];
    const emails = emailsResult.data || [];
    const tickets = ticketsResult.data || [];
    const events = eventsResult.data || [];
    const revenues = revenueResult.data || [];
    const etablissements = etablissementsResult.data || [];

    // Calculer les métriques
    const tasksCompleted = tasks.filter(t => t.statut === 'Terminé').length;
    const tasksCreated = tasks.filter(t => new Date(t.created_at) >= startDate).length;
    const tasksOverdue = tasks.filter(t => t.echeance && new Date(t.echeance) < now && t.statut !== 'Terminé').length;
    
    const unreadEmails = emails.filter(e => e.unread_count > 0).length;
    const urgentEmails = emails.filter(e => e.sentiment_score && e.sentiment_score < -0.3).length;
    
    const ticketsOpen = tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
    const ticketsResolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
    const ticketsCritical = tickets.filter(t => t.priority === 'critical' || t.priority === 'high').length;
    
    const upcomingEvents = events.filter(e => new Date(e.start_time) > now).length;
    const todayEvents = events.filter(e => {
      const eventDate = new Date(e.start_time);
      return eventDate.toDateString() === now.toDateString();
    }).length;
    
    const totalRevenue = revenues.reduce((sum, r) => sum + (r.montant || 0), 0);
    const pendingRevenue = revenues.filter(r => r.statut !== 'encaissé').reduce((sum, r) => sum + (r.montant || 0), 0);

    // Générer les insights
    const insights: string[] = [];
    const recommendations: string[] = [];

    // Insights sur les tâches
    if (tasksOverdue > 0) {
      insights.push(`⚠️ ${tasksOverdue} tâche(s) en retard nécessitent attention`);
      recommendations.push(`Prioriser les ${Math.min(tasksOverdue, 3)} tâches les plus urgentes`);
    }
    if (tasksCompleted > 5) {
      insights.push(`✅ Excellente productivité: ${tasksCompleted} tâches terminées`);
    }

    // Insights sur les emails
    if (unreadEmails > 10) {
      insights.push(`📧 ${unreadEmails} emails non lus en attente`);
      recommendations.push('Planifier 30 min pour traiter les emails prioritaires');
    }
    if (urgentEmails > 0) {
      insights.push(`🚨 ${urgentEmails} email(s) avec sentiment négatif détecté`);
      recommendations.push('Vérifier les emails urgents en priorité');
    }

    // Insights sur le support
    if (ticketsCritical > 0) {
      insights.push(`🎫 ${ticketsCritical} ticket(s) critique(s) en cours`);
      recommendations.push('Escalader les tickets critiques si nécessaire');
    }
    if (ticketsResolved > 0) {
      const resolutionRate = ticketsResolved / (ticketsOpen + ticketsResolved) * 100;
      insights.push(`📊 Taux de résolution: ${Math.round(resolutionRate)}%`);
    }

    // Insights sur le calendrier
    if (todayEvents > 3) {
      insights.push(`📅 Journée chargée: ${todayEvents} événements aujourd'hui`);
      recommendations.push('Prévoir des pauses entre les réunions');
    }

    // Insights financiers
    if (pendingRevenue > 0) {
      insights.push(`💰 ${pendingRevenue.toLocaleString('fr-FR')}€ de revenus en attente d'encaissement`);
      recommendations.push('Relancer les factures en attente de paiement');
    }

    // Insights sur les clients
    const newClients = etablissements.filter(e => e.statut === 'production').length;
    if (newClients > 0) {
      insights.push(`🏥 ${newClients} nouvel(aux) client(s) en production`);
    }

    const briefing = {
      period: args.briefing_type,
      generated_at: now.toISOString(),
      summary: {
        tasks: { completed: tasksCompleted, created: tasksCreated, overdue: tasksOverdue },
        emails: { unread: unreadEmails, urgent: urgentEmails, total: emails.length },
        support: { open: ticketsOpen, resolved: ticketsResolved, critical: ticketsCritical },
        calendar: { today: todayEvents, upcoming: upcomingEvents },
        revenue: { total: totalRevenue, pending: pendingRevenue },
        clients: { active: etablissements.length, new: newClients }
      },
      insights,
      recommendations: args.include_recommendations !== false ? recommendations : [],
      focus_areas: args.focus_areas || ['tasks', 'emails', 'support', 'calendar']
    };

    return {
      success: true,
      data: briefing,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[Intelligence] Briefing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate briefing',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Compare deux périodes ou entités
 */
export async function executeCompareAnalysis(
  ctx: ToolContext,
  args: {
    compare_type: 'periods' | 'entities' | 'metrics';
    entity_a: string;
    entity_b: string;
    metrics?: string[];
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    if (args.compare_type === 'periods') {
      // Comparer deux périodes (ex: ce mois vs mois dernier)
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const [currentTasks, lastTasks, currentRevenue, lastRevenue] = await Promise.all([
        ctx.supabase.from('taches')
          .select('statut')
          .gte('created_at', currentMonthStart.toISOString()),
        ctx.supabase.from('taches')
          .select('statut')
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString()),
        ctx.supabase.from('tresorerie_revenus')
          .select('montant')
          .gte('date_reception', currentMonthStart.toISOString()),
        ctx.supabase.from('tresorerie_revenus')
          .select('montant')
          .gte('date_reception', lastMonthStart.toISOString())
          .lte('date_reception', lastMonthEnd.toISOString())
      ]);

      const currentTasksCompleted = (currentTasks.data || []).filter(t => t.statut === 'Terminé').length;
      const lastTasksCompleted = (lastTasks.data || []).filter(t => t.statut === 'Terminé').length;
      const currentRevenueTotal = (currentRevenue.data || []).reduce((sum, r) => sum + (r.montant || 0), 0);
      const lastRevenueTotal = (lastRevenue.data || []).reduce((sum, r) => sum + (r.montant || 0), 0);

      const taskChange = lastTasksCompleted > 0 ? ((currentTasksCompleted - lastTasksCompleted) / lastTasksCompleted * 100) : 0;
      const revenueChange = lastRevenueTotal > 0 ? ((currentRevenueTotal - lastRevenueTotal) / lastRevenueTotal * 100) : 0;

      return {
        success: true,
        data: {
          compare_type: 'periods',
          period_a: 'Mois en cours',
          period_b: 'Mois dernier',
          metrics: {
            tasks_completed: {
              current: currentTasksCompleted,
              previous: lastTasksCompleted,
              change_percent: Math.round(taskChange * 10) / 10,
              trend: taskChange > 5 ? 'up' : taskChange < -5 ? 'down' : 'stable'
            },
            revenue: {
              current: currentRevenueTotal,
              previous: lastRevenueTotal,
              change_percent: Math.round(revenueChange * 10) / 10,
              trend: revenueChange > 5 ? 'up' : revenueChange < -5 ? 'down' : 'stable'
            }
          },
          analysis: taskChange > 0 && revenueChange > 0 
            ? '📈 Tendance positive sur tous les indicateurs'
            : taskChange < 0 && revenueChange < 0
            ? '📉 Attention: baisse sur les indicateurs clés'
            : '➡️ Résultats mixtes ce mois-ci'
        },
        execution_time_ms: Date.now() - start
      };
    }

    if (args.compare_type === 'entities') {
      // Comparer deux établissements
      const [etabA, etabB, tasksA, tasksB] = await Promise.all([
        ctx.supabase.from('etablissements')
          .select('id, nom, statut, ca_mensuel_moyen')
          .eq('id', args.entity_a)
          .single(),
        ctx.supabase.from('etablissements')
          .select('id, nom, statut, ca_mensuel_moyen')
          .eq('id', args.entity_b)
          .single(),
        ctx.supabase.from('taches')
          .select('statut')
          .eq('etablissement_id', args.entity_a),
        ctx.supabase.from('taches')
          .select('statut')
          .eq('etablissement_id', args.entity_b)
      ]);

      if (etabA.error || etabB.error) {
        return {
          success: false,
          error: 'Établissement(s) non trouvé(s)',
          execution_time_ms: Date.now() - start
        };
      }

      const tasksACompleted = (tasksA.data || []).filter(t => t.statut === 'Terminé').length;
      const tasksBCompleted = (tasksB.data || []).filter(t => t.statut === 'Terminé').length;

      return {
        success: true,
        data: {
          compare_type: 'entities',
          entity_a: { id: etabA.data.id, name: etabA.data.nom, statut: etabA.data.statut },
          entity_b: { id: etabB.data.id, name: etabB.data.nom, statut: etabB.data.statut },
          comparison: {
            ca_mensuel: {
              a: etabA.data.ca_mensuel_moyen || 0,
              b: etabB.data.ca_mensuel_moyen || 0
            },
            tasks_completed: { a: tasksACompleted, b: tasksBCompleted }
          }
        },
        execution_time_ms: Date.now() - start
      };
    }

    return {
      success: false,
      error: 'Type de comparaison non supporté',
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[Intelligence] Compare error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Comparison failed',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Suggère des actions prioritaires basées sur l'analyse du contexte
 */
export async function executeSuggestActions(
  ctx: ToolContext,
  args: {
    context_type?: 'crm' | 'emails' | 'support' | 'global';
    max_suggestions?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const now = new Date();
    const suggestions: Array<{
      priority: 'critical' | 'high' | 'medium' | 'low';
      category: string;
      action: string;
      reason: string;
      entity_id?: string;
      entity_type?: string;
    }> = [];

    // Tâches en retard
    const { data: overdueTasks } = await ctx.supabase
      .from('taches')
      .select('id, titre, echeance, priorite, etablissement_id')
      .lt('echeance', now.toISOString())
      .not('statut', 'in', '("Terminé","Annulé")')
      .order('echeance', { ascending: true })
      .limit(5);

    for (const task of (overdueTasks || [])) {
      suggestions.push({
        priority: task.priorite === 'critique' ? 'critical' : 'high',
        category: 'tasks',
        action: `Traiter la tâche "${task.titre}"`,
        reason: `En retard depuis ${Math.ceil((now.getTime() - new Date(task.echeance).getTime()) / (1000 * 60 * 60 * 24))} jour(s)`,
        entity_id: task.id,
        entity_type: 'tache'
      });
    }

    // Tickets critiques non assignés
    const { data: criticalTickets } = await ctx.supabase
      .from('support_tickets')
      .select('id, titre, priority, created_at')
      .in('priority', ['critical', 'high'])
      .eq('status', 'open')
      .is('assigned_to', null)
      .limit(3);

    for (const ticket of (criticalTickets || [])) {
      suggestions.push({
        priority: ticket.priority === 'critical' ? 'critical' : 'high',
        category: 'support',
        action: `Assigner le ticket "${ticket.titre}"`,
        reason: 'Ticket prioritaire sans responsable',
        entity_id: ticket.id,
        entity_type: 'ticket'
      });
    }

    // Emails non lus depuis plus de 24h
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: oldUnreadEmails } = await ctx.supabase
      .from('email_threads')
      .select('id, subject, last_message_date')
      .gt('unread_count', 0)
      .lt('last_message_date', yesterday.toISOString())
      .eq('is_deleted', false)
      .order('last_message_date', { ascending: true })
      .limit(3);

    for (const email of (oldUnreadEmails || [])) {
      suggestions.push({
        priority: 'medium',
        category: 'emails',
        action: `Répondre à "${email.subject || 'Sans sujet'}"`,
        reason: 'Email en attente depuis plus de 24h',
        entity_id: email.id,
        entity_type: 'email'
      });
    }

    // Prospects sans contact récent
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const { data: coldProspects } = await ctx.supabase
      .from('etablissements')
      .select('id, nom, updated_at')
      .eq('statut', 'prospect')
      .lt('updated_at', twoWeeksAgo.toISOString())
      .limit(3);

    for (const prospect of (coldProspects || [])) {
      suggestions.push({
        priority: 'medium',
        category: 'crm',
        action: `Relancer le prospect "${prospect.nom}"`,
        reason: 'Aucun contact depuis 2 semaines',
        entity_id: prospect.id,
        entity_type: 'etablissement'
      });
    }

    // Trier par priorité
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const maxSuggestions = args.max_suggestions || 10;
    
    return {
      success: true,
      data: {
        suggestions: suggestions.slice(0, maxSuggestions),
        total_found: suggestions.length,
        by_category: {
          tasks: suggestions.filter(s => s.category === 'tasks').length,
          support: suggestions.filter(s => s.category === 'support').length,
          emails: suggestions.filter(s => s.category === 'emails').length,
          crm: suggestions.filter(s => s.category === 'crm').length
        },
        generated_at: now.toISOString()
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[Intelligence] Suggest actions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to suggest actions',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Exécute des actions en lot (bulk operations)
 */
export async function executeBulkAction(
  ctx: ToolContext,
  args: {
    action_type: 'complete_tasks' | 'assign_tickets' | 'archive_emails' | 'update_statuses';
    entity_ids: string[];
    action_data?: Record<string, unknown>;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    
    switch (args.action_type) {
      case 'complete_tasks': {
        for (const taskId of args.entity_ids) {
          const { error } = await ctx.supabase
            .from('taches')
            .update({ statut: 'Terminé', updated_at: new Date().toISOString() })
            .eq('id', taskId);
          results.push({ id: taskId, success: !error, error: error?.message });
        }
        break;
      }
      
      case 'assign_tickets': {
        const assigneeId = args.action_data?.assignee_id as string;
        if (!assigneeId) {
          return { success: false, error: 'assignee_id requis', execution_time_ms: Date.now() - start };
        }
        for (const ticketId of args.entity_ids) {
          const { error } = await ctx.supabase
            .from('support_tickets')
            .update({ assigned_to: assigneeId, status: 'in_progress' })
            .eq('id', ticketId);
          results.push({ id: ticketId, success: !error, error: error?.message });
        }
        break;
      }
      
      case 'archive_emails': {
        for (const threadId of args.entity_ids) {
          const { error } = await ctx.supabase
            .from('email_threads')
            .update({ is_archived: true })
            .eq('id', threadId);
          results.push({ id: threadId, success: !error, error: error?.message });
        }
        break;
      }
      
      case 'update_statuses': {
        const newStatus = args.action_data?.status as string;
        const entityType = args.action_data?.entity_type as string;
        if (!newStatus || !entityType) {
          return { success: false, error: 'status et entity_type requis', execution_time_ms: Date.now() - start };
        }
        
        const tableName = entityType === 'etablissement' ? 'etablissements' : entityType === 'tache' ? 'taches' : null;
        if (!tableName) {
          return { success: false, error: 'entity_type invalide', execution_time_ms: Date.now() - start };
        }
        
        for (const entityId of args.entity_ids) {
          const { error } = await ctx.supabase
            .from(tableName)
            .update({ statut: newStatus })
            .eq('id', entityId);
          results.push({ id: entityId, success: !error, error: error?.message });
        }
        break;
      }
      
      default:
        return { success: false, error: 'action_type non supporté', execution_time_ms: Date.now() - start };
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      data: {
        action_type: args.action_type,
        total: args.entity_ids.length,
        successful: successCount,
        failed: args.entity_ids.length - successCount,
        results
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[Intelligence] Bulk action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bulk action failed',
      execution_time_ms: Date.now() - start
    };
  }
}
