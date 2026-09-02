/**
 * JARVIS - Attribution multi-touch (Scoring v2)
 *
 * RPC compute_attribution(_etablissement_id, _model).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function executeGetAttributionAnalysis(
  ctx: ToolContext,
  args: {
    etablissement_id: string;
    model?: "first_touch" | "last_touch" | "linear" | "time_decay";
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.etablissement_id) throw new Error("etablissement_id requis");
    const model = args.model || "time_decay";

    const { data, error } = await (ctx.supabase as any).rpc("compute_attribution", {
      _etablissement_id: args.etablissement_id,
      _model: model,
    });
    if (error) throw error;

    const result = data || { by_channel: {}, by_user: {} };

    // Top canaux
    const byChannel = Object.entries((result.by_channel as Record<string, number>) || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([channel, weight]) => ({ channel, weight }));

    const byUser = Object.entries((result.by_user as Record<string, number>) || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([user_id, weight]) => ({ user_id, weight }));

    return {
      success: true,
      data: {
        etablissement_id: args.etablissement_id,
        model,
        first_touch: result.first_touch,
        last_touch: result.last_touch,
        top_channels: byChannel,
        top_users: byUser,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_attribution_analysis failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
