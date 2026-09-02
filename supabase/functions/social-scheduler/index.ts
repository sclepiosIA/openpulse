// Edge Function: social-scheduler
// CRON */1min — sélectionne les social_scheduled_posts dont scheduled_at <= now() et status='scheduled'.
// Pour chacun, appelle social-publish (en interne) avec scheduled_id.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorLog, sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

export type SchedulerDependencies = {
  createClient: typeof createClient
  /** Resolve fetch at request time so tests can inject a deterministic publisher. */
  fetch: typeof fetch
}

const productionDependencies: SchedulerDependencies = {
  createClient,
  fetch: (...args) => globalThis.fetch(...args),
}

export function createHandler(deps: SchedulerDependencies = productionDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })

    const provided = req.headers.get('x-cron-secret') ?? ''
    const eq = (a: string, b: string) => {
      if (!a || !b || a.length !== b.length) return false
      let d = 0
      for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
      return d === 0
    }
    if (!eq(provided, CRON_SECRET)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }

    const admin = deps.createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { fetch: deps.fetch },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    try {
      const { data: due, error } = await admin
        .from('social_scheduled_posts')
        .select('id')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())
        .limit(20)
      if (error) throw error

      const results: Array<Record<string, unknown>> = []
      for (const row of due || []) {
        try {
          const r = await deps.fetch(`${SUPABASE_URL}/functions/v1/social-publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
            body: JSON.stringify({ scheduled_id: row.id }),
          })
          const j = await r.json()
          results.push({ id: row.id, ok: r.ok, ...j })
        } catch (e) {
          results.push({
            id: row.id,
            ok: false,
            error: (e instanceof Error ? e.message : '').slice(0, 300),
          })
        }
      }

      return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    } catch (e) {
      console.error(JSON.stringify(safeErrorLog('social-scheduler', e)))
      return new Response(JSON.stringify({ error: sanitizeErrorForClient(e) }), {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      })
    }
  }
}

export const handler = createHandler()

Deno.serve(handler)
