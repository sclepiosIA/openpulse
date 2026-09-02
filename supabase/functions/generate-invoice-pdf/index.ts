import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 🔒 Validate JWT — reject anon/unauthenticated callers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { factureId } = await req.json();

    if (!factureId) {
      return new Response(JSON.stringify({ error: 'factureId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🔒 Verify access via user-context client (RLS enforces ownership/role)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: accessCheck, error: accessError } = await userClient
      .from('factures')
      .select('id')
      .eq('id', factureId)
      .maybeSingle();

    if (accessError || !accessCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load company info from app_config
    const { data: configData, error: configError } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "company_info")
      .single();

    if (configError || !configData) {
      console.error("Failed to load company_info from app_config:", configError);
      return new Response(JSON.stringify({ error: 'Company configuration not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const companyInfo = configData.value as {
      name: string;
      address: string;
      city: string;
      siret: string;
      tva_intracom: string;
      email: string;
      phone: string;
      iban: string;
      bic: string;
      logo_url?: string | null;
    };

    // Fetch facture with all details
    const { data: facture, error: fetchError } = await supabase
      .from("factures")
      .select(`
        *,
        etablissement:etablissements(id, nom, ville, adresse, code_postal, siret),
        contact:contacts(id, nom, prenom, email, telephone),
        commercial:profiles!factures_commercial_id_fkey(id, first_name, last_name),
        lignes:factures_lignes(
          *,
          produit:catalogue_produits(*)
        ),
        paiements:paiements_factures(*)
      `)
      .eq("id", factureId)
      .single();

    if (fetchError || !facture) {
      console.error('Facture fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Facture not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate PDF HTML content
    const pdfHtml = generateInvoiceHtml(facture, companyInfo);

    return new Response(JSON.stringify({
      success: true,
      pdfHtml,
      facture: {
        numero: facture.numero,
        client_nom: facture.client_nom,
        montant_ttc: facture.montant_ttc
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error("Error generating invoice PDF:", error);
    // 🔒 Sanitize errors — do not leak internal details (schema, DB columns)
    return buildErrorResponse('generate-invoice-pdf', error, corsHeaders, 500);
  }
});

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  siret: string;
  tva_intracom: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
  logo_url?: string | null;
}

function generateInvoiceHtml(facture: any, company: CompanyInfo): string {
  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  
  const formatDate = (date: string) => 
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const lignes = facture.lignes || [];
  
  // Group lines by TVA rate for summary
  const tvaGroups: Record<number, { base: number; tva: number }> = {};
  lignes.forEach((l: any) => {
    const rate = l.taux_tva || 20;
    if (!tvaGroups[rate]) {
      tvaGroups[rate] = { base: 0, tva: 0 };
    }
    tvaGroups[rate].base += l.montant_ht || 0;
    tvaGroups[rate].tva += l.montant_tva || 0;
  });

  const lignesHtml = lignes.map((l: any, idx: number) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${l.designation}</strong>
        ${l.description ? `<br><small style="color: #6b7280;">${l.description}</small>` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${l.quantite} ${l.unite || ''}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(l.prix_unitaire_ht)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${l.taux_tva || 20}%</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(l.montant_ht)}</td>
    </tr>
  `).join('');

  const tvaDetailsHtml = Object.entries(tvaGroups).map(([rate, values]) => `
    <tr>
      <td style="padding: 8px;">TVA ${rate}%</td>
      <td style="padding: 8px; text-align: right;">${formatMoney(values.base)}</td>
      <td style="padding: 8px; text-align: right;">${formatMoney(values.tva)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${facture.numero}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      font-size: 12px; 
      color: #1f2937; 
      line-height: 1.5;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4f46e5; }
    .invoice-title { font-size: 28px; color: #4f46e5; text-align: right; }
    .invoice-number { font-size: 14px; color: #6b7280; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-block h3 { color: #4f46e5; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .dates-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
    .dates-info table { width: 100%; }
    .dates-info td { padding: 5px 10px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { 
      background: #4f46e5; 
      color: white; 
      padding: 12px; 
      text-align: left; 
      font-weight: 600;
    }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 350px; }
    .totals-table td { padding: 8px 12px; }
    .totals-table .total-row { 
      background: #4f46e5; 
      color: white; 
      font-weight: bold; 
      font-size: 16px; 
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 2px solid #e5e7eb; 
      font-size: 10px; 
      color: #6b7280; 
    }
    .payment-info { 
      background: #fef3c7; 
      padding: 15px; 
      border-radius: 8px; 
      margin-bottom: 20px; 
    }
    .legal-mentions { margin-top: 20px; font-size: 9px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">${company.name}</div>
      <p>${company.address}<br>${company.city}</p>
      <p>SIRET: ${company.siret}<br>TVA: ${company.tva_intracom}</p>
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-number">N° ${facture.numero}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <h3>Émetteur</h3>
      <p>
        <strong>${company.name}</strong><br>
        ${company.address}<br>
        ${company.city}<br>
        Tél: ${company.phone}<br>
        Email: ${company.email}
      </p>
    </div>
    <div class="address-block">
      <h3>Facturé à</h3>
      <p>
        <strong>${facture.client_nom}</strong><br>
        ${facture.client_adresse || ''}<br>
        ${facture.client_siret ? `SIRET: ${facture.client_siret}` : ''}
        ${facture.client_email ? `<br>Email: ${facture.client_email}` : ''}
        ${facture.client_telephone ? `<br>Tél: ${facture.client_telephone}` : ''}
      </p>
    </div>
  </div>

  <div class="dates-info">
    <table>
      <tr>
        <td><strong>Date d'émission:</strong></td>
        <td>${formatDate(facture.date_emission)}</td>
        <td><strong>Date d'échéance:</strong></td>
        <td>${formatDate(facture.date_echeance)}</td>
      </tr>
      ${facture.numero_bon_commande ? `
      <tr>
        <td><strong>Bon de commande:</strong></td>
        <td colspan="3">${facture.numero_bon_commande}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 40%;">Désignation</th>
        <th style="width: 12%; text-align: center;">Quantité</th>
        <th style="width: 15%; text-align: right;">Prix Unit. HT</th>
        <th style="width: 10%; text-align: center;">TVA</th>
        <th style="width: 18%; text-align: right;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lignesHtml || '<tr><td colspan="6" style="text-align: center; padding: 20px;">Aucune ligne</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr>
        <td>Total HT</td>
        <td style="text-align: right;">${formatMoney(facture.montant_ht)}</td>
      </tr>
      ${tvaDetailsHtml}
      <tr>
        <td><strong>Total TVA</strong></td>
        <td style="text-align: right;"><strong>${formatMoney(facture.montant_tva)}</strong></td>
      </tr>
      ${facture.remise_globale_montant ? `
      <tr>
        <td>Remise</td>
        <td style="text-align: right;">-${formatMoney(facture.remise_globale_montant)}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td style="padding: 12px;">TOTAL TTC</td>
        <td style="text-align: right; padding: 12px;">${formatMoney(facture.montant_ttc)}</td>
      </tr>
    </table>
  </div>

  <div class="payment-info">
    <h4 style="margin: 0 0 10px 0; color: #92400e;">💳 Informations de paiement</h4>
    <p style="margin: 0;">
      <strong>IBAN:</strong> ${company.iban}<br>
      <strong>BIC:</strong> ${company.bic}<br>
      ${facture.conditions_paiement ? `<strong>Conditions:</strong> ${facture.conditions_paiement}` : ''}
    </p>
  </div>

  ${facture.notes_client ? `
  <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
    <h4 style="margin: 0 0 10px 0; color: #166534;">📝 Notes</h4>
    <p style="margin: 0;">${facture.notes_client}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>
      <strong>${company.name}</strong> • ${company.address}, ${company.city}<br>
      SIRET: ${company.siret} • TVA Intracommunautaire: ${company.tva_intracom}<br>
      ${company.email} • ${company.phone}
    </p>
    <div class="legal-mentions">
      <p>En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40€ (art. L.441-10 Code de commerce).</p>
      <p>Pas d'escompte pour paiement anticipé. TVA acquittée sur les débits.</p>
    </div>
  </div>
</body>
</html>
  `;
}
