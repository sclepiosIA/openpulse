/**
 * JARVIS - Churn Predictor Tools
 *
 * Prédictions de churn (table churn_predictions + RPC compute_churn_predictions).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

// ------------------------------------------------------------------
// get_churn_predictions — top N comptes à risque
// ------------------------------------------------------------------
export async function executeGetChurnPredictionsList(
  ctx: ToolContext,
  args: { tier?: "critique" | "eleve" | "modere" | "faible"; limit?: number; min_score?: number }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let q = ctx.supabase
      .from("churn_predictions")
      .select(
        "id, etablissement_id, score, tier, factors, recommendations, computed_at, etablissements(nom, statut)"
      )
      .order("score", { ascending: false })
      .limit(Math.min(args.limit || 20, 100));

    if (args.tier) q = q.eq("tier", args.tier);
    if (args.min_score !== undefined) q = q.gte("score", args.min_score);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []) as any[];
    const byTier = items.reduce((acc, i) => {
      acc[i.tier] = (acc[i.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      success: true,
      data: {
        predictions: items.map((p) => ({
          etablissement_id: p.etablissement_id,
          nom: p.etablissements?.nom || null,
          statut: p.etablissements?.statut || null,
          score: p.score,
          tier: p.tier,
          top_factors: (p.factors || []).slice(0, 3),
          recommendations: (p.recommendations || []).slice(0, 3),
          computed_at: p.computed_at,
        })),
        total: items.length,
        by_tier: byTier,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_churn_predictions failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// recompute_churn_predictions — relance le calcul
// ------------------------------------------------------------------
export async function executeRecomputeChurnPredictions(
  _ctx: ToolContext,
  _args: Record<string, unknown>
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await (_ctx.supabase as any).rpc("compute_churn_predictions");
    if (error) throw error;

    return {
      success: true,
      data: {
        message: "Recalcul des prédictions de churn lancé",
        result: data,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "recompute_churn_predictions failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// get_churn_account_detail — détail d'un compte
// ------------------------------------------------------------------
export async function executeGetChurnAccountDetail(
  ctx: ToolContext,
  args: { etablissement_id: string }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.etablissement_id) throw new Error("etablissement_id requis");

    const { data, error } = await ctx.supabase
      .from("churn_predictions")
      .select("*, etablissements(id, nom, statut, type_structure, csm_id, commercial_id)")
      .eq("etablissement_id", args.etablissement_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return {
        success: true,
        data: { message: "Aucune prédiction trouvée pour cet établissement", etablissement_id: args.etablissement_id },
        execution_time_ms: Date.now() - start,
      };
    }

    return {
      success: true,
      data: {
        etablissement: (data as any).etablissements,
        score: (data as any).score,
        tier: (data as any).tier,
        factors: (data as any).factors || [],
        recommendations: (data as any).recommendations || [],
        computed_at: (data as any).computed_at,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_churn_account_detail failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
