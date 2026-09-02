/**
 * JARVIS - Activity Feed Tools
 *
 * Flux d'activité global (RPC get_global_activity_feed) + épingles personnelles
 * (table activity_feed_pins).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

// ------------------------------------------------------------------
// get_activity_feed
// ------------------------------------------------------------------
export async function executeGetActivityFeed(
  ctx: ToolContext,
  args: {
    limit?: number;
    cursor?: string | null;
    types?: string[];
    user_ids?: string[];
    etablissement_ids?: string[];
    date_from?: string;
    date_to?: string;
    search?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const filters: Record<string, unknown> = {};
    if (args.types?.length) filters.types = args.types;
    if (args.user_ids?.length) filters.user_ids = args.user_ids;
    if (args.etablissement_ids?.length) filters.etablissement_ids = args.etablissement_ids;
    if (args.date_from) filters.date_from = args.date_from;
    if (args.date_to) filters.date_to = args.date_to;
    if (args.search) filters.search = args.search;

    const { data, error } = await (ctx.supabase as any).rpc("get_global_activity_feed", {
      p_limit: Math.min(args.limit || 30, 100),
      p_cursor: args.cursor ?? null,
      p_filters: filters,
    });
    if (error) throw error;

    const items = (data || []) as any[];

    return {
      success: true,
      data: {
        items,
        count: items.length,
        next_cursor: items.length === (args.limit || 30) ? items[items.length - 1].occurred_at : null,
        by_type: items.reduce((acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_activity_feed failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// pin_activity_event — pin / unpin
// ------------------------------------------------------------------
export async function executePinActivityEvent(
  ctx: ToolContext,
  args: { activity_key: string; action: "pin" | "unpin"; note?: string }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!args.activity_key) throw new Error("activity_key requis");

    if (args.action === "unpin") {
      const { error } = await ctx.supabase
        .from("activity_feed_pins")
        .delete()
        .eq("user_id", ctx.userId)
        .eq("activity_key", args.activity_key);
      if (error) throw error;
      return {
        success: true,
        data: { message: "Événement désépinglé" },
        execution_time_ms: Date.now() - start,
      };
    }

    const { data, error } = await ctx.supabase
      .from("activity_feed_pins")
      .upsert(
        {
          user_id: ctx.userId,
          activity_key: args.activity_key,
          note: args.note || null,
          pinned_at: new Date().toISOString(),
        },
        { onConflict: "user_id,activity_key" }
      )
      .select()
      .single();
    if (error) throw error;

    return {
      success: true,
      data: { message: "Événement épinglé", pin: data },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "pin_activity_event failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
