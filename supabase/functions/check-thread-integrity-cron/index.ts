// Session 9 — Lot A item 3: cron quotidien d'intégrité des threads emails.
// Lit `check_thread_integrity()` et publie une alerte dans `monitor_alerts`
// si la dérive dépasse 1% du total des threads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-internal-secret;

const DRIFT_THRESHOLD = 0.01; // 1%

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const denied = requireInternalSecret(req, corsHeaders);
    if (denied) return denied;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );


    const { data: report, error } = await supabase.rpc("check_thread_integrity");
    if (error) throw error;

    const driftRatio = Number(report?.drift_ratio ?? 0);
    const driftCount = Number(report?.message_count_drift ?? 0);
    const orphans = Number(report?.orphan_messages ?? 0);
    const ghostThreads = Number(report?.threads_without_messages ?? 0);

    const shouldAlert = driftRatio > DRIFT_THRESHOLD || orphans > 0 || ghostThreads > 10;
    let alertId: string | null = null;

    if (shouldAlert) {
      const severity = driftRatio > 0.05 || orphans > 50 ? "critical" : "warning";
      const fingerprint = "email_thread_integrity:daily";

      // Upsert: incrémente occurrences si une alerte ouverte avec même fingerprint existe
      const { data: existing } = await supabase
        .from("monitor_alerts")
        .select("id, occurrences")
        .eq("fingerprint", fingerprint)
        .eq("status", "open")
        .maybeSingle();

      const payload = {
        rule_key: "email_thread_integrity",
        fingerprint,
        source: "check-thread-integrity-cron",
        severity,
        title: `Dérive intégrité threads emails (${driftCount} threads / ${(driftRatio * 100).toFixed(2)}%)`,
        message: `Drift: ${driftCount} threads | Orphans: ${orphans} | Ghost threads: ${ghostThreads}`,
        status: "open",
        last_seen_at: new Date().toISOString(),
        metadata: report,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { data: upd, error: updErr } = await supabase
          .from("monitor_alerts")
          .update({ ...payload, occurrences: (existing.occurrences ?? 0) + 1 })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (updErr) throw updErr;
        alertId = upd.id;
      } else {
        const { data: ins, error: insErr } = await supabase
          .from("monitor_alerts")
          .insert({
            ...payload,
            occurrences: 1,
            first_seen_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        alertId = ins.id;
      }
    }

    return new Response(
      JSON.stringify({ success: true, report, alert_id: alertId, alerted: shouldAlert }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return buildErrorResponse('check-thread-integrity-cron', err, corsHeaders, 500);
  }
});
