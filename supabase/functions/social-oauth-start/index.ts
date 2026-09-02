// Edge Function: social-oauth-start
// Démarre le flow OAuth pour une marque + plateforme donnée.
// Retourne une URL d'autorisation à ouvrir côté client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorLog, sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export type OAuthStartDependencies = {
  createClient: typeof createClient
  /** Resolve fetch at request time so test doubles cannot be bypassed by module caching. */
  fetch: typeof fetch
}

const productionDependencies: OAuthStartDependencies = {
  createClient,
  fetch: (...args) => globalThis.fetch(...args),
}

const PLATFORM_SCOPES: Record<string, string[]> = {
  facebook: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_read_user_content',
    'business_management',
  ],
  instagram: [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'business_management',
  ],
  linkedin: [
    'openid',
    'profile',
    'email',
    'w_member_social',
    'r_organization_social',
    'w_organization_social',
    'rw_organization_admin',
  ],
  tiktok: [
    'user.info.basic',
    'user.info.profile',
    'user.info.stats',
    'video.list',
    'video.publish',
    'video.upload',
  ],
}

function randomState(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function buildAuthUrl(platform: string, state: string, redirectUri: string): string {
  const scopes = PLATFORM_SCOPES[platform].join(
    platform === 'tiktok' ? ',' : platform === 'linkedin' ? ' ' : ','
  )
  if (platform === 'facebook' || platform === 'instagram') {
    const appId = Deno.env.get('META_APP_ID')!
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
      auth_type: 'rerequest',
    })
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  }
  if (platform === 'linkedin') {
    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')!
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  }
  if (platform === 'tiktok') {
    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!
    const params = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
    })
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  }
  throw new Error(`Unsupported platform: ${platform}`)
}

export function createHandler(deps: OAuthStartDependencies = productionDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })

    try {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }

      const sbUser = deps.createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { fetch: deps.fetch, headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
      const { data: userRes, error: userErr } = await sbUser.auth.getUser()
      if (userErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }
      const userId = userRes.user.id

      const admin = deps.createClient(SUPABASE_URL, SERVICE_ROLE, {
        global: { fetch: deps.fetch },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
      const { data: isAdmin } = await admin.rpc('is_social_admin', { _user_id: userId })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const brand_id = String(body.brand_id || '')
      const platform = String(body.platform || '')
      const return_to = String(body.return_to || '/parametres/social')
      if (!brand_id || !PLATFORM_SCOPES[platform]) {
        return new Response(JSON.stringify({ error: 'Invalid brand_id or platform' }), {
          status: 400,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/social-oauth-callback`
      const state = randomState()

      const { error: insErr } = await admin.from('social_oauth_states').insert({
        state,
        brand_id,
        platform,
        user_id: userId,
        redirect_uri: return_to,
      })
      if (insErr) throw insErr

      const authUrl = buildAuthUrl(platform, state, redirectUri)
      return new Response(JSON.stringify({ auth_url: authUrl, state }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    } catch (e) {
      console.error(JSON.stringify(safeErrorLog('social-oauth-start', e)))
      return new Response(JSON.stringify({ error: sanitizeErrorForClient(e) }), {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }
  }
}

export const handler = createHandler()

Deno.serve(handler)
