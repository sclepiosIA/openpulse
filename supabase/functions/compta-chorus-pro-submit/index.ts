// Soumission Chorus Pro (Portail public de facturation — secteur public)
// OAuth 2 PISTE (piste.gouv.fr) + API Chorus Pro v1
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const PISTE_TOKEN_URL = 'https://oauth.piste.gouv.fr/api/oauth/token'
const CHORUS_PRO_API = 'https://api.piste.gouv.fr/cpro/factures/v1'

async function getPisteToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'openid',
  })
  const resp = await fetch(PISTE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) throw new Error(`PISTE token error ${resp.status}: ${await resp.text()}`)
  const j = await resp.json()
  return j.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { facture_id, pdf_base64 } = await req.json()
    if (!facture_id) throw new Error('facture_id requis')

    const { data: facture } = await supabase
      .from('factures')
      .select('*')
      .eq('id', facture_id)
      .single()
    if (!facture) throw new Error('Facture introuvable')

    // Génération XML via appel interne
    const { data: fxData, error: fxErr } = await supabase.functions.invoke(
      'compta-generate-facturx',
      {
        body: { facture_id },
      }
    )
    if (fxErr) throw fxErr

    const clientId = Deno.env.get('CHORUS_PRO_CLIENT_ID')
    const clientSecret = Deno.env.get('CHORUS_PRO_CLIENT_SECRET')
    const cpLogin = Deno.env.get('CHORUS_PRO_LOGIN')
    const cpPassword = Deno.env.get('CHORUS_PRO_PASSWORD')

    const chorusPayload = {
      formatDepot: pdf_base64 ? 'PDF_ET_XML' : 'IN_DP_E1_UBL_INVOICE',
      texteFacture: facture.numero,
      fichierFacture: pdf_base64 || null,
      fichierFactureNom: `${facture.numero}.pdf`,
      formatFluxDepot: 'IN_DP_E1_UBL_INVOICE',
      cadre: 'A9_FACTURE_FOURNISSEUR_MONO_DESTINATAIRE',
      pieceJointeComplementaire: [
        {
          pieceJointeFichier: btoa(fxData.xml_cii),
          pieceJointeNom: 'factur-x.xml',
          pieceJointeTypeMime: 'TEXT_XML',
        },
      ],
    }

    // Mode simulation si secrets absents
    if (!clientId || !clientSecret || !cpLogin || !cpPassword) {
      await supabase
        .from('factures')
        .update({
          metadata: {
            ...(facture.metadata || {}),
            chorus_pro: {
              prepared_at: new Date().toISOString(),
              payload_size: JSON.stringify(chorusPayload).length,
              xml: fxData.xml_cii,
            },
          },
        } as any)
        .eq('id', facture_id)
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'prepared',
          facture_id,
          numero: facture.numero,
          note: 'Payload prêt. Configurez CHORUS_PRO_CLIENT_ID, CHORUS_PRO_CLIENT_SECRET, CHORUS_PRO_LOGIN, CHORUS_PRO_PASSWORD (compte technique PISTE) pour le dépôt effectif.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Dépôt effectif via PISTE OAuth + Chorus Pro API
    const token = await getPisteToken(clientId, clientSecret)
    const basicAuth = btoa(`${cpLogin}:${cpPassword}`)
    const resp = await fetch(`${CHORUS_PRO_API}/deposer/flux`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'cpro-account': basicAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chorusPayload),
    })

    const respText = await resp.text()
    let respJson: any = null
    try {
      respJson = JSON.parse(respText)
    } catch {
      /* ignore */
    }

    await supabase
      .from('factures')
      .update({
        metadata: {
          ...(facture.metadata || {}),
          chorus_pro: {
            submitted_at: new Date().toISOString(),
            status: resp.status,
            numero_flux: respJson?.numeroFluxDepot,
            date_depot: respJson?.dateDepot,
            response: respJson || respText,
          },
        },
      } as any)
      .eq('id', facture_id)

    if (!resp.ok) throw new Error(`Chorus Pro error ${resp.status}: ${respText}`)

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'submitted',
        facture_id,
        numero: facture.numero,
        numero_flux: respJson?.numeroFluxDepot,
        date_depot: respJson?.dateDepot,
        chorus_response: respJson,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('[compta-chorus-pro-submit]', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
