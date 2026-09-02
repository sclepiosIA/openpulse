// Génération Factur-X (PDF/A-3 + XML CII) — conforme réforme e-invoicing 2026
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

// Génère le XML CII (Cross Industry Invoice) UN/CEFACT — profil MINIMUM/BASIC WL
function buildFacturXXML(facture: any, lignes: any[], emetteur: any): string {
  const esc = (s: any) =>
    String(s || '').replace(
      /[<>&"']/g,
      (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] || c
    )
  const totalHT = lignes.reduce((s, l) => s + Number(l.montant_ht || 0), 0)
  const totalTTC = Number(facture.montant_ttc || 0)
  const totalTVA = totalTTC - totalHT
  const dateFmt = (
    facture.date_facture ||
    facture.date_emission ||
    new Date().toISOString().slice(0, 10)
  ).replace(/-/g, '')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basicwl</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(facture.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${dateFmt}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(emetteur.name || 'OpenPulse')}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(emetteur.siren || '000000000')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(facture.client_nom || facture.nom_etablissement || 'Client')}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${totalTVA.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { facture_id } = await req.json()
    if (!facture_id) throw new Error('facture_id requis')

    const { data: facture, error } = await supabase
      .from('factures')
      .select('*')
      .eq('id', facture_id)
      .single()
    if (error || !facture) throw new Error('Facture introuvable')

    const { data: lignes } = await supabase
      .from('factures_lignes')
      .select('*')
      .eq('facture_id', facture_id)

    const emetteur = { name: 'OpenPulse', siren: '000000000' }
    const xml = buildFacturXXML(facture, lignes || [], emetteur)

    // Le PDF/A-3 nécessite une lib native. On expose ici le XML et un manifeste pour intégration PPF/PDP.
    // La génération PDF/A-3 (embed XML) est déléguée au front (via jsPDF+xml) ou à un service externe.
    return new Response(
      JSON.stringify({
        success: true,
        facture_id,
        numero: facture.numero,
        xml_cii: xml,
        profile: 'BASIC WL',
        note: 'XML CII généré. Le PDF/A-3 avec pièce jointe XML doit être finalisé côté client via une lib PDF/A-3 (ex: pdf-lib + xmp metadata).',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('[compta-generate-facturx]', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
