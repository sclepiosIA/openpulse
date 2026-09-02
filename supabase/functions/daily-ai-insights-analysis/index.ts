import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

serve(async (req) => {
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
    console.log('🕐 Starting daily AI insights analysis at 9:00 AM')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Récupérer tous les utilisateurs actifs (qui ont au moins 1 établissement)
    const { data: activeUsers, error: usersError } = await supabase
      .from('etablissements')
      .select('commercial_id, chef_projet_id, csm_id')
      .not('commercial_id', 'is', null)
      .order('commercial_id')
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      throw usersError
    }

    // Dédupliquer les IDs utilisateurs (commercial, chef projet, csm)
    const userIdSet = new Set<string>()
    activeUsers.forEach(e => {
      if (e.commercial_id) userIdSet.add(e.commercial_id)
      if (e.chef_projet_id) userIdSet.add(e.chef_projet_id)
      if (e.csm_id) userIdSet.add(e.csm_id)
    })
    const uniqueUserIds = Array.from(userIdSet)
    
    console.log(`📊 Found ${uniqueUserIds.length} active users to analyze`)

    const analysisTypes = ['trends', 'alerts', 'recommendations', 'anomalies']
    const results = {
      success: [] as string[],
      failed: [] as string[],
      skipped: [] as string[],
      total: uniqueUserIds.length * analysisTypes.length
    }

    // Pour chaque utilisateur, exécuter les 4 analyses
    for (const userId of uniqueUserIds) {
      console.log(`\n👤 Processing user: ${userId}`)
      
      // Récupérer les établissements de l'utilisateur
      const { data: etablissements, error: etabError } = await supabase
        .from('etablissements')
        .select('id, nom, statut, phase, commercial_id, chef_projet_id, csm_id, type_etablissement, nombre_lits, ville, departement')
        .or(`commercial_id.eq.${userId},chef_projet_id.eq.${userId},csm_id.eq.${userId}`)
      
      if (etabError) {
        console.error(`❌ Error fetching etablissements for user ${userId}:`, etabError)
        analysisTypes.forEach(type => results.failed.push(`${userId}:${type}`))
        continue
      }

      if (!etablissements || etablissements.length === 0) {
        console.log(`⚠️  User ${userId}: No etablissements, skipping`)
        analysisTypes.forEach(type => results.skipped.push(`${userId}:${type}`))
        continue
      }

      // Calculer les stats basiques
      const stats = {
        totalEtablissements: etablissements.length,
        prospects: etablissements.filter(e => e.statut === 'Prospect').length,
        enProduction: etablissements.filter(e => e.statut === 'En production').length,
        enDeploiement: etablissements.filter(e => e.statut === 'En déploiement').length,
        pauseCommerciale: etablissements.filter(e => e.statut === 'Pause commerciale').length,
        progressionMoyenne: etablissements.reduce((sum, e) => sum + (e.pourcentage_progression || 0), 0) / etablissements.length
      }

      console.log(`📊 Stats for user ${userId}:`, stats)

      // Lancer les 4 analyses en parallèle
      const analysisPromises = analysisTypes.map(async (analysisType) => {
        try {
          console.log(`🔍 Analyzing ${analysisType} for user ${userId}`)
          
          const { data, error } = await supabase.functions.invoke('analyze-rapports-insights', {
            body: {
              stats,
              etablissements,
              filters: { periodPreset: 'month', includeProspects: true, productionOnly: false },
              analysis_type: analysisType
            }
          })

          if (error) {
            console.error(`❌ Error analyzing ${analysisType} for user ${userId}:`, error)
            results.failed.push(`${userId}:${analysisType}`)
            return
          }

          if (data.success && !data.is_rate_limited) {
            console.log(`✅ ${analysisType} completed for user ${userId} - ${data.insights?.trends?.length || data.insights?.alerts?.length || data.insights?.recommendations?.length || data.insights?.anomalies?.length || 0} insights`)
            results.success.push(`${userId}:${analysisType}`)
          } else if (data.is_rate_limited) {
            console.log(`⏰ ${analysisType} skipped for user ${userId}: ${data.message || 'Rate limited'}`)
            results.skipped.push(`${userId}:${analysisType}`)
          } else {
            console.warn(`⚠️  ${analysisType} failed for user ${userId}: ${data.error || 'Unknown error'}`)
            results.failed.push(`${userId}:${analysisType}`)
          }
        } catch (e) {
          console.error(`❌ Exception analyzing ${analysisType} for user ${userId}:`, e)
          results.failed.push(`${userId}:${analysisType}`)
        }
      })

      await Promise.allSettled(analysisPromises)
      
      // Pause de 2s entre chaque utilisateur pour éviter le rate limit Azure
      await new Promise(r => setTimeout(r, 2000))
    }

    console.log('\n✅ Daily AI insights analysis completed')
    console.log(`📊 Results: ${results.success.length} succeeded, ${results.skipped.length} skipped, ${results.failed.length} failed out of ${results.total} total`)

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          total: results.total,
          succeeded: results.success.length,
          skipped: results.skipped.length,
          failed: results.failed.length
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    return buildErrorResponse('daily-ai-insights-analysis', error, corsHeaders, 500)
  }
})
