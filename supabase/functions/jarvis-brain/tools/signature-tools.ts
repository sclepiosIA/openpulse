/**
 * JARVIS - Signature électronique (DocuSeal)
 *
 * Gestion des demandes de signature : liste, relance, annulation.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ------------------------------------------------------------------
// list_signature_requests
// ------------------------------------------------------------------
export async function executeListSignatureRequests(
  ctx: ToolContext,
  args: {
    status?: "pending" | "sent" | "viewed" | "signed" | "completed" | "refused" | "expired" | "cancelled";
    contrat_id?: string;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    let q = ctx.supabase
      .from("signature_requests")
      .select(
        "id, contrat_id, provider, status, signers, expire_at, reminders_sent, last_reminder_at, created_at, completed_at, cancelled_at"
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(args.limit || 30, 100));

    if (args.status) q = q.eq("status", args.status);
    if (args.contrat_id) q = q.eq("contrat_id", args.contrat_id);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []) as any[];
    const byStatus = items.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      success: true,
      data: { requests: items, total: items.length, by_status: byStatus },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "list_signature_requests failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// remind_signature
// ------------------------------------------------------------------
export async function executeRemindSignature(
  ctx: ToolContext,
  args: { request_id: string; message?: string }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.request_id) throw new Error("request_id requis");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/signature-remind`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        request_id: args.request_id,
        message: args.message,
        triggered_by: ctx.userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);

    return {
      success: true,
      data: { message: "Relance envoyée aux signataires", ...data },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "remind_signature failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// cancel_signature
// ------------------------------------------------------------------
export async function executeCancelSignature(
  ctx: ToolContext,
  args: { request_id: string; reason?: string }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.request_id) throw new Error("request_id requis");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/signature-cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        request_id: args.request_id,
        reason: args.reason,
        triggered_by: ctx.userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);

    return {
      success: true,
      data: { message: "Demande de signature annulée", ...data },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "cancel_signature failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
