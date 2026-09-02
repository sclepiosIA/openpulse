// signature-remind: send reminder to one or all pending signers via DocuSeal
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const DOCUSEAL_API_URL = (Deno.env.get('SIGNATURE_URL_BASE') ?? '');


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const DOCUSEAL_API_KEY = Deno.env.get('DOCUSEAL_API_KEY');
    if (!DOCUSEAL_API_KEY) throw new Error('DOCUSEAL_API_KEY non configurée');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Auth optional (cron uses service role)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '_')) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id ?? null;
    }

    const { requestId, signerEmail } = await req.json();
    if (!requestId) throw new Error('requestId requis');

    const { data: reqRow, error } = await supabase
      .from('signature_requests').select('*').eq('id', requestId).single();
    if (error || !reqRow) throw new Error('Demande introuvable');
    if (!['sent', 'viewed', 'signed'].includes(reqRow.status)) {
      throw new Error(`Statut ${reqRow.status} : relance impossible`);
    }

    // Find submitter slugs to remind
    const submitters = (reqRow.metadata?.submitters ?? []) as Array<{ email: string; slug?: string; id?: string | number }>;
    const targets = signerEmail
      ? submitters.filter(s => s.email === signerEmail)
      : submitters.filter(s => {
          const signer = (reqRow.signers ?? []).find((x: any) => x.email === s.email);
          return signer && !signer.signed_at;
        });

    if (targets.length === 0) throw new Error('Aucun signataire à relancer');

    let success = 0;
    for (const t of targets) {
      if (!t.id && !t.slug) continue;
      const ident = t.id ?? t.slug;
      const r = await fetch(`${DOCUSEAL_API_URL}/submitters/${ident}/reminder`, {
        method: 'POST',
        headers: { 'X-Auth-Token': DOCUSEAL_API_KEY, 'Content-Type': 'application/json' },
      });
      if (r.ok) success++;
    }

    if (success === 0) throw new Error('Aucune relance envoyée par le provider');

    await supabase.from('signature_requests').update({
      reminders_sent: (reqRow.reminders_sent ?? 0) + 1,
      last_reminder_at: new Date().toISOString(),
    }).eq('id', requestId);

    await supabase.from('signature_events').insert(
      targets.map(t => ({
        request_id: requestId,
        event_type: 'reminded',
        signer_email: t.email,
        payload: { triggered_by: userId ?? 'cron' },
      })),
    );

    return new Response(JSON.stringify({ success: true, reminded: success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    return buildErrorResponse('signature-remind', error, corsHeaders, 400);
  }

});
