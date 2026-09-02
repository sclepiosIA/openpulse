import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend@2.0.0";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const PATHS = {
  post_formation: 'post-formation',
  ces: 'ces',
  satisfaction: 'satisfaction',
  suivi_csm: 'suivi-csm',
} as const;

const SUBJECTS = {
  post_formation: "Rappel — votre avis sur la formation OpenPulse",
  ces: "Rappel — votre prise en main de OpenPulse",
  satisfaction: "Rappel — votre satisfaction OpenPulse",
  suivi_csm: "Rappel — évaluation du suivi CSM",
} as const;

/**
 * CRON quotidien : relance les campagnes email envoyées depuis +7 jours
 * non répondues, et expire celles dépassées.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const baseUrl = Deno.env.get('PUBLIC_APP_URL');
  const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

  let relanceSent = 0;
  let expired = 0;

  try {
    // 1) Marquer expirées
    const { count: expCount } = await supabase
      .from('enquetes_campagnes')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .in('status', ['scheduled', 'sent', 'relance_sent'])
      .select('id', { count: 'exact', head: true });
    expired = expCount || 0;

    // 2) Relances : status=sent, relance_at<=now, pas encore relancé, email présent
    const { data: toRelancer } = await supabase
      .from('enquetes_campagnes')
      .select('id, type, token_unique, email_destinataire, etablissement_id, csm_id')
      .eq('status', 'sent')
      .is('relance_sent_at', null)
      .lte('relance_at', new Date().toISOString())
      .not('email_destinataire', 'is', null)
      .limit(50);

    for (const c of (toRelancer || [])) {
      const type = c.type as keyof typeof PATHS;
      const url = `${baseUrl}/enquete/${PATHS[type]}/${c.token_unique}`;
      try {
        const { getEmailSenderConfig } = await import("../_shared/email-sender-config.ts");
        const senderConfig = await getEmailSenderConfig();
        await resend.emails.send({
          from: senderConfig.formations_from || 'OpenPulse <no-reply@exploitant.example.org>',
          to: [c.email_destinataire!],
          subject: SUBJECTS[type],
          html: `<p>Bonjour,</p><p>Nous n'avons pas encore reçu votre réponse à notre enquête. Cela ne prend que quelques minutes : <a href="${url}">${url}</a></p><p>Merci d'avance,<br>L'équipe OpenPulse</p>`,
        });
        await supabase.from('enquetes_campagnes')
          .update({ status: 'relance_sent', relance_sent_at: new Date().toISOString() })
          .eq('id', c.id);
        relanceSent++;
      } catch (e) {
        console.error('Échec relance campagne', c.id, e);
      }
    }

    return new Response(JSON.stringify({ success: true, relance_sent: relanceSent, expired }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('relance-enquetes error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
