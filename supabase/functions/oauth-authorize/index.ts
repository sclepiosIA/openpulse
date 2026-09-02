import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { safeErrorLog } from '../_shared/error-sanitizer.ts'
import { checkRateLimit, extractClientIp, rateLimitedResponse } from '../_shared/rate-limit.ts'

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-secret',
}

interface OAuthApp {
  id: string
  name: string
  client_id: string
  redirect_uris: string[]
  scopes: string[]
}

async function resolveNonce(
  supabase: ReturnType<typeof createClient>,
  nonce: string | null,
  { consume }: { consume: boolean }
): Promise<{ userId: string } | null> {
  if (!nonce || typeof nonce !== 'string' || nonce.length < 16 || nonce.length > 128) return null
  const { data, error } = await supabase
    .from('oauth_state_nonces')
    .select('user_id, expires_at, consumed_at')
    .eq('nonce', nonce)
    .maybeSingle()
  if (error || !data) return null
  if (data.consumed_at) return null
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null
  if (consume) {
    await supabase
      .from('oauth_state_nonces')
      .update({ consumed_at: new Date().toISOString() })
      .eq('nonce', nonce)
  }
  return { userId: data.user_id as string }
}

async function authenticateViaBearer(
  supabase: ReturnType<typeof createClient>,
  req: Request
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return { userId: data.user.id }
}

async function mintNonce(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const nonce = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await supabase.from('oauth_state_nonces').insert({
    nonce,
    user_id: userId,
    expires_at: expiresAt,
  })
  return nonce
}

