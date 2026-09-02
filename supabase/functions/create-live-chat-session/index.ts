// Public edge function to start a live-chat visitor session and return the
// unguessable session_token used for subsequent message reads/writes via
// PostgREST under the visitor RLS policies.
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const guest_name = String(body?.guest_name || '').slice(0, 120).trim();
    const guest_email = body?.guest_email ? String(body.guest_email).slice(0, 200).trim() : null;
    const etablissement_id = body?.etablissement_id ? String(body.etablissement_id) : null;
    const source = String(body?.source || 'widget').slice(0, 32);

    if (!guest_name) {
      return new Response(JSON.stringify({ error: 'guest_name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('live_chat_sessions')
      .insert({
        guest_name,
        guest_email,
        etablissement_id,
        status: 'waiting',
        metadata: { source },
      })
      .select('id, session_token')
      .single();

    if (error || !data) {
      console.error('[create-live-chat-session]', error);
      return new Response(JSON.stringify({ error: 'Could not start session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ session_id: data.id, session_token: data.session_token }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: unknown) {
    return buildErrorResponse('create-live-chat-session', e, corsHeaders, 500);
  }
});
