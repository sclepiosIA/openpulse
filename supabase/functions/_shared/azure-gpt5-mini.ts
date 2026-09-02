/**
 * 🚀 Azure GPT-5.4 - Helper optimisé pour les fonctions de réécriture pure
 * 
 * Ce helper utilise GPT-5.4 comme modèle primaire (via AZURE_OPENAI_ENDPOINT)
 * avec fallback vers GPT-5 Mini et GPT-5.2.
 * 
 * Chaîne de fallback: GPT-5.4 → GPT-5 Mini → GPT-5.2
 * 
 * Avantages:
 * - Modèle le plus récent et performant
 * - Timeout réduit (30s pour les tâches simples)
 * - Fallback automatique vers Mini puis GPT-5.2 si nécessaire
 * - Support automatique de la Responses API pour GPT-5.2
 * 
 * Secrets Supabase requis:
 * - AZURE_GPT5_MINI_ENDPOINT : URL du déploiement GPT-5 Mini
 * - AZURE_GPT5_MINI_API_KEY : Clé API (peut être la même que GPT-5)
 * - AZURE_GPT52_ENDPOINT : URL du déploiement GPT-5.2 (fallback 1)
 * - AZURE_GPT52_API_KEY : Clé API pour GPT-5.2
 * - AZURE_OPENAI_ENDPOINT : URL du déploiement GPT-5 (fallback 2)
 * - AZURE_OPENAI_API_KEY : Clé API pour GPT-5
 */

import { isResponsesAPIEndpoint, callGpt52ResponsesAPI } from "./azure-responses-api.ts";

export interface Gpt5MiniOptions {
  maxTokens?: number;
  timeout?: number;
  jsonOutput?: boolean;
}

export interface Gpt5MiniResponse {
  content: string;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model: 'gpt-5.4' | 'gpt-5-mini' | 'gpt-5.2';
}

// Configuration optimisée pour GPT-5 Mini
export const AZURE_GPT5_MINI_CONFIG = {
  endpoint: () => Deno.env.get('AZURE_GPT5_MINI_ENDPOINT'),
  apiKey: () => Deno.env.get('AZURE_GPT5_MINI_API_KEY'),
  timeout: 30000,  // 30s au lieu de 90s (modèle plus rapide)
  defaultParams: {
    max_completion_tokens: 2000,
    reasoning_effort: "low",
    verbosity: "low",
  }
};

// Configuration GPT-5.4 (primary - via AZURE_OPENAI_ENDPOINT)
export const AZURE_GPT54_CONFIG = {
  endpoint: () => Deno.env.get('AZURE_OPENAI_ENDPOINT'),
  apiKey: () => Deno.env.get('AZURE_OPENAI_API_KEY'),
};

// Configuration GPT-5.2 (fallback 2)
export const AZURE_GPT52_CONFIG = {
  endpoint: () => Deno.env.get('AZURE_GPT52_ENDPOINT'),
  apiKey: () => Deno.env.get('AZURE_GPT52_API_KEY'),
};

/**
 * Appelle Azure GPT-5.4 avec fallback automatique vers GPT-5 Mini puis GPT-5.2
 * 
 * Chaîne de fallback: GPT-5.4 → GPT-5 Mini → GPT-5.2
 * 
 * @param systemPrompt - Prompt système
 * @param userPrompt - Prompt utilisateur
 * @param options - Options (maxTokens, timeout, jsonOutput)
 * @returns Contenu généré et métriques d'usage
 */
