import { createClient } from '@supabase/supabase-js'

interface AILogEntry {
  processing_type: string
  model_used?: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  processing_duration_ms?: number
  success: boolean
  error_message?: string
  result?: unknown
  confidence_score?: number
  // Contexte optionnel
  email_thread_id?: string
  context_id?: string
  context_type?: string
  processed_by?: string
}

/**
 * Grille tarifaire par modèle (coût pour 1 token)
 * Mise à jour: Février 2026
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // GPT-5 standard (Azure)
  'gpt-5': { input: 0.00001, output: 0.00003 }, // $10/$30 per 1M tokens
  // GPT-5.2 (Azure Responses API)
  'gpt-5.2': { input: 0.000015, output: 0.00006 }, // $15/$60 per 1M tokens
  // GPT-5 Mini
  'gpt-5-mini': { input: 0.0000015, output: 0.000006 }, // $1.50/$6 per 1M tokens
  // GPT-5 Vision
  'gpt-5-vision': { input: 0.00001, output: 0.00003 },
  // Fallback for unknown models
  default: { input: 0.00001, output: 0.00003 },
}

/**
 * Calcule le coût estimé d'un appel IA en USD
 */
export function calculateCost(
  model: string,
  promptTokens?: number,
  completionTokens?: number
): number {
  // Normalize model name for lookup
  const modelLower = (model || '').toLowerCase()
  let pricing = MODEL_PRICING['default']

  for (const [key, p] of Object.entries(MODEL_PRICING)) {
    if (key !== 'default' && modelLower.includes(key)) {
      pricing = p
      break
    }
  }

  const inputCost = (promptTokens || 0) * pricing.input
  const outputCost = (completionTokens || 0) * pricing.output
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000 // 6 decimal precision
}

/**
 * Log un appel IA dans la table ai_processing_log
 * Calcule automatiquement le coût estimé
 * Ne fait jamais échouer la fonction appelante si le logging échoue
 */
export async function logAICall(entry: AILogEntry): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[AI Logging] Missing Supabase credentials, skipping log')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        // Service-role Edge Function clients never need browser-session refreshes.
        // Disabling them prevents a persistent timer per AI log invocation.
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const estimatedCost = calculateCost(
      entry.model_used || 'gpt-5',
      entry.prompt_tokens,
      entry.completion_tokens
    )

    const { error } = await supabase.from('ai_processing_log').insert({
      processing_type: entry.processing_type,
      model_used: entry.model_used || 'gpt-5',
      prompt_tokens: entry.prompt_tokens,
      completion_tokens: entry.completion_tokens,
      total_tokens: entry.total_tokens,
      processing_duration_ms: entry.processing_duration_ms,
      success: entry.success,
      error_message: entry.error_message,
      result: entry.result,
      confidence_score: entry.confidence_score,
      email_thread_id: entry.email_thread_id || null,
      context_id: entry.context_id,
      context_type: entry.context_type,
      processed_by: entry.processed_by,
      estimated_cost: estimatedCost > 0 ? estimatedCost : null,
    })

    if (error) {
      console.error('[AI Logging] Insert error:', error.message)
    }
  } catch (error) {
    console.error('[AI Logging] Failed to log:', error)
    // Ne pas faire échouer la fonction principale si le log échoue
  }
}

/**
 * Extrait les informations d'usage des tokens depuis la réponse Azure
 */
export function extractUsage(azureData: unknown): {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
} {
  return {
    prompt_tokens: (azureData as { usage?: { prompt_tokens?: number } })?.usage?.prompt_tokens,
    completion_tokens: (azureData as { usage?: { completion_tokens?: number } })?.usage
      ?.completion_tokens,
    total_tokens: (azureData as { usage?: { total_tokens?: number } })?.usage?.total_tokens,
  }
}

/**
 * Crée un timer pour mesurer la durée d'un appel
 */
export function createTimer(): { stop: () => number } {
  const startTime = Date.now()
  return {
    stop: () => Date.now() - startTime,
  }
}

/**
 * Retourne la grille tarifaire pour affichage
 */
export function getPricingTable(): Record<string, { input: number; output: number }> {
  return { ...MODEL_PRICING }
}
