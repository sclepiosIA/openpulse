/**
 * JARVIS - CSM (Customer Success Management) Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeGetCsmHealthScore(ctx: ToolContext, args: { etablissement_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('csm_sante_comptes').select('*').eq('etablissement_id', args.etablissement_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return { success: true, data: { health_score: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Health score failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetCsmKpis(ctx: ToolContext, args: { csm_id?: string; period?: string; type?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const table = args.type === 'trimestriel' ? 'csm_kpis_trimestriels' : 'csm_kpis_mensuels';
    let query = ctx.supabase.from(table).select('*');
    if (args.csm_id) query = query.eq('csm_id', args.csm_id);
    if (args.period) query = query.eq('periode', args.period);
    const { data, error } = await query.order('periode', { ascending: false }).limit(12);
    if (error) throw error;
    return { success: true, data: { kpis: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'CSM KPIs failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageCsmMilestone(ctx: ToolContext, args: { action: string; etablissement_id?: string; milestone_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        if (!args.etablissement_id) throw new Error('etablissement_id required');
        const { data, error } = await ctx.supabase.from('csm_parcours_jalons').select('*').eq('etablissement_id', args.etablissement_id).order('ordre', { ascending: true });
        if (error) throw error;
        return { success: true, data: { milestones: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('csm_parcours_jalons').insert({ ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Jalon créé', milestone: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.milestone_id) throw new Error('milestone_id required');
        const { data, error } = await ctx.supabase.from('csm_parcours_jalons').update(args.data || {}).eq('id', args.milestone_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Jalon mis à jour', milestone: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'CSM milestone operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetChurnPredictions(ctx: ToolContext, args: { etablissement_id?: string; risk_level?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    let query = ctx.supabase.from('churn_predictions').select('*, etablissements(nom)');
    if (args.etablissement_id) query = query.eq('etablissement_id', args.etablissement_id);
    if (args.risk_level) query = query.eq('risk_level', args.risk_level);
    const { data, error } = await query.order('risk_score', { ascending: false }).limit(50);
    if (error) throw error;
    return { success: true, data: { predictions: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Churn predictions failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageCsmBillingFollowup(ctx: ToolContext, args: { action: string; followup_id?: string; etablissement_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        let query = ctx.supabase.from('csm_facturation_suivi').select('*, etablissements(nom)');
        if (args.etablissement_id) query = query.eq('etablissement_id', args.etablissement_id);
        const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { followups: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('csm_facturation_suivi').insert({ ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Suivi facturation créé', followup: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.followup_id) throw new Error('followup_id required');
        const { data, error } = await ctx.supabase.from('csm_facturation_suivi').update(args.data || {}).eq('id', args.followup_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Suivi mis à jour', followup: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'CSM billing followup failed', execution_time_ms: Date.now() - start };
  }
}
