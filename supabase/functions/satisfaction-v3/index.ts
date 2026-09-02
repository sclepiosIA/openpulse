// Edge Function: satisfaction-v3
// Endpoint public signé HMAC-SHA256 pour le flux "Satisfaction V3".
// - Le backend OpenPulse V3 (DPI / Hôpital Manager) appelle cette fonction en signant
//   `${timestamp}.${rawBody}` avec le secret partagé `MARQUE_V3_SATISFACTION_SECRET`.
// - Le même endpoint accepte les soumissions du formulaire public
//   `exploitant.example.org/questionnairesatisfaction` avec `source='public-form'` (signature
//   côté serveur du site public — le secret n'est JAMAIS exposé au navigateur).
//
// verify_jwt=false (déclaré dans supabase/config.toml) : accessible sans Authorization
// ni apikey. La sécurité repose UNIQUEMENT sur la signature HMAC + fenêtre de 300s.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { origineAutorisee } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'content-type, x-scl-v3-timestamp, x-scl-v3-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' }

const SECRET = Deno.env.get('MARQUE_V3_SATISFACTION_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const MAX_SKEW_SECONDS = 300

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function err(status: number, message: string): Response {
  return jsonResponse({ success: false, error: message }, status)
}

function internalError(error: unknown): Response {
  return err(500, sanitizeErrorForClient(error))
}

function hexEncode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let out = ''
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, '0')
  }
  return out
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return hexEncode(sig)
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return hexEncode(buf)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

interface Ctx {
  dpi?: string | null
  etablissement?: string | null
  service?: string | null
  role?: string | null
  user_hash?: string | null
  module?: string | null
}

async function computeFingerprint(ctx: Ctx): Promise<string> {
  const raw = `${ctx.etablissement ?? ''}|${ctx.dpi ?? ''}|${ctx.service ?? ''}|${ctx.role ?? ''}|${ctx.user_hash ?? ''}`
  return await sha256Hex(raw)
}

function matchesContext(row: Record<string, unknown>, ctx: Ctx): boolean {
  const t_et = row.target_etablissement as string | null
  const t_dpi = row.target_dpi as string | null
  const t_srv = row.target_service as string | null
  if (t_et && t_et !== (ctx.etablissement ?? '')) return false
  if (t_dpi && t_dpi !== (ctx.dpi ?? '')) return false
  if (t_srv && t_srv !== (ctx.service ?? '')) return false
  return true
}

async function handleCampaigns(body: { context?: Ctx }): Promise<Response> {
  const ctx: Ctx = body.context ?? {}
  const fingerprint = await computeFingerprint(ctx)

  // Anti-relance : déjà répondu ?
  const { data: existing, error: exErr } = await supabase
    .from('satisfaction_v3_responses')
    .select('id')
    .eq('fingerprint', fingerprint)
    .limit(1)
    .maybeSingle()
  if (exErr) return internalError(exErr)
  if (existing) return jsonResponse({ success: true, show: false })

  // Campagnes actives dans la fenêtre
  const nowIso = new Date().toISOString()
  const { data: campaigns, error: cErr } = await supabase
    .from('satisfaction_v3_campaigns')
    .select(
      'id,title,message,priority,target_etablissement,target_dpi,target_service,starts_at,ends_at'
    )
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('priority', { ascending: false })
  if (cErr) return internalError(cErr)

  let picked: Record<string, unknown> | null = null
  for (const row of campaigns ?? []) {
    if (matchesContext(row as Record<string, unknown>, ctx)) {
      picked = row as Record<string, unknown>
      break
    }
  }

  // Fallback : campagne par défaut
  if (!picked) {
    const { data: def } = await supabase
      .from('satisfaction_v3_campaigns')
      .select('id,title,message')
      .eq('id', 'default-v3-satisfaction')
      .eq('is_active', true)
      .maybeSingle()
    if (def) picked = def as Record<string, unknown>
  }

  if (!picked) return jsonResponse({ success: true, show: false })

  return jsonResponse({
    success: true,
    show: true,
    campaign: {
      id: picked.id,
      title: picked.title,
      message: picked.message ?? null,
    },
  })
}

async function handleSubmit(body: {
  campaign_id?: string
  context?: Ctx
  answers?: {
    satisfaction?: number
    recommendation?: number
    comment?: string
  }
  source?: string
}): Promise<Response> {
  const ctx: Ctx = body.context ?? {}
  const fingerprint = await computeFingerprint(ctx)

  // Idempotence sur fingerprint
  const { data: existing } = await supabase
    .from('satisfaction_v3_responses')
    .select('id')
    .eq('fingerprint', fingerprint)
    .limit(1)
    .maybeSingle()
  if (existing) {
    return jsonResponse({ success: true, already_answered: true })
  }

  const source = body.source === 'public-form' ? 'public-form' : 'v3-dpi'
  const answers = body.answers ?? {}

  const { error: insErr } = await supabase.from('satisfaction_v3_responses').insert({
    campaign_id: body.campaign_id ?? null,
    source,
    dpi: ctx.dpi ?? null,
    etablissement: ctx.etablissement ?? null,
    service: ctx.service ?? null,
    role: ctx.role ?? null,
    user_hash: ctx.user_hash ?? null,
    fingerprint,
    satisfaction: typeof answers.satisfaction === 'number' ? answers.satisfaction : null,
    recommendation: typeof answers.recommendation === 'number' ? answers.recommendation : null,
    comment: typeof answers.comment === 'string' ? answers.comment : null,
  })

  if (insErr) {
    // Collision de fingerprint (unique index) → idempotent
    if ((insErr as { code?: string }).code === '23505') {
      return jsonResponse({ success: true, already_answered: true })
    }
    return internalError(insErr)
  }

  return jsonResponse({ success: true })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return err(405, 'method_not_allowed')

  if (!SECRET) return err(500, 'server_misconfigured')

  const tsHeader = req.headers.get('x-scl-v3-timestamp')
  const sigHeader = req.headers.get('x-scl-v3-signature')
  const rawBody = await req.text()

  if (!tsHeader || !sigHeader) return err(401, 'missing_signature')

  const ts = Number(tsHeader)
  if (!Number.isFinite(ts)) return err(401, 'invalid_timestamp')
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) {
    return err(401, 'stale_timestamp')
  }

  const expected = 'sha256=' + (await hmacSha256Hex(SECRET, `${ts}.${rawBody}`))
  if (!timingSafeEqual(expected, sigHeader.trim())) {
    return err(401, 'invalid_signature')
  }

  let body: {
    action?: string
    context?: Ctx
    campaign_id?: string
    answers?: {
      satisfaction?: number
      recommendation?: number
      comment?: string
    }
    source?: string
  }
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return err(400, 'invalid_json')
  }

  try {
    switch (body.action) {
      case 'campaigns':
        return await handleCampaigns(body)
      case 'submit':
        return await handleSubmit(body)
      default:
        return err(400, 'unknown_action')
    }
  } catch (error) {
    return internalError(error)
  }
})
