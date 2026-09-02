// docuseal-webhook: HMAC-verified, writes signature_events + updates signature_requests
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-docuseal-signature;

interface DocuSealWebhookPayload {
  event_type: 'form.viewed' | 'form.started' | 'form.completed' | 'form.declined' | 'submission.completed' | 'submission.archived' | 'submission.expired';
  timestamp: string;
  data: {
    id: number;
    submission_id: number;
    email: string;
    status: string;
    sent_at?: string;
    opened_at?: string;
    completed_at?: string;
    declined_at?: string;
    decline_reason?: string;
    name?: string;
    role?: string;
    documents?: Array<{ name: string; url: string }>;
    submission?: { id: number; status: string; audit_log_url?: string; completed_at?: string };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // HMAC verification
    const webhookSecret = Deno.env.get('DOCUSEAL_WEBHOOK_SECRET');
    const signatureHeader = req.headers.get('x-docuseal-signature');
    if (!webhookSecret) {
      console.error('CRITICAL: DOCUSEAL_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (signatureHeader !== expected) {
      console.error('Invalid DocuSeal webhook signature - rejected');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody) as DocuSealWebhookPayload;
    return await processWebhook(payload, supabase, req);
  } catch (error: unknown) {
    console.error('docuseal-webhook error:', error);
    return buildErrorResponse('docuseal-webhook', error, corsHeaders, 500);
  }
});

const eventMap: Record<string, string> = {
  'form.viewed': 'viewed',
  'form.started': 'opened',
  'form.completed': 'signed',
  'form.declined': 'refused',
  'submission.completed': 'completed',
  'submission.expired': 'expired',
  'submission.archived': 'cancelled',
};

async function processWebhook(payload: DocuSealWebhookPayload, supabase: any, req: Request) {
  const { event_type, data, timestamp } = payload;
  const submissionId = String(data.submission_id);

  console.log(`DocuSeal webhook: ${event_type} for submission ${submissionId}`);

  // 1. Find signature_request (preferred) — fallback to contrat
  const { data: sigReq } = await supabase
    .from('signature_requests')
    .select('*')
    .eq('provider_request_id', submissionId)
    .eq('provider', 'docuseal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: contrat } = await supabase
    .from('contrats').select('*').eq('signature_request_id', submissionId).maybeSingle();

  if (!sigReq && !contrat) {
    return new Response(JSON.stringify({ success: true, message: 'Unknown submission, ignored' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent') ?? null;

  // 2. Log signature_event (single source of truth)
  if (sigReq) {
    const mapped = eventMap[event_type] ?? 'opened';
    await supabase.from('signature_events').insert({
      request_id: sigReq.id,
      event_type: mapped,
      signer_email: data.email,
      signer_name: data.name ?? null,
      payload: { event_type, raw: data, timestamp },
      ip_address: ip,
      user_agent: ua,
    });

    // 3. Update signers array per-signer status
    const newSigners = (sigReq.signers ?? []).map((s: any) =>
      s.email === data.email
        ? {
            ...s,
            status: mapped === 'signed' || data.status === 'completed' ? 'signed' : (mapped === 'viewed' ? 'viewed' : s.status),
            signed_at: (event_type === 'form.completed' ? (data.completed_at ?? timestamp) : s.signed_at),
            ip: ip ?? s.ip,
          }
        : s,
    );

    const reqUpdate: Record<string, unknown> = { signers: newSigners };

    if (event_type === 'submission.completed' || (event_type === 'form.completed' && data.submission?.status === 'completed')) {
      reqUpdate.status = 'completed';
      reqUpdate.completed_at = data.submission?.completed_at ?? timestamp;
      reqUpdate.audit_log_url = data.submission?.audit_log_url ?? null;

      // Archive signed PDF
      if (data.documents?.[0]?.url && contrat) {
        try {
          const r = await fetch(data.documents[0].url);
          if (r.ok) {
            const blob = await r.blob();
            const signedPath = `signed/${contrat.id}_signed_${Date.now()}.pdf`;
            const { error: upErr } = await supabase.storage.from('contrats')
              .upload(signedPath, blob, { contentType: 'application/pdf', upsert: true });
            if (!upErr) {
              reqUpdate.signed_document_path = signedPath;
              await supabase.from('contrats').update({ signed_document_path: signedPath }).eq('id', contrat.id);
            }
          }
        } catch (e) { console.error('Archive PDF error:', e); }
      }
    } else if (event_type === 'form.declined') {
      reqUpdate.status = 'refused';
    } else if (event_type === 'submission.expired') {
      reqUpdate.status = 'expired';
    } else if (event_type === 'form.viewed' && sigReq.status === 'sent') {
      reqUpdate.status = 'viewed';
    }

    await supabase.from('signature_requests').update(reqUpdate).eq('id', sigReq.id);
  }

  // 4. Notify on completion
  if ((event_type === 'submission.completed' || (event_type === 'form.completed' && data.submission?.status === 'completed')) && contrat?.created_by) {
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: contrat.created_by,
          title: 'Contrat signé ✅',
          body: `Le contrat ${contrat.numero || contrat.titre} a été entièrement signé`,
          data: { type: 'contrat_signed', contratId: contrat.id },
        },
      });
      // Auto-create archival task
      await supabase.from('taches').insert({
        titre: `Archiver le contrat signé ${contrat.numero || contrat.titre}`,
        description: 'Contrat entièrement signé via DocuSeal — vérifier l\'archivage et la facturation associée.',
        statut: 'a_faire',
        priorite: 'normale',
        etablissement_id: contrat.etablissement_id,
        assignee_id: contrat.created_by,
        created_by: contrat.created_by,
        type: 'administrative',
        date_echeance: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      }).catch((e: unknown) => console.error('Auto-task error:', e));
    } catch (e) { console.error('Notify error:', e); }
  } else if (event_type === 'form.declined' && contrat?.created_by) {
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: contrat.created_by,
          title: 'Signature refusée ❌',
          body: `${data.email} a refusé de signer ${contrat.numero || contrat.titre}`,
          data: { type: 'contrat_signature_refused', contratId: contrat.id },
        },
      });
    } catch (_) { /* noop */ }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
