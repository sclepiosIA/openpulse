// Edge Function: workflow-scheduler
// Reprend les workflow_scheduled_steps arrivés à échéance.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    const providedSecret = req.headers.get('x-function-secret');
    const authHeader = req.headers.get('authorization') || '';
    const isInternal = !!internalSecret && providedSecret === internalSecret;
    const isServiceRole = !!SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`;
    if (!isInternal && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const now = new Date().toISOString();

    const { data: due, error } = await supabase
      .from('workflow_scheduled_steps')
      .select('*')
      .eq('status', 'pending')
      .lte('execute_at', now)
      .limit(50);
    if (error) throw error;

    let resumed = 0;
    for (const step of (due || [])) {
      try {
        await supabase.from('workflow_scheduled_steps')
          .update({ status: 'processing' })
          .eq('id', step.id);

        // Récupère le payload depuis le run
        const { data: run } = await supabase
          .from('workflow_runs').select('trigger_payload').eq('id', step.run_id).single();

        await supabase.functions.invoke('workflow-engine', {
          body: {
            workflow_id: step.workflow_id,
            run_id: step.run_id,
            resume_from_node: step.node_id,
            trigger_payload: run?.trigger_payload || {},
          },
        });

        await supabase.from('workflow_scheduled_steps')
          .update({ status: 'done', processed_at: new Date().toISOString() })
          .eq('id', step.id);
        resumed++;
      } catch (stepErr: any) {
        console.error('[scheduler step]', stepErr);
        await supabase.from('workflow_scheduled_steps')
          .update({ status: 'failed' })
          .eq('id', step.id);
      }
    }

    return new Response(JSON.stringify({ due: due?.length || 0, resumed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[workflow-scheduler]', err);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
