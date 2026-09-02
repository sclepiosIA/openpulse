// Edge Function: workflow-webhook-trigger
// Public endpoint: POST /functions/v1/workflow-webhook-trigger/{token}
// → resolves token → optional HMAC verification → invokes workflow-engine
//   with the body as trigger_payload.
// verify_jwt = false (configured via supabase/config.toml).
// Security:
//   - Opaque token (path segment).
//   - When the token row has `webhook_secret`, HMAC-SHA256 verification of the
//     raw body is REQUIRED (header `x-webhook-signature`, optional
//     `x-webhook-timestamp` for 5-min replay protection).
//   - Per-token rate-limit (60 calls/min via workflow_runs count).
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { verifyHmacSignature } from "../_shared/hmac.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const token = segments[segments.length - 1];

    if (!token || token === 'workflow-webhook-trigger') {
      return new Response(JSON.stringify({ error: 'Token manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Resolve token → workflow_id (+ optional webhook_secret)
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('workflow_webhook_tokens')
      .select('id, workflow_id, is_active, webhook_secret')
      .eq('token', token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!tokenRow.is_active) {
      return new Response(JSON.stringify({ error: 'Token désactivé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Lightweight rate-limit: max 60 calls/min per token
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from('workflow_runs')
      .select('id', { count: 'exact', head: true })
      .eq('workflow_id', tokenRow.workflow_id)
      .gte('started_at', sinceIso);
    if ((count ?? 0) > 60) {
      return new Response(JSON.stringify({ error: 'Rate limit dépassé (60/min)' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read raw body first (required for HMAC verification, even if not enforced).
    const rawBody = await req.text();

    // Optional HMAC verification — enforced ONLY when the token has a secret.
    if (tokenRow.webhook_secret) {
      const signature = req.headers.get('x-webhook-signature');
      const timestamp = req.headers.get('x-webhook-timestamp');
      const verify = await verifyHmacSignature(
        rawBody,
        signature,
        tokenRow.webhook_secret as string,
        // 5-minute replay window when a timestamp is supplied; otherwise
        // signature alone is accepted (back-compat with senders that don't
        // send a timestamp).
        timestamp ? { maxAgeSeconds: 300, timestamp } : {},
      );
      if (!verify.ok) {
        console.warn('[workflow-webhook-trigger] HMAC verification failed:', verify.reason);
        return new Response(
          JSON.stringify({ error: 'Signature invalide' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Parse body (tolerate non-JSON)
    let payload: Record<string, unknown> = {};
    try {
      const contentType = req.headers.get('content-type') ?? '';
      if (contentType.includes('application/json') && rawBody) {
        payload = JSON.parse(rawBody);
      } else if (rawBody) {
        payload = { raw: rawBody };
      }
    } catch {
      payload = {};
    }

    // Invoke engine (do not block on response)
    const { data: invoked, error: invErr } = await supabase.functions.invoke('workflow-engine', {
      body: {
        workflow_id: tokenRow.workflow_id,
        trigger_payload: { ...payload, _via_webhook_token: token },
        manual: true,
      },
    });
    if (invErr) {
      console.error('[workflow-webhook-trigger] Engine error:', invErr);
      return new Response(JSON.stringify({ error: 'Engine error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update telemetry — simple increment via raw select + update
    const { data: currentToken } = await supabase
      .from('workflow_webhook_tokens')
      .select('total_calls')
      .eq('id', tokenRow.id)
      .single();
    await supabase
      .from('workflow_webhook_tokens')
      .update({
        last_used_at: new Date().toISOString(),
        total_calls: ((currentToken?.total_calls as number) || 0) + 1,
      })
      .eq('id', tokenRow.id);

    return new Response(JSON.stringify({ accepted: true, run: invoked ?? null }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
