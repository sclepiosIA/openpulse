/**
 * JARVIS 12.0 - Notification & Proactive Tools
 * 
 * Outils pour notifications push et suggestions proactives.
 * CORRIGÉ: Utilise la table in_app_notifications avec les bonnes colonnes
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

/**
 * send_notification - Envoie une notification push à un utilisateur
 */
export async function executeSendNotification(
  ctx: ToolContext,
  args: { 
    target_user_id?: string; 
    title: string; 
    message: string; 
    type?: string;
    link?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const targetUserId = args.target_user_id || ctx.userId;
    
    // Mapper le type vers les types acceptés par la table
    const validTypes = ['ai_suggestion', 'task_assignment', 'task_completion', 'establishment_update', 'mention', 'other'];
    const notificationType = validTypes.includes(args.type || '') ? args.type : 'other';
    
    // Créer la notification dans la table in_app_notifications (corrigé)
    // Note: related_id doit être un UUID valide ou null, pas un lien URL
    const relatedId = args.link && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.link) 
      ? args.link 
      : null;
    
    const { data: notification, error } = await ctx.supabase
      .from('in_app_notifications')
      .insert({
        user_id: targetUserId,
        title: args.title,
        message: args.message,
        type: notificationType,
        related_id: relatedId,
        related_type: 'jarvis',
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;

    // Tenter d'envoyer la notification push si le service est disponible
    try {
      await ctx.supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: targetUserId,
          title: args.title,
          body: args.message,
          data: { link: args.link, type: args.type }
        }
      });
    } catch (pushError) {
      console.log('[Notification] Push failed, notification saved to DB:', pushError);
    }

    return { 
      success: true, 
      data: { message: 'Notification envoyée', notification_id: notification?.id },
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send notification', 
      execution_time_ms: Date.now() - start 
    };
  }
}

/**
 * get_notifications - Récupère les notifications d'un utilisateur
 */
export async function executeGetNotifications(
  ctx: ToolContext,
  args: { 
    unread_only?: boolean; 
    limit?: number;
    type?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let query = ctx.supabase
      .from('in_app_notifications')
      .select('id, title, message, type, related_id, is_read, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false });

    if (args.unread_only) {
      query = query.eq('is_read', false);
    }
    if (args.type) {
      query = query.eq('type', args.type);
    }

    const { data, error } = await query.limit(args.limit || 20);

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        notifications: data || [], 
        unread_count: data?.filter(n => !n.is_read).length || 0,
        total: data?.length || 0
      },
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get notifications', 
      execution_time_ms: Date.now() - start 
    };
  }
}

/**
 * mark_notifications_read - Marque des notifications comme lues
 */
export async function executeMarkNotificationsRead(
  ctx: ToolContext,
  args: { notification_ids?: string[]; mark_all?: boolean }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let query = ctx.supabase
      .from('in_app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', ctx.userId);

    if (args.notification_ids && args.notification_ids.length > 0 && !args.mark_all) {
      query = query.in('id', args.notification_ids);
    } else if (!args.mark_all) {
      throw new Error('notification_ids ou mark_all requis');
    }

    const { error, count } = await query;

    if (error) throw error;

    return { 
      success: true, 
      data: { message: 'Notifications marquées comme lues', count },
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to mark notifications', 
      execution_time_ms: Date.now() - start 
    };
  }
}

/**
 * auto_followup_check - Détecte les opportunités de suivi proactif
 */
