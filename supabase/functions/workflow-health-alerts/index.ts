// Edge Function: workflow-health-alerts
// Called every 15 min by cron `workflow-health-alerts-tick`.
// Reads workflow_alert_config rows; for each active config, computes the
// failure rate over the window and inserts in-app notifications when the
// threshold is exceeded. Debounced 1h via last_triggered_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DEBOUNCE_MS = 60 * 60 * 1000; // 1h

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const providedSecret = req.headers.get('x-function-secret');
  const auth = req.headers.get('authorization') ?? '';
  const isServiceRole = auth === `Bearer ${SERVICE_ROLE}`;
  if (!isServiceRole && (!internalSecret || providedSecret !== internalSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const triggered: Array<{ config_id: string; reason: string }> = [];

  try {
    const { data: configs, error } = await supabase
      .from('workflow_alert_config')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;

    for (const cfg of configs ?? []) {
      // Debounce
      if (cfg.last_triggered_at && Date.now() - new Date(cfg.last_triggered_at).getTime() < DEBOUNCE_MS) {
        continue;
      }

      const sinceIso = new Date(Date.now() - cfg.window_minutes * 60_000).toISOString();

      // Failure rate
      let runsQ = supabase.from('workflow_runs').select('status', { count: 'exact' }).gte('started_at', sinceIso);
      if (cfg.workflow_id) runsQ = runsQ.eq('workflow_id', cfg.workflow_id);
      const { data: runs } = await runsQ;
      const total = runs?.length ?? 0;
      const failed = (runs ?? []).filter((r: any) => r.status === 'failed').length;
      const rate = total > 0 ? failed / total : 0;

      // Backlog scheduled
      let backlogQ = supabase.from('workflow_scheduled_steps').select('id', { count: 'exact', head: true });
      if (cfg.workflow_id) {
        const { data: ws } = await supabase.from('workflow_runs').select('id').eq('workflow_id', cfg.workflow_id);
        const ids = (ws ?? []).map((r: any) => r.id);
        if (ids.length) backlogQ = backlogQ.in('run_id', ids);
      }
      const { count: backlogCount } = await backlogQ;

      const reasons: string[] = [];
      if (total >= cfg.min_runs && rate >= Number(cfg.failure_rate_threshold)) {
        reasons.push(`Taux d'échec ${(rate * 100).toFixed(0)}% (${failed}/${total}) sur ${cfg.window_minutes} min`);
      }
      if ((backlogCount ?? 0) >= cfg.scheduled_backlog_threshold) {
        reasons.push(`Backlog scheduled : ${backlogCount} étapes en attente`);
      }
      if (!reasons.length) continue;

      // Push notifications
      const userIds: string[] = cfg.notify_user_ids ?? [];
      if (!userIds.length) continue;

      const message = `⚠️ Alerte workflow${cfg.workflow_id ? '' : ' (global)'} : ${reasons.join(' · ')}`;
      const rows = userIds.map((uid) => ({
        user_id: uid,
        type: 'workflow_alert',
        title: 'Alerte automatisations',
        message,
        link: '/automatisations/sante',
        is_read: false,
      }));
      await supabase.from('notifications').insert(rows as any);
      await supabase.from('workflow_alert_config').update({ last_triggered_at: new Date().toISOString() }).eq('id', cfg.id);
      triggered.push({ config_id: cfg.id, reason: reasons.join(' · ') });
    }

    return new Response(JSON.stringify({ ok: true, triggered }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    return buildErrorResponse('workflow-health-alerts', e, corsHeaders, 500);
  }

});
