// Edge Function: social-comment-reply
// Actions sur un commentaire social :
//   - reply  : poster une réponse (FB/IG via Graph API)
//   - hide   : masquer (FB) ; mark handled
//   - handle : marquer comme traité (sans appel externe)
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { safeErrorLog, sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ENC_KEY = Deno.env.get('EMAIL_ENCRYPTION_KEY')!

const statelessAuth = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
}

type SupabaseClientFactory = typeof createClient
type FetchImpl = typeof fetch

type Dependencies = {
  createClient: SupabaseClientFactory
  fetch: FetchImpl
  env: {
    supabaseUrl: string
    serviceRole: string
    anonKey: string
    encryptionKey: string
  }
}

const productionDependencies: Dependencies = {
  createClient,
  // Resolve at request time so the handler can be exercised with a deterministic
  // Graph API mock; production still delegates to the platform fetch implementation.
  fetch: (...args) => globalThis.fetch(...args),
  env: {
    supabaseUrl: SUPABASE_URL,
    serviceRole: SERVICE_ROLE,
    anonKey: ANON_KEY,
    encryptionKey: ENC_KEY,
  },
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function createHandler(deps: Dependencies = productionDependencies) {
  async function decryptToken(admin: SupabaseClient, connectionId: string): Promise<string | null> {
    const { data: sec } = await admin
      .from('social_connection_secrets')
      .select('access_token_enc')
      .eq('connection_id', connectionId)
      .maybeSingle()
    if (!sec?.access_token_enc) return null
    const { data, error } = await admin.rpc('decrypt_social_secret', {
      ciphertext: sec.access_token_enc,
      encryption_key: deps.env.encryptionKey,
    })
    if (error) return null
    return data as string
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, 401)
      }

      // Edge functions are short-lived. Disabling browser-style session persistence and
      // refresh avoids leaked refresh timers while retaining server-side JWT validation.
      const admin = deps.createClient(deps.env.supabaseUrl, deps.env.serviceRole, {
        auth: statelessAuth,
      })
      const sbUser = deps.createClient(deps.env.supabaseUrl, deps.env.anonKey, {
        auth: statelessAuth,
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userRes } = await sbUser.auth.getUser()
      if (!userRes?.user) return json({ error: 'Unauthorized' }, 401)
      const userId = userRes.user.id

      const { data: canPublish } = await admin.rpc('is_social_publisher', {
        _user_id: userId,
      })
      if (!canPublish) return json({ error: 'Forbidden' }, 403)

      const body = await req.json().catch(() => ({}))
      const { comment_id, action, message } = body as {
        comment_id?: string
        action?: 'reply' | 'hide' | 'handle' | 'unhandle'
        message?: string
      }
      if (!comment_id || !action) {
        return json({ error: 'comment_id et action requis' }, 400)
      }

      const { data: comment, error: cErr } = await admin
        .from('social_comments')
        .select('id, brand_id, platform, external_id, post_id')
        .eq('id', comment_id)
        .maybeSingle()
      if (cErr || !comment) {
        return json({ error: 'Commentaire introuvable' }, 404)
      }

      // Handle/unhandle are local operations; do not require or load a social connection.
      let conn: { id: string } | null = null
      if (action === 'reply' || action === 'hide') {
        const { data } = await admin
          .from('social_connections')
          .select('id')
          .eq('brand_id', comment.brand_id)
          .eq('platform', comment.platform)
          .eq('status', 'active')
          .maybeSingle()
        conn = data
      }

      if (action === 'reply') {
        if (!message || message.trim().length === 0) {
          return json({ error: 'message vide' }, 400)
        }
        if (!conn?.id) {
          throw new Error('Aucune connexion active pour cette plateforme')
        }
        const token = await decryptToken(admin, conn.id)
        if (!token) throw new Error('Token indisponible')
        if (comment.platform !== 'facebook' && comment.platform !== 'instagram') {
          throw new Error(`Réponse non supportée pour ${comment.platform}`)
        }

        const res = await deps.fetch(
          `https://graph.facebook.com/v21.0/${comment.external_id}/comments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: token }),
          }
        )
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`Reply failed: ${res.status} ${txt.slice(0, 200)}`)
        }
      }

      if (action === 'hide') {
        if (!conn?.id) throw new Error('Aucune connexion active')
        const token = await decryptToken(admin, conn.id)
        if (!token) throw new Error('Token indisponible')
        if (comment.platform !== 'facebook') {
          throw new Error(`Masquage non supporté pour ${comment.platform}`)
        }
        const res = await deps.fetch(
          `https://graph.facebook.com/v21.0/${comment.external_id}?is_hidden=true&access_token=${encodeURIComponent(
            token
          )}`,
          { method: 'POST' }
        )
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`Hide failed: ${res.status} ${txt.slice(0, 200)}`)
        }
        await admin.from('social_comments').update({ is_hidden: true }).eq('id', comment_id)
      }

      const handled = action !== 'unhandle'
      await admin
        .from('social_comments')
        .update({
          is_handled: handled,
          handled_by: handled ? userId : null,
          handled_at: handled ? new Date().toISOString() : null,
        })
        .eq('id', comment_id)

      return json({ ok: true })
    } catch (e) {
      console.error(JSON.stringify(safeErrorLog('social-comment-reply', e)))
      return json({ error: sanitizeErrorForClient(e) }, 500)
    }
  }
}

export const handler = createHandler()
Deno.serve(handler)
