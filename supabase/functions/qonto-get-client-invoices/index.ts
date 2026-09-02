import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface QontoInvoice {
  id: string;
  number: string;
  status: string;
  total_amount: {
    value: string;
    currency: string;
  };
  total_amount_cents: number;
  issue_date: string;
  due_date: string | null;
  client: {
    name: string;
    email?: string;
  } | null;
  file_url?: string;
}

interface QontoClientInvoicesResponse {
  client_invoices: QontoInvoice[];
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('QONTO_API_KEY');
    const orgId = Deno.env.get('QONTO_ORGANIZATION_ID');

    if (!apiKey || !orgId) {
      console.error('[qonto-get-client-invoices] Missing QONTO_API_KEY or QONTO_ORGANIZATION_ID');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuration Qonto manquante',
          invoices: [],
          total_a_encaisser: 0,
          count: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[qonto-get-client-invoices] Fetching unpaid invoices from Qonto...');

    // Fetch unpaid invoices from Qonto API
    // statuses: pending, paid, canceled - we want pending (unpaid)
    const qontoUrl = 'https://thirdparty.qonto.com/v2/client_invoices?filter[status]=unpaid&per_page=100';
    
    const response = await fetch(qontoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `${orgId}:${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[qonto-get-client-invoices] Qonto API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erreur Qonto: ${response.status}`,
          invoices: [],
          total_a_encaisser: 0,
          count: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: QontoClientInvoicesResponse = await response.json();
    const invoices = data.client_invoices || [];

    console.log(`[qonto-get-client-invoices] Found ${invoices.length} unpaid invoices`);

    // Calculate total amount to collect
    const totalAEncaisser = invoices.reduce((sum, inv) => {
      const amount = parseFloat(inv.total_amount?.value || '0');
      return sum + amount;
    }, 0);

    console.log(`[qonto-get-client-invoices] Total à encaisser: ${totalAEncaisser}€`);

    // Transform invoices for frontend consumption
    const transformedInvoices = invoices.map((inv) => ({
      id: inv.id,
      numero: inv.number,
      status: inv.status,
      montant_ttc: parseFloat(inv.total_amount?.value || '0'),
      currency: inv.total_amount?.currency || 'EUR',
      date_emission: inv.issue_date,
      date_echeance: inv.due_date,
      client_name: inv.client?.name || 'Client inconnu',
      client_email: inv.client?.email || null,
      file_url: inv.file_url || null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        invoices: transformedInvoices,
        total_a_encaisser: totalAEncaisser,
        count: invoices.length,
        meta: data.meta,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    return buildErrorResponse('qonto-get-client-invoices', error, corsHeaders, 500);
  }
});
