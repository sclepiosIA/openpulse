/**
 * JARVIS - Catalogue Produits & Services Tools
 *
 * Référentiel produits/services (table public.catalogue_produits).
 * Lecture pour tous les utilisateurs authentifiés, écriture restreinte (direction/admin/commercial).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

// ------------------------------------------------------------------
// list_catalogue_produits
// ------------------------------------------------------------------
export async function executeListCatalogueProduits(
  ctx: ToolContext,
  args: {
    search?: string;
    type?: string;
    categorie?: string;
    actif_only?: boolean;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let q = ctx.supabase
      .from("catalogue_produits")
      .select(
        "id, code, nom, description, type, categorie, prix_unitaire_ht, taux_tva, unite, recurrence, est_actif, ordre_affichage"
      )
      .order("ordre_affichage", { ascending: true })
      .limit(Math.min(args.limit || 50, 200));

    if (args.actif_only !== false) q = q.eq("est_actif", true);
    if (args.type) q = q.eq("type", args.type);
    if (args.categorie) q = q.eq("categorie", args.categorie);
    if (args.search) {
      const safe = args.search.replace(/[(),".\\%*:]/g, ' ').trim().substring(0, 200);
      if (safe) q = q.or(`nom.ilike.%${safe}%,code.ilike.%${safe}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    return {
      success: true,
      data: { produits: data || [], total: data?.length || 0 },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "list_catalogue_produits failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// get_catalogue_stats — RPC get_catalogue_stats
// ------------------------------------------------------------------
export async function executeGetCatalogueStats(
  ctx: ToolContext,
  args: { top_n?: number }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await (ctx.supabase as any).rpc("get_catalogue_stats");
    if (error) throw error;

    const stats = (data || []) as Array<{
      produit_id: string;
      nb_devis: number;
      nb_factures: number;
      ca_cumule_ht: number;
      derniere_utilisation: string | null;
    }>;

    const sorted = [...stats].sort((a, b) => (b.ca_cumule_ht || 0) - (a.ca_cumule_ht || 0));
    const top = sorted.slice(0, Math.min(args.top_n || 10, 50));

    // Joindre les noms produits pour le top
    const ids = top.map((s) => s.produit_id);
    const { data: produits } = await ctx.supabase
      .from("catalogue_produits")
      .select("id, code, nom")
      .in("id", ids);
    const nameById = new Map((produits || []).map((p) => [p.id, p]));

    return {
      success: true,
      data: {
        total_produits_utilises: stats.length,
        ca_total_ht: stats.reduce((s, x) => s + (Number(x.ca_cumule_ht) || 0), 0),
        top: top.map((s) => ({
          ...s,
          nom: nameById.get(s.produit_id)?.nom || null,
          code: nameById.get(s.produit_id)?.code || null,
        })),
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_catalogue_stats failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// manage_catalogue_produit — create / update / archive
// ------------------------------------------------------------------
export async function executeManageCatalogueProduit(
  ctx: ToolContext,
  args: {
    action: "create" | "update" | "archive" | "restore";
    produit_id?: string;
    data?: {
      code?: string;
      nom?: string;
      description?: string;
      type?: string;
      categorie?: string;
      prix_unitaire_ht?: number;
      taux_tva?: number;
      unite?: string;
      recurrence?: "none" | "monthly" | "quarterly" | "yearly";
    };
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case "create": {
        if (!args.data?.nom || !args.data?.code) throw new Error("code et nom requis");
        const { data, error } = await ctx.supabase
          .from("catalogue_produits")
          .insert({
            ...args.data,
            est_actif: true,
            type: args.data.type || "service",
            taux_tva: args.data.taux_tva ?? 20,
          })
          .select("id, code, nom")
          .single();
        if (error) throw error;
        return {
          success: true,
          data: { message: `Produit "${data.nom}" créé`, produit: data },
          execution_time_ms: Date.now() - start,
        };
      }
      case "update": {
        if (!args.produit_id) throw new Error("produit_id requis");
        const { data, error } = await ctx.supabase
          .from("catalogue_produits")
          .update({ ...(args.data || {}), updated_at: new Date().toISOString() })
          .eq("id", args.produit_id)
          .select("id, code, nom")
          .single();
        if (error) throw error;
        return {
          success: true,
          data: { message: `Produit "${data.nom}" mis à jour`, produit: data },
          execution_time_ms: Date.now() - start,
        };
      }
      case "archive":
      case "restore": {
        if (!args.produit_id) throw new Error("produit_id requis");
        const { data, error } = await ctx.supabase
          .from("catalogue_produits")
          .update({ est_actif: args.action === "restore" })
          .eq("id", args.produit_id)
          .select("id, code, nom, est_actif")
          .single();
        if (error) throw error;
        return {
          success: true,
          data: {
            message: `Produit "${data.nom}" ${args.action === "archive" ? "archivé" : "réactivé"}`,
            produit: data,
          },
          execution_time_ms: Date.now() - start,
        };
      }
      default:
        throw new Error(`Action inconnue: ${args.action}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "manage_catalogue_produit failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
