/**
 * JARVIS - Custom Reports Tools
 *
 * Dashboards personnalisés (table custom_dashboards : id, nom, description,
 * widgets JSONB, layout JSONB, is_shared, is_template, owner_id, shared_with).
 * Exécution via RPC get_report_data(source_key text, params jsonb).
 * Export via edge function report-export (PDF/XLSX/CSV → URL signée).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Sources whitelistées dans la RPC get_report_data
const ALLOWED_SOURCES = [
  "etablissements_pipeline",
  "etablissements_par_statut",
  "factures_par_mois",
  "factures_impayees",
  "devis_par_statut",
  "tresorerie_revenus_par_categorie",
  "tresorerie_depenses_par_categorie",
  "taches_par_statut",
  "support_tickets_par_statut",
  "rh_masse_salariale",
  "formations_sessions",
  "csm_health_distribution",
  "churn_risk_distribution",
  "sales_forecast_pipeline",
  "activity_volume",
  "mrr_evolution",
] as const;

// ------------------------------------------------------------------
// list_custom_reports — liste des dashboards (mes propres + partagés + templates)
// ------------------------------------------------------------------
export async function executeListCustomReports(
  ctx: ToolContext,
  args: { search?: string; limit?: number; include_templates?: boolean }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let q = ctx.supabase
      .from("custom_dashboards")
      .select("id, nom, description, owner_id, is_shared, is_template, icon, color, widgets, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(Math.min(args.limit || 50, 100));

    if (args.search) q = q.ilike("nom", `%${args.search}%`);

    const { data, error } = await q;
    if (error) throw error;

    const all = (data || []) as any[];
    const personal = all.filter((d) => d.owner_id === ctx.userId);
    const shared = all.filter((d) => d.owner_id !== ctx.userId && d.is_shared && !d.is_template);
    const templates = args.include_templates !== false ? all.filter((d) => d.is_template) : [];

    return {
      success: true,
      data: {
        total: all.length,
        personal: personal.map((d) => ({
          id: d.id,
          nom: d.nom,
          description: d.description,
          widgets_count: Array.isArray(d.widgets) ? d.widgets.length : 0,
          updated_at: d.updated_at,
        })),
        shared: shared.map((d) => ({ id: d.id, nom: d.nom, description: d.description })),
        templates: templates.map((d) => ({ id: d.id, nom: d.nom, description: d.description })),
        available_sources: ALLOWED_SOURCES,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "list_custom_reports failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// run_custom_report — exécute un widget (source whitelisté + filtres)
// ------------------------------------------------------------------
export async function executeRunCustomReport(
  ctx: ToolContext,
  args: { source: string; filters?: Record<string, unknown> }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.source) throw new Error("source requise");
    if (!ALLOWED_SOURCES.includes(args.source as any)) {
      throw new Error(`Source non autorisée. Sources valides: ${ALLOWED_SOURCES.join(", ")}`);
    }

    const filters = args.filters || {};
    const { data, error } = await (ctx.supabase as any).rpc("get_report_data", {
      source_key: args.source,
      params: filters,
    });
    if (error) throw error;

    return {
      success: true,
      data: { source: args.source, filters, result: data },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "run_custom_report failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// export_custom_report — appelle edge function report-export
// ------------------------------------------------------------------
export async function executeExportCustomReport(
  ctx: ToolContext,
  args: {
    dashboard_id?: string;
    source?: string;
    filters?: Record<string, unknown>;
    format?: "pdf" | "xlsx" | "csv";
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const format = args.format || "pdf";
    if (!["pdf", "xlsx", "csv"].includes(format)) throw new Error("Format invalide (pdf/xlsx/csv)");
    if (!args.dashboard_id && !args.source) {
      throw new Error("dashboard_id ou source requis");
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/report-export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        dashboard_id: args.dashboard_id,
        source: args.source,
        filters: args.filters || {},
        format,
        user_id: ctx.userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return {
      success: true,
      data: {
        message: `Rapport exporté en ${format.toUpperCase()}`,
        url: data.url || data.signed_url,
        expires_at: data.expires_at,
        format,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "export_custom_report failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