export async function callGpt5Mini(
  systemPrompt: string, 
  userPrompt: string,
  options?: Gpt5MiniOptions
): Promise<Gpt5MiniResponse> {
  // Get all possible endpoints
  const gpt54Endpoint = AZURE_GPT54_CONFIG.endpoint();
  const gpt54ApiKey = AZURE_GPT54_CONFIG.apiKey();
  const miniEndpoint = AZURE_GPT5_MINI_CONFIG.endpoint();
  const miniApiKey = AZURE_GPT5_MINI_CONFIG.apiKey();
  const gpt52Endpoint = AZURE_GPT52_CONFIG.endpoint();
  const gpt52ApiKey = AZURE_GPT52_CONFIG.apiKey();
  
  // Build provider chain: GPT-5.4 → Mini → GPT-5.2
  type Provider = { 
    type: 'chat_completions' | 'responses_api'; 
    endpoint: string; 
    apiKey: string; 
    model: 'gpt-5.4' | 'gpt-5-mini' | 'gpt-5.2' 
  };
  const providers: Provider[] = [];
  
  // GPT-5.4 is now the primary model
  if (gpt54Endpoint && gpt54ApiKey) {
    providers.push({ type: 'chat_completions', endpoint: gpt54Endpoint, apiKey: gpt54ApiKey, model: 'gpt-5.4' });
  }
  if (miniEndpoint && miniApiKey) {
    providers.push({ type: 'chat_completions', endpoint: miniEndpoint, apiKey: miniApiKey, model: 'gpt-5-mini' });
  }
  if (gpt52Endpoint && gpt52ApiKey) {
    const isResponses = isResponsesAPIEndpoint(gpt52Endpoint);
    providers.push({ 
      type: isResponses ? 'responses_api' : 'chat_completions', 
      endpoint: gpt52Endpoint, 
      apiKey: gpt52ApiKey, 
      model: 'gpt-5.2' 
    });
  }
  
  if (providers.length === 0) {
    throw new Error('Azure OpenAI not configured (no GPT-5.4, GPT-5 Mini, or GPT-5.2 endpoints available)');
  }
  
  const timeout = options?.timeout || AZURE_GPT5_MINI_CONFIG.timeout;
  
  // Standard Chat Completions body
  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_completion_tokens: options?.maxTokens || AZURE_GPT5_MINI_CONFIG.defaultParams.max_completion_tokens,
    reasoning_effort: "low",
    verbosity: "low",
  };
  
  if (options?.jsonOutput) {
    body.response_format = { type: "json_object" };
  }
  
  // Try each provider in order
  let lastError: Error | null = null;
  
  for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
    const provider = providers[providerIndex];
    const isLastProvider = providerIndex === providers.length - 1;
    
    console.log(`[GPT-5 Mini] Trying ${provider.model} (${provider.type})...`);
    
    try {
      let result: Gpt5MiniResponse;
      
      if (provider.type === 'responses_api') {
        // Use Responses API helper
        const responsesResult = await callGpt52ResponsesAPI(systemPrompt, userPrompt, {
          maxOutputTokens: options?.maxTokens || AZURE_GPT5_MINI_CONFIG.defaultParams.max_completion_tokens,
          reasoningEffort: 'low',
          verbosity: 'low',
          jsonOutput: options?.jsonOutput,
          timeout,
        });
        
        result = {
          content: responsesResult.content,
          usage: responsesResult.usage,
          model: 'gpt-5.2',
        };
      } else {
        // Use standard Chat Completions
        result = await callProviderWithRetry(provider.endpoint, provider.apiKey, body, timeout, provider.model);
      }
      
      console.log(`[GPT-5 Mini] Success with ${provider.model}`);
      return result;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[GPT-5 Mini] ${provider.model} failed: ${lastError.message}`);
      
      if (!isLastProvider) {
        console.log(`[GPT-5 Mini] Falling back to next provider...`);
      }
    }
  }
  
  throw lastError || new Error('All Azure OpenAI providers failed');
}

/**
 * Helper interne pour appeler un provider avec retry
 */
async function callProviderWithRetry(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeout: number,
  model: 'gpt-5.4' | 'gpt-5-mini' | 'gpt-5.2'
): Promise<Gpt5MiniResponse> {
  const maxRetries = 3;
  let consecutiveRateLimits = 0;
  
  while (consecutiveRateLimits <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // Retry on rate limit (429) with backoff
      if (response.status === 429) {
        consecutiveRateLimits++;
        if (consecutiveRateLimits > maxRetries) {
          throw new Error(`[${model}] Rate limit retries exceeded`);
        }
        const backoffMs = Math.min(500 * Math.pow(2, consecutiveRateLimits - 1), 8000);
        console.warn(`[${model}] Rate limited (429), waiting ${backoffMs}ms before retry ${consecutiveRateLimits}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${model}] Azure API error: ${response.status}`, errorText);
        throw new Error(`Azure OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content || typeof content !== 'string') {
        console.error(`[${model}] Unexpected response format:`, JSON.stringify(data, null, 2));
        throw new Error('No content in Azure response');
      }
      
      return {
        content: content.trim(),
        usage: {
          prompt_tokens: data.usage?.prompt_tokens,
          completion_tokens: data.usage?.completion_tokens,
          total_tokens: data.usage?.total_tokens,
        },
        model,
      };
      
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`[${model}] Azure request timeout (${timeout / 1000}s)`);
      }
      throw error;
    }
  }
  
  throw new Error(`[${model}] Max retries exceeded`);
}
