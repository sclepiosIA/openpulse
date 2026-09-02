/**
 * Cron quotidien : recalcule les scores comportementaux + crée les snapshots
 * dans prospect_score_history pour graph d'évolution.
 *
 * Lancé tous les jours à 02:00 (Paris) via pg_cron.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  const providedSecret = req.headers.get('x-function-secret')
  const authHeader = req.headers.get('authorization') || ''
  const isInternal = !!internalSecret && providedSecret === internalSecret
  const isServiceRole = !!SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`
  if (!isInternal && !isServiceRole) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    // This is a request-scoped service client, not a browser session. Avoid
    // refresh scheduling that otherwise survives an Edge Function request.
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const startedAt = Date.now()
  let processed = 0
  let errors = 0
  let snapshots = 0

  try {
    // Récupère tous les prospects + comptes contractuels (300 max par run)
    const { data: etabs, error: e1 } = await supabase
      .from('etablissements')
      .select('id, score_conversion')
      .or(
        'statut_relation.eq.prospect,statut_relation.eq.contractuel,statut_etablissement.eq.prospect'
      )
      .limit(500)

    if (e1) throw e1

    for (const etab of etabs ?? []) {
      try {
        // 1. Calcul du score comportemental (RPC)
        const { data: bhScore, error: e2 } = await supabase.rpc('compute_behavioral_score', {
          _etablissement_id: etab.id,
        })
        if (e2) {
          errors++
          continue
        }

        const behavioral_score = (bhScore as any)?.behavioral_score ?? 0
        const engagement_velocity = (bhScore as any)?.engagement_velocity ?? 0

        // 2. Calcul attribution
        const { data: attr } = await supabase.rpc('compute_attribution', {
          _etablissement_id: etab.id,
          _model: 'time_decay',
        })

        // 3. MAJ etablissements
        const staticScore = Math.max(
          0,
          Math.min(50, Math.round((etab.score_conversion ?? 0) * 0.5))
        )
        const totalScore = Math.min(100, staticScore + behavioral_score)

        await supabase
          .from('etablissements')
          .update({
            behavioral_score,
            engagement_velocity,
            attribution_summary: attr ?? {},
          })
          .eq('id', etab.id)

        // 4. Snapshot dans l'historique (1 par jour)
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)

        const { error: e3 } = await supabase.from('prospect_score_history').insert({
          etablissement_id: etab.id,
          score: totalScore,
          static_score: staticScore,
          behavioral_score,
          engagement_velocity,
          computed_at: today.toISOString(),
        })

        if (!e3) snapshots++
        processed++
      } catch (err) {
        console.error('[recompute] etab', etab.id, err)
        errors++
      }
    }

    const duration = Date.now() - startedAt
    return new Response(
      JSON.stringify({ success: true, processed, snapshots, errors, duration_ms: duration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    return buildErrorResponse('recompute-prospect-scores', err, corsHeaders, 500)
  }
})
