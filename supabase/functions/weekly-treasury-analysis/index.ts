import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

/**
 * Weekly Treasury Analysis CRON Job
 * Runs every Monday at 8:30 AM to refresh treasury forecasts
 */
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  const providedSecret = req.headers.get('x-function-secret')
  const auth = req.headers.get('authorization') ?? ''
  const isServiceRole = auth === `Bearer ${supabaseServiceKey}`
  if (!isServiceRole && (!internalSecret || providedSecret !== internalSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    console.log('[weekly-treasury-analysis] Démarrage du CRON hebdomadaire Trésorerie')

    // Appeler predict-cashflow pour générer les nouvelles prévisions
    const { data: forecastResult, error: forecastError } = await supabase.functions.invoke(
      'predict-cashflow',
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    )

    if (forecastError) {
      console.error('[weekly-treasury-analysis] Erreur predict-cashflow:', forecastError)
      throw forecastError
    }

    console.log(`[weekly-treasury-analysis] Prévisions générées avec succès`)
    console.log(`[weekly-treasury-analysis] Score santé: ${forecastResult?.resume?.score_sante}%`)
    console.log(`[weekly-treasury-analysis] Fallback: ${forecastResult?.fallback || false}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analyse trésorerie hebdomadaire terminée',
        score_sante: forecastResult?.resume?.score_sante,
        fallback: forecastResult?.fallback,
        solde_actuel: forecastResult?.solde_actuel,
        previsions_count: forecastResult?.previsions?.length || 0,
        alertes_count: forecastResult?.alertes?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('weekly-treasury-analysis', error, corsHeaders, 500)
  }
}

if (import.meta.main) Deno.serve(handler)
