/**
 * JARVIS 6.0 - Webhook Receiver
 * 
 * Réceptionne et traite les webhooks externes :
 * - Qonto (paiements)
 * - GitHub (commits)
 * - Slack (messages)
 * - Formulaires web
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { verifyHmacSignature, timingSafeEqual } from "../_shared/hmac.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-webhook-source, x-webhook-secret, x-webhook-signature, x-webhook-timestamp;

interface WebhookPayload {
  source: string;
  event_type: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Identifier la source du webhook
    const webhookSource = req.headers.get('x-webhook-source') || 'unknown';
    const webhookSecret = req.headers.get('x-webhook-secret');
    const webhookSignature = req.headers.get('x-webhook-signature');
    const webhookTimestamp = req.headers.get('x-webhook-timestamp');

    // Lire raw body pour HMAC + parse JSON ensuite
    const rawBody = await req.text();

    // Vérifier le secret si configuré (HMAC prioritaire, fallback secret plain)
    const { data: config } = await supabase
      .from('jarvis_webhook_configs')
      .select('*')
      .eq('source', webhookSource)
      .eq('is_active', true)
      .single();

    // 🔒 SECURITY: fail-closed. Any active webhook config MUST have a non-empty
    // secret_hash. If the config is missing or the secret is null/empty we
    // reject the request with 401 instead of skipping the auth check.
    if (!config || !config.secret_hash || String(config.secret_hash).trim() === '') {
      console.warn('[jarvis-webhook-receiver] Rejected: missing config/secret for source:', webhookSource);
      return new Response(JSON.stringify({ error: 'Webhook source not configured or missing secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let authorized = false;
    if (webhookSignature) {
      // HMAC mode (recommandé)
      authorized = await verifyHmacSignature(
        rawBody,
        webhookSignature,
        config.secret_hash as string,
        webhookTimestamp ? { maxAgeSeconds: 300, timestamp: webhookTimestamp } : {}
      );
    } else if (webhookSecret) {
      // Legacy: secret en clair (timing-safe)
      authorized = timingSafeEqual(webhookSecret, config.secret_hash as string);
    }
    if (!authorized) {
      console.warn('[jarvis-webhook-receiver] Auth failed for source:', webhookSource);
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody) as WebhookPayload;
    const targetUserId = config?.user_id;

    if (!targetUserId) {
      console.log('[jarvis-webhook-receiver] No user configured for source:', webhookSource);
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Traiter selon la source
    let result: { agent: string; action: string; data: unknown } | null = null;

    switch (webhookSource) {
      case 'qonto':
        result = await processQontoWebhook(payload, supabase, targetUserId);
        break;
      case 'github':
        result = await processGitHubWebhook(payload, supabase, targetUserId);
        break;
      case 'slack':
        result = await processSlackWebhook(payload, supabase, targetUserId);
        break;
      case 'form':
        result = await processFormWebhook(payload, supabase, targetUserId);
        break;
      default:
        result = await processGenericWebhook(payload, supabase, targetUserId);
    }

    // Logger l'événement
    await supabase.from('jarvis_webhook_configs').update({
      last_triggered_at: new Date().toISOString(),
    }).eq('id', config?.id);

    return new Response(JSON.stringify({ 
      received: true, 
      processed: true,
      result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[jarvis-webhook-receiver] Error:', error);
    return buildErrorResponse('jarvis-webhook-receiver', error, corsHeaders, 500);
  }
});

async function processQontoWebhook(
  payload: WebhookPayload, 
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { event_type, data } = payload;

  // Créer une alerte proactive pour Olivia
  if (event_type === 'transaction.created' || event_type === 'payment.received') {
    const amount = (data.amount as number) / 100; // Centimes vers euros
    const label = data.label as string || 'Paiement';

    await supabase.from('jarvis_proactive_alerts').insert({
      user_id: userId,
      type: 'payment_received',
      priority: amount > 5000 ? 'high' : 'medium',
      title: `💰 Nouveau paiement : ${amount.toLocaleString('fr-FR')}€`,
      message: `${label}. Olivia va vérifier la réconciliation.`,
      action_type: 'reconcile_payment',
      action_data: { transaction_id: data.id, amount, label },
      read: false,
      dismissed: false,
    });

    return { agent: 'olivia', action: 'reconcile', data: { amount, label } };
  }

  return null;
}

async function processGitHubWebhook(
  payload: WebhookPayload,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { event_type, data } = payload;

  if (event_type === 'push') {
    const commits = data.commits as Array<{ message: string; author: { name: string } }>;
    const branch = (data.ref as string)?.replace('refs/heads/', '');

    if (branch === 'main' || branch === 'master') {
      await supabase.from('jarvis_proactive_alerts').insert({
        user_id: userId,
        type: 'code_deployed',
        priority: 'high',
        title: `🚀 Déploiement en production`,
        message: `${commits.length} commit(s) pushé(s) sur ${branch}. Noah analyse l'impact.`,
        action_type: 'analyze_deployment',
        action_data: { commits: commits.slice(0, 5), branch },
        read: false,
        dismissed: false,
      });

      return { agent: 'noah', action: 'analyze_deployment', data: { branch, commit_count: commits.length } };
    }
  }

  return null;
}

async function processSlackWebhook(
  payload: WebhookPayload,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data } = payload;
  const text = data.text as string || '';
  const channel = data.channel as string || '';
  const user = data.user as string || '';

  // Détecter l'agent approprié selon le contenu
  let targetAgent = 'prime';
  let priority: 'low' | 'medium' | 'high' = 'low';

  if (text.toLowerCase().includes('urgent') || text.includes('🔥')) {
    priority = 'high';
  }

  if (text.toLowerCase().includes('client') || text.toLowerCase().includes('prospect')) {
    targetAgent = 'sophia';
  } else if (text.toLowerCase().includes('bug') || text.toLowerCase().includes('erreur')) {
    targetAgent = 'emma';
    priority = 'high';
  } else if (text.toLowerCase().includes('facture') || text.toLowerCase().includes('paiement')) {
    targetAgent = 'olivia';
  }

  await supabase.from('jarvis_proactive_alerts').insert({
    user_id: userId,
    type: 'slack_message',
    priority,
    title: `💬 Message Slack de ${user}`,
    message: text.substring(0, 200),
    action_type: 'respond_slack',
    action_data: { channel, user, text, target_agent: targetAgent },
    read: false,
    dismissed: false,
  });

  return { agent: targetAgent, action: 'process_slack', data: { channel, text: text.substring(0, 100) } };
}

async function processFormWebhook(
  payload: WebhookPayload,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data } = payload;
  const email = data.email as string;
  const name = data.name as string || 'Inconnu';
  const company = data.company as string;
  const message = data.message as string || '';

  // Sophia crée le prospect
  await supabase.from('jarvis_proactive_alerts').insert({
    user_id: userId,
    type: 'new_lead',
    priority: 'high',
    title: `🎯 Nouveau lead : ${name}`,
    message: `${company || 'Société inconnue'} - ${email}. Sophia prépare le dossier prospect.`,
    action_type: 'create_prospect',
    action_data: { email, name, company, message },
    read: false,
    dismissed: false,
  });

  return { agent: 'sophia', action: 'create_prospect', data: { email, name, company } };
}

async function processGenericWebhook(
  payload: WebhookPayload,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  // Webhook générique - créer une notification
  await supabase.from('jarvis_proactive_alerts').insert({
    user_id: userId,
    type: 'webhook_received',
    priority: 'low',
    title: `🔔 Webhook reçu : ${payload.source}`,
    message: `Événement: ${payload.event_type}`,
    action_type: 'review_webhook',
    action_data: payload.data,
    read: false,
    dismissed: false,
  });

  return { agent: 'prime', action: 'log_webhook', data: payload };
}
