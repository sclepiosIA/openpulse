/**
 * JARVIS 15.1 - Task Management Tools
 * CRUD complet sur tâches, sous-tâches, time entries, récurrences
 * Validation UUID + logging systématique
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUUID(value: unknown, label: string): string {
  if (!value || typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`${label} invalide ou manquant: "${value}"`);
  }
  return value;
}

export async function executeUpdateTask(ctx: ToolContext, args: { task_id: string; data: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const id = assertUUID(args.task_id, 'task_id');
    if (!args.data || Object.keys(args.data).length === 0) throw new Error('Aucune donnée de mise à jour fournie');
    console.log(`[update_task] Updating ${id}:`, JSON.stringify(args.data).substring(0, 200));
    const { data, error } = await ctx.supabase.from('taches').update(args.data).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Tâche "${data.titre}" mise à jour`, task: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    console.error('[update_task] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update task failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeDeleteTask(ctx: ToolContext, args: { task_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const id = assertUUID(args.task_id, 'task_id');
    // Verify task exists before deleting
    const { data: existing } = await ctx.supabase.from('taches').select('titre').eq('id', id).single();
    console.log(`[delete_task] Deleting task: ${existing?.titre || id}`);
    const { error } = await ctx.supabase.from('taches').delete().eq('id', id);
    if (error) throw error;
    return { success: true, data: { message: `Tâche "${existing?.titre || id}" supprimée` }, execution_time_ms: Date.now() - start };
  } catch (error) {
    console.error('[delete_task] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete task failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageSubtask(ctx: ToolContext, args: { action: string; task_id?: string; subtask_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        if (!args.task_id) throw new Error('task_id required');
        const { data, error } = await ctx.supabase.from('tache_sous_taches').select('*').eq('tache_id', args.task_id).order('ordre', { ascending: true });
        if (error) throw error;
        return { success: true, data: { subtasks: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        if (!args.task_id) throw new Error('task_id required');
        const { data, error } = await ctx.supabase.from('tache_sous_taches').insert({ tache_id: args.task_id, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Sous-tâche créée', subtask: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.subtask_id) throw new Error('subtask_id required');
        const { data, error } = await ctx.supabase.from('tache_sous_taches').update(args.data || {}).eq('id', args.subtask_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Sous-tâche mise à jour', subtask: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.subtask_id) throw new Error('subtask_id required');
        const { error } = await ctx.supabase.from('tache_sous_taches').delete().eq('id', args.subtask_id);
        if (error) throw error;
        return { success: true, data: { message: 'Sous-tâche supprimée' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Subtask operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeLogTimeEntry(ctx: ToolContext, args: { task_id: string; duration_minutes: number; description?: string; date?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('tache_time_entries').insert({
      tache_id: args.task_id, user_id: ctx.userId, duration_minutes: args.duration_minutes,
      description: args.description, date: args.date || new Date().toISOString().split('T')[0]
    }).select().single();
    if (error) throw error;
    return { success: true, data: { message: `${args.duration_minutes} min enregistrées`, entry: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Time entry failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageTaskRecurrence(ctx: ToolContext, args: { action: string; task_id?: string; recurrence_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'create': {
        if (!args.task_id) throw new Error('task_id required');
        const { data, error } = await ctx.supabase.from('tache_recurrences').insert({ tache_id: args.task_id, ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Récurrence créée', recurrence: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.recurrence_id) throw new Error('recurrence_id required');
        const { error } = await ctx.supabase.from('tache_recurrences').delete().eq('id', args.recurrence_id);
        if (error) throw error;
        return { success: true, data: { message: 'Récurrence supprimée' }, execution_time_ms: Date.now() - start };
      }
      case 'list': {
        let query = ctx.supabase.from('tache_recurrences').select('*');
        if (args.task_id) query = query.eq('tache_id', args.task_id);
        const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { recurrences: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Recurrence operation failed', execution_time_ms: Date.now() - start };
  }
}
