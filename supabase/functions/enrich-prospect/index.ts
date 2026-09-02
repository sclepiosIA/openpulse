// supabase/functions/enrich-prospect/index.ts
// Enrichissement prospects via APIs publiques GRATUITES :
//   - INSEE Sirene (recherche-entreprises.api.gouv.fr — proxy public officiel, sans clé)
//   - Pappers public (api.pappers.fr/v2 — endpoint /entreprise sans clé, infos limitées mais utiles)
// Déclenchements : auto (cron sur etablissements.enrichment_status='pending') ou manuel (UI bouton).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { origineAutorisee } from '../_shared/cors.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Edge Functions are short-lived, server-side requests. Avoid browser-oriented
// session persistence and refresh timers that can outlive the request lifecycle.
const edgeClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

interface RequestBody {
  etablissement_id?: string
  trigger?: 'manual_button' | 'auto_create' | 'cron_refresh'
  batch?: boolean // si true, traite jusqu'à 10 prospects pending
}

interface EnrichedData {
  source: string
  siren?: string | null
  siret?: string | null
  denomination?: string | null
  forme_juridique?: string | null
  code_naf?: string | null
  libelle_naf?: string | null
  tranche_effectif?: string | null
  date_creation?: string | null
  capital?: number | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  dirigeants?: Array<{ nom: string; prenom?: string; qualite?: string }>
  raw?: unknown
}

// ----- 1. Recherche entreprises (INSEE proxy gouv.fr — gratuit, sans clé) -----
async function searchByName(name: string): Promise<EnrichedData | null> {
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(name)}&per_page=1`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.results?.[0]
    if (!r) return null
    return mapRechercheEntreprise(r)
  } catch (e) {
    console.error('searchByName failed:', e)
    return null
  }
}

async function searchBySiren(siren: string): Promise<EnrichedData | null> {
  try {
    const cleaned = siren.replace(/\s/g, '')
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${cleaned}&per_page=1`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.results?.[0]
    if (!r) return null
    return mapRechercheEntreprise(r)
  } catch (e) {
    console.error('searchBySiren failed:', e)
    return null
  }
}

function mapRechercheEntreprise(r: any): EnrichedData {
  const siege = r?.siege ?? {}
  return {
    source: 'recherche_entreprises_gouv',
    siren: r?.siren ?? null,
    siret: siege?.siret ?? null,
    denomination: r?.nom_complet ?? r?.nom_raison_sociale ?? null,
    forme_juridique: r?.nature_juridique ?? null,
    code_naf: r?.activite_principale ?? null,
    libelle_naf: r?.libelle_activite_principale ?? null,
    tranche_effectif: r?.tranche_effectif_salarie ?? null,
    date_creation: r?.date_creation ?? null,
    adresse: siege?.adresse ?? null,
    code_postal: siege?.code_postal ?? null,
    ville: siege?.libelle_commune ?? null,
    dirigeants: Array.isArray(r?.dirigeants)
      ? r.dirigeants.slice(0, 5).map((d: any) => ({
          nom: d?.nom ?? '',
          prenom: d?.prenoms ?? d?.prenom ?? undefined,
          qualite: d?.qualite ?? undefined,
        }))
      : [],
    raw: r,
  }
}

// ----- 2. Apply enrichment to etablissement row -----
function buildPatch(
  current: any,
  enriched: EnrichedData
): { patch: Record<string, unknown>; fields: string[] } {
  const patch: Record<string, unknown> = {}
  const fields: string[] = []

  // SIREN — uniquement si vide côté DB
  if (!current?.siren_client && enriched.siren) {
    patch.siren_client = enriched.siren
    fields.push('siren_client')
  }

  // Adresse / CP / ville — uniquement si vides
  if (!current?.adresse && enriched.adresse) {
    patch.adresse = enriched.adresse
    fields.push('adresse')
  }
  if (!current?.code_postal && enriched.code_postal) {
    patch.code_postal = enriched.code_postal
    fields.push('code_postal')
  }
  if (!current?.ville && enriched.ville) {
    patch.ville = enriched.ville
    fields.push('ville')
  }

  // Dirigeant principal — si DG vide
  if (!current?.directeur_general_nom && enriched.dirigeants && enriched.dirigeants.length > 0) {
    const first = enriched.dirigeants[0]
    if (first?.nom) {
      patch.directeur_general_nom = first.nom
      fields.push('directeur_general_nom')
    }
    if (first?.prenom) {
      patch.directeur_general_prenom = first.prenom
      fields.push('directeur_general_prenom')
    }
  }

  // Toujours stocker le bloc complet enrichment_data + flags
  patch.enrichment_data = {
    ...(current?.enrichment_data ?? {}),
    ...enriched,
    enriched_at: new Date().toISOString(),
  }
  patch.enrichment_source = enriched.source
  patch.enrichment_at = new Date().toISOString()
  patch.enrichment_status = 'enriched'

  return { patch, fields }
}

