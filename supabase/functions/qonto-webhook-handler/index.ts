import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-qonto-signature;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.text();
    const signature = req.headers.get('x-qonto-signature');

    // Vérifier la signature du webhook (sécurité) — fail-closed
    const webhookSecret = Deno.env.get('QONTO_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[qonto-webhook-handler] QONTO_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const expectedSignature = await generateSignature(body, webhookSecret);
    if (signature !== expectedSignature) {
      console.error('Signature webhook invalide');
      return new Response(
        JSON.stringify({ error: 'Signature invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(body);
    console.log('Webhook Qonto reçu:', event.event_type, event.resource_id);

    // Traiter l'événement selon son type
    switch (event.event_type) {
      case 'transaction.created':
      case 'transaction.updated':
        // Déclencher une sync immédiate pour cette transaction
        await syncSingleTransaction(supabaseClient, event);
        break;

      case 'transaction.declined':
        // Créer une notification
        await createNotification(
          supabaseClient,
          'Transaction déclinée',
          `Une transaction a été déclinée: ${event.data?.label || 'Transaction Qonto'}`
        );
        break;

      case 'membership.updated':
        // Mettre à jour les permissions (si nécessaire)
        console.log('Membership mis à jour');
        break;

      default:
        console.log(`Type d'événement non géré: ${event.event_type}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook traité',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur qonto-webhook-handler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: sanitizeErrorForClient(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generateSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function syncSingleTransaction(supabase: any, event: any) {
  try {
    const transactionId = event.resource_id;
    
    // Récupérer la connexion pour obtenir le token
    const { data: connection } = await supabase
      .from('tresorerie_qonto_connections')
      .select('*')
      .eq('organization_id', event.organization_id)
      .eq('is_active', true)
      .single();

    if (!connection) {
      console.error('Connexion Qonto non trouvée');
      return;
    }

    // Récupérer la transaction depuis l'API Qonto
    const txResponse = await fetch(
      `https://thirdparty.qonto.com/v2/transactions/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token_encrypted}`,
        },
      }
    );

    if (!txResponse.ok) {
      console.error('Erreur récupération transaction');
      return;
    }

    const txData = await txResponse.json();
    const tx = txData.transaction;

    // Upsert la transaction
    await supabase
      .from('tresorerie_operations_bancaires')
      .upsert({
        qonto_transaction_id: tx.transaction_id,
        qonto_account_id: tx.bank_account_id,
        date_operation: tx.emitted_at,
        date_valeur: tx.settled_at || tx.emitted_at,
        libelle: tx.label || 'Transaction Qonto',
        montant: Math.abs(tx.amount),
        type_operation: tx.side === 'credit' ? 'credit' : 'debit',
        statut: tx.status === 'completed' ? 'rapproche' : 'non_rapproche',
        raw_qonto_data: tx,
      }, {
        onConflict: 'qonto_transaction_id',
      });

    console.log(`✅ Transaction ${transactionId} synchronisée`);
  } catch (error) {
    console.error('Erreur sync transaction:', error);
  }
}

async function createNotification(supabase: any, title: string, message: string) {
  try {
    const { data: profiles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();

        if (userProfile) {
          await supabase
            .from('notifications')
            .insert({
              profile_id: userProfile.id,
              type: 'qonto',
              title,
              message,
              priority: 'normale',
            });
        }
      }
    }
  } catch (error) {
    console.error('Erreur création notification:', error);
  }
}
