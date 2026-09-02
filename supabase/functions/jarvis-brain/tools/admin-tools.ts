/**
 * JARVIS 12.0 - Admin Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageUser(ctx: ToolContext, args: { action: string; user_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('profiles').select('id, nom, prenom, email, est_actif, created_at').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return { success: true, data: { users: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.user_id) throw new Error('user_id required');
        const { data, error } = await ctx.supabase.from('profiles').update(args.data || {}).eq('id', args.user_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Utilisateur mis à jour', user: data }, execution_time_ms: Date.now() - start };
      }
      case 'deactivate': {
        if (!args.user_id) throw new Error('user_id required');
        const { data, error } = await ctx.supabase.from('profiles').update({ est_actif: false }).eq('id', args.user_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Utilisateur désactivé', user: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: false, error: 'User creation requires Supabase Auth dashboard', execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'User operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageUserRole(ctx: ToolContext, args: { user_id: string; role: string; action: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (args.action === 'add') {
      const { data: existing } = await ctx.supabase.from('user_roles').select('id').eq('user_id', args.user_id).eq('role', args.role).single();
      if (existing) return { success: true, data: { message: `L'utilisateur a déjà le rôle ${args.role}` }, execution_time_ms: Date.now() - start };
      const { error } = await ctx.supabase.from('user_roles').insert({ user_id: args.user_id, role: args.role });
      if (error) throw error;
      return { success: true, data: { message: `Rôle ${args.role} ajouté` }, execution_time_ms: Date.now() - start };
    } else {
      const { error } = await ctx.supabase.from('user_roles').delete().eq('user_id', args.user_id).eq('role', args.role);
      if (error) throw error;
      return { success: true, data: { message: `Rôle ${args.role} retiré` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Role operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetSystemLogs(ctx: ToolContext, args: { log_type?: string; period?: string; limit?: number }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const limit = args.limit || 50;
    let logs: unknown[] = [];
    switch (args.log_type) {
      case 'ai_processing': {
        const { data } = await ctx.supabase.from('ai_processing_log').select('*').order('processed_at', { ascending: false }).limit(limit);
        logs = data || [];
        break;
      }
      case 'email_sync': {
        const { data } = await ctx.supabase.from('user_email_accounts').select('id, email, last_sync_at, last_sync_status, sync_error').order('last_sync_at', { ascending: false }).limit(limit);
        logs = data || [];
        break;
      }
      default: {
        const { data } = await ctx.supabase.from('ai_processing_log').select('*').order('processed_at', { ascending: false }).limit(limit);
        logs = data || [];
      }
    }
    return { success: true, data: { log_type: args.log_type || 'ai_processing', logs, count: logs.length }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get logs', execution_time_ms: Date.now() - start };
  }
}

export async function executeExportDataRgpd(ctx: ToolContext, args: { user_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const exportData: Record<string, unknown> = {};
    const { data: profile } = await ctx.supabase.from('profiles').select('*').eq('id', args.user_id).single();
    exportData.profile = profile;
    const { data: roles } = await ctx.supabase.from('user_roles').select('role').eq('user_id', args.user_id);
    exportData.roles = roles;
    const { data: tasks } = await ctx.supabase.from('taches').select('id, titre, created_at').eq('created_by', args.user_id);
    exportData.tasks_created = tasks;
    const { data: conversations } = await ctx.supabase.from('jarvis_conversations').select('id, title, created_at').eq('user_id', args.user_id);
    exportData.jarvis_conversations = conversations;
    return { success: true, data: { message: 'Export RGPD généré', user_id: args.user_id, export_date: new Date().toISOString(), data: exportData }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'RGPD export failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetAiUsageStats(ctx: ToolContext, args: { period?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodStart = args.period ? new Date(args.period) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: logs } = await ctx.supabase.from('ai_processing_log').select('processing_type, total_tokens, success, processing_duration_ms').gte('processed_at', periodStart.toISOString());
    if (!logs) return { success: true, data: { message: 'No AI usage data found' }, execution_time_ms: Date.now() - start };
    const stats = {
      total_calls: logs.length,
      successful_calls: logs.filter(l => l.success).length,
      failed_calls: logs.filter(l => !l.success).length,
      total_tokens: logs.reduce((sum, l) => sum + (l.total_tokens || 0), 0),
      avg_duration_ms: logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.processing_duration_ms || 0), 0) / logs.length) : 0
    };
    return { success: true, data: { period_start: periodStart.toISOString(), ...stats }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get AI stats', execution_time_ms: Date.now() - start };
  }
}
