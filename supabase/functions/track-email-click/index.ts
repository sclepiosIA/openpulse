// Session 10 — Lot C item 8: enregistre le clic sur un lien d'email sortant
// puis redirige (302) vers l'URL d'origine. Alimente prospect_behavioral_events.
//
// Sécurité: les URLs de tracking sont signées en HMAC-SHA256 par
// `rewrite-tracking-links.ts` au moment de l'envoi. Toute requête sans
// signature valide est rejetée pour empêcher l'utilisation du endpoint
// comme open redirect.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/') + pad
  try {
    return decodeURIComponent(escape(atob(b64)))
  } catch {
    return ''
  }
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return b64urlFromBytes(new Uint8Array(sig))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isSafeRedirect(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const encoded = url.searchParams.get('u') ?? ''
  const threadId = url.searchParams.get('t')
  const messageIdParam = url.searchParams.get('m')
  const sig = url.searchParams.get('s') ?? ''

  const target = b64urlDecode(encoded)
  if (!target || !isSafeRedirect(target)) {
    return new Response('Invalid redirect URL', { status: 400, headers: corsHeaders })
  }

  // HMAC verification — required to prevent open-redirect abuse
  const secret = Deno.env.get('EMAIL_TRACKING_HMAC_SECRET')
  if (!secret) {
    console.error('[track-email-click] EMAIL_TRACKING_HMAC_SECRET not configured')
    return new Response('Tracking misconfigured', { status: 500, headers: corsHeaders })
  }
  if (!sig) {
    return new Response('Missing signature', { status: 400, headers: corsHeaders })
  }
  const payload = `${encoded}|${threadId ?? ''}|${messageIdParam ?? ''}`
  const expected = await hmacSign(secret, payload)
  if (!timingSafeEqual(sig, expected)) {
    return new Response('Invalid signature', { status: 403, headers: corsHeaders })
  }

  // Settle DB fetches before returning so no background resources outlive this request.
  await (async () => {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      let etablissementId: string | null = null
      if (threadId) {
        const { data: thread } = await supabase
          .from('email_threads')
          .select('etablissement_id')
          .eq('id', threadId)
          .maybeSingle()
        etablissementId = thread?.etablissement_id ?? null
      }

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const ua = req.headers.get('user-agent') ?? null

      const { data: inserted, error: insErr } = await supabase
        .from('email_link_clicks')
        .insert({
          thread_id: threadId,
          message_id: messageIdParam,
          etablissement_id: etablissementId,
          url: target,
          ip,
          user_agent: ua,
        })
        .select('id')
        .single()

      if (insErr) {
        console.error('[track-email-click] insert error', insErr.message)
        return
      }

      if (etablissementId) {
        await supabase.rpc('record_behavioral_event', {
          _etablissement_id: etablissementId,
          _event_type: 'email_clicked',
          _occurred_at: new Date().toISOString(),
          _weight: 3,
          _source_id: inserted?.id ?? null,
          _source_type: 'email_link_click',
          _metadata: { url: target, thread_id: threadId },
        })
      }
    } catch (err) {
      console.error('[track-email-click] log failure', (err as Error).message)
    }
  })()

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: target, 'Cache-Control': 'no-store' },
  })
}

if (import.meta.main) Deno.serve(handler)
