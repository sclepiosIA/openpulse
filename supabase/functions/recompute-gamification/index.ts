// Recompute gamification: points + badge unlocks for all active users.
// Designed to be invoked hourly by pg_cron (and on-demand by admins).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require authenticated user OR internal/service call
  const auth = await validateServiceOrUser(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const startedAt = Date.now();
  const periods = ["week", "month", "quarter", "year", "all"] as const;
  let scope: "single" | "all" = "all";
  let onlyUserId: string | null = null;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.user_id) {
        scope = "single";
        onlyUserId = body.user_id;
      }
    }

    // Non-service callers can only recompute their own user
    if (!auth.isServiceCall) {
      scope = "single";
      onlyUserId = auth.userId!;
    }

    // Fetch active users
    let userIds: string[] = [];
    if (scope === "single" && onlyUserId) {
      userIds = [onlyUserId];
    } else {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("actif", true)
        .not("user_id", "is", null)
        .limit(1000);
      if (error) throw error;
      userIds = (data ?? []).map((r: any) => r.user_id).filter(Boolean);
    }

    let okCount = 0;
    let errCount = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    for (const uid of userIds) {
      try {
        // Compute points for each rolling period
        for (const p of periods) {
          const { error: cErr } = await supabase.rpc("compute_gamification_points", {
            p_user_id: uid,
            p_period: p,
          });
          if (cErr) throw cErr;
        }
        // Unlock newly earned badges
        const { error: bErr } = await supabase.rpc("unlock_badges", { p_user_id: uid });
        if (bErr) throw bErr;
        okCount++;
      } catch (e: any) {
        errCount++;
        errors.push({ user_id: uid, error: e?.message ?? String(e) });
      }
    }

    const durationMs = Date.now() - startedAt;
    return new Response(
      JSON.stringify({
        success: true,
        scope,
        users_total: userIds.length,
        users_ok: okCount,
        users_error: errCount,
        duration_ms: durationMs,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    return buildErrorResponse('recompute-gamification', e, corsHeaders, 500);
  }
});
