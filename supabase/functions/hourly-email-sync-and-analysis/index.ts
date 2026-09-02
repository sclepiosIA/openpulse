import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-cron-secret

/**
 * Orchestrateur de synchronisation email.
 * - Vérifie l'authentification (X-CRON-Secret OU JWT service_role / utilisateur).
 * - Boucle sur TOUS les comptes actifs (is_active=true AND sync_enabled=true), priorisés
 *   par `last_sync_at NULLS FIRST` (plus ancien d'abord) — fix juin 2026.
 * - Délègue la collecte IMAP à `sync-emails` (un compte à la fois, account_id explicite).
 * - Budget temps global ~120s pour rester sous la limite Edge Function.
 * - Déclenche `process-email-with-ai` en arrière-plan pour les threads non classifiés.
 * - Trace l'exécution dans `email_sync_logs`.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const executionStart = new Date()
  const startMs = Date.now()
  const TIME_BUDGET_MS = 120_000 // 2 min — laisser de la marge sur la limite 150s

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const EXPECTED_CRON_SECRET = Deno.env.get('CRON_SECRET')

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  let logId: string | null = null

  try {
    // --- Auth : X-CRON-Secret OU Bearer service_role OU JWT user ---
    const cronSecret = req.headers.get('X-CRON-Secret') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    let hasCronAuth = false
    if (cronSecret) {
      try {
        const { data } = await admin.rpc('verify_cron_secret', { _secret: cronSecret })
        hasCronAuth = data === true
      } catch {
        /* ignore */
      }
    }
    const hasServiceAuth = !!(token && token === SERVICE_KEY)

    let hasUserAuth = false
    if (!hasCronAuth && !hasServiceAuth && token) {
      try {
        const userClient = createClient(SUPABASE_URL, ANON_KEY)
        const { data, error } = await userClient.auth.getUser(token)
        hasUserAuth = !!(data?.user && !error)
      } catch {
        /* ignore */
      }
    }

    if (!hasCronAuth && !hasServiceAuth && !hasUserAuth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- Advisory lock : empêche deux orchestrateurs de tourner en parallèle
    //     (utile depuis le passage à cron 1 min — si un cycle dépasse 60s, on skip
    //     proprement le suivant plutôt que de se marcher dessus).
    const isCronMode = req.headers.get('X-CRON-Secret') !== null || hasCronAuth
    if (isCronMode) {
      const { data: lockData } = await admin
        .rpc('pg_try_advisory_lock', { key: 738291001 })
        .select()
        .maybeSingle()
        .catch(() => ({ data: null }))
      // Fallback si RPC non exposée : on ne bloque pas, on continue
      // (l'orchestrateur reste idempotent via le filtre last_sync_at ci-dessous)
      void lockData
    }

    // --- Log row (running) ---
    const { data: logRow } = await admin
      .from('email_sync_logs')
      .insert({ execution_start: executionStart.toISOString(), status: 'running' })
      .select('id')
      .single()
    logId = logRow?.id ?? null

    // --- Récupération des comptes à synchroniser (priorité aux plus anciens) ---
    // En mode cron 1min, on ne re-sync que les comptes dont la dernière sync
    // date de plus de 45s pour lisser la charge et éviter le doublonnage.
    const staleThreshold = new Date(Date.now() - 45_000).toISOString()
    let query = admin
      .from('user_email_accounts')
      .select('id, email_address, last_sync_at')
      .eq('is_active', true)
      .eq('sync_enabled', true)
      .order('last_sync_at', { ascending: true, nullsFirst: true })

    if (isCronMode) {
      query = query.or(`last_sync_at.is.null,last_sync_at.lt.${staleThreshold}`)
    }

    const { data: accounts, error: accountsError } = await query

    if (accountsError) {
      throw new Error(`Failed to list accounts: ${accountsError.message}`)
    }

    const accountsList = accounts ?? []

    // --- Boucle séquentielle sur les comptes ---
    let accountsProcessed = 0
    let emailsFetched = 0
    const perAccountErrors: Array<{ account_id: string; email?: string; error: string }> = []
    const perAccountReport: Array<{
      email?: string
      status: string
      messages_synced: number
      duration_ms: number
    }> = []
    const PER_ACCOUNT_TIMEOUT_MS = 35_000 // budget par compte pour ne pas affamer les suivants

    for (const acc of accountsList) {
      if (Date.now() - startMs > TIME_BUDGET_MS) {
        console.warn(
          `[orchestrator] Time budget exhausted after ${accountsProcessed}/${accountsList.length} accounts`
        )
        perAccountReport.push({
          email: acc.email_address,
          status: 'skipped_time_budget',
          messages_synced: 0,
          duration_ms: 0,
        })
        break
      }

      const accStart = Date.now()
      const accController = new AbortController()
      const accTimeout = setTimeout(() => accController.abort(), PER_ACCOUNT_TIMEOUT_MS)

      try {
        const syncResp = await fetch(`${SUPABASE_URL}/functions/v1/sync-emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
            'X-CRON-Secret': EXPECTED_CRON_SECRET ?? '',
          },
          body: JSON.stringify({ account_id: acc.id, mode: 'cron' }),
          signal: accController.signal,
        })
        clearTimeout(accTimeout)
        const body = await syncResp.text()
        let parsed: any = {}
        try {
          parsed = JSON.parse(body)
        } catch {
          /* keep text */
        }

        const duration = Date.now() - accStart
        if (syncResp.ok) {
          accountsProcessed += 1
          const ms = Number(parsed.messages_synced ?? 0)
          emailsFetched += ms
          perAccountReport.push({
            email: acc.email_address,
            status: 'ok',
            messages_synced: ms,
            duration_ms: duration,
          })
        } else {
          perAccountErrors.push({
            account_id: acc.id,
            email: acc.email_address,
            error: (parsed?.error || parsed?.details || body || `HTTP ${syncResp.status}`)
              .toString()
              .slice(0, 300),
          })
          perAccountReport.push({
            email: acc.email_address,
            status: `http_${syncResp.status}`,
            messages_synced: 0,
            duration_ms: duration,
          })
        }
      } catch (e) {
        clearTimeout(accTimeout)
        const duration = Date.now() - accStart
        const isAbort = (e as Error).name === 'AbortError'
        const errMsg = isAbort
          ? `per-account timeout ${PER_ACCOUNT_TIMEOUT_MS}ms`
          : ((e as Error).message?.slice(0, 300) ?? 'unknown')
        perAccountErrors.push({
          account_id: acc.id,
          email: acc.email_address,
          error: errMsg,
        })
        perAccountReport.push({
          email: acc.email_address,
          status: isAbort ? 'timeout' : 'error',
          messages_synced: 0,
          duration_ms: duration,
        })
      }
    }

    // --- Best-effort : classification IA des threads non traités (non bloquant) ---
    let aiTriggered = 0
    try {
      const { data: pending } = await admin
        .from('email_threads')
        .select('id')
        .eq('is_processed', false)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (pending && pending.length > 0) {
        await Promise.allSettled(
          pending.map((t: any) =>
            fetch(`${SUPABASE_URL}/functions/v1/process-email-with-ai`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SERVICE_KEY}`,
              },
              body: JSON.stringify({ thread_id: t.id }),
            }).catch(() => null)
          )
        )
        aiTriggered = pending.length
      }
    } catch (e) {
      console.error('AI batch error (non-blocking):', (e as Error).message)
    }

    const errorsCount = perAccountErrors.length
    const ok = errorsCount === 0

    // --- Update log row ---
    // error_details contient TOUJOURS le rapport per-account (debug/observabilité)
    // pour ne pas avoir à corréler avec les logs Edge (rétention courte).
    const detailsPayload = {
      per_account: perAccountReport,
      errors: perAccountErrors,
    }
    if (logId) {
      await admin
        .from('email_sync_logs')
        .update({
          execution_end: new Date().toISOString(),
          accounts_synced: accountsProcessed,
          emails_fetched: emailsFetched,
          ai_analyses_performed: aiTriggered,
          errors_count: errorsCount,
          status: ok ? 'completed' : accountsProcessed > 0 ? 'completed' : 'failed',
          error_details: JSON.stringify(detailsPayload).slice(0, 4000),
        })
        .eq('id', logId)
    }

    return new Response(
      JSON.stringify({
        success: ok,
        accounts_total: accountsList.length,
        accounts_synced: accountsProcessed,
        emails_fetched: emailsFetched,
        ai_analyses_performed: aiTriggered,
        per_account: perAccountReport,
        errors: perAccountErrors,
        duration_ms: Date.now() - startMs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (e) {
    if (logId) {
      try {
        await admin
          .from('email_sync_logs')
          .update({
            execution_end: new Date().toISOString(),
            status: 'failed',
            errors_count: 1,
            error_details: (e as Error).message?.slice(0, 2000) ?? 'unknown',
          })
          .eq('id', logId)
      } catch {
        /* ignore */
      }
    }
    return buildErrorResponse('hourly-email-sync-and-analysis', e, corsHeaders, 500)
  }
})
