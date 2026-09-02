/**
 * JARVIS - Forum Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageForumPost(ctx: ToolContext, args: { action: string; post_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('forum_posts').select('*').eq('archive', false).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { posts: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'get': {
        if (!args.post_id) throw new Error('post_id required');
        const { data, error } = await ctx.supabase.from('forum_posts').select('*').eq('id', args.post_id).single();
        if (error) throw error;
        return { success: true, data: { post: data }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('forum_posts').insert({ ...args.data, user_id: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Post créé', post: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.post_id) throw new Error('post_id required');
        const { data, error } = await ctx.supabase.from('forum_posts').update(args.data || {}).eq('id', args.post_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Post mis à jour', post: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.post_id) throw new Error('post_id required');
        const { error } = await ctx.supabase.from('forum_posts').update({ archive: true }).eq('id', args.post_id);
        if (error) throw error;
        return { success: true, data: { message: 'Post archivé' }, execution_time_ms: Date.now() - start };
      }
      case 'search': {
        const rawTerm = (args.data as Record<string, unknown>)?.query as string;
        if (!rawTerm) throw new Error('query required in data');
        const term = rawTerm.replace(/[(),".\\%*:]/g, ' ').trim().substring(0, 200);
        if (!term) return { success: true, data: { posts: [], count: 0 }, execution_time_ms: Date.now() - start };
        const { data, error } = await ctx.supabase.from('forum_posts').select('*').or(`titre.ilike.%${term}%,contenu.ilike.%${term}%`).eq('archive', false).limit(30);
        if (error) throw error;
        return { success: true, data: { posts: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Forum post operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageForumComment(ctx: ToolContext, args: { action: string; post_id?: string; comment_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        if (!args.post_id) throw new Error('post_id required');
        const { data, error } = await ctx.supabase.from('forum_comments').select('*').eq('post_id', args.post_id).order('created_at', { ascending: true });
        if (error) throw error;
        return { success: true, data: { comments: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        if (!args.post_id) throw new Error('post_id required');
        const { data, error } = await ctx.supabase.from('forum_comments').insert({ post_id: args.post_id, user_id: ctx.userId, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Commentaire ajouté', comment: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.comment_id) throw new Error('comment_id required');
        const { error } = await ctx.supabase.from('forum_comments').delete().eq('id', args.comment_id);
        if (error) throw error;
        return { success: true, data: { message: 'Commentaire supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Forum comment operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeVoteForumPost(ctx: ToolContext, args: { post_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: existing } = await ctx.supabase.from('forum_votes').select('id').eq('post_id', args.post_id).eq('user_id', ctx.userId).maybeSingle();
    if (existing) {
      await ctx.supabase.from('forum_votes').delete().eq('id', existing.id);
      return { success: true, data: { message: 'Vote retiré', action: 'removed' }, execution_time_ms: Date.now() - start };
    }
    await ctx.supabase.from('forum_votes').insert({ post_id: args.post_id, user_id: ctx.userId });
    return { success: true, data: { message: 'Vote ajouté', action: 'added' }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Vote failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeBookmarkForumPost(ctx: ToolContext, args: { post_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: existing } = await ctx.supabase.from('forum_bookmarks').select('id').eq('post_id', args.post_id).eq('user_id', ctx.userId).maybeSingle();
    if (existing) {
      await ctx.supabase.from('forum_bookmarks').delete().eq('id', existing.id);
      return { success: true, data: { message: 'Favori retiré', action: 'removed' }, execution_time_ms: Date.now() - start };
    }
    await ctx.supabase.from('forum_bookmarks').insert({ post_id: args.post_id, user_id: ctx.userId });
    return { success: true, data: { message: 'Favori ajouté', action: 'added' }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Bookmark failed', execution_time_ms: Date.now() - start };
  }
}
