// Edge function: call-log
// Log les états d'un appel (start / answer / end / fail) envoyés par le front.
// L'écriture en BDD passe par RLS user_id = auth.uid().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { origineAutorisee } from '../_shared/cors.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LogPayload {
  action: 'start' | 'answer' | 'end' | 'fail';
  call_id?: string;
  direction?: 'outbound' | 'inbound';
  from_number?: string;
  to_number?: string;
  display_name?: string;
  contact_id?: string;
  etablissement_id?: string;
  prospect_id?: string;
  sip_call_id?: string;
  status?: string;
  duration_sec?: number;
  failure_reason?: string;
  notes?: string;
  recording_path?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: LogPayload = await req.json();

    if (!payload.action) {
      return new Response(JSON.stringify({ error: 'Missing action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payload.action === 'start') {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          user_id: user.id,
          direction: payload.direction || 'outbound',
          from_number: payload.from_number || '',
          to_number: payload.to_number || '',
          display_name: payload.display_name ?? null,
          contact_id: payload.contact_id ?? null,
          etablissement_id: payload.etablissement_id ?? null,
          prospect_id: payload.prospect_id ?? null,
          sip_call_id: payload.sip_call_id ?? null,
          status: 'initiating',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ call_id: data.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payload.call_id) {
      return new Response(JSON.stringify({ error: 'Missing call_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update: Record<string, unknown> = {};
    if (payload.action === 'answer') {
      update.status = 'in-progress';
      update.answered_at = new Date().toISOString();
    } else if (payload.action === 'end') {
      update.status = payload.status || 'completed';
      update.ended_at = new Date().toISOString();
      if (typeof payload.duration_sec === 'number') update.duration_sec = payload.duration_sec;
      if (payload.notes !== undefined) update.notes = payload.notes;
      if (payload.recording_path) update.recording_path = payload.recording_path;
    } else if (payload.action === 'fail') {
      update.status = payload.status || 'failed';
      update.ended_at = new Date().toISOString();
      update.failure_reason = payload.failure_reason ?? null;
    }

    const { error } = await supabase.from('calls').update(update).eq('id', payload.call_id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    return buildErrorResponse('call-log', e, corsHeaders, 500);
  }
});
