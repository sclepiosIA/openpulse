/**
 * JARVIS - Avoir (Credit Note) Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageAvoir(ctx: ToolContext, args: { action: string; avoir_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('avoirs').select('*, etablissements(nom)').order('date_emission', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { avoirs: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'get': {
        if (!args.avoir_id) throw new Error('avoir_id required');
        const { data, error } = await ctx.supabase.from('avoirs').select('*, avoirs_lignes(*)').eq('id', args.avoir_id).single();
        if (error) throw error;
        return { success: true, data: { avoir: data }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const year = new Date().getFullYear();
        const { count } = await ctx.supabase.from('avoirs').select('*', { count: 'exact', head: true }).gte('date_emission', `${year}-01-01`);
        const numero = `AV-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
        const { data, error } = await ctx.supabase.from('avoirs').insert({ ...args.data, numero, date_emission: new Date().toISOString().split('T')[0], statut: 'brouillon', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: `Avoir ${numero} créé`, avoir: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.avoir_id) throw new Error('avoir_id required');
        const { data, error } = await ctx.supabase.from('avoirs').update(args.data || {}).eq('id', args.avoir_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Avoir mis à jour', avoir: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Avoir operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeAddAvoirLigne(ctx: ToolContext, args: { action: string; avoir_id?: string; ligne_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'add': {
        if (!args.avoir_id) throw new Error('avoir_id required');
        const { data, error } = await ctx.supabase.from('avoirs_lignes').insert({ avoir_id: args.avoir_id, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Ligne ajoutée', ligne: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.ligne_id) throw new Error('ligne_id required');
        const { error } = await ctx.supabase.from('avoirs_lignes').delete().eq('id', args.ligne_id);
        if (error) throw error;
        return { success: true, data: { message: 'Ligne supprimée' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Avoir ligne operation failed', execution_time_ms: Date.now() - start };
  }
}
