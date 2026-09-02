/**
 * JARVIS - Tresorerie Management Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageRevenue(ctx: ToolContext, args: { action: string; revenue_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('tresorerie_revenus').select('*').order('date', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { revenues: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('tresorerie_revenus').insert({ ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Revenu créé', revenue: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.revenue_id) throw new Error('revenue_id required');
        const { data, error } = await ctx.supabase.from('tresorerie_revenus').update(args.data || {}).eq('id', args.revenue_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Revenu mis à jour', revenue: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.revenue_id) throw new Error('revenue_id required');
        const { error } = await ctx.supabase.from('tresorerie_revenus').delete().eq('id', args.revenue_id);
        if (error) throw error;
        return { success: true, data: { message: 'Revenu supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Revenue operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageBudget(ctx: ToolContext, args: { action: string; budget_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('tresorerie_budgets').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { budgets: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('tresorerie_budgets').insert({ ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Budget créé', budget: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.budget_id) throw new Error('budget_id required');
        const { data, error } = await ctx.supabase.from('tresorerie_budgets').update(args.data || {}).eq('id', args.budget_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Budget mis à jour', budget: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Budget operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetTresorerieSummary(ctx: ToolContext): Promise<ToolResult> {
  const start = Date.now();
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [revenus, depenses, factures] = await Promise.all([
      ctx.supabase.from('tresorerie_revenus').select('montant_ttc').gte('date', monthStart),
      ctx.supabase.from('tresorerie_depenses').select('montant_ttc').gte('date', monthStart),
      ctx.supabase.from('factures').select('montant_ttc, statut').in('statut', ['envoyee', 'en_retard'])
    ]);

    const totalRevenus = (revenus.data || []).reduce((s, r) => s + (r.montant_ttc || 0), 0);
    const totalDepenses = (depenses.data || []).reduce((s, d) => s + (d.montant_ttc || 0), 0);
    const aEncaisser = (factures.data || []).reduce((s, f) => s + (f.montant_ttc || 0), 0);
    const facturesEnRetard = (factures.data || []).filter(f => f.statut === 'en_retard').length;

    return {
      success: true,
      data: {
        periode: monthStart,
        revenus_mois: totalRevenus,
        depenses_mois: totalDepenses,
        solde_mois: totalRevenus - totalDepenses,
        a_encaisser: aEncaisser,
        factures_en_retard: facturesEnRetard
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Treasury summary failed', execution_time_ms: Date.now() - start };
  }
}
