import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "../_shared/rate-limit.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * Endpoint legacy maintenu pour compatibilité.
 * Délègue désormais au RPC public submit_enquete(token, type, payload)
 * qui gère validation, expiration et plan d'action automatique.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const ip = extractClientIp(req);
  const rl = checkRateLimit(`submit-satisfaction-solution:${ip}`, { limit: 5, windowSec: 60 });
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSec!, corsHeaders);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    const token = typeof payload.token_enquete === 'string' ? payload.token_enquete.trim() : '';
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token_enquete requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase.rpc('submit_enquete', {
      p_token: token,
      p_type: 'satisfaction',
      p_payload: payload,
    });

    if (error) {
      const safe = sanitizeErrorForClient(error);
      return new Response(JSON.stringify({ error: safe }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = data as { success: boolean; error?: string; id?: string };
    if (!result?.success) {
      const status = result?.error === 'deja_repondu' ? 409
        : result?.error === 'token_expire' || result?.error === 'token_invalide' ? 401
        : 400;
      return new Response(JSON.stringify({ error: result?.error || 'unknown' }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-satisfaction-solution error:', err);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
