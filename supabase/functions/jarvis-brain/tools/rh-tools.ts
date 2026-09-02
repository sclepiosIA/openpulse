/**
 * JARVIS 12.0 - HR Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeParsePayslip(ctx: ToolContext, args: { storage_path: string; profile_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('parse-bulletin-salaire', { body: { storage_path: args.storage_path, profile_id: args.profile_id } });
    if (error) throw error;
    return { success: true, data: { message: 'Bulletin analysé', parsed_data: data?.parsed_data, salaire_net: data?.salaire_net }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to parse payslip', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageAbsence(ctx: ToolContext, args: { action: string; profile_id?: string; absence_type?: string; date_debut?: string; date_fin?: string; absence_id?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        let query = ctx.supabase.from('rh_absences').select('*, profiles(nom, prenom)').order('date_debut', { ascending: false });
        if (args.profile_id) query = query.eq('profile_id', args.profile_id);
        const { data, error } = await query.limit(50);
        if (error) throw error;
        return { success: true, data: { absences: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        if (!args.profile_id || !args.date_debut || !args.date_fin) throw new Error('profile_id, date_debut, date_fin required');
        const { data, error } = await ctx.supabase.from('rh_absences').insert({ profile_id: args.profile_id, type: args.absence_type || 'conge_paye', date_debut: args.date_debut, date_fin: args.date_fin, statut: 'pending', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Absence créée', absence: data }, execution_time_ms: Date.now() - start };
      }
      case 'check_conflicts': {
        if (!args.profile_id || !args.date_debut || !args.date_fin) throw new Error('profile_id, date_debut, date_fin required');
        const { data: conflicts } = await ctx.supabase.from('rh_absences').select('*').eq('profile_id', args.profile_id).neq('statut', 'rejected');
        return { success: true, data: { has_conflicts: (conflicts?.length || 0) > 0, existing_absences: conflicts || [] }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Absence operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCalculatePayrollKpis(ctx: ToolContext, args: { period: string; department?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const [year, month] = args.period.split('-');
    const { data: salaires } = await ctx.supabase.from('rh_salaires_mensuels').select('salaire_net, salaire_brut, cout_employeur').eq('annee', parseInt(year)).eq('mois', parseInt(month));
    const totals = (salaires || []).reduce((acc, s) => ({ total_net: acc.total_net + (s.salaire_net || 0), total_brut: acc.total_brut + (s.salaire_brut || 0), total_cout: acc.total_cout + (s.cout_employeur || 0), count: acc.count + 1 }), { total_net: 0, total_brut: 0, total_cout: 0, count: 0 });
    return { success: true, data: { period: args.period, masse_salariale_nette: totals.total_net, masse_salariale_brute: totals.total_brut, cout_employeur_total: totals.total_cout, nombre_employes: totals.count }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Payroll KPIs failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeRecommendTraining(ctx: ToolContext, args: { profile_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('recommend-training', { body: { profile_id: args.profile_id } });
    if (error) throw error;
    return { success: true, data: { recommendations: data?.recommendations || [] }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Training recommendation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetEmployeeCompetences(ctx: ToolContext, args: { profile_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('employee_competences').select('*, referentiel_competences(nom, categorie)').eq('profile_id', args.profile_id);
    if (error) throw error;
    return { success: true, data: { competences: data || [], count: data?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get competences', execution_time_ms: Date.now() - start };
  }
}
