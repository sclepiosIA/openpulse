/**
 * sequence-engine — Worker d'envoi des séquences email avec A/B testing.
 *
 * Cron toutes les 10 min. Pour chaque enrollment "active" dont prochaine_action_at <= now() :
 *  1. Récupère la séquence + l'étape courante
 *  2. Appelle pick_sequence_variant() (RPC) pour choisir une variante (gagnant ou pondéré)
 *  3. Envoie l'email via send-email (compte SMTP du created_by de la séquence)
 *  4. Log dans email_sequence_sends
 *  5. Avance etape_courante + prochaine_action_at, ou termine si dernière étape
 *
 * Conditions d'arrêt par étape :
 *  - condition='no_reply' et le contact a répondu → on arrête (statut='completed')
 *  - condition='always' → toujours envoyer
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse as _buildErrorResponse } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SequenceStep {
  delay_days?: number;
  subject?: string;
  body_html?: string;
  condition?: 'always' | 'no_reply' | 'no_open';
}

interface Enrollment {
  id: string;
  sequence_id: string;
  etablissement_id: string | null;
  contact_email: string;
  contact_name: string | null;
  etape_courante: number;
  metadata: Record<string, unknown>;
}

interface Sequence {
  id: string;
  nom: string;
  etapes: SequenceStep[];
  statut: string;
  created_by: string;
}

async function processEnrollment(
  supabase: ReturnType<typeof createClient>,
  enrollment: Enrollment,
): Promise<{ ok: boolean; reason?: string }> {
  // 1. Charger la séquence
  const { data: seq, error: seqErr } = await supabase
    .from('email_sequences')
    .select('id,nom,etapes,statut,created_by')
    .eq('id', enrollment.sequence_id)
    .maybeSingle();

  if (seqErr || !seq) return { ok: false, reason: 'sequence_not_found' };
  if ((seq as any).statut !== 'active') return { ok: false, reason: 'sequence_paused' };

  const sequence = seq as unknown as Sequence;
  const stepIndex = enrollment.etape_courante;
  const step: SequenceStep | undefined = sequence.etapes?.[stepIndex];

  if (!step) {
    // Plus d'étape → terminer
    await supabase
      .from('email_sequence_enrollments')
      .update({ statut: 'completed', derniere_action_at: new Date().toISOString() })
      .eq('id', enrollment.id);
    return { ok: true, reason: 'completed' };
  }

  // 2. Vérifier les conditions d'arrêt
  if (step.condition === 'no_reply') {
    const { data: replied } = await supabase
      .from('email_sequence_sends')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .not('replied_at', 'is', null)
      .limit(1);
    if (replied && replied.length > 0) {
      await supabase
        .from('email_sequence_enrollments')
        .update({ statut: 'replied', derniere_action_at: new Date().toISOString() })
        .eq('id', enrollment.id);
      return { ok: true, reason: 'replied' };
    }
  }

  // 3. Picker une variante via la RPC (winner > pondéré > step de base)
  let variantId: string | null = null;
  let subject = step.subject ?? '';
  let bodyHtml = step.body_html ?? '';
  let variantLabel = 'A';

  try {
    const { data: picked } = await supabase.rpc('pick_sequence_variant', {
      _sequence_id: sequence.id,
      _step_index: stepIndex,
    });
    if (picked && Array.isArray(picked) && picked.length > 0) {
      const v = picked[0] as any;
      variantId = v.id ?? null;
      if (v.subject) subject = v.subject;
      if (v.body_html) bodyHtml = v.body_html;
      if (v.variant_label) variantLabel = v.variant_label;
    }
  } catch (e) {
    console.warn('[sequence-engine] pick_sequence_variant failed, fallback to step:', e);
  }

  if (!subject || !bodyHtml) {
    return { ok: false, reason: 'empty_template' };
  }

  // 4. Variables de template basiques
  const renderedSubject = subject
    .replace(/\{\{contact_name\}\}/g, enrollment.contact_name ?? '')
    .replace(/\{\{contact_email\}\}/g, enrollment.contact_email);
  const renderedBody = bodyHtml
    .replace(/\{\{contact_name\}\}/g, enrollment.contact_name ?? '')
    .replace(/\{\{contact_email\}\}/g, enrollment.contact_email);

  // 5. Insérer le log AVANT l'envoi (statut pending) pour idempotence
  const { data: sendLog, error: logErr } = await supabase
    .from('email_sequence_sends')
    .insert({
      enrollment_id: enrollment.id,
      sequence_id: sequence.id,
      step_index: stepIndex,
      variant_id: variantId,
      variant_label: variantLabel,
      contact_email: enrollment.contact_email,
      subject_used: renderedSubject,
      status: 'pending',
    })
    .select('id')
    .single();

  if (logErr || !sendLog) {
    console.error('[sequence-engine] log insert failed', logErr);
    return { ok: false, reason: 'log_insert_failed' };
  }

  // 6. Envoyer via send-email (utilise le compte SMTP du créateur de la séquence)
  try {
    const { data: sendResult, error: sendErr } = await supabase.functions.invoke('send-email', {
      body: {
        to: enrollment.contact_email,
        subject: renderedSubject,
        html: renderedBody,
        user_id: sequence.created_by,
        etablissement_id: enrollment.etablissement_id,
        metadata: {
          source: 'sequence-engine',
          sequence_id: sequence.id,
          enrollment_id: enrollment.id,
          step_index: stepIndex,
          variant_id: variantId,
        },
      },
    });

    if (sendErr) throw sendErr;

    await supabase
      .from('email_sequence_sends')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        message_id: (sendResult as any)?.message_id ?? null,
      })
      .eq('id', (sendLog as any).id);
  } catch (e: any) {
    console.error('[sequence-engine] send failed', e);
    await supabase
      .from('email_sequence_sends')
      .update({ status: 'failed', metadata: { error: String(e?.message ?? e) } })
      .eq('id', (sendLog as any).id);
    return { ok: false, reason: 'send_failed' };
  }

  // 7. Avancer ou terminer
  const nextIndex = stepIndex + 1;
  const nextStep: SequenceStep | undefined = sequence.etapes?.[nextIndex];
  if (!nextStep) {
    await supabase
      .from('email_sequence_enrollments')
      .update({
        etape_courante: nextIndex,
        statut: 'completed',
        derniere_action_at: new Date().toISOString(),
        prochaine_action_at: null,
      })
      .eq('id', enrollment.id);
  } else {
    const delayDays = Math.max(0, nextStep.delay_days ?? 0);
    const next = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);
    await supabase
      .from('email_sequence_enrollments')
      .update({
        etape_courante: nextIndex,
        derniere_action_at: new Date().toISOString(),
        prochaine_action_at: next.toISOString(),
      })
      .eq('id', enrollment.id);
  }

  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate: only internal CRON (x-function-secret) or service-role bearer
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const providedSecret = req.headers.get('x-function-secret');
  const authHeader = req.headers.get('authorization') ?? '';
  const isInternal = !!internalSecret && providedSecret === internalSecret;
  const isServiceRole = authHeader === `Bearer ${SERVICE_KEY}`;
  if (!isInternal && !isServiceRole) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let limit = 50;
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (typeof body?.limit === 'number') limit = Math.min(200, Math.max(1, body.limit));
  } catch {
    /* noop */
  }

  const { data: due, error } = await supabase
    .from('email_sequence_enrollments')
    .select('id,sequence_id,etablissement_id,contact_email,contact_name,etape_courante,metadata')
    .eq('statut', 'active')
    .lte('prochaine_action_at', new Date().toISOString())
    .order('prochaine_action_at', { ascending: true })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ enrollment_id: string; ok: boolean; reason?: string }> = [];
  for (const e of (due ?? []) as unknown as Enrollment[]) {
    const r = await processEnrollment(supabase, e);
    results.push({ enrollment_id: e.id, ...r });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: results.length,
      sent: results.filter((r) => r.ok && !r.reason).length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
