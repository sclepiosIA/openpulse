/**
 * JARVIS - Automation / Workflow Builder Tools
 *
 * Outils pour gérer les workflows métier (table public.workflows + workflow_runs).
 * Création depuis langage naturel via la edge function generate-workflow-from-prompt,
 * activation/désactivation, déclenchement manuel via workflow-engine, historique d'exécutions.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callEdgeFunction(name: string, body: unknown, userJwt?: string): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userJwt || SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

// ------------------------------------------------------------------
// list_workflows — liste des workflows + état + dernier run
// ------------------------------------------------------------------
export async function executeListWorkflows(
  ctx: ToolContext,
  args: { active_only?: boolean; search?: string; limit?: number }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let q = ctx.supabase
      .from("workflows")
      .select("id, name, description, is_active, trigger_type, created_at, updated_at, last_run_at, last_run_status")
      .order("updated_at", { ascending: false })
      .limit(Math.min(args.limit || 50, 100));

    if (args.active_only) q = q.eq("is_active", true);
    if (args.search) q = q.ilike("name", `%${args.search}%`);

    const { data, error } = await q;
    if (error) throw error;

    return {
      success: true,
      data: { workflows: data || [], total: data?.length || 0 },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "list_workflows failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// get_workflow_runs — historique des exécutions
// ------------------------------------------------------------------
export async function executeGetWorkflowRuns(
  ctx: ToolContext,
  args: { workflow_id?: string; status?: "success" | "error" | "running" | "pending"; limit?: number }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let q = ctx.supabase
      .from("workflow_runs")
      .select("id, workflow_id, status, started_at, finished_at, duration_ms, error_message, trigger_payload")
      .order("started_at", { ascending: false })
      .limit(Math.min(args.limit || 30, 100));

    if (args.workflow_id) q = q.eq("workflow_id", args.workflow_id);
    if (args.status) q = q.eq("status", args.status);

    const { data, error } = await q;
    if (error) throw error;

    const total = data?.length || 0;
    const success = data?.filter((r) => r.status === "success").length || 0;
    const errors = data?.filter((r) => r.status === "error").length || 0;

    return {
      success: true,
      data: {
        runs: data || [],
        summary: { total, success, errors, error_rate: total ? Math.round((errors / total) * 100) : 0 },
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_workflow_runs failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// create_workflow_from_prompt — génération depuis langue naturelle
// ------------------------------------------------------------------
export async function executeCreateWorkflowFromPrompt(
  ctx: ToolContext,
  args: { prompt: string; activate?: boolean }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.prompt || args.prompt.length < 8) {
      throw new Error("Le prompt doit décrire le workflow souhaité (8 caractères minimum)");
    }

    const res = await callEdgeFunction("generate-workflow-from-prompt", {
      prompt: args.prompt,
      user_id: ctx.userId,
      auto_activate: args.activate === true,
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return {
      success: true,
      data: {
        message: `Workflow généré${args.activate ? " et activé" : " (en brouillon)"}`,
        workflow_id: data.workflow_id || data.workflow?.id,
        workflow: data.workflow,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "create_workflow_from_prompt failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// toggle_workflow — activer / désactiver
// ------------------------------------------------------------------
export async function executeToggleWorkflow(
  ctx: ToolContext,
  args: { workflow_id: string; is_active: boolean }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.workflow_id) throw new Error("workflow_id requis");

    const { data, error } = await ctx.supabase
      .from("workflows")
      .update({ is_active: args.is_active, updated_at: new Date().toISOString() })
      .eq("id", args.workflow_id)
      .select("id, name, is_active")
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: `Workflow "${data.name}" ${data.is_active ? "activé" : "désactivé"}`, workflow: data },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "toggle_workflow failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// run_workflow_now — déclenchement manuel
// ------------------------------------------------------------------
export async function executeRunWorkflowNow(
  ctx: ToolContext,
  args: { workflow_id: string; payload?: Record<string, unknown> }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.workflow_id) throw new Error("workflow_id requis");

    // Tentative via workflow-dispatcher (déclencheur centralisé)
    const res = await callEdgeFunction("workflow-dispatcher", {
      workflow_id: args.workflow_id,
      trigger_type: "manual",
      triggered_by: ctx.userId,
      payload: args.payload || {},
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return {
      success: true,
      data: {
        message: "Workflow déclenché",
        run_id: data.run_id || data.runId,
        status: data.status || "pending",
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "run_workflow_now failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
