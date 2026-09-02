import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SCAN_BATCH = 20
const PORTAL_BASE_URL = 'https://portail.exploitant.example.org'

interface Etab {
  id: string
  nom: string
  statut: string
  siren_client: string | null
  email: string | null
  email_facturation: string | null
  email_domains: string[] | null
  backend_url: string | null
}

async function hmacSign(secret: string, payload: string, timestamp: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload + timestamp))
  return (
    'sha256=' +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

function defaultEmail(etab: Etab): string {
  if (etab.email_facturation) return etab.email_facturation
  if (etab.email) return etab.email
  const id8 = etab.id.replace(/-/g, '').slice(0, 8)
  const domain = etab.email_domains?.[0] || 'exploitant.example.org'
  return `portail+${id8}@${domain}`
}

async function logStep(
  admin: any,
  etabId: string,
  step: string,
  status: string,
  details: any = {},
  error: string | null = null
) {
  try {
    await admin.from('client_provisioning_log').insert({
      etablissement_id: etabId,
      step,
      status,
      details,
      error,
      attempt: 1,
    })
  } catch (e) {
    console.error('[provision] log fail', e)
  }
}

async function provisionOne(
  admin: any,
  etab: Etab,
  productSecret: string | null
): Promise<{ etablissement_id: string; portal: string; product: string }> {
  const result = { etablissement_id: etab.id, portal: 'skipped', product: 'skipped' }

  // 1. Portail site-web
  const { data: existingSiteWeb } = await admin
    .from('client_external_ids')
    .select('id')
    .eq('etablissement_id', etab.id)
    .eq('system', 'site_web')
    .maybeSingle()

  if (!existingSiteWeb) {
    try {
      const email = defaultEmail(etab)
      const { data: rpcData, error: rpcErr } = await admin.rpc('create_client_portal_user_admin', {
        p_email: email,
        p_nom: etab.nom?.slice(0, 80) || 'Contact',
        p_prenom: 'Portail',
        p_etablissement_id: etab.id,
        p_admin_id: null,
      })
      if (rpcErr) throw rpcErr
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
      const userId = row?.user_id
      const tempPassword = row?.temp_password

      await admin.from('client_external_ids').insert({
        etablissement_id: etab.id,
        system: 'site_web',
        external_id: userId,
        provisioned_at: new Date().toISOString(),
        metadata: { email, generated_password: tempPassword, portal_url: PORTAL_BASE_URL },
      })

      await logStep(admin, etab.id, 'portal', 'success', { email, user_id: userId })
      result.portal = 'created'
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await logStep(admin, etab.id, 'portal', 'error', {}, msg)
      result.portal = 'error:' + msg.slice(0, 120)
    }
  } else {
    result.portal = 'already'
  }

  // 2. Backend produit
  const { data: existingProduct } = await admin
    .from('client_external_ids')
    .select('id')
    .eq('etablissement_id', etab.id)
    .eq('system', 'product')
    .maybeSingle()

  if (existingProduct) {
    result.product = 'already'
  } else if (!etab.backend_url) {
    await logStep(admin, etab.id, 'product', 'pending_backend_url', {})
    result.product = 'pending_backend_url'
  } else if (!productSecret) {
    await logStep(admin, etab.id, 'product', 'error', {}, 'PRODUCT_WEBHOOK_SECRET not configured')
    result.product = 'error:missing_secret'
  } else {
    try {
      const portalEmail = defaultEmail(etab)
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const body = JSON.stringify({
        etablissement_id: etab.id,
        nom: etab.nom,
        siren: etab.siren_client,
        portal_email: portalEmail,
        timestamp: Number(timestamp),
      })
      const signature = await hmacSign(productSecret, body, timestamp)
      const url = etab.backend_url.replace(/\/+$/, '') + '/api/provision-tenant'

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 30000)
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Marque-Timestamp': timestamp,
          'X-Marque-Signature': signature,
        },
        body,
        signal: ctrl.signal,
      }).finally(() => clearTimeout(tid))

      const respText = await resp.text()
      if (!resp.ok) {
        await logStep(
          admin,
          etab.id,
          'product',
          'error',
          { http_status: resp.status, body: respText.slice(0, 500) },
          `HTTP ${resp.status}`
        )
        result.product = `error:http_${resp.status}`
      } else {
        let tenantId: string | null = null
        try {
          tenantId = JSON.parse(respText)?.tenant_id ?? null
        } catch {
          /* ignore */
        }

        await admin.from('client_external_ids').insert({
          etablissement_id: etab.id,
          system: 'product',
          external_id: tenantId || `unknown-${Date.now()}`,
          provisioned_at: new Date().toISOString(),
          metadata: { backend_url: etab.backend_url, response: respText.slice(0, 500) },
        })
        await logStep(admin, etab.id, 'product', 'success', { tenant_id: tenantId })
        result.product = 'created'
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await logStep(admin, etab.id, 'product', 'error', {}, msg)
      result.product = 'error:' + msg.slice(0, 120)
    }
  }

  return result
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const PRODUCT_WEBHOOK_SECRET = Deno.env.get('PRODUCT_WEBHOOK_SECRET') || null

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  try {
    // --- Auth: CRON secret OR service_role bearer ---
    const cronSecret = req.headers.get('X-CRON-Secret') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    let authorized = false
    if (cronSecret) {
      try {
        const { data } = await admin.rpc('verify_cron_secret', { _secret: cronSecret })
        authorized = data === true
      } catch {
        /* ignore */
      }
    }
    if (!authorized && token && token === SERVICE_KEY) authorized = true

    // Allow authenticated admin users via JWT (for UI relaunch button)
    if (!authorized && token) {
      try {
        const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
        const userClient = createClient(SUPABASE_URL, ANON, {
          auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        })
        const { data: udata } = await userClient.auth.getUser(token)
        if (udata?.user) {
          const { data: roles } = await admin
            .from('user_roles')
            .select('role')
            .eq('user_id', udata.user.id)
          if (roles?.some((r: any) => r.role === 'admin' || r.role === 'direction'))
            authorized = true
        }
      } catch {
        /* ignore */
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const etabIdSingle: string | undefined = body?.etablissement_id
    const mode: string = body?.mode || (etabIdSingle ? 'single' : 'scan')

    const baseSelect =
      'id, nom, statut, siren_client, email, email_facturation, email_domains, backend_url'

    let etabs: Etab[] = []
    if (mode === 'single' && etabIdSingle) {
      const { data, error } = await admin
        .from('etablissements')
        .select(baseSelect)
        .eq('id', etabIdSingle)
        .maybeSingle()
      if (error) throw error
      if (data) etabs = [data as Etab]
    } else {
      // Scan: Production sans entrée client_external_ids site_web
      const { data: alreadyDone } = await admin
        .from('client_external_ids')
        .select('etablissement_id')
        .eq('system', 'site_web')
      const doneIds = new Set((alreadyDone ?? []).map((r: any) => r.etablissement_id))

      const { data: prodEtabs, error } = await admin
        .from('etablissements')
        .select(baseSelect)
        .eq('statut', 'Production')
        .limit(200)
      if (error) throw error
      etabs = (prodEtabs ?? [])
        .filter((e: any) => !doneIds.has(e.id))
        .slice(0, SCAN_BATCH) as Etab[]
    }

    const results = []
    for (const etab of etabs) {
      results.push(await provisionOne(admin, etab, PRODUCT_WEBHOOK_SECRET))
    }

    return new Response(JSON.stringify({ ok: true, mode, processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return buildErrorResponse('provision-client-on-production', e, corsHeaders, 500)
  }
}

serve(handler)
