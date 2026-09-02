/**
 * JARVIS 6.0 - Multi-Channel Actions
 * 
 * Permet à Jarvis d'agir sur plusieurs canaux :
 * - Email (existant)
 * - SMS (Twilio)
 * - Slack (Webhook)
 * - Teams (Graph API)
 * - WhatsApp Business (Meta API)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateUserAuth } from "../_shared/auth-helpers.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface ChannelMessage {
  channel: 'email' | 'sms' | 'slack' | 'teams' | 'whatsapp';
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller; never trust user_id from body
    const authResult = await validateUserAuth(req);
    if ('error' in authResult) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user_id = authResult.userId;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, agent_id, channel_message } = await req.json();

    // Résoudre le profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user_id)
      .single();

    const profile_id = profile?.id || user_id;

    switch (action) {
      case 'send': {
        const msg = channel_message as ChannelMessage;
        let result: { success: boolean; message_id?: string; error?: string };

        switch (msg.channel) {
          case 'sms':
            result = await sendSMS(msg.recipient, msg.message);
            break;
          case 'slack':
            result = await sendSlack(msg.recipient, msg.message, msg.metadata);
            break;
          case 'teams':
            result = await sendTeams(msg.recipient, msg.message, msg.subject);
            break;
          case 'whatsapp':
            result = await sendWhatsApp(msg.recipient, msg.message);
            break;
          default:
            result = { success: false, error: `Channel ${msg.channel} not implemented` };
        }

        // Logger l'action
        await supabase.from('jarvis_multi_channel_actions').insert({
          user_id: profile_id,
          agent_id: agent_id || 'prime',
          channel: msg.channel,
          recipient: msg.recipient,
          message_preview: msg.message.substring(0, 200),
          status: result.success ? 'sent' : 'failed',
          error_message: result.error,
          external_id: result.message_id,
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_channels': {
        // Retourner les canaux disponibles et configurés
        const channels = [
          { id: 'email', name: 'Email', enabled: true, configured: true },
          { id: 'sms', name: 'SMS', enabled: !!Deno.env.get('TWILIO_ACCOUNT_SID'), configured: !!Deno.env.get('TWILIO_ACCOUNT_SID') },
          { id: 'slack', name: 'Slack', enabled: !!Deno.env.get('SLACK_WEBHOOK_URL'), configured: !!Deno.env.get('SLACK_WEBHOOK_URL') },
          { id: 'teams', name: 'Microsoft Teams', enabled: !!Deno.env.get('TEAMS_WEBHOOK_URL'), configured: !!Deno.env.get('TEAMS_WEBHOOK_URL') },
          { id: 'whatsapp', name: 'WhatsApp', enabled: !!Deno.env.get('WHATSAPP_TOKEN'), configured: !!Deno.env.get('WHATSAPP_TOKEN') },
        ];

        return new Response(JSON.stringify({ channels }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_history': {
        const { data: history, error } = await supabase
          .from('jarvis_multi_channel_actions')
          .select('*')
          .eq('user_id', profile_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        return new Response(JSON.stringify({ history }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[jarvis-multi-channel] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: sanitizeErrorForClient(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendSMS(to: string, message: string): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: message,
        }),
      }
    );

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, message_id: data.sid };
    } else {
      return { success: false, error: data.message || 'SMS failed' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'SMS error' };
  }
}

async function sendSlack(
  channel: string, 
  message: string, 
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

  if (!webhookUrl) {
    return { success: false, error: 'Slack webhook not configured' };
  }

  try {
    const payload: Record<string, unknown> = {
      text: message,
    };

    if (channel && !channel.startsWith('#')) {
      payload.channel = `#${channel}`;
    } else if (channel) {
      payload.channel = channel;
    }

    // Ajouter des blocs riches si metadata fournie
    if (metadata?.title) {
      payload.blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: metadata.title as string },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: message },
        },
      ];
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, message_id: `slack_${Date.now()}` };
    } else {
      const text = await response.text();
      return { success: false, error: text || 'Slack failed' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Slack error' };
  }
}

async function sendTeams(
  channel: string,
  message: string,
  title?: string
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');

  if (!webhookUrl) {
    return { success: false, error: 'Teams webhook not configured' };
  }

  try {
    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '6366f1',
      summary: title || 'Message de Jarvis',
      sections: [
        {
          activityTitle: title || 'Jarvis AI',
          activitySubtitle: new Date().toLocaleString('fr-FR'),
          activityImage: 'https://gestion-marque-ia.apercu.example.org/jarvis-icon.png',
          text: message,
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, message_id: `teams_${Date.now()}` };
    } else {
      const text = await response.text();
      return { success: false, error: text || 'Teams failed' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Teams error' };
  }
}

async function sendWhatsApp(
  to: string,
  message: string
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!token || !phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    // Formater le numéro (enlever le + et les espaces)
    const formattedTo = to.replace(/[\s+-]/g, '');

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedTo,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, message_id: data.messages[0].id };
    } else {
      return { success: false, error: data.error?.message || 'WhatsApp failed' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'WhatsApp error' };
  }
}
