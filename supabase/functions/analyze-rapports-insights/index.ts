import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface InsightRequest {
  stats: any
  etablissements: any[]
  filters: any
  analysis_type: 'trends' | 'anomalies' | 'recommendations' | 'alerts' | 'all'
  force?: boolean
}

const SYSTEM_PROMPTS = {
  trends: `Tu es un analyste data expert en CRM de santé. 
Analyse les statistiques et identifie les 3-5 tendances les plus significatives.
Pour chaque tendance, fournis :
- Un titre court (max 10 mots)
- Une description détaillée avec chiffres clés
- L'impact (positif/négatif/neutre)
- Une recommandation d'action

Réponds en JSON avec cette structure exacte :
{
  "trends": [
    {
      "title": "string",
      "description": "string",
      "impact": "positive" | "negative" | "neutral",
      "recommendation": "string"
    }
  ]
}`,

  anomalies: `Tu es un data scientist spécialisé en détection d'anomalies.
Analyse les établissements et identifie les valeurs aberrantes :
- Progressions anormales (>50% ou <-30% vs moyenne)
- Retards critiques (>30j sur objectif)
- Valeurs atypiques (écart significatif)

Pour chaque anomalie :
- Nom de l'établissement concerné
- Type d'anomalie détecté
- Sévérité (critical/high/medium)
- Explication détaillée
- Action recommandée

Réponds en JSON avec cette structure exacte :
{
  "anomalies": [
    {
      "etablissement": "string",
      "type": "string",
      "severity": "critical" | "high" | "medium",
      "explanation": "string",
      "action": "string"
    }
  ]
}`,

  recommendations: `Tu es un consultant CRM expert.
Analyse les données et génère 5-8 recommandations actionnables :
- Prospects à relancer (inactifs >60j)
- Opportunités de croissance (upsell, cross-sell)
- Optimisations process
- Actions commerciales prioritaires

Pour chaque recommandation :
- Titre court
- Description détaillée
- Priorité (high/medium/low)
- Impact estimé (chiffré si possible)
- Actions concrètes (liste de 2-4 actions)

Réponds en JSON avec cette structure exacte :
{
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "high" | "medium" | "low",
      "estimatedImpact": "string",
      "actions": ["string"]
    }
  ]
}`,

  alerts: `Tu es un système d'alerte intelligent.
Détecte les situations critiques nécessitant une action immédiate :
- Prospects inactifs >90j avec forte valeur
- Déploiements bloqués >30j
- Objectifs mensuels/trimestriels en danger (<80%)
- Commerciaux sous-performants

Pour chaque alerte :
- Titre urgent
- Sévérité (critical/warning/info)
- Description du problème
- Impact business (chiffré)
- Actions correctives (liste ordonnée par priorité)

Réponds en JSON avec cette structure exacte :
{
  "alerts": [
    {
      "title": "string",
      "severity": "critical" | "warning" | "info",
      "description": "string",
      "businessImpact": "string",
      "actions": ["string"]
    }
  ]
}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { stats, etablissements, filters, analysis_type, force = false }: InsightRequest = await req.json()

    // Récupérer l'utilisateur depuis le JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  // Rate limit : vérifier dernière analyse RÉUSSIE avec insights_data non-null (limitation 24h)
  // Bypass si force=true (refresh manuel)
  if (!force) {
    const { data: lastSuccessfulAnalysis } = await supabase
      .from('ai_analysis_log')
      .select('created_at, has_insights, insights_count')
      .eq('user_id', user.id)
      .eq('analysis_type', analysis_type)
      .eq('has_insights', true)
      .not('insights_data', 'is', null)  // ✅ Seulement les analyses avec insights valides
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSuccessfulAnalysis) {
      const hoursSinceLastAnalysis = (Date.now() - new Date(lastSuccessfulAnalysis.created_at).getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceLastAnalysis < 24) {
        const hoursLeft = Math.ceil(24 - hoursSinceLastAnalysis)
        return new Response(
          JSON.stringify({
            success: true,
            is_rate_limited: true,
            hours_left: hoursLeft,
            nextAvailableAt: new Date(new Date(lastSuccessfulAnalysis.created_at).getTime() + 24 * 60 * 60 * 1000),
            message: `Analyse déjà effectuée. Prochaine analyse disponible dans ${hoursLeft}h`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
  }

    console.log(`🔍 Analyzing insights: ${analysis_type}`, {
      statsCount: Object.keys(stats || {}).length,
      etablissementsCount: etablissements?.length || 0
    })

    const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
    const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI configuration missing')
    }

    // Préparer le prompt utilisateur avec les données
    const userPrompt = `
Voici les données à analyser :

STATISTIQUES GLOBALES :
- Total établissements : ${stats.totalEtablissements}
- Prospects : ${stats.prospects}
- En production : ${stats.enProduction}
- En déploiement : ${stats.enDeploiement}
- CA réalisé : ${stats.caRealise} €
- CA prévisionnel : ${stats.caPrevisionnel} €
- Taux de conversion : ${stats.tauxConversion}%
- Pipeline value : ${stats.pipelineValue} €
- Total passages urgences : ${stats.totalPassages}
- Taux de réalisation tâches : ${stats.totalTaches > 0 ? Math.round((stats.tachesTerminees / stats.totalTaches) * 100) : 0}%

ÉTABLISSEMENTS (échantillon de ${Math.min(etablissements.length, 20)} sur ${etablissements.length}) :
${etablissements.slice(0, 20).map((e: any) => `
- ${e.nom} (${e.statut})
  Région: ${e.region || 'N/A'}, Type offre: ${e.type_offre || 'N/A'}
  Progression: ${e.progression || 0}%
  Commercial: ${e.commercial_id ? 'Assigné' : 'Non assigné'}
`).join('\n')}

FILTRES ACTIFS :
- Période : ${filters.periodPreset}
- Prospects inclus : ${filters.includeProspects ? 'Oui' : 'Non'}
- Production seulement : ${filters.productionOnly ? 'Oui' : 'Non'}

Analyse maintenant selon le type d'analyse demandé et fournis des insights pertinents et actionnables.
`

    // ✅ PATTERN SIMPLIFIÉ AZURE GPT-5 (validé en production)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90s timeout
    
    const startTime = Date.now()
    let azureResponse: Response
    
    try {
      console.log('🚀 Starting Azure GPT-5 call...')
      
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPTS[analysis_type === 'all' ? 'trends' : analysis_type] },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 3000,
          reasoning_effort: "low",
          verbosity: "low",
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      console.log(`✅ Azure response received in ${Date.now() - startTime}ms`)
      
      // Retry on rate limit
      if (azureResponse.status === 429) {
        console.warn('⚠️ Azure rate limited, backing off 1s and retrying...')
        await new Promise(r => setTimeout(r, 1000))
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: SYSTEM_PROMPTS[analysis_type === 'all' ? 'trends' : analysis_type] },
              { role: 'user', content: userPrompt }
            ],
            max_completion_tokens: 3000,
            reasoning_effort: "low",
            verbosity: "low",
            response_format: { type: "json_object" }
          })
        })
      }
      
    } catch (e: any) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        console.error('❌ Azure request timeout (90s)')
        throw new Error('Azure request timeout (90s)')
      }
      console.error('❌ Azure call failed:', e)
      throw new Error('Azure request failed')
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text()
      console.error('❌ Azure OpenAI error:', azureResponse.status, errorText)
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`)
    }

    const azureData = await azureResponse.json()
    const processingDuration = Date.now() - startTime
    
    // ✅ EXTRACTION SIMPLE DU CONTENU
    const content = azureData.choices?.[0]?.message?.content
    
    if (!content || typeof content !== 'string') {
      console.error('❌ Unexpected response format:', JSON.stringify(azureData, null, 2))
      throw new Error('No content in Azure response')
    }
    
    console.log('✅ Content extracted, length:', content.length)

    // Normalize JSON string (strip code fences if any)
    let contentStr = content.trim()
    if (contentStr.startsWith('```')) {
      contentStr = contentStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    }

    // ✅ PARSE JSON SIMPLE
    let insights: any
    try {
      insights = JSON.parse(contentStr)
    } catch (e) {
      console.error('❌ Failed to parse AI JSON. Raw content:', contentStr)
      throw new Error('Invalid JSON returned by Azure model')
    }

    const usage = extractUsage(azureData)
    console.log('📊 Token usage:', usage)
    console.log('✅ Insights generated successfully:', analysis_type)

    // Compter les insights retournés
    const insightsCount = 
      (insights.trends?.length || 0) +
      (insights.alerts?.length || 0) +
      (insights.recommendations?.length || 0) +
      (insights.anomalies?.length || 0)

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'rapports_insights',
      model_used: 'gpt-5',
      ...usage,
      processing_duration_ms: processingDuration,
      success: true,
      result: { insights_count: insightsCount, analysis_type },
    });

    // ✅ Upsert les insights complets en base de données (écrase l'ancien)
    const { error: upsertError } = await supabase
      .from('ai_analysis_log')
      .upsert({
        user_id: user.id,
        analysis_type: analysis_type,
        filters: filters,
        has_insights: insightsCount > 0,
        insights_count: insightsCount,
        insights_data: insights,  // ✅ Stocker les insights complets en JSONB
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,analysis_type'  // ✅ Clé unique définie dans la contrainte
      })

    if (upsertError) {
      console.error('❌ Error upserting insights to database:', upsertError)
      // Non-bloquant - on retourne quand même les insights
    } else {
      console.log(`✅ Insights upserted to database: ${insightsCount} insights for ${analysis_type}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        insights,
        analysis_type,
        timestamp: new Date().toISOString(),
        processing_duration_ms: processingDuration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    return buildErrorResponse('analyze-rapports-insights', error, corsHeaders, 500)
  }
})
