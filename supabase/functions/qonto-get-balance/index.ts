import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

interface QontoAccount {
  slug: string;
  name: string;
  balance: number;
  currency: string;
  iban: string;
  bic: string;
}

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer la connexion active
    const { data: connection, error: connError } = await supabaseClient
      .from('tresorerie_qonto_connections')
      .select('*')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('Aucune connexion Qonto active');
    }

    // Récupérer les comptes bancaires avec soldes depuis Qonto
    const accountsResponse = await fetch(
      'https://thirdparty.qonto.com/v2/bank_accounts',
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token_encrypted}`,
        },
      }
    );

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      throw new Error(`API Qonto error: ${accountsResponse.status} - ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts = (accountsData.bank_accounts || []) as QontoAccount[];

    // Calculer le solde total
    const totalBalance = accounts.reduce(
      (sum: number, acc: QontoAccount) => sum + (acc.balance || 0),
      0
    );

    // Récupérer le solde prévu depuis notre base
    const today = new Date().toISOString().split('T')[0];
    const { data: soldePrevuData } = await supabaseClient
      .from('tresorerie_solde')
      .select('solde_fin')
      .eq('date', today)
      .single();

    const soldePrevu = soldePrevuData?.solde_fin || 0;
    const ecart = totalBalance - soldePrevu;

    // Déterminer le statut
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (totalBalance < connection.alert_threshold_critical) {
      status = 'critical';
    } else if (totalBalance < connection.alert_threshold_low) {
      status = 'warning';
    }

    // Mettre à jour les comptes dans la connexion
    await supabaseClient
      .from('tresorerie_qonto_connections')
      .update({
        bank_accounts: accounts,
      })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        accounts: accounts.map((acc: QontoAccount) => ({
          id: acc.slug,
          name: acc.name,
          balance: acc.balance,
          currency: acc.currency,
          iban: acc.iban,
          bic: acc.bic,
        })),
        total_balance: totalBalance,
        solde_prevu: soldePrevu,
        ecart_prevu: ecart,
        status,
        last_updated: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('qonto-get-balance', error, corsHeaders, 500);
  }
});
