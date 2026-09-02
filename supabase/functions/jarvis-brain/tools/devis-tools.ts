/**
 * JARVIS 15.1 - Devis (Quotes) Tools
 * Validation UUID + montants + logging
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUUID(value: unknown, label: string): string {
  if (!value || typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`${label} invalide ou manquant: "${value}"`);
  }
  return value;
}

export async function executeManageDevis(ctx: ToolContext, args: { action: string; devis_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('devis').select('*, etablissements(nom)').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { devis: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'get': {
        if (!args.devis_id) throw new Error('devis_id required');
        const { data, error } = await ctx.supabase.from('devis').select('*, devis_lignes(*), etablissements(nom, siret, adresse)').eq('id', args.devis_id).single();
        if (error) throw error;
        return { success: true, data: { devis: data }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const year = new Date().getFullYear();
        const { count } = await ctx.supabase.from('devis').select('*', { count: 'exact', head: true }).gte('created_at', `${year}-01-01`);
        const numero = `DEV-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
        const { data, error } = await ctx.supabase.from('devis').insert({ ...args.data, numero, statut: 'brouillon', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: `Devis ${numero} créé`, devis: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.devis_id) throw new Error('devis_id required');
        const { data, error } = await ctx.supabase.from('devis').update(args.data || {}).eq('id', args.devis_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Devis mis à jour', devis: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.devis_id) throw new Error('devis_id required');
        const { error } = await ctx.supabase.from('devis').delete().eq('id', args.devis_id);
        if (error) throw error;
        return { success: true, data: { message: 'Devis supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Devis operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeAddDevisLigne(ctx: ToolContext, args: { action: string; devis_id?: string; ligne_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'add': {
        if (!args.devis_id) throw new Error('devis_id required');
        const { data, error } = await ctx.supabase.from('devis_lignes').insert({ devis_id: args.devis_id, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Ligne ajoutée', ligne: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.ligne_id) throw new Error('ligne_id required');
        const { data, error } = await ctx.supabase.from('devis_lignes').update(args.data || {}).eq('id', args.ligne_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Ligne mise à jour', ligne: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.ligne_id) throw new Error('ligne_id required');
        const { error } = await ctx.supabase.from('devis_lignes').delete().eq('id', args.ligne_id);
        if (error) throw error;
        return { success: true, data: { message: 'Ligne supprimée' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Devis ligne operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeConvertDevisToInvoice(ctx: ToolContext, args: { devis_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const id = assertUUID(args.devis_id, 'devis_id');
    console.log(`[convert_devis] Converting devis ${id} to invoice`);
    const { data: devis, error: devisErr } = await ctx.supabase.from('devis').select('*, devis_lignes(*)').eq('id', id).single();
    if (devisErr) throw devisErr;
    if (!devis) throw new Error('Devis introuvable');
    if (devis.statut !== 'accepte') throw new Error(`Le devis doit être accepté pour être converti (statut actuel: ${devis.statut})`);

    const year = new Date().getFullYear();
    const { count } = await ctx.supabase.from('factures').select('*', { count: 'exact', head: true }).gte('date_emission', `${year}-01-01`);
    const numero = `FAC-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data: facture, error } = await ctx.supabase.from('factures').insert({
      numero, etablissement_id: devis.etablissement_id, client_nom: devis.client_nom,
      date_emission: new Date().toISOString().split('T')[0],
      date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      montant_ht: devis.montant_ht, montant_tva: devis.montant_tva, montant_ttc: devis.montant_ttc,
      statut: 'brouillon', created_by: ctx.userId, devis_id: args.devis_id
    }).select().single();
    if (error) throw error;

    if (devis.devis_lignes?.length) {
      await ctx.supabase.from('factures_lignes').insert(
        devis.devis_lignes.map((l: Record<string, unknown>) => ({
          facture_id: facture.id, designation: l.designation, quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht, taux_tva: l.taux_tva,
          montant_ht: l.montant_ht, montant_tva: l.montant_tva, montant_ttc: l.montant_ttc
        }))
      );
    }

    await ctx.supabase.from('devis').update({ statut: 'converti' }).eq('id', args.devis_id);

    return { success: true, data: { message: `Devis converti en facture ${numero}`, facture_id: facture.id, numero }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Conversion failed', execution_time_ms: Date.now() - start };
  }
}
