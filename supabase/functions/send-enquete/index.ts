import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend@2.0.0";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const TYPES = ['post_formation', 'ces', 'satisfaction', 'suivi_csm'] as const;
type EnqueteType = typeof TYPES[number];

const SUBJECTS: Record<EnqueteType, string> = {
  post_formation: "Votre avis sur la formation OpenPulse",
  ces: "Comment se passe votre prise en main de OpenPulse ?",
  satisfaction: "Votre satisfaction OpenPulse – 5 minutes pour nous aider",
  suivi_csm: "Évaluation du suivi par votre Customer Success Manager",
};

const PATHS: Record<EnqueteType, string> = {
  post_formation: 'post-formation',
  ces: 'ces',
  satisfaction: 'satisfaction',
  suivi_csm: 'suivi-csm',
};

function buildHtml(opts: { type: EnqueteType; url: string; etablissement?: string; csm?: string }) {
  const intro: Record<EnqueteType, string> = {
    post_formation: "Vous venez de suivre une formation OpenPulse. Votre retour nous permet d'améliorer la qualité de nos formations.",
    ces: "Cela fait quelques semaines que vous utilisez OpenPulse. En 2 minutes, indiquez-nous l'effort que vous avez fourni pour le prendre en main.",
    satisfaction: "Quelques mois d'utilisation nous donnent un recul précieux. Votre satisfaction et vos suggestions alimentent notre roadmap produit.",
    suivi_csm: "Votre avis sur l'accompagnement par votre Customer Success Manager nous aide à améliorer notre suivi.",
  };
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f6f8fa;padding:24px">
    <div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e2e8f0">
      <h1 style="margin:0 0 16px;color:#0f172a;font-size:22px">${SUBJECTS[opts.type]}</h1>
      ${opts.etablissement ? `<p style="color:#64748b;margin:0 0 16px">Établissement : <strong>${opts.etablissement}</strong></p>` : ''}
      ${opts.csm ? `<p style="color:#64748b;margin:0 0 16px">CSM : <strong>${opts.csm}</strong></p>` : ''}
      <p style="line-height:1.6;color:#334155">${intro[opts.type]}</p>
      <p style="margin:24px 0;text-align:center">
        <a href="${opts.url}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600">Répondre à l'enquête</a>
      </p>
      <p style="color:#94a3b8;font-size:12px">Ce lien est personnel et expire dans 30 jours.<br>Si le bouton ne fonctionne pas, copiez ce lien : ${opts.url}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#94a3b8;font-size:12px;margin:0">OpenPulse — Équipe Customer Success</p>
    </div></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Bypass auth pour appels système (schedule-enquetes) via service_role key
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isSystemCall = authHeader === `Bearer ${serviceKey}`;
    let userId: string | null = null;

    if (!isSystemCall) {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (!claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = claims.claims.sub as string;
      const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      const roles = (rolesData || []).map(r => r.role);
      const isStaff = roles.some(r => ['admin', 'direction', 'csm'].includes(r));
      if (!isStaff) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const body = await req.json();
    const type = body.type as EnqueteType;
    if (!TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: 'type invalide' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const etablissementId = body.etablissement_id as string;
    const targetUserId = body.user_id as string | undefined;
    const sessionId = body.session_id as string | undefined;
    const csmId = body.csm_id as string | undefined;
    const emailOverride = body.email as string | undefined;
    const canal = (body.canal as string) || 'email';

    // Récupération email destinataire
    let destinataireEmail = emailOverride;
    let etablissementNom: string | undefined;
    let csmNom: string | undefined;

    if (etablissementId) {
      const { data: etab } = await supabase.from('etablissements').select('nom').eq('id', etablissementId).maybeSingle();
      etablissementNom = etab?.nom;
    }
    if (csmId) {
      const { data: csm } = await supabase.from('profiles').select('full_name').eq('id', csmId).maybeSingle();
      csmNom = csm?.full_name;
    }
    if (!destinataireEmail && targetUserId) {
      const { data: u } = await supabase.from('etablissement_users').select('email').eq('id', targetUserId).maybeSingle();
      destinataireEmail = u?.email || undefined;
    }

    // Création campagne
    const { data: campagne, error: campErr } = await supabase
      .from('enquetes_campagnes')
      .insert({
        type,
        etablissement_id: etablissementId,
        user_id: targetUserId,
        session_id: sessionId,
        csm_id: csmId,
        canal,
        status: canal === 'email' ? 'scheduled' : 'sent',
        scheduled_at: new Date().toISOString(),
        sent_at: canal === 'email' ? null : new Date().toISOString(),
        relance_at: canal === 'email' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
        email_destinataire: destinataireEmail,
        created_by: userId,
      })
      .select('*')
      .single();

    if (campErr || !campagne) {
      return new Response(JSON.stringify({ error: sanitizeErrorForClient(campErr) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseUrl = body.base_url || Deno.env.get('PUBLIC_APP_URL');
    const url = `${baseUrl}/enquete/${PATHS[type]}/${campagne.token_unique}`;

    // Envoi email si canal=email et email destinataire dispo
    if (canal === 'email' && destinataireEmail) {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      try {
        const { getEmailSenderConfig } = await import("../_shared/email-sender-config.ts");
        const senderConfig = await getEmailSenderConfig();
        await resend.emails.send({
          from: senderConfig.formations_from || 'OpenPulse <no-reply@exploitant.example.org>',
          to: [destinataireEmail],
          subject: SUBJECTS[type],
          html: buildHtml({ type, url, etablissement: etablissementNom, csm: csmNom }),
        });
        await supabase.from('enquetes_campagnes')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', campagne.id);
      } catch (e) {
        console.error('Erreur envoi email:', e);
        // On garde la campagne en scheduled, l'utilisateur peut la renvoyer
      }
    }

    return new Response(JSON.stringify({
      success: true,
      campagne_id: campagne.id,
      token: campagne.token_unique,
      url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-enquete error:', err);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
