// signature-send: orchestrates DocuSeal signature creation, hashes document,
// creates signature_requests + initial events.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const DOCUSEAL_API_URL = (Deno.env.get('SIGNATURE_URL_BASE') ?? '');

interface Signer { name: string; email: string; role?: string }
interface Body {
  contratId: string;
  signers: Signer[];
  message?: string;
  expireDays?: number;
  documentPath?: string;
}




async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const DOCUSEAL_API_KEY = Deno.env.get('DOCUSEAL_API_KEY');
    if (!DOCUSEAL_API_KEY) throw new Error('DOCUSEAL_API_KEY non configurée');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization manquant');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Non authentifié');

    const body = await req.json() as Body;
    if (!body.contratId || !Array.isArray(body.signers) || body.signers.length === 0) {
      return new Response(JSON.stringify({ error: 'contratId et signers requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const s of body.signers) {
      if (!s.name?.trim() || !emailRe.test(s.email ?? '')) {
        return new Response(JSON.stringify({ error: 'Signataire invalide' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Load contract
    const { data: contrat, error: cErr } = await supabase
      .from('contrats').select('*').eq('id', body.contratId).single();
    if (cErr || !contrat) throw new Error('Contrat introuvable');

    const pdfPath = body.documentPath || (contrat as any).document_path || (contrat as any).signed_document_path;
    if (!pdfPath) throw new Error('Aucun document PDF associé au contrat');

    const { data: pdfData, error: dlErr } = await supabase.storage.from('contrats').download(pdfPath);
    if (dlErr || !pdfData) throw new Error('Téléchargement PDF échoué');

    const arrayBuffer = await pdfData.arrayBuffer();
    const docHash = await sha256Hex(arrayBuffer);
    const base64Pdf = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));

    // Resolve config defaults
    const { data: cfgRow } = await supabase
      .from('app_config').select('value').eq('key', 'signature_config').maybeSingle();
    const cfg = (cfgRow?.value ?? {}) as { default_expiry_days?: number; max_reminders?: number };
    const expireDays = body.expireDays ?? cfg.default_expiry_days ?? 30;

    const expireAt = new Date(); expireAt.setDate(expireAt.getDate() + expireDays);
    const expireFmt = expireAt.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    // Call DocuSeal
    const submitters = body.signers.map((s, i) => ({
      role: s.role || `Signataire ${i + 1}`,
      email: s.email,
      name: s.name,
    }));
    const docResp = await fetch(`${DOCUSEAL_API_URL}/submissions/pdf`, {
      method: 'POST',
      headers: { 'X-Auth-Token': DOCUSEAL_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Contrat ${contrat.numero || body.contratId}`,
        documents: [{ name: `contrat_${contrat.numero || body.contratId}.pdf`, file: base64Pdf }],
        submitters,
        send_email: true,
        expire_at: expireFmt,
        message: {
          subject: `Signature requise: Contrat ${contrat.numero || ''}`,
          body: body.message || `Vous êtes invité(e) à signer le contrat "${contrat.titre || contrat.numero}".`,
        },
      }),
    });
    if (!docResp.ok) {
      const txt = await docResp.text();
      throw new Error(`DocuSeal ${docResp.status}: ${txt.slice(0, 200)}`);
    }
    const submissionData = await docResp.json();
    const submissionId = submissionData?.[0]?.submission_id ?? submissionData?.id;
    const providerUrl = submissionData?.[0]?.embed_src ?? null;

    // Persist signature_request
    const signersWithStatus = body.signers.map((s, i) => ({
      ...s,
      status: 'sent',
      signed_at: null,
      external_id: submissionData?.[i]?.slug ?? null,
    }));

    const { data: reqRow, error: reqErr } = await supabase
      .from('signature_requests')
      .insert({
        contrat_id: body.contratId,
        provider: 'docuseal',
        provider_request_id: String(submissionId),
        provider_url: providerUrl,
        status: 'sent',
        signers: signersWithStatus,
        message: body.message ?? null,
        expire_at: expireAt.toISOString(),
        document_hash: docHash,
        document_path: pdfPath,
        metadata: { submitters: submissionData },
        created_by: user.id,
      })
      .select()
      .single();
    if (reqErr) throw reqErr;

    // Update contract
    await supabase.from('contrats').update({
      signature_provider: 'docuseal',
      signature_request_id: String(submissionId),
      signature_status: 'sent',
      signature_sent_at: new Date().toISOString(),
      statut: contrat.statut === 'brouillon' ? 'en_attente_signature' : contrat.statut,
    }).eq('id', body.contratId);

    // Initial events
    await supabase.from('signature_events').insert([
      { request_id: reqRow.id, event_type: 'created', payload: { user_id: user.id } },
      { request_id: reqRow.id, event_type: 'sent', payload: { signers: body.signers.map(s => s.email) } },
    ]);

    return new Response(JSON.stringify({
      success: true,
      request_id: reqRow.id,
      submission_id: submissionId,
      provider_url: providerUrl,
      expires_at: expireAt.toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    return buildErrorResponse('signature-send', error, corsHeaders, 400);
  }
});

