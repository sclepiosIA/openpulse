/**
 * JARVIS 12.0 - CRM Management Tools
 * 
 * CRUD complet pour les entités CRM : établissements, contacts, groupes, partenaires.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Gestion complète des établissements (CRUD + recherche)
 */
export async function executeManageEtablissement(
  ctx: ToolContext,
  args: {
    action: 'create' | 'update' | 'delete' | 'get' | 'list' | 'search';
    etablissement_id?: string;
    data?: {
      nom?: string;
      statut?: string;
      adresse?: string;
      ville?: string;
      code_postal?: string;
      telephone?: string;
      email?: string;
      ca_previsionnel?: number;
      ca_signe?: number;
      dpi?: string;
      commercial_id?: string;
      csm_id?: string;
      groupe_id?: string;
      finess?: string;
      siret?: string;
    };
    filters?: {
      statut?: string;
      commercial_id?: string;
      csm_id?: string;
      dpi?: string;
      ville?: string;
      groupe_id?: string;
    };
    search_term?: string;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    switch (args.action) {
      case 'get': {
        if (!args.etablissement_id) throw new Error('etablissement_id requis');
        const { data, error } = await ctx.supabase
          .from('etablissements')
          .select(`
            *,
            commercial:profiles!etablissements_commercial_id_fkey(id, nom, prenom, email),
            csm:profiles!etablissements_csm_id_fkey(id, nom, prenom, email),
            groupe:groupes_etablissements(id, nom),
            contacts(id, nom, prenom, email, telephone, fonction, est_decideur)
          `)
          .eq('id', args.etablissement_id)
          .single();
        if (error) throw error;
        return { success: true, data: { etablissement: data }, execution_time_ms: Date.now() - start };
      }

      case 'list': {
        let query = ctx.supabase
          .from('etablissements')
          .select('id, nom, statut, ville, ca_previsionnel, ca_signe, dpi, created_at')
          .order('created_at', { ascending: false })
          .limit(args.limit || 50);

        if (args.filters?.statut) query = query.eq('statut', args.filters.statut);
        if (args.filters?.commercial_id) query = query.eq('commercial_id', args.filters.commercial_id);
        if (args.filters?.csm_id) query = query.eq('csm_id', args.filters.csm_id);
        if (args.filters?.dpi) query = query.eq('dpi', args.filters.dpi);
        if (args.filters?.ville) query = query.ilike('ville', `%${args.filters.ville}%`);
        if (args.filters?.groupe_id) query = query.eq('groupe_id', args.filters.groupe_id);

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: { etablissements: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }

      case 'search': {
        if (!args.search_term) throw new Error('search_term requis pour la recherche');
        const safeTerm = args.search_term.replace(/[(),".\\%*:]/g, ' ').trim().substring(0, 200);
        if (!safeTerm) return { success: true, data: { etablissements: [], count: 0, search_term: args.search_term }, execution_time_ms: Date.now() - start };
        const { data, error } = await ctx.supabase
          .from('etablissements')
          .select('id, nom, statut, ville, ca_previsionnel, dpi')
          .or(`nom.ilike.%${safeTerm}%,ville.ilike.%${safeTerm}%,finess.ilike.%${safeTerm}%`)
          .limit(args.limit || 20);
        if (error) throw error;
        return { success: true, data: { etablissements: data, count: data?.length || 0, search_term: args.search_term }, execution_time_ms: Date.now() - start };
      }

      case 'create': {
        if (!args.data?.nom) throw new Error('nom requis pour créer un établissement');
        const { data, error } = await ctx.supabase
          .from('etablissements')
          .insert({
            ...args.data,
            statut: args.data.statut || 'prospect',
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Établissement "${data.nom}" créé`, etablissement: data }, execution_time_ms: Date.now() - start };
      }

      case 'update': {
        if (!args.etablissement_id) throw new Error('etablissement_id requis');
        if (!args.data) throw new Error('data requis pour la mise à jour');
        const { data, error } = await ctx.supabase
          .from('etablissements')
          .update(args.data)
          .eq('id', args.etablissement_id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Établissement mis à jour`, etablissement: data }, execution_time_ms: Date.now() - start };
      }

      case 'delete': {
        if (!args.etablissement_id) throw new Error('etablissement_id requis');
        // Soft delete ou vérification des dépendances
        const { error } = await ctx.supabase
          .from('etablissements')
          .update({ statut: 'archived' })
          .eq('id', args.etablissement_id);
        if (error) throw error;
        return { success: true, data: { message: 'Établissement archivé' }, execution_time_ms: Date.now() - start };
      }

      default:
        throw new Error(`Action inconnue: ${args.action}`);
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Opération établissement échouée', execution_time_ms: Date.now() - start };
  }
}

/**
 * Gestion des contacts
 */
export async function executeManageContact(
  ctx: ToolContext,
  args: {
    action: 'create' | 'update' | 'delete' | 'list';
    contact_id?: string;
    etablissement_id?: string;
    data?: {
      nom?: string;
      prenom?: string;
      email?: string;
      telephone?: string;
      fonction?: string;
      est_decideur?: boolean;
      notes?: string;
    };
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    switch (args.action) {
      case 'list': {
        let query = ctx.supabase
          .from('contacts')
          .select('id, nom, prenom, email, telephone, fonction, est_decideur, etablissement_id')
          .order('nom', { ascending: true })
          .limit(50);

        if (args.etablissement_id) {
          query = query.eq('etablissement_id', args.etablissement_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: { contacts: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }

      case 'create': {
        if (!args.data?.nom || !args.etablissement_id) {
          throw new Error('nom et etablissement_id requis');
        }
        const { data, error } = await ctx.supabase
          .from('contacts')
          .insert({
            ...args.data,
            etablissement_id: args.etablissement_id,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Contact "${data.prenom} ${data.nom}" créé`, contact: data }, execution_time_ms: Date.now() - start };
      }

      case 'update': {
        if (!args.contact_id) throw new Error('contact_id requis');
        const { data, error } = await ctx.supabase
          .from('contacts')
          .update(args.data || {})
          .eq('id', args.contact_id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: 'Contact mis à jour', contact: data }, execution_time_ms: Date.now() - start };
      }

      case 'delete': {
        if (!args.contact_id) throw new Error('contact_id requis');
        const { error } = await ctx.supabase
          .from('contacts')
          .delete()
          .eq('id', args.contact_id);
        if (error) throw error;
        return { success: true, data: { message: 'Contact supprimé' }, execution_time_ms: Date.now() - start };
      }

      default:
        throw new Error(`Action inconnue: ${args.action}`);
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Opération contact échouée', execution_time_ms: Date.now() - start };
  }
}

/**
 * Gestion des groupes d'établissements
 */
export async function executeManageGroupe(
  ctx: ToolContext,
  args: {
    action: 'create' | 'update' | 'delete' | 'list' | 'add_member' | 'remove_member';
    groupe_id?: string;
    etablissement_id?: string;
    data?: {
      nom?: string;
      type?: string;
      description?: string;
    };
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase
          .from('groupes_etablissements')
          .select(`
            id, nom, type, description,
            etablissements:etablissements(id, nom, statut)
          `)
          .order('nom', { ascending: true })
          .limit(50);
        if (error) throw error;
        return { success: true, data: { groupes: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }

      case 'create': {
        if (!args.data?.nom) throw new Error('nom requis');
        const { data, error } = await ctx.supabase
          .from('groupes_etablissements')
          .insert({
            ...args.data,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Groupe "${data.nom}" créé`, groupe: data }, execution_time_ms: Date.now() - start };
      }

      case 'update': {
        if (!args.groupe_id) throw new Error('groupe_id requis');
        const { data, error } = await ctx.supabase
          .from('groupes_etablissements')
          .update(args.data || {})
          .eq('id', args.groupe_id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: 'Groupe mis à jour', groupe: data }, execution_time_ms: Date.now() - start };
      }

      case 'delete': {
        if (!args.groupe_id) throw new Error('groupe_id requis');
        // Retirer les établissements du groupe d'abord
        await ctx.supabase
          .from('etablissements')
          .update({ groupe_id: null })
          .eq('groupe_id', args.groupe_id);
        const { error } = await ctx.supabase
          .from('groupes_etablissements')
          .delete()
          .eq('id', args.groupe_id);
        if (error) throw error;
        return { success: true, data: { message: 'Groupe supprimé' }, execution_time_ms: Date.now() - start };
      }

      case 'add_member': {
        if (!args.groupe_id || !args.etablissement_id) {
          throw new Error('groupe_id et etablissement_id requis');
        }
        const { data, error } = await ctx.supabase
          .from('etablissements')
          .update({ groupe_id: args.groupe_id })
          .eq('id', args.etablissement_id)
          .select('id, nom')
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Établissement "${data.nom}" ajouté au groupe` }, execution_time_ms: Date.now() - start };
      }

      case 'remove_member': {
        if (!args.etablissement_id) throw new Error('etablissement_id requis');
        const { data, error } = await ctx.supabase
          .from('etablissements')
          .update({ groupe_id: null })
          .eq('id', args.etablissement_id)
          .select('id, nom')
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Établissement "${data.nom}" retiré du groupe` }, execution_time_ms: Date.now() - start };
      }

      default:
        throw new Error(`Action inconnue: ${args.action}`);
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Opération groupe échouée', execution_time_ms: Date.now() - start };
  }
}

/**
 * Gestion des partenaires
 */
export async function executeManagePartenaire(
  ctx: ToolContext,
  args: {
    action: 'create' | 'update' | 'delete' | 'list' | 'get';
    partenaire_id?: string;
    data?: {
      nom?: string;
      type?: string;
      email?: string;
      telephone?: string;
      adresse?: string;
      commission_rate?: number;
      notes?: string;
      est_actif?: boolean;
    };
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase
          .from('partenaires')
          .select('id, nom, type, email, telephone, commission_rate, est_actif, created_at')
          .order('nom', { ascending: true })
          .limit(50);
        if (error) throw error;
        return { success: true, data: { partenaires: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }

      case 'get': {
        if (!args.partenaire_id) throw new Error('partenaire_id requis');
        const { data, error } = await ctx.supabase
          .from('partenaires')
          .select(`
            *,
            etablissements:etablissements(id, nom, statut)
          `)
          .eq('id', args.partenaire_id)
          .single();
        if (error) throw error;
        return { success: true, data: { partenaire: data }, execution_time_ms: Date.now() - start };
      }

      case 'create': {
        if (!args.data?.nom) throw new Error('nom requis');
        const { data, error } = await ctx.supabase
          .from('partenaires')
          .insert({
            ...args.data,
            est_actif: args.data.est_actif ?? true,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: `Partenaire "${data.nom}" créé`, partenaire: data }, execution_time_ms: Date.now() - start };
      }

      case 'update': {
        if (!args.partenaire_id) throw new Error('partenaire_id requis');
        const { data, error } = await ctx.supabase
          .from('partenaires')
          .update(args.data || {})
          .eq('id', args.partenaire_id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: { message: 'Partenaire mis à jour', partenaire: data }, execution_time_ms: Date.now() - start };
      }

      case 'delete': {
        if (!args.partenaire_id) throw new Error('partenaire_id requis');
        // Soft delete
        const { error } = await ctx.supabase
          .from('partenaires')
          .update({ est_actif: false })
          .eq('id', args.partenaire_id);
        if (error) throw error;
        return { success: true, data: { message: 'Partenaire désactivé' }, execution_time_ms: Date.now() - start };
      }

      default:
        throw new Error(`Action inconnue: ${args.action}`);
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Opération partenaire échouée', execution_time_ms: Date.now() - start };
  }
}
