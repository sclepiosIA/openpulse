/**
 * JARVIS - Email Management Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageEmailDraft(ctx: ToolContext, args: { action: string; draft_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('email_drafts').select('*').eq('user_id', ctx.userId).order('updated_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { drafts: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('email_drafts').insert({ ...args.data, user_id: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Brouillon créé', draft: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.draft_id) throw new Error('draft_id required');
        const { data, error } = await ctx.supabase.from('email_drafts').update({ ...args.data, updated_at: new Date().toISOString() }).eq('id', args.draft_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Brouillon mis à jour', draft: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.draft_id) throw new Error('draft_id required');
        const { error } = await ctx.supabase.from('email_drafts').delete().eq('id', args.draft_id);
        if (error) throw error;
        return { success: true, data: { message: 'Brouillon supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Email draft operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageEmailFilter(ctx: ToolContext, args: { action: string; filter_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('email_filters').select('*').eq('user_id', ctx.userId).order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data: { filters: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('email_filters').insert({ ...args.data, user_id: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Filtre créé', filter: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.filter_id) throw new Error('filter_id required');
        const { data, error } = await ctx.supabase.from('email_filters').update(args.data || {}).eq('id', args.filter_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Filtre mis à jour', filter: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.filter_id) throw new Error('filter_id required');
        const { error } = await ctx.supabase.from('email_filters').delete().eq('id', args.filter_id);
        if (error) throw error;
        return { success: true, data: { message: 'Filtre supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Email filter operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageEmailThread(ctx: ToolContext, args: { action: string; thread_id: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'archive': {
        const { data, error } = await ctx.supabase.from('email_threads').update({ is_archived: true }).eq('id', args.thread_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Thread archivé', thread: data }, execution_time_ms: Date.now() - start };
      }
      case 'unarchive': {
        const { data, error } = await ctx.supabase.from('email_threads').update({ is_archived: false }).eq('id', args.thread_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Thread désarchivé', thread: data }, execution_time_ms: Date.now() - start };
      }
      case 'mark_read': {
        const { data, error } = await ctx.supabase.from('email_threads').update({ unread_count: 0 }).eq('id', args.thread_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Thread marqué comme lu', thread: data }, execution_time_ms: Date.now() - start };
      }
      case 'star': {
        const { data, error } = await ctx.supabase.from('email_threads').update({ is_starred: true }).eq('id', args.thread_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Thread mis en favori', thread: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Email thread operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeClassifyEmailThread(ctx: ToolContext, args: { thread_id: string; category?: string; etablissement_id?: string; tags?: string[] }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const updates: Record<string, unknown> = {};
    if (args.category) updates.category = args.category;
    if (args.etablissement_id) updates.etablissement_id = args.etablissement_id;
    if (args.tags) updates.tags = args.tags;
    const { data, error } = await ctx.supabase.from('email_threads').update(updates).eq('id', args.thread_id).select().single();
    if (error) throw error;
    return { success: true, data: { message: 'Thread classifié', thread: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Classification failed', execution_time_ms: Date.now() - start };
  }
}
