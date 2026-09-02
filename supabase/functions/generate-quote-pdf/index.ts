import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const COMPANY_INFO = {
  name: 'OPENPULSE IA',
  address: '123 Avenue de la Santé',
  city: '75001 Paris',
  siret: '123 456 789 00012',
  tvaIntracom: 'FR12 123456789',
  email: 'contact@exploitant.example.org',
  phone: '+33 1 23 45 67 89',
  website: 'www.exploitant.example.org',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { devisId } = await req.json()

    if (!devisId) {
      throw new Error('devisId is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select(
        `
        *,
        etablissement:etablissements(id, nom, ville, adresse, code_postal, siret),
        contact:contacts(id, nom, prenom, email, telephone),
        commercial:profiles!devis_commercial_id_fkey(id, prenom, nom),
        lignes:devis_lignes(
          *,
          produit:catalogue_produits(*)
        )
      `
      )
      .eq('id', devisId)
      .single()

    if (fetchError) throw fetchError
    if (!devis) throw new Error('Devis not found')

    const pdfHtml = generateQuoteHtml(devis)

    return new Response(
      JSON.stringify({
        success: true,
        pdfHtml,
        devis: {
          numero: devis.numero,
          client_nom: devis.client_nom,
          montant_ttc: devis.montant_ttc,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating quote PDF:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function generateQuoteHtml(devis: any): string {
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  const lignes = devis.lignes || []

  const lignesHtml = lignes
    .map(
      (l: any, idx: number) => `
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
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Devis ${devis.numero}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      font-size: 12px; 
      color: #1f2937; 
      line-height: 1.5;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #059669; }
    .quote-title { font-size: 28px; color: #059669; text-align: right; }
    .quote-number { font-size: 14px; color: #6b7280; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-block h3 { color: #059669; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .validity-banner { 
      background: #ecfdf5;
      padding: 15px; 
      border-radius: 8px; 
      margin-bottom: 30px;
      border-left: 4px solid #059669;
    }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { 
      background: #059669; 
      color: white; 
      padding: 12px; 
      text-align: left; 
      font-weight: 600;
    }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 350px; }
    .totals-table td { padding: 8px 12px; }
    .totals-table .total-row { 
      background: #059669; 
      color: white; 
      font-weight: bold; 
      font-size: 16px; 
    }
    .signature-block {
      margin-top: 40px;
      padding: 20px;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 2px solid #e5e7eb; 
      font-size: 10px; 
      color: #6b7280; 
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">${COMPANY_INFO.name}</div>
      <p>${COMPANY_INFO.address}<br>${COMPANY_INFO.city}</p>
      <p>SIRET: ${COMPANY_INFO.siret}<br>TVA: ${COMPANY_INFO.tvaIntracom}</p>
    </div>
    <div style="text-align: right;">
      <div class="quote-title">DEVIS</div>
      <div class="quote-number">N° ${devis.numero}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <h3>Émetteur</h3>
      <p>
        <strong>${COMPANY_INFO.name}</strong><br>
        ${COMPANY_INFO.address}<br>
        ${COMPANY_INFO.city}<br>
        Tél: ${COMPANY_INFO.phone}<br>
        Email: ${COMPANY_INFO.email}
      </p>
    </div>
    <div class="address-block">
      <h3>Destinataire</h3>
      <p>
        <strong>${devis.client_nom}</strong><br>
        ${devis.client_adresse || ''}<br>
        ${devis.client_siret ? `SIRET: ${devis.client_siret}` : ''}
        ${devis.client_email ? `<br>Email: ${devis.client_email}` : ''}
        ${devis.client_telephone ? `<br>Tél: ${devis.client_telephone}` : ''}
      </p>
    </div>
  </div>

  <div class="validity-banner">
    <table style="width: 100%;">
      <tr>
        <td><strong>📅 Date d'émission:</strong> ${formatDate(devis.date_emission)}</td>
        <td><strong>⏰ Valable jusqu'au:</strong> ${formatDate(devis.date_validite)}</td>
      </tr>
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
        <td style="text-align: right;">${formatMoney(devis.montant_ht)}</td>
      </tr>
      <tr>
        <td>TVA</td>
        <td style="text-align: right;">${formatMoney(devis.montant_tva)}</td>
      </tr>
      ${
        devis.remise_globale_montant
          ? `
      <tr>
        <td>Remise</td>
        <td style="text-align: right;">-${formatMoney(devis.remise_globale_montant)}</td>
      </tr>
      `
          : ''
      }
      <tr class="total-row">
        <td style="padding: 12px;">TOTAL TTC</td>
        <td style="text-align: right; padding: 12px;">${formatMoney(devis.montant_ttc)}</td>
      </tr>
    </table>
  </div>

  ${
    devis.conditions_paiement
      ? `
  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
    <h4 style="margin: 0 0 10px 0;">Conditions de paiement</h4>
    <p style="margin: 0;">${devis.conditions_paiement}</p>
  </div>
  `
      : ''
  }

  ${
    devis.notes_client
      ? `
  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
    <h4 style="margin: 0 0 10px 0;">📝 Notes</h4>
    <p style="margin: 0;">${devis.notes_client}</p>
  </div>
  `
      : ''
  }

  <div class="signature-block">
    <h4 style="margin: 0 0 15px 0;">✍️ Acceptation du devis</h4>
    <p>Bon pour accord. Date et signature du client :</p>
    <div style="height: 60px; border-bottom: 1px solid #d1d5db; margin-top: 30px;"></div>
    <p style="font-size: 10px; color: #6b7280; margin-top: 10px;">
      En signant ce document, le client accepte les conditions générales de vente disponibles sur demande.
    </p>
  </div>

  <div class="footer">
    <p>
      <strong>${COMPANY_INFO.name}</strong> • ${COMPANY_INFO.address}, ${COMPANY_INFO.city}<br>
      SIRET: ${COMPANY_INFO.siret} • TVA Intracommunautaire: ${COMPANY_INFO.tvaIntracom}<br>
      ${COMPANY_INFO.email} • ${COMPANY_INFO.phone} • ${COMPANY_INFO.website}
    </p>
  </div>
</body>
</html>
  `
}
