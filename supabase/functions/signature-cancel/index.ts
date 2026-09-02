// signature-cancel: archive DocuSeal submission and mark request cancelled
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse as _buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const DOCUSEAL_API_URL = (Deno.env.get('SIGNATURE_URL_BASE') ?? '');

function sanitize(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  return m.replace(/(api[_-]?key|token|secret)[^\s]*/gi, '[redacted]').slice(0, 500);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const DOCUSEAL_API_KEY = Deno.env.get('DOCUSEAL_API_KEY');
    if (!DOCUSEAL_API_KEY) throw new Error('DOCUSEAL_API_KEY non configurée');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization manquant');
    const { data: { user }, error: aerr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (aerr || !user) throw new Error('Non authentifié');

    const { requestId, reason } = await req.json();
    if (!requestId) throw new Error('requestId requis');

    const { data: reqRow, error } = await supabase
      .from('signature_requests').select('*').eq('id', requestId).single();
    if (error || !reqRow) throw new Error('Demande introuvable');
    if (['completed', 'cancelled', 'expired'].includes(reqRow.status)) {
      throw new Error(`Demande déjà ${reqRow.status}`);
    }

    // Archive submission on DocuSeal (DELETE)
    if (reqRow.provider_request_id) {
      try {
        await fetch(`${DOCUSEAL_API_URL}/submissions/${reqRow.provider_request_id}`, {
          method: 'DELETE',
          headers: { 'X-Auth-Token': DOCUSEAL_API_KEY },
        });
      } catch (_) { /* best effort */ }
    }

    await supabase.from('signature_requests').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    }).eq('id', requestId);

    await supabase.from('signature_events').insert({
      request_id: requestId,
      event_type: 'cancelled',
      payload: { reason: reason ?? null, user_id: user.id },
    });

    await supabase.from('contrats').update({
      signature_status: 'cancelled',
    }).eq('id', reqRow.contrat_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('signature-cancel error:', error);
    return new Response(JSON.stringify({ error: sanitize(error) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
