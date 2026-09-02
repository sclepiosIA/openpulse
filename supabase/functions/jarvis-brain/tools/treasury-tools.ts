/**
 * JARVIS 12.0 - Treasury Tools
 * 
 * Tools for treasury management: Qonto sync, invoicing, forecasting, expenses.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function executeSyncQontoTransactions(
  ctx: ToolContext,
  args: { days_back?: number; force_relink?: boolean }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('qonto-sync-transactions', {
      body: { days_back: args.days_back || 30, force_relink: args.force_relink || false }
    });
    if (error) throw error;
    return { success: true, data: { message: 'Synchronisation Qonto terminée', ...data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Qonto sync failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetBankBalance(ctx: ToolContext): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('qonto-get-balance', { body: {} });
    if (error) throw error;
    return { success: true, data: { balance: data?.balance, currency: data?.currency || 'EUR' }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get balance', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateInvoice(
  ctx: ToolContext,
  args: { etablissement_id: string; lignes: Array<{ designation: string; quantite: number; prix_unitaire_ht: number; taux_tva?: number }>; date_echeance?: string; conditions_paiement?: string }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: etab } = await ctx.supabase.from('etablissements').select('id, nom, siret, adresse, email_facturation').eq('id', args.etablissement_id).single();
    const year = new Date().getFullYear();
    const { count } = await ctx.supabase.from('factures').select('*', { count: 'exact', head: true }).gte('date_emission', `${year}-01-01`);
    const numero = `FAC-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
    let montant_ht = 0, montant_tva = 0;
    const lignesCalculees = args.lignes.map(l => {
      const taux_tva = l.taux_tva || 20;
      const ligne_ht = l.quantite * l.prix_unitaire_ht;
      const ligne_tva = ligne_ht * (taux_tva / 100);
      montant_ht += ligne_ht;
      montant_tva += ligne_tva;
      return { designation: l.designation, quantite: l.quantite, prix_unitaire_ht: l.prix_unitaire_ht, taux_tva, montant_ht: ligne_ht, montant_tva: ligne_tva, montant_ttc: ligne_ht + ligne_tva };
    });
    const { data: facture, error } = await ctx.supabase.from('factures').insert({
      numero, etablissement_id: args.etablissement_id, client_nom: etab?.nom, client_siret: etab?.siret,
      date_emission: new Date().toISOString().split('T')[0], date_echeance: args.date_echeance || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      conditions_paiement: args.conditions_paiement || 'A 30 jours', montant_ht, montant_tva, montant_ttc: montant_ht + montant_tva, statut: 'brouillon', created_by: ctx.userId
    }).select().single();
    if (error) throw error;
    await ctx.supabase.from('factures_lignes').insert(lignesCalculees.map(l => ({ facture_id: facture.id, ...l })));
    return { success: true, data: { message: `Facture ${numero} créée`, facture_id: facture.id, numero, montant_ttc: montant_ht + montant_tva }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create invoice', execution_time_ms: Date.now() - start };
  }
}

export async function executeForecastCashflow(ctx: ToolContext, args: { months_ahead: number }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('predict-cashflow', { body: { months_ahead: args.months_ahead || 3 } });
    if (error) throw error;
    return { success: true, data: { forecast: data?.forecast || [], summary: data?.summary }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Forecast failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageExpense(
  ctx: ToolContext,
  args: { action: 'create' | 'update' | 'delete' | 'list'; expense_id?: string; data?: Record<string, unknown> }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('tresorerie_depenses').select('*').order('date', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { expenses: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('tresorerie_depenses').insert({ ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Dépense créée', expense: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.expense_id) throw new Error('expense_id required');
        const { data, error } = await ctx.supabase.from('tresorerie_depenses').update(args.data || {}).eq('id', args.expense_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Dépense mise à jour', expense: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.expense_id) throw new Error('expense_id required');
        const { error } = await ctx.supabase.from('tresorerie_depenses').delete().eq('id', args.expense_id);
        if (error) throw error;
        return { success: true, data: { message: 'Dépense supprimée' }, execution_time_ms: Date.now() - start };
      }
      default:
        throw new Error(`Unknown action: ${args.action}`);
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Expense operation failed', execution_time_ms: Date.now() - start };
  }
}
