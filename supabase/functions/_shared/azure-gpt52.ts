/**
 * 🚀 Azure GPT-5.4 - Helper centralisé avec fallback automatique vers GPT-5.2
 *
 * Ce helper utilise GPT-5.4 (via AZURE_OPENAI_ENDPOINT) en endpoint principal
 * avec fallback vers GPT-5.2 en cas d'échec (rate limit, erreur API, etc.)
 *
 * IMPORTANT: Ce helper détecte automatiquement si l'endpoint GPT-5.2 utilise
 * la nouvelle Responses API (2025) ou l'API Chat Completions standard, et
 * route les requêtes vers le bon format.
 *
 * Secrets Supabase requis:
 * - AZURE_OPENAI_ENDPOINT : URL du déploiement GPT-5.4 (primary)
 * - AZURE_OPENAI_API_KEY : Clé API pour GPT-5.4
 * - AZURE_GPT52_ENDPOINT : URL du déploiement GPT-5.2 (fallback)
 * - AZURE_GPT52_API_KEY : Clé API pour GPT-5.2 (fallback)
 */

import {
  isResponsesAPIEndpoint,
  callGpt52ResponsesAPI,
  callGpt52ResponsesAPIWithMessages,
  type ResponsesAPIResult,
} from './azure-responses-api.ts'

export interface Gpt52Options {
  maxTokens?: number
  timeout?: number
  jsonOutput?: boolean
  reasoningEffort?: 'low' | 'medium' | 'high'
  verbosity?: 'low' | 'medium' | 'high'
  tools?: unknown[]
  toolChoice?: string | { type: string; function?: { name: string } }
}

export interface Gpt52Response {
  content: string
  toolCalls?: Array<{
    id: string
    type: string
    function: {
      name: string
      arguments: string
    }
  }>
  usage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  model: 'gpt-5.4' | 'gpt-5.2'
  rawMessage?: unknown
}

// Configuration GPT-5.4 (primary - via AZURE_OPENAI_ENDPOINT)
export const AZURE_GPT54_PRIMARY_CONFIG = {
  endpoint: () => Deno.env.get('AZURE_OPENAI_ENDPOINT'),
  apiKey: () => Deno.env.get('AZURE_OPENAI_API_KEY'),
}

// Configuration GPT-5.2 (fallback)
export const AZURE_GPT52_CONFIG = {
  endpoint: () => Deno.env.get('AZURE_GPT52_ENDPOINT'),
  apiKey: () => Deno.env.get('AZURE_GPT52_API_KEY'),
}

/**
 * Appelle Azure GPT-5.4 avec fallback automatique vers GPT-5.2
 * Détecte automatiquement si l'endpoint utilise Responses API ou Chat Completions
 */
export async function callGpt52(
  systemPrompt: string,
  userPrompt: string,
  options?: Gpt52Options
): Promise<Gpt52Response> {
  // Try GPT-5.4 first (primary via AZURE_OPENAI_ENDPOINT)
  const gpt54Endpoint = AZURE_GPT54_PRIMARY_CONFIG.endpoint()
  const gpt54ApiKey = AZURE_GPT54_PRIMARY_CONFIG.apiKey()

  if (gpt54Endpoint && gpt54ApiKey) {
    console.log('[GPT-5.4] Using primary GPT-5.4 endpoint...')
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const result = await callAzureWithRetry(
        gpt54Endpoint,
        gpt54ApiKey,
        messages,
        options,
        options?.timeout || 90000,
        5,
        'gpt-5.4'
      )
      return result
    } catch (error) {
      console.warn(
        '[GPT-5.4] Primary endpoint failed, trying GPT-5.2 fallback:',
        error instanceof Error ? error.message : error
      )
    }
  }

  const gpt52Endpoint = AZURE_GPT52_CONFIG.endpoint()

  // Check if GPT-5.2 endpoint uses Responses API
  if (gpt52Endpoint && isResponsesAPIEndpoint(gpt52Endpoint)) {
    console.log('[GPT-5.2] Detected Responses API endpoint, routing accordingly...')
    try {
      const result = await callGpt52ResponsesAPI(systemPrompt, userPrompt, {
        maxOutputTokens: options?.maxTokens,
        reasoningEffort: options?.reasoningEffort,
        verbosity: options?.verbosity,
        jsonOutput: options?.jsonOutput,
        timeout: options?.timeout,
      })

      return {
        content: result.content,
        toolCalls: result.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
        usage: result.usage,
        model: 'gpt-5.2',
      }
    } catch (error) {
      console.warn(
        '[GPT-5.2] Responses API failed:',
        error instanceof Error ? error.message : error
      )
    }
  }

  // Standard Chat Completions API path
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  return callGpt52WithMessages(messages, options)
}

/**
 * Appelle Azure GPT-5.4/GPT-5.2 avec un array de messages (pour le tool calling)
 * Détecte automatiquement si l'endpoint utilise Responses API ou Chat Completions
 */