function buildLoginRedirect(originalUrl: URL): string {
  const next = encodeURIComponent(originalUrl.pathname + originalUrl.search)
  return `/auth?next=${next}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Rate-limit anti-abuse (per-IP, best-effort). Consent UI + code minting
  // are interactive — generous window, low burst.
  const ip = extractClientIp(req)
  const rl = await checkRateLimit(`oauth-authorize:${req.method}:${ip}`, {
    limit: 30,
    windowSec: 600,
  })
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSec ?? 60, corsHeaders)
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const url = new URL(req.url)

  // SPA preparation endpoint:
  // The SPA calls POST /oauth-authorize?prepare=1 with Authorization: Bearer <jwt>
  // to exchange its session JWT for a short-lived opaque nonce. The SPA then
  // redirects the browser to GET /oauth-authorize?...&nonce=<nonce>, so the
  // JWT never appears in the URL, browser history, server logs, or Referer.
  if (req.method === 'POST' && url.searchParams.get('prepare') === '1') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const authed = await authenticateViaBearer(supabase, req)
    if (!authed) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const nonce = await mintNonce(supabase, authed.userId)
    return new Response(JSON.stringify({ nonce }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // OAuth authorization endpoint
  // GET /oauth-authorize?client_id=xxx&redirect_uri=xxx&scope=xxx&state=xxx&response_type=code&nonce=xxx
  if (req.method === 'GET') {
    const clientId = url.searchParams.get('client_id')
    const redirectUri = url.searchParams.get('redirect_uri')
    const scope = url.searchParams.get('scope') || 'read'
    const state = url.searchParams.get('state') || ''
    const responseType = url.searchParams.get('response_type')

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing client_id or redirect_uri',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (responseType !== 'code') {
      return new Response(
        JSON.stringify({
          error: 'unsupported_response_type',
          error_description: "Only 'code' response type is supported",
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the OAuth app exists and redirect_uri is allowed
    const { data: app, error: appError } = await supabase
      .from('oauth_apps')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single()

    if (appError || !app) {
      return new Response(
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'Unknown or inactive client',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check redirect_uri is allowed
    const allowedRedirects = app.redirect_uris || []
    if (!allowedRedirects.includes(redirectUri)) {
      return new Response(
        JSON.stringify({
          error: 'invalid_redirect_uri',
          error_description: 'Redirect URI not allowed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Require an authenticated end-user to view the consent page.
    // The SPA exchanges its JWT for a short-lived nonce via POST ?prepare=1,
    // then redirects the browser to GET with ?nonce=<opaque>. We resolve (but
    // do NOT yet consume) the nonce so the user can refresh the consent page.
    const nonce = url.searchParams.get('nonce')
    const authedUser = await resolveNonce(supabase, nonce, { consume: false })
    if (!authedUser) {
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connexion requise</title></head>
<body style="font-family:system-ui;padding:40px;text-align:center">
<h1>Connexion requise</h1>
<p>Vous devez être connecté à OpenPulse pour autoriser cette application.</p>
<p><a href="${buildLoginRedirect(url)}">Se connecter</a></p>
</body></html>`,
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      )
    }

    // Return consent page HTML
    const requestedScopes = scope.split(' ')
    const escHtml = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    const scopeDescriptions: Record<string, string> = {
      read: 'Lire vos données (établissements, contacts, factures)',
      write: 'Modifier vos données',
      'etablissements:read': 'Lire les établissements',
      'etablissements:write': 'Créer et modifier les établissements',
      'contacts:read': 'Lire les contacts',
      'contacts:write': 'Créer et modifier les contacts',
      'factures:read': 'Lire les factures',
      'taches:read': 'Lire les tâches',
      'taches:write': 'Créer et modifier les tâches',
    }

    const consentHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autorisation - OpenPulse</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      background: #211A17;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: none;
      max-width: 420px;
      width: 100%;
      padding: 32px;
    }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { color: #1a1a2e; font-size: 24px; }
    .app-info {
      text-align: center;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .app-name { font-weight: 600; color: #1e293b; font-size: 18px; }
    .app-desc { color: #64748b; font-size: 14px; margin-top: 4px; }
    .scopes {
      margin-bottom: 24px;
    }
    .scopes h3 {
      font-size: 14px;
      color: #475569;
      margin-bottom: 12px;
    }
    .scope-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      background: #f1f5f9;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .scope-icon {
      width: 32px;
      height: 32px;
      background: #e2e8f0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }
    .scope-text { flex: 1; font-size: 14px; color: #334155; }
    .buttons {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-deny {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #64748b;
    }
    .btn-deny:hover { background: #e2e8f0; }
    .btn-allow {
      background: #3b82f6;
      border: none;
      color: white;
    }
    .btn-allow:hover { background: #2563eb; }
    .footer {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🏥 OpenPulse</h1>
    </div>
    
    <div class="app-info">
      <div class="app-name">${escHtml(app.name)}</div>
      <div class="app-desc">souhaite accéder à votre compte</div>
    </div>
    
    <div class="scopes">
      <h3>Cette application pourra :</h3>
      ${requestedScopes
        .map(
          (s) => `
        <div class="scope-item">
          <div class="scope-icon">✓</div>
          <span class="scope-text">${escHtml(scopeDescriptions[s] || s)}</span>
        </div>
      `
        )
        .join('')}
    </div>
    
    <form method="POST" action="">
      <input type="hidden" name="client_id" value="${escHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escHtml(redirectUri)}">
      <input type="hidden" name="scope" value="${escHtml(scope)}">
      <input type="hidden" name="state" value="${escHtml(state)}">
      <input type="hidden" name="response_type" value="code">
      <input type="hidden" name="nonce" value="${escHtml(nonce ?? '')}">
      
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="btn-deny">Refuser</button>
        <button type="submit" name="action" value="allow" class="btn-allow">Autoriser</button>
      </div>
    </form>
    
    <div class="footer">
      En autorisant, vous acceptez les conditions d'utilisation.
    </div>
  </div>
</body>
</html>`

    return new Response(consentHtml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    })
  }

  // Handle POST (consent form submission)
  if (req.method === 'POST') {
    const formData = await req.formData()
    const action = formData.get('action')
    const clientId = formData.get('client_id') as string
    const redirectUri = formData.get('redirect_uri') as string
    const scope = formData.get('scope') as string
    const state = formData.get('state') as string
    const formNonce = formData.get('nonce') as string | null

    // Require an authenticated end-user — codes must be scoped to a real user.
    // Consume the nonce so it cannot be replayed.
    const authedUser = await resolveNonce(supabase, formNonce, { consume: true })
    if (!authedUser) {
      return new Response(
        JSON.stringify({
          error: 'login_required',
          error_description: 'User must be authenticated to authorize',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing client_id or redirect_uri',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CRITICAL: re-validate redirect_uri against the OAuth app whitelist on POST
    // to prevent open-redirect via forged form submission
    const { data: app, error: appError } = await supabase
      .from('oauth_apps')
      .select('redirect_uris')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single()

    if (appError || !app) {
      return new Response(
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'Unknown or inactive client',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const allowedRedirects: string[] = app.redirect_uris || []

    // Strict exact-match against the whitelist + scheme allowlist
    // (blocks javascript:, data:, file:, etc.)
    let parsedRedirect: URL
    try {
      parsedRedirect = new URL(redirectUri)
    } catch (e: unknown) {
      console.error(safeErrorLog('oauth-authorize', e))
      return new Response(
        JSON.stringify({
          error: 'invalid_redirect_uri',
          error_description: 'Malformed redirect URI',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (
      (parsedRedirect.protocol !== 'https:' && parsedRedirect.protocol !== 'http:') ||
      !allowedRedirects.includes(redirectUri)
    ) {
      // Do NOT redirect to an untrusted URL — return a plain error
      return new Response(
        JSON.stringify({
          error: 'invalid_redirect_uri',
          error_description: 'Redirect URI not allowed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'deny') {
      const errorUrl = new URL(redirectUri)
      errorUrl.searchParams.set('error', 'access_denied')
      errorUrl.searchParams.set('error_description', 'The user denied the request')
      if (state) errorUrl.searchParams.set('state', state)

      return Response.redirect(errorUrl.toString(), 302)
    }

    // Generate authorization code
    const authCode = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store the authorization code scoped to the authenticated user
    await supabase.from('oauth_authorization_codes').insert({
      code: authCode,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      user_id: authedUser.userId,
      expires_at: expiresAt.toISOString(),
    })

    // Redirect back with authorization code (validated above)
    const successUrl = new URL(redirectUri)
    successUrl.searchParams.set('code', authCode)
    if (state) successUrl.searchParams.set('state', state)

    return Response.redirect(successUrl.toString(), 302)
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
