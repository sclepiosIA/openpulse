/**
 * JARVIS 12.0 - R&D Agile Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageEpic(ctx: ToolContext, args: { action: string; epic_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('rd_epics').select('*, rd_user_stories(id, title, points, status)').order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data: { epics: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('rd_epics').insert({ title: (args.data as Record<string, unknown>)?.title, description: (args.data as Record<string, unknown>)?.description, status: 'backlog', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Epic créé', epic: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Epic operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageUserStory(ctx: ToolContext, args: { action: string; story_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('rd_user_stories').select('*, rd_epics(title), rd_sprints(name)').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return { success: true, data: { stories: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('rd_user_stories').insert({ title: (args.data as Record<string, unknown>)?.title, description: (args.data as Record<string, unknown>)?.description, points: (args.data as Record<string, unknown>)?.points || 0, status: 'backlog', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'User Story créée', story: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'User Story operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageSprint(ctx: ToolContext, args: { action: string; sprint_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('rd_sprints').select('*, rd_user_stories(id, title, points, status)').order('start_date', { ascending: false }).limit(20);
        if (error) throw error;
        return { success: true, data: { sprints: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'start': {
        if (!args.sprint_id) throw new Error('sprint_id required');
        const { data, error } = await ctx.supabase.from('rd_sprints').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', args.sprint_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Sprint démarré', sprint: data }, execution_time_ms: Date.now() - start };
      }
      case 'close': {
        if (!args.sprint_id) throw new Error('sprint_id required');
        const { data, error } = await ctx.supabase.from('rd_sprints').update({ status: 'completed', closed_at: new Date().toISOString() }).eq('id', args.sprint_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Sprint clôturé', sprint: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Sprint operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeMoveStoryToSprint(ctx: ToolContext, args: { story_id: string; sprint_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('rd_user_stories').update({ sprint_id: args.sprint_id }).eq('id', args.story_id).select('*, rd_sprints(name)').single();
    if (error) throw error;
    return { success: true, data: { message: `Story déplacée dans le sprint`, story: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to move story', execution_time_ms: Date.now() - start };
  }
}

export async function executeCalculateRdMetrics(ctx: ToolContext, args: { sprint_id?: string; metric_type: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const metrics: Record<string, unknown> = {};
    if (args.metric_type === 'velocity' || args.metric_type === 'all') {
      const { data: sprints } = await ctx.supabase.from('rd_sprints').select('id, name, rd_user_stories(points, status)').eq('status', 'completed').order('closed_at', { ascending: false }).limit(6);
      const velocities = (sprints || []).map(s => ({ sprint: s.name, points_completed: ((s as Record<string, unknown>).rd_user_stories as Array<{ status: string; points: number }> || []).filter(story => story.status === 'done').reduce((sum, story) => sum + (story.points || 0), 0) }));
      metrics.velocity = { history: velocities, average: velocities.length > 0 ? velocities.reduce((sum, v) => sum + v.points_completed, 0) / velocities.length : 0 };
    }
    return { success: true, data: metrics, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Metrics calculation failed', execution_time_ms: Date.now() - start };
  }
}

// ============================================================
// manage_rd_comment - CRUD commentaires sur stories/epics
// ============================================================
export async function executeManageRdComment(ctx: ToolContext, args: { action: string; story_id?: string; epic_id?: string; comment_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        let query = ctx.supabase.from('rd_comments').select('*, profiles(nom, prenom)');
        if (args.story_id) query = query.eq('story_id', args.story_id);
        if (args.epic_id) query = query.eq('epic_id', args.epic_id);
        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        return { success: true, data: { comments: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('rd_comments').insert({ story_id: args.story_id, epic_id: args.epic_id, user_id: ctx.userId, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Commentaire ajouté', comment: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.comment_id) throw new Error('comment_id required');
        const { error } = await ctx.supabase.from('rd_comments').delete().eq('id', args.comment_id);
        if (error) throw error;
        return { success: true, data: { message: 'Commentaire supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'RD comment operation failed', execution_time_ms: Date.now() - start };
  }
}

// ============================================================
// manage_rd_label - CRUD labels et assignation aux stories
// ============================================================
export async function executeManageRdLabel(ctx: ToolContext, args: { action: string; label_id?: string; story_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('rd_labels').select('*').order('name', { ascending: true });
        if (error) throw error;
        return { success: true, data: { labels: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('rd_labels').insert(args.data || {}).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Label créé', label: data }, execution_time_ms: Date.now() - start };
      }
      case 'assign': {
        if (!args.story_id || !args.label_id) throw new Error('story_id and label_id required');
        const { data, error } = await ctx.supabase.from('rd_story_labels').insert({ story_id: args.story_id, label_id: args.label_id }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Label assigné', assignment: data }, execution_time_ms: Date.now() - start };
      }
      case 'unassign': {
        if (!args.story_id || !args.label_id) throw new Error('story_id and label_id required');
        const { error } = await ctx.supabase.from('rd_story_labels').delete().eq('story_id', args.story_id).eq('label_id', args.label_id);
        if (error) throw error;
        return { success: true, data: { message: 'Label retiré' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'RD label operation failed', execution_time_ms: Date.now() - start };
  }
}

// ============================================================
// ai_assist_story - Améliore la rédaction avec GPT-5
// ============================================================
export async function executeAiAssistStory(
  ctx: ToolContext,
  args: { titre: string; description?: string; action?: 'improve' | 'acceptance_criteria' | 'split' }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('rd-ai-assist', {
      body: {
        action: args.action || 'improve',
        titre: args.titre,
        description: args.description || ''
      }
    });

    if (error) throw error;

    return {
      success: true,
      data: {
        action: args.action || 'improve',
        original_title: args.titre,
        improved_title: data?.improved_title,
        improved_description: data?.improved_description,
        acceptance_criteria: data?.acceptance_criteria,
        suggestions: data?.suggestions
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI story assistance failed',
      execution_time_ms: Date.now() - start
    };
  }
}
