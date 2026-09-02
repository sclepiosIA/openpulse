/**
 * JARVIS - Sales Forecasting Tools
 *
 * Prévisions de ventes via RPC get_sales_forecast.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

function computeRange(range: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const qStart = Math.floor(m / 3) * 3;
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (range) {
    case "current_quarter":
      return { start: fmt(new Date(y, qStart, 1)), end: fmt(new Date(y, qStart + 3, 0)) };
    case "next_quarter":
      return { start: fmt(new Date(y, qStart + 3, 1)), end: fmt(new Date(y, qStart + 6, 0)) };
    case "rolling_12":
      return { start: fmt(new Date(y, m - 6, 1)), end: fmt(new Date(y, m + 6, 0)) };
    case "year":
    default:
      return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
}

// ------------------------------------------------------------------
// get_sales_forecast
// ------------------------------------------------------------------
export async function executeGetSalesForecast(
  ctx: ToolContext,
  args: { range?: "current_quarter" | "next_quarter" | "year" | "rolling_12" }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { start: pStart, end: pEnd } = computeRange(args.range || "year");

    const { data, error } = await (ctx.supabase as any).rpc("get_sales_forecast", {
      p_start: pStart,
      p_end: pEnd,
    });
    if (error) throw error;

    const f = data || {};
    return {
      success: true,
      data: {
        range: { start: pStart, end: pEnd, label: args.range || "year" },
        kpis: f.kpis,
        top_deals: (f.top_deals || []).slice(0, 10),
        at_risk_deals: (f.at_risk_deals || []).slice(0, 10),
        by_quarter: f.by_quarter,
        by_commercial: f.by_commercial,
        by_phase_group: f.by_phase_group,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "get_sales_forecast failed",
      execution_time_ms: Date.now() - start,
    };
  }
}

// ------------------------------------------------------------------
// compare_forecast_vs_actual — pondéré vs réalisé (factures gagnées)
// ------------------------------------------------------------------
export async function executeCompareForecastVsActual(
  ctx: ToolContext,
  args: { range?: "current_quarter" | "next_quarter" | "year" | "rolling_12" }
): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { start: pStart, end: pEnd } = computeRange(args.range || "year");

    const { data: forecast, error: fErr } = await (ctx.supabase as any).rpc("get_sales_forecast", {
      p_start: pStart,
      p_end: pEnd,
    });
    if (fErr) throw fErr;

    const kpis = forecast?.kpis || {};
    const weighted = Number(kpis.pipeline_weighted) || 0;
    const won = Number(kpis.won_total) || 0;
    const target = Number(kpis.target_total) || 0;

    const conversion = weighted > 0 ? Math.round((won / weighted) * 100) : 0;
    const target_progress = target > 0 ? Math.round((won / target) * 100) : null;

    return {
      success: true,
      data: {
        range: { start: pStart, end: pEnd },
        weighted_pipeline: weighted,
        won_actual: won,
        target,
        conversion_pct: conversion,
        target_progress_pct: target_progress,
        gap_to_target: target ? target - won : null,
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "compare_forecast_vs_actual failed",
      execution_time_ms: Date.now() - start,
    };
  }
}