export async function executeAutoFollowupCheck(
  ctx: ToolContext,
  args: { domain?: string }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const followups: Array<{ type: string; priority: string; subject: string; suggestion: string; data: Record<string, unknown> }> = [];
    const today = new Date();
    
    // 1. Tâches en retard (corrigé: echeance au lieu de date_echeance)
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const { data: overdueTasks } = await ctx.supabase
      .from('taches')
      .select('id, titre, echeance, etablissement_id, etablissements(nom)')
      .eq('responsable_id', ctx.userId)
      .in('statut', ['en_attente', 'en_cours'])
      .lt('echeance', today.toISOString())
      .order('echeance', { ascending: true })
      .limit(10);

    for (const task of overdueTasks || []) {
      if (!task.echeance) continue;
      const daysOverdue = Math.floor((today.getTime() - new Date(task.echeance).getTime()) / (1000 * 60 * 60 * 24));
      followups.push({
        type: 'overdue_task',
        priority: daysOverdue > 7 ? 'high' : 'medium',
        subject: task.titre,
        suggestion: `Tâche en retard de ${daysOverdue} jour(s). Voulez-vous la reporter ou la compléter?`,
        data: { task_id: task.id, etablissement: (task as any).etablissements?.nom }
      });
    }

    // 2. Prospects sans activité récente
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: coldProspects } = await ctx.supabase
      .from('etablissements')
      .select('id, nom, statut, updated_at')
      .in('statut', ['prospect', 'qualification'])
      .lt('updated_at', thirtyDaysAgo.toISOString())
      .limit(10);

    for (const prospect of coldProspects || []) {
      const daysSinceActivity = Math.floor((today.getTime() - new Date(prospect.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      followups.push({
        type: 'cold_prospect',
        priority: daysSinceActivity > 60 ? 'high' : 'medium',
        subject: prospect.nom,
        suggestion: `Prospect sans activité depuis ${daysSinceActivity} jours. Envoyer une relance?`,
        data: { etablissement_id: prospect.id, status: prospect.statut }
      });
    }

    // 3. Emails sans réponse depuis longtemps (threads avec messages envoyés mais non lus depuis 7+ jours)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: pendingThreads } = await ctx.supabase
      .from('email_threads')
      .select('id, subject, ai_generated_title, last_message_date, category, has_sent_messages')
      .eq('has_sent_messages', true)
      .gt('unread_count', 0)
      .lt('last_message_date', sevenDaysAgo.toISOString())
      .eq('is_deleted', false)
      .limit(10);

    for (const thread of pendingThreads || []) {
      const daysPending = Math.floor((today.getTime() - new Date(thread.last_message_date).getTime()) / (1000 * 60 * 60 * 24));
      followups.push({
        type: 'pending_email',
        priority: daysPending > 14 ? 'high' : 'low',
        subject: thread.ai_generated_title || thread.subject,
        suggestion: `Email en attente de réponse depuis ${daysPending} jours`,
        data: { thread_id: thread.id, category: thread.category }
      });
    }

    // 4. Factures impayées (corrigé: date_echeance existe dans factures)
    const { data: unpaidInvoices } = await ctx.supabase
      .from('factures')
      .select('id, numero, montant_ttc, date_emission, etablissements(nom)')
      .eq('statut', 'envoyee')
      .lt('date_echeance', today.toISOString())
      .limit(10);

    for (const invoice of unpaidInvoices || []) {
      const daysOverdue = Math.floor((today.getTime() - new Date(invoice.date_emission).getTime()) / (1000 * 60 * 60 * 24));
      followups.push({
        type: 'unpaid_invoice',
        priority: daysOverdue > 30 ? 'high' : 'medium',
        subject: `Facture ${invoice.numero}`,
        suggestion: `Facture impayée de ${invoice.montant_ttc}€. Envoyer une relance?`,
        data: { facture_id: invoice.id, montant: invoice.montant_ttc, etablissement: (invoice as any).etablissements?.nom }
      });
    }

    // Trier par priorité
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    followups.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);

    return { 
      success: true, 
      data: { 
        followups,
        total_count: followups.length,
        high_priority_count: followups.filter(f => f.priority === 'high').length,
        summary: `${followups.length} suivi(s) suggéré(s): ${followups.filter(f => f.type === 'overdue_task').length} tâches, ${followups.filter(f => f.type === 'cold_prospect').length} prospects, ${followups.filter(f => f.type === 'pending_email').length} emails, ${followups.filter(f => f.type === 'unpaid_invoice').length} factures`
      },
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Followup check failed', 
      execution_time_ms: Date.now() - start 
    };
  }
}

/**
 * get_team_availability - Vérifie la disponibilité de l'équipe pour une période donnée
 */
export async function executeGetTeamAvailability(
  ctx: ToolContext,
  args: { 
    date: string; 
    duration_minutes?: number;
    team_member_ids?: string[];
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const checkDate = new Date(args.date);
    const duration = args.duration_minutes || 60;
    const endDate = new Date(checkDate.getTime() + duration * 60 * 1000);

    // Récupérer les membres de l'équipe si non spécifiés
    let teamIds = args.team_member_ids;
    if (!teamIds || teamIds.length === 0) {
      const { data: team } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('est_actif', true)
        .limit(20);
      teamIds = team?.map(t => t.id) || [];
    }

    const availability: Array<{ user_id: string; name: string; available: boolean; conflicts: string[] }> = [];

    for (const userId of teamIds) {
      // Récupérer le profil
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('nom, prenom')
        .eq('id', userId)
        .single();

      // Vérifier les événements calendrier
      const { data: events } = await ctx.supabase
        .from('calendar_events')
        .select('title, start_time, end_time')
        .eq('created_by', userId)
        .lt('start_time', endDate.toISOString())
        .gt('end_time', checkDate.toISOString());

      // Vérifier les absences
      const { data: absences } = await ctx.supabase
        .from('rh_absences')
        .select('type, date_debut, date_fin')
        .eq('profile_id', userId)
        .eq('statut', 'approved')
        .lte('date_debut', checkDate.toISOString().split('T')[0])
        .gte('date_fin', checkDate.toISOString().split('T')[0]);

      const conflicts: string[] = [];
      if (events && events.length > 0) {
        conflicts.push(...events.map(e => `📅 ${e.title}`));
      }
      if (absences && absences.length > 0) {
        conflicts.push(...absences.map(a => `🏖️ ${a.type}`));
      }

      availability.push({
        user_id: userId,
        name: `${profile?.prenom || ''} ${profile?.nom || ''}`.trim() || userId,
        available: conflicts.length === 0,
        conflicts
      });
    }

    const availableCount = availability.filter(a => a.available).length;

    return { 
      success: true, 
      data: { 
        date: args.date,
        duration_minutes: duration,
        team_availability: availability,
        available_count: availableCount,
        total_checked: availability.length,
        summary: `${availableCount}/${availability.length} personnes disponibles`
      },
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Availability check failed', 
      execution_time_ms: Date.now() - start 
    };
  }
}

/**
 * create_workflow - Crée un workflow automatisé multi-étapes
 */
export async function executeCreateWorkflow(
  ctx: ToolContext,
  args: {
    name: string;
    trigger: string;
    steps: Array<{
      action: string;
      parameters: Record<string, unknown>;
      delay_minutes?: number;
    }>;
  }
): Promise<ToolResult> {
  const start = Date.now();
  // Les workflows seront stockés pour exécution ultérieure
  // Pour l'instant, on retourne une confirmation
  return {
    success: true,
    data: {
      message: `Workflow "${args.name}" configuré avec ${args.steps.length} étape(s)`,
      trigger: args.trigger,
      steps_count: args.steps.length,
      note: 'Les workflows automatisés seront bientôt disponibles'
    },
    execution_time_ms: Date.now() - start
  };
}
