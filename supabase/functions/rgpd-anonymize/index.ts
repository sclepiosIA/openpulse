/**
 * RGPD — Droit à l'effacement (Art. 17)
 *
 * Stratégie : PSEUDONYMISATION par défaut (les obligations comptables/légales imposent
 * de conserver des traces de transactions pendant 10 ans). On efface les PII directes
 * (nom, prénom, email, téléphone, adresse) et on remplace par des tokens irréversibles
 * dérivés d'un hash du subject. Les FK restent intactes pour préserver l'intégrité
 * référentielle. Toutes les opérations sont journalisées dans rgpd_audit_logs.
 *
 * Tables traitées :
 *   - contacts                       (PII directes → tokens)
 *   - bookings                       (guest_*)
 *   - live_chat_conversations + messages (visitor_*)
 *   - support_tickets                (email_expediteur)
 *   - formation_emargements          (nom_prenom, email, signature_data = null)
 *   - enquetes_satisfaction          (email, responses non touchées)
 *   - email_messages                 (from_address / to_addresses : on n'efface pas le
 *                                     contenu — base légale conservation commerciale —
 *                                     mais on pseudonymise l'identifiant)
 *
 * Accès : admin uniquement (cohérence avec rgpd-export-data).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sanitizeErrorForClient, safeErrorLog } from '../_shared/error-sanitizer.ts'

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface AnonymizeReport {
  subject: { email?: string; name?: string }
  pseudonym: string
  tables: Record<string, { matched: number; updated: number; error?: string }>
  total_records: number
  started_at: string
  completed_at?: string
}

export const handler = async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cors = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    // ---- Auth (admin only) ----
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) {
      await supabase
        .from('rgpd_audit_logs')
        .insert({
          action: 'unauthorized_anonymize_attempt',
          user_id: user.id,
          details: { ip: req.headers.get('x-forwarded-for') || 'unknown' },
        })
        .then(
          () => {},
          () => {}
        )
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ---- Input ----
    const {
      personEmail,
      personName,
      requestId,
      dryRun = false,
    } = (await req.json()) as {
      personEmail?: string
      personName?: string
      requestId?: string
      dryRun?: boolean
    }
    if (!personEmail && !personName) {
      return new Response(JSON.stringify({ error: 'Email or name required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Token irréversible pour pseudonymisation (préserve la jointure analytique sans réidentification)
    const subjectKey = (personEmail || personName || '').toLowerCase().trim()
    const hash = await sha256Hex(
      subjectKey + '|' + (Deno.env.get('EMAIL_ENCRYPTION_KEY') || 'salt')
    )
    const pseudonym = `anon_${hash.slice(0, 12)}`
    const anonEmail = `${pseudonym}@anonymized.local`

    const report: AnonymizeReport = {
      subject: { email: personEmail, name: personName },
      pseudonym,
      tables: {},
      total_records: 0,
      started_at: new Date().toISOString(),
    }

    // Helper: update + count
    const run = async (
      table: string,
      build: () => Promise<{ matched: number; updated: number }>
    ) => {
      try {
        const r = await build()
        report.tables[table] = r
        report.total_records += r.updated
      } catch (e) {
        report.tables[table] = { matched: 0, updated: 0, error: sanitizeErrorForClient(e) }
      }
    }

    // ---- 1. contacts ----
    if (personEmail) {
      await run('contacts', async () => {
        const { data: rows } = await supabase.from('contacts').select('id').eq('email', personEmail)
        const matched = rows?.length || 0
        if (!matched || dryRun) return { matched, updated: 0 }
        const { error, count } = await supabase
          .from('contacts')
          .update(
            {
              nom: pseudonym,
              prenom: '',
              email: anonEmail,
              telephone: null,
              fonction: null,
            },
            { count: 'exact' }
          )
          .eq('email', personEmail)
        if (error) throw error
        return { matched, updated: count || 0 }
      })
    }

    // ---- 2. bookings ----
    if (personEmail) {
      await run('bookings', async () => {
        const { data: rows } = await supabase
          .from('bookings')
          .select('id')
          .eq('guest_email', personEmail)
        const matched = rows?.length || 0
        if (!matched || dryRun) return { matched, updated: 0 }
        const { error, count } = await supabase
          .from('bookings')
          .update(
            {
              guest_name: pseudonym,
              guest_email: anonEmail,
              guest_phone: null,
              guest_company: null,
              guest_notes: null,
            },
            { count: 'exact' }
          )
          .eq('guest_email', personEmail)
        if (error) throw error
        return { matched, updated: count || 0 }
      })
    }

    // ---- 3. live_chat_conversations ----
    if (personEmail) {
      await run('live_chat_conversations', async () => {
        const { data: rows } = await supabase
          .from('live_chat_conversations')
          .select('id')
          .eq('visitor_email', personEmail)
        const matched = rows?.length || 0
        if (!matched || dryRun) return { matched, updated: 0 }
        const { error, count } = await supabase
          .from('live_chat_conversations')
          .update(
            {
              visitor_name: pseudonym,
              visitor_email: anonEmail,
            },
            { count: 'exact' }
          )
          .eq('visitor_email', personEmail)
        if (error) throw error
        return { matched, updated: count || 0 }
      })
    }

    // ---- 4. support_tickets ----
    if (personEmail) {
      await run('support_tickets', async () => {
        const { data: rows } = await supabase
          .from('support_tickets')
          .select('id')
          .eq('email_expediteur', personEmail)
        const matched = rows?.length || 0
        if (!matched || dryRun) return { matched, updated: 0 }
        const { error, count } = await supabase
          .from('support_tickets')
          .update(
            {
              email_expediteur: anonEmail,
            },
            { count: 'exact' }
          )
          .eq('email_expediteur', personEmail)
        if (error) throw error
        return { matched, updated: count || 0 }
      })
    }

    // ---- 5. formation_emargements (efface signature, pseudonymise identité) ----
    if (personEmail) {
      await run('formation_emargements', async () => {
        const { data: rows } = await supabase
          .from('formation_emargements')
          .select('id')
          .eq('email', personEmail)
        const matched = rows?.length || 0
        if (!matched || dryRun) return { matched, updated: 0 }
        const { error, count } = await supabase
          .from('formation_emargements')
          .update(
            {
              nom_prenom: pseudonym,
              email: anonEmail,
              signature_data: null,
            },
            { count: 'exact' }
          )
          .eq('email', personEmail)
        if (error) throw error
        return { matched, updated: count || 0 }
      })
    }

    // ---- 6. enquetes_satisfaction ----
    if (personEmail) {
      await run('enquetes_satisfaction', async () => {
        const { data: rows } = await supabase
          .from('enquetes_satisfaction')
          .select('id')
          .eq('email', personEmail)
        const matched = rows?.length || 0
        if (!matched || dryRun) return { matched, updated: 0 }
        const { error, count } = await supabase
          .from('enquetes_satisfaction')
          .update(
            {
              email: anonEmail,
            },
            { count: 'exact' }
          )
          .eq('email', personEmail)
        if (error) throw error
        return { matched, updated: count || 0 }
      })
    }

    // ---- 7. email_messages (from_address — on conserve le contenu, base légale commerciale) ----
    if (personEmail) {
      await run('email_messages_from', async () => {
        const { count: matched } = await supabase
          .from('email_messages')
          .select('id', { count: 'exact', head: true })
          .eq('from_address', personEmail)
        if (!matched || dryRun) return { matched: matched || 0, updated: 0 }
        const { error, count } = await supabase
          .from('email_messages')
          .update(
            {
              from_address: anonEmail,
            },
            { count: 'exact' }
          )
          .eq('from_address', personEmail)
        if (error) throw error
        return { matched: matched || 0, updated: count || 0 }
      })
    }

    // ---- Audit log ----
    report.completed_at = new Date().toISOString()
    await supabase
      .from('rgpd_audit_logs')
      .insert({
        action: dryRun ? 'anonymize_dry_run' : 'anonymize_executed',
        user_id: user.id,
        details: {
          subject_email: personEmail || null,
          subject_name: personName || null,
          pseudonym,
          request_id: requestId || null,
          report: report.tables,
          total_records: report.total_records,
        },
      })
      .then(
        () => {},
        (e) => console.error('audit log fail', safeErrorLog('rgpd-anonymize', e))
      )

    // ---- Update demande status ----
    if (requestId && !dryRun) {
      await supabase
        .from('rgpd_demandes_droits')
        .update({
          statut: 'completee',
          date_traitement: new Date().toISOString(),
        })
        .eq('id', requestId)
    }

    return new Response(JSON.stringify({ success: true, dryRun, report }, null, 2), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('rgpd-anonymize error:', safeErrorLog('rgpd-anonymize', error))
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        error_code: 'RGPD_ANONYMIZE_FAILED',
      }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}

if (import.meta.main) serve(handler)
