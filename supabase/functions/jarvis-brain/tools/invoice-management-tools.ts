/**
 * JARVIS - Invoice Management Tools (CRUD + mark paid)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageInvoice(ctx: ToolContext, args: { action: string; invoice_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        let query = ctx.supabase.from('factures').select('id, numero, client_nom, montant_ht, montant_tva, montant_ttc, statut, date_emission, date_echeance, etablissement_id').order('date_emission', { ascending: false });
        if (args.data?.statut) query = query.eq('statut', args.data.statut as string);
        if (args.data?.etablissement_id) query = query.eq('etablissement_id', args.data.etablissement_id as string);
        const { data, error } = await query.limit(50);
        if (error) throw error;
        return { success: true, data: { invoices: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'get': {
        if (!args.invoice_id) throw new Error('invoice_id required');
        const { data, error } = await ctx.supabase.from('factures').select('*, factures_lignes(*)').eq('id', args.invoice_id).single();
        if (error) throw error;
        return { success: true, data: { invoice: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.invoice_id) throw new Error('invoice_id required');
        const { data, error } = await ctx.supabase.from('factures').update(args.data || {}).eq('id', args.invoice_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Facture mise à jour', invoice: data }, execution_time_ms: Date.now() - start };
      }
      case 'mark_paid': {
        if (!args.invoice_id) throw new Error('invoice_id required');
        const updateData: Record<string, unknown> = { statut: 'payee', date_paiement: new Date().toISOString() };
        if (args.data?.mode_paiement) updateData.mode_paiement = args.data.mode_paiement;
        if (args.data?.reference_paiement) updateData.reference_paiement = args.data.reference_paiement;
        const { data, error } = await ctx.supabase.from('factures').update(updateData).eq('id', args.invoice_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Facture marquée comme payée', invoice: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.invoice_id) throw new Error('invoice_id required');
        // Only allow deleting draft invoices
        const { data: existing } = await ctx.supabase.from('factures').select('statut').eq('id', args.invoice_id).single();
        if (existing?.statut !== 'brouillon') {
          return { success: false, error: 'Seules les factures en brouillon peuvent être supprimées', execution_time_ms: Date.now() - start };
        }
        const { error } = await ctx.supabase.from('factures').delete().eq('id', args.invoice_id);
        if (error) throw error;
        return { success: true, data: { message: 'Facture supprimée' }, execution_time_ms: Date.now() - start };
      }
      case 'get_unpaid': {
        const { data, error } = await ctx.supabase.from('factures').select('id, numero, client_nom, montant_ttc, date_emission, date_echeance, statut, etablissement_id').in('statut', ['envoyee', 'en_retard']).order('date_echeance', { ascending: true }).limit(50);
        if (error) throw error;
        return { success: true, data: { unpaid_invoices: data, count: data?.length || 0, total_amount: (data || []).reduce((s, f) => s + (f.montant_ttc || 0), 0) }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action '${args.action}' not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invoice operation failed', execution_time_ms: Date.now() - start };
  }
}