export async function callGpt52WithMessages(
  messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>,
  options?: Gpt52Options
): Promise<Gpt52Response> {
  // Try GPT-5.4 first (primary)
  const gpt54Endpoint = AZURE_GPT54_PRIMARY_CONFIG.endpoint()
  const gpt54ApiKey = AZURE_GPT54_PRIMARY_CONFIG.apiKey()
  const gpt52Endpoint = AZURE_GPT52_CONFIG.endpoint()
  const gpt52ApiKey = AZURE_GPT52_CONFIG.apiKey()

  // Check if GPT-5.2 endpoint uses Responses API
  if (gpt52Endpoint && gpt52ApiKey && isResponsesAPIEndpoint(gpt52Endpoint)) {
    console.log('[GPT-5.2] Using Responses API for messages...')
    try {
      const tools = options?.tools?.map((t: unknown) => {
        const tool = t as {
          type?: string
          function?: { name: string; description?: string; parameters?: unknown }
        }
        return {
          type: 'function' as const,
          function:
            tool.function || (t as { name: string; description?: string; parameters?: unknown }),
        }
      })

      const result = await callGpt52ResponsesAPIWithMessages(messages, tools, {
        maxOutputTokens: options?.maxTokens,
        reasoningEffort: options?.reasoningEffort,
        verbosity: options?.verbosity,
        jsonOutput: options?.jsonOutput,
        timeout: options?.timeout,
      })

      return {
        content: result.content,
        toolCalls: result.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
        usage: result.usage,
        model: 'gpt-5.2',
        rawMessage: result.rawOutput,
      }
    } catch (error) {
      console.warn(
        '[GPT-5.2] Responses API with messages failed:',
        error instanceof Error ? error.message : error
      )
    }
  }

  if (!gpt54Endpoint && !gpt52Endpoint) {
    throw new Error('Azure OpenAI not configured (neither GPT-5.4 nor GPT-5.2)')
  }

  const timeout = options?.timeout || 90000
  const maxRetries = 5

  // Try GPT-5.4 first if available
  if (gpt54Endpoint && gpt54ApiKey) {
    try {
      const result = await callAzureWithRetry(
        gpt54Endpoint,
        gpt54ApiKey,
        messages,
        options,
        timeout,
        maxRetries,
        'gpt-5.4'
      )
      return result
    } catch (error) {
      console.warn(
        '[GPT-5.4] Primary endpoint failed, falling back to GPT-5.2:',
        error instanceof Error ? error.message : error
      )

      // Fallback to GPT-5.2
      if (gpt52Endpoint && gpt52ApiKey) {
        console.log('[GPT-5.4] Falling back to GPT-5.2...')
        return callAzureWithRetry(
          gpt52Endpoint,
          gpt52ApiKey,
          messages,
          options,
          timeout,
          maxRetries,
          'gpt-5.2'
        )
      }
      throw error
    }
  }

  // If GPT-5.4 not configured, use GPT-5.2 directly
  if (gpt52Endpoint && gpt52ApiKey) {
    console.log('[GPT-5.4] GPT-5.4 not configured, using GPT-5.2 directly')
    return callAzureWithRetry(
      gpt52Endpoint,
      gpt52ApiKey,
      messages,
      options,
      timeout,
      maxRetries,
      'gpt-5.2'
    )
  }

  throw new Error('No Azure OpenAI endpoint available')
}

/**
 * Helper interne pour appeler Azure avec retry et backoff exponentiel
 */
async function callAzureWithRetry(
  endpoint: string,
  apiKey: string,
  messages: Array<{ role: string; content: string; tool_calls?: unknown }>,
  options: Gpt52Options | undefined,
  timeout: number,
  maxRetries: number,
  modelLabel: 'gpt-5.4' | 'gpt-5.2'
): Promise<Gpt52Response> {
  let consecutiveRateLimits = 0

  while (consecutiveRateLimits <= maxRetries) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const body: Record<string, unknown> = {
        messages,
        max_completion_tokens: options?.maxTokens || 3000,
        reasoning_effort: options?.reasoningEffort || 'low',
        verbosity: options?.verbosity || 'low',
      }

      if (options?.jsonOutput) {
        body.response_format = { type: 'json_object' }
      }

      if (options?.tools) {
        body.tools = options.tools
        body.tool_choice = options.toolChoice || 'auto'
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // Handle rate limit with exponential backoff
      if (response.status === 429) {
        consecutiveRateLimits++
        if (consecutiveRateLimits > maxRetries) {
          throw new Error(`[${modelLabel}] Max rate limit retries exceeded`)
        }
        // Backoff: 2s, 4s, 8s, 16s, 32s (max 60s)
        const backoffMs = Math.min(2000 * Math.pow(2, consecutiveRateLimits - 1), 60000)
        console.warn(
          `[${modelLabel}] Rate limited (429), waiting ${backoffMs}ms before retry ${consecutiveRateLimits}/${maxRetries}...`
        )
        await new Promise((r) => setTimeout(r, backoffMs))
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[${modelLabel}] Azure API error: ${response.status}`, errorText)
        throw new Error(`Azure OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message
      const content = message?.content

      // For tool calling, we might not have content but have tool_calls
      if (!content && !message?.tool_calls) {
        console.error(`[${modelLabel}] Unexpected response format:`, JSON.stringify(data, null, 2))
        throw new Error('No content or tool_calls in Azure response')
      }

      return {
        content: content?.trim() || '',
        toolCalls: message?.tool_calls,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens,
          completion_tokens: data.usage?.completion_tokens,
          total_tokens: data.usage?.total_tokens,
        },
        model: modelLabel,
        rawMessage: message,
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`[${modelLabel}] Azure request timeout (${timeout / 1000}s)`)
      }
      throw error
    }
  }

  throw new Error(`[${modelLabel}] Max retries exceeded`)
}
