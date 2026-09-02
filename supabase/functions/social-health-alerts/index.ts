// Edge Function: social-health-alerts
// CRON quotidien (ou ad hoc) : détecte les échecs de synchro / publication / connexions
// sur les dernières 24h et envoie une notification interne aux admins/direction.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorLog, sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const noSessionPersistence = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  // CRON or admin call only
  const isCron = CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET
  let admin: ReturnType<typeof createClient> | undefined

  try {
    if (!isCron) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }
      const sbUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        ...noSessionPersistence,
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userRes } = await sbUser.auth.getUser()
      if (!userRes?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }
      admin = createClient(SUPABASE_URL, SERVICE_ROLE, noSessionPersistence)
      const { data: isAdmin } = await admin.rpc('is_social_admin', {
        _user_id: userRes.user.id,
      })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        })
      }
    }
    admin ??= createClient(SUPABASE_URL, SERVICE_ROLE, noSessionPersistence)

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const reasons: string[] = []

    // 1. Connexions en erreur
    const { data: brokenConns } = await admin
      .from('social_connections')
      .select('id, platform, brand_id, last_error')
      .eq('status', 'error')
    if ((brokenConns?.length ?? 0) > 0) {
      reasons.push(`${brokenConns!.length} connexion(s) sociale(s) en erreur`)
    }

    // 2. Échecs sync sur 24h
    const { count: failedSyncs } = await admin
      .from('social_sync_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('started_at', since)
    if ((failedSyncs ?? 0) > 0) {
      reasons.push(`${failedSyncs} échec(s) de synchronisation (24h)`)
    }

    // 3. Échecs publication
    const { count: failedPosts } = await admin
      .from('social_scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', since)
    if ((failedPosts ?? 0) > 0) {
      reasons.push(`${failedPosts} post(s) planifié(s) en échec (24h)`)
    }

    if (reasons.length === 0) {
      return new Response(JSON.stringify({ ok: true, triggered: false }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }

    // Récipiendaires : admin + direction
    const { data: admins } = await admin
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'direction'])
    const userIds = Array.from(
      new Set(
        (admins ?? []).flatMap(({ user_id }) => (typeof user_id === 'string' ? [user_id] : []))
      )
    )
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, triggered: false, note: 'no recipients' }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }

    const message = `⚠️ Santé Réseaux sociaux : ${reasons.join(' · ')}`
    const rows = userIds.map((uid) => ({
      user_id: uid,
      type: 'social_health_alert',
      title: 'Alerte Réseaux sociaux',
      message,
      link: '/parametres/social',
      is_read: false,
    }))
    await admin.from('notifications').insert(rows)

    return new Response(
      JSON.stringify({
        ok: true,
        triggered: true,
        reasons,
        recipients: userIds.length,
      }),
      {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      }
    )
  } catch (e) {
    console.error(JSON.stringify(safeErrorLog('social-health-alerts', e)))
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(e) }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    })
  }
}

Deno.serve(handler)