// ----- 3. Process one etablissement -----
async function processOne(
  supabase: ReturnType<typeof createClient>,
  etablissement_id: string,
  trigger: string,
  triggered_by: string | null
): Promise<{ ok: boolean; fields_updated: string[]; error?: string }> {
  const start = Date.now()
  const { data: etab, error: fetchErr } = await supabase
    .from('etablissements')
    .select(
      'id, nom, siren_client, email, email_domains, adresse, code_postal, ville, directeur_general_nom, enrichment_data'
    )
    .eq('id', etablissement_id)
    .maybeSingle()

  if (fetchErr || !etab) {
    return { ok: false, fields_updated: [], error: fetchErr?.message ?? 'not_found' }
  }

  // Stratégie : SIREN > nom
  let enriched: EnrichedData | null = null
  if (etab.siren_client) enriched = await searchBySiren(etab.siren_client as string)
  if (!enriched && etab.nom) enriched = await searchByName(etab.nom as string)

  if (!enriched) {
    await supabase
      .from('etablissements')
      .update({ enrichment_status: 'failed', enrichment_at: new Date().toISOString() })
      .eq('id', etablissement_id)

    await supabase.from('prospect_enrichment_log').insert({
      etablissement_id,
      source: 'recherche_entreprises_gouv',
      trigger,
      success: false,
      error_message: 'Aucun résultat trouvé',
      duration_ms: Date.now() - start,
      triggered_by,
    })

    return { ok: false, fields_updated: [], error: 'Aucun résultat' }
  }

  const { patch, fields } = buildPatch(etab, enriched)

  const { error: updErr } = await supabase
    .from('etablissements')
    .update(patch)
    .eq('id', etablissement_id)

  if (updErr) {
    await supabase.from('prospect_enrichment_log').insert({
      etablissement_id,
      source: enriched.source,
      trigger,
      success: false,
      error_message: updErr.message,
      duration_ms: Date.now() - start,
      triggered_by,
    })
    return { ok: false, fields_updated: [], error: updErr.message }
  }

  await supabase.from('prospect_enrichment_log').insert({
    etablissement_id,
    source: enriched.source,
    trigger,
    success: true,
    data_returned: enriched as any,
    fields_updated: fields,
    duration_ms: Date.now() - start,
    triggered_by,
  })

  return { ok: true, fields_updated: fields }
}

// ----- 4. Edge function entrypoint -----
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Identifier l'appelant si auth présente
    let triggered_by: string | null = null
    const auth = req.headers.get('Authorization')
    if (auth?.startsWith('Bearer ')) {
      const userClient = createClient(supabaseUrl, anonKey, {
        ...edgeClientOptions,
        global: { headers: { Authorization: auth } },
      })
      const token = auth.replace('Bearer ', '')
      const { data } = await userClient.auth.getClaims(token)
      triggered_by = data?.claims?.sub ?? null
    }

    const supabase = createClient(supabaseUrl, serviceKey, edgeClientOptions)
    const body: RequestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const trigger = body.trigger ?? 'manual_button'

    // Mode batch : récupérer N prospects pending
    if (body.batch) {
      const { data: pending } = await supabase
        .from('etablissements')
        .select('id')
        .eq('enrichment_status', 'pending')
        .limit(10)

      const results: Array<{ id: string; ok: boolean; fields_updated: string[] }> = []
      for (const row of pending ?? []) {
        const r = await processOne(supabase, row.id as string, 'cron_refresh', null)
        results.push({ id: row.id as string, ...r })
      }
      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mode unique
    if (!body.etablissement_id) {
      return new Response(JSON.stringify({ error: 'etablissement_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await processOne(supabase, body.etablissement_id, trigger, triggered_by)
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    return buildErrorResponse('enrich-prospect', err, corsHeaders, 500)
  }
})
