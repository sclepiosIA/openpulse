/**
 * JARVIS 12.0 - Batch Operations Tools
 * 
 * Outils pour opérations en masse et actions groupées.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

/**
 * batch_update_tasks - Met à jour plusieurs tâches en une seule opération
 */
export async function executeBatchUpdateTasks(ctx: ToolContext, args: { task_ids: string[]; updates: { statut?: string; priorite?: string; responsable_id?: string; date_echeance?: string } }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.task_ids || args.task_ids.length === 0) {
      throw new Error('task_ids array is required');
    }
    if (args.task_ids.length > 50) {
      throw new Error('Maximum 50 tasks per batch');
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    
    for (const taskId of args.task_ids) {
      const { error } = await ctx.supabase.from('taches').update(args.updates).eq('id', taskId);
      results.push({ id: taskId, success: !error, error: error?.message });
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      data: {
        message: `${successCount}/${args.task_ids.length} tâches mises à jour`,
        results,
        total: args.task_ids.length,
        successful: successCount,
        failed: args.task_ids.length - successCount
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Batch update failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * batch_send_emails - Envoie plusieurs emails
 */
export async function executeBatchSendEmails(ctx: ToolContext, args: { emails: Array<{ to: string; subject: string; body: string }> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.emails || args.emails.length === 0) {
      throw new Error('emails array is required');
    }
    if (args.emails.length > 20) {
      throw new Error('Maximum 20 emails per batch');
    }

    const results: Array<{ to: string; success: boolean; error?: string }> = [];

    for (const email of args.emails) {
      const { error } = await ctx.supabase.functions.invoke('send-email', {
        body: { to: email.to, subject: email.subject, html_body: email.body, user_id: ctx.userId }
      });
      results.push({ to: email.to, success: !error, error: error?.message });
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      data: {
        message: `${successCount}/${args.emails.length} emails envoyés`,
        results,
        total: args.emails.length,
        successful: successCount,
        failed: args.emails.length - successCount
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Batch send failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * batch_create_tasks - Crée plusieurs tâches
 */
export async function executeBatchCreateTasks(ctx: ToolContext, args: { tasks: Array<{ titre: string; description?: string; priorite?: string; etablissement_id?: string; date_echeance?: string }> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.tasks || args.tasks.length === 0) {
      throw new Error('tasks array is required');
    }
    if (args.tasks.length > 20) {
      throw new Error('Maximum 20 tasks per batch');
    }

    const tasksToInsert = args.tasks.map(t => ({
      titre: t.titre,
      description: t.description,
      priorite: t.priorite || 'moyenne',
      etablissement_id: t.etablissement_id,
      echeance: t.date_echeance,
      statut: 'A faire',
      responsable_id: ctx.userId,
      created_by: ctx.userId
    }));

    const { data, error } = await ctx.supabase.from('taches').insert(tasksToInsert).select('id, titre');

    if (error) throw error;

    return {
      success: true,
      data: {
        message: `${data?.length || 0} tâches créées`,
        tasks: data,
        total: args.tasks.length
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Batch create failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * batch_assign_tasks - Assigne plusieurs tâches à une personne
 */
export async function executeBatchAssignTasks(ctx: ToolContext, args: { task_ids: string[]; assignee_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.task_ids || args.task_ids.length === 0) {
      throw new Error('task_ids array is required');
    }

    // Vérifier que l'assignee existe
    const { data: assignee } = await ctx.supabase.from('profiles').select('id, nom, prenom').eq('id', args.assignee_id).single();
    if (!assignee) throw new Error('Assignee not found');

    const { error, count } = await ctx.supabase.from('taches').update({ responsable_id: args.assignee_id }).in('id', args.task_ids);

    if (error) throw error;

    return {
      success: true,
      data: {
        message: `${args.task_ids.length} tâches assignées à ${assignee.prenom} ${assignee.nom}`,
        assignee: { id: assignee.id, name: `${assignee.prenom} ${assignee.nom}` },
        task_count: args.task_ids.length
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Batch assign failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * batch_close_tickets - Ferme plusieurs tickets support
 */
export async function executeBatchCloseTickets(ctx: ToolContext, args: { ticket_ids: string[]; resolution_note?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.ticket_ids || args.ticket_ids.length === 0) {
      throw new Error('ticket_ids array is required');
    }

    const { error } = await ctx.supabase.from('support_tickets').update({
      status: 'closed',
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.userId,
      resolution_note: args.resolution_note || 'Fermé en masse'
    }).in('id', args.ticket_ids);

    if (error) throw error;

    return {
      success: true,
      data: {
        message: `${args.ticket_ids.length} tickets fermés`,
        ticket_count: args.ticket_ids.length
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Batch close failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * bulk_email_classification - Classifie plusieurs threads emails
 */
export async function executeBulkEmailClassification(ctx: ToolContext, args: { thread_ids: string[]; etablissement_id?: string; category?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.thread_ids || args.thread_ids.length === 0) {
      throw new Error('thread_ids array is required');
    }

    const updates: Record<string, unknown> = {};
    if (args.etablissement_id) updates.etablissement_id = args.etablissement_id;
    if (args.category) updates.category = args.category;

    if (Object.keys(updates).length === 0) {
      throw new Error('At least one of etablissement_id or category required');
    }

    const { error } = await ctx.supabase.from('email_threads').update(updates).in('id', args.thread_ids);

    if (error) throw error;

    return {
      success: true,
      data: {
        message: `${args.thread_ids.length} threads classifiés`,
        updates_applied: updates,
        thread_count: args.thread_ids.length
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Bulk classification failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * export_data - Exporte des données en JSON
 */
export async function executeExportData(ctx: ToolContext, args: { table: string; filters?: Array<{ column: string; operator: string; value: string }>; format?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const allowedTables = ['etablissements', 'contacts', 'taches', 'factures', 'support_tickets'];
    if (!allowedTables.includes(args.table)) {
      throw new Error(`Table '${args.table}' not allowed for export. Allowed: ${allowedTables.join(', ')}`);
    }

    let query = ctx.supabase.from(args.table).select('*');

    if (args.filters) {
      for (const filter of args.filters) {
        switch (filter.operator) {
          case 'eq': query = query.eq(filter.column, filter.value); break;
          case 'neq': query = query.neq(filter.column, filter.value); break;
          case 'gt': query = query.gt(filter.column, filter.value); break;
          case 'lt': query = query.lt(filter.column, filter.value); break;
          case 'gte': query = query.gte(filter.column, filter.value); break;
          case 'lte': query = query.lte(filter.column, filter.value); break;
          case 'ilike': query = query.ilike(filter.column, `%${filter.value}%`); break;
        }
      }
    }

    const { data, error } = await query.limit(1000);
    if (error) throw error;

    return {
      success: true,
      data: {
        table: args.table,
        record_count: data?.length || 0,
        exported_at: new Date().toISOString(),
        format: args.format || 'json',
        records: data
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Export failed', execution_time_ms: Date.now() - start };
  }
}

/**
 * cleanup_old_data - Nettoie les données anciennes (notifications, logs)
 */
export async function executeCleanupOldData(ctx: ToolContext, args: { data_type: 'notifications' | 'ai_logs' | 'email_sync_errors'; days_old: number }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const cutoffDate = new Date(Date.now() - args.days_old * 24 * 60 * 60 * 1000).toISOString();
    let deletedCount = 0;

    switch (args.data_type) {
      case 'notifications': {
        const { count } = await ctx.supabase.from('notifications').delete().lt('created_at', cutoffDate).eq('read', true);
        deletedCount = count || 0;
        break;
      }
      case 'ai_logs': {
        const { count } = await ctx.supabase.from('ai_processing_log').delete().lt('processed_at', cutoffDate);
        deletedCount = count || 0;
        break;
      }
      case 'email_sync_errors': {
        // Nettoyer les logs d'erreur de sync email
        const { count } = await ctx.supabase.from('user_email_accounts').update({ sync_error: null }).is('sync_error', null).not('id', 'is', null);
        deletedCount = count || 0;
        break;
      }
    }

    return {
      success: true,
      data: {
        message: `Nettoyage terminé: ${deletedCount} entrées supprimées`,
        data_type: args.data_type,
        cutoff_date: cutoffDate,
        deleted_count: deletedCount
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Cleanup failed', execution_time_ms: Date.now() - start };
  }
}
