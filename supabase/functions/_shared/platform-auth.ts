/**
 * Platform API — Shared auth & signing helpers.
 * Used by all `platform-*` edge functions.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { origineAutorisee } from './cors.ts'

export const PLATFORM_CORS = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, x-api-key, idempotency-key, content-type, x-marque-signature, marque-signature, x-marque-event, x-marque-event-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

export interface ApiKeyContext {
  api_key_id: string
  scope: 'platform:site_web' | 'platform:product' | 'platform:product:sandbox'
}

/**
 * Verifies the `x-api-key` header against `public.api_keys`.
 * Keys are stored hashed (sha256 hex). Returns context or null.
 */
export async function verifyApiKey(req: Request): Promise<ApiKeyContext | null> {
  const raw = req.headers.get('x-api-key')
  if (!raw) return null

  const hash = await sha256Hex(raw)
  const sb = serviceClient()
  const { data, error } = await sb
    .from('api_keys')
    .select('id, permissions, est_active, revoked_at, expires_at')
    .eq('key_hash', hash)
    .maybeSingle()
  if (error || !data) return null
  if (!data.est_active || data.revoked_at) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null

  const perms: string[] = Array.isArray(data.permissions) ? data.permissions : []
  const scope = perms.find((p) => p.startsWith('platform:'))
  if (!scope) return null

  // Fire-and-forget : last_used_at + total_requests
  sb.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { api_key_id: data.id as string, scope: scope as ApiKeyContext['scope'] }
}

/** Standard JSON response with platform CORS. */
export function jsonResponse(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...PLATFORM_CORS, 'Content-Type': 'application/json', ...Object(extra) },
  })
}

/** Standardized error envelope (sanitized). */
export function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code: code ?? null }, status)
}

/** OPTIONS preflight helper. */
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: PLATFORM_CORS })
  return null
}

/** Wraps a handler with API key check. */
export async function withApiKey(
  req: Request,
  handler: (ctx: ApiKeyContext) => Promise<Response>
): Promise<Response> {
  const pf = preflight(req)
  if (pf) return pf
  const ctx = await verifyApiKey(req)
  if (!ctx) return errorResponse('Invalid or missing x-api-key', 401, 'invalid_api_key')
  try {
    return await handler(ctx)
  } catch (e) {
    console.error('[platform] handler error', e)
    return errorResponse('Internal error', 500, 'internal_error')
  }
}

/** Idempotency-Key check : returns cached body if seen, else null. Stores on success. */
export async function checkIdempotency(
  req: Request,
  endpoint: string
): Promise<{ key: string | null; cached: Response | null }> {
  const key = req.headers.get('idempotency-key')
  if (!key) return { key: null, cached: null }
  const sb = serviceClient()
  const { data } = await sb
    .from('webhook_idempotency_keys')
    .select('response_body, response_status')
    .eq('idempotency_key', key)
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (data?.response_body) {
    return {
      key,
      cached: new Response(JSON.stringify(data.response_body), {
        status: (data.response_status as number) ?? 200,
        headers: {
          ...PLATFORM_CORS,
          'Content-Type': 'application/json',
          'X-Idempotent-Replay': 'true',
        },
      }),
    }
  }
  return { key, cached: null }
}

export async function storeIdempotency(
  key: string,
  endpoint: string,
  responseBody: unknown,
  status: number
): Promise<void> {
  const sb = serviceClient()
  await sb.from('webhook_idempotency_keys').upsert({
    idempotency_key: key,
    endpoint,
    response_body: responseBody as never,
    response_status: status,
    created_at: new Date().toISOString(),
  })
}

/** SHA-256 hex digest. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** HMAC-SHA256 hex. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Signs a webhook body : returns header value `t=<ts>,v1=<hmac>`. */
export async function signWebhook(secret: string, rawBody: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000)
  const sig = await hmacSha256Hex(secret, `${ts}.${rawBody}`)
  return `t=${ts},v1=${sig}`
}

/** Issues a short-lived (5 min) SSO JWT HS256 for the Product backend. */
export async function issueSsoJwt(
  payload: Record<string, unknown>
): Promise<{ token: string; exp: number }> {
  const secret = Deno.env.get('PLATFORM_SSO_JWT_SECRET')
  if (!secret) throw new Error('PLATFORM_SSO_JWT_SECRET not configured')
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 300
  const claims = { iss: 'gestion', aud: 'product', iat: now, exp, ...payload }
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${b64(header)}.${b64(claims)}`
  const sig = await hmacSha256Hex(secret, signingInput)
  // sig is hex -> convert to base64url of raw bytes
  const sigBytes = new Uint8Array(sig.match(/../g)!.map((h) => parseInt(h, 16)))
  const sigB64 = btoa(String.fromCharCode(...sigBytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return { token: `${signingInput}.${sigB64}`, exp }
}

/** Service-role Supabase client (bypasses RLS). */
export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
