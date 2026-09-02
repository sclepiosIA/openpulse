/**
 * JARVIS 10.0 - Resilient Fetch with Smart Retry
 *
 * Provides:
 * - Exponential backoff with jitter
 * - Configurable retry strategies
 * - Fallback chain support
 * - Circuit breaker integration
 * - Request timeout handling
 */

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryableStatuses: number[]
  jitterMs: number
  timeoutMs: number
}

export interface FallbackConfig<T> {
  name: string
  execute: () => Promise<T>
  condition?: (error: unknown) => boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
  jitterMs: 500,
  timeoutMs: 90000,
}

// Retry configs by endpoint type
export const RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  'azure-openai': {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 20000,
    retryableStatuses: [429, 500, 502, 503],
    timeoutMs: 90000,
  },
  database: {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    retryableStatuses: [500, 503],
    timeoutMs: 30000,
  },
  'external-api': {
    maxRetries: 2,
    baseDelayMs: 2000,
    maxDelayMs: 15000,
    retryableStatuses: [429, 500, 502, 503, 504],
    timeoutMs: 45000,
  },
  email: {
    maxRetries: 2,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    retryableStatuses: [500, 502, 503],
    timeoutMs: 60000,
  },
}

/**
 * Calculate delay with exponential backoff + jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * config.jitterMs
  return Math.min(exponentialDelay + jitter, config.maxDelayMs)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function raceWithTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  })

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  })
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  // Timeout errors
  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }

  // HTTP status-based retry
  if (error instanceof Response) {
    return config.retryableStatuses.includes(error.status)
  }

  // Custom error with status
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status
    return config.retryableStatuses.includes(status)
  }

  return false
}

/**
 * Create a fetch with timeout
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export interface ResilientFetchResult<T> {
  success: boolean
  data?: T
  error?: string
  attempts: number
  totalTimeMs: number
  fallbackUsed?: string
}

/**
 * Resilient fetch with automatic retry and timeout
 */
export async function resilientFetch<T = Response>(
  input: RequestInfo | URL,
  init?: RequestInit,
  config?: Partial<RetryConfig>,
  parseResponse?: (response: Response) => Promise<T>
): Promise<ResilientFetchResult<T>> {
  const startTime = Date.now()
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  let lastError: unknown
  let attempts = 0

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    attempts = attempt + 1

    try {
      const response = await fetchWithTimeout(input, init, cfg.timeoutMs)

      // Check if response is retryable
      if (!response.ok && cfg.retryableStatuses.includes(response.status)) {
        console.log(`[ResilientFetch] Attempt ${attempts}: HTTP ${response.status} (retryable)`)
        lastError = response

        if (attempt < cfg.maxRetries) {
          const delay = calculateDelay(attempt, cfg)
          console.log(`[ResilientFetch] Waiting ${delay}ms before retry...`)
          await sleep(delay)
          continue
        }
      }

      // Non-retryable error or success
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          attempts,
          totalTimeMs: Date.now() - startTime,
        }
      }

      // Parse response if parser provided
      const data = parseResponse ? await parseResponse(response) : (response as unknown as T)

      return {
        success: true,
        data,
        attempts,
        totalTimeMs: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.log(`[ResilientFetch] Attempt ${attempts}: ${errorMsg}`)

      if (attempt < cfg.maxRetries && isRetryableError(error, cfg)) {
        const delay = calculateDelay(attempt, cfg)
        console.log(`[ResilientFetch] Waiting ${delay}ms before retry...`)
        await sleep(delay)
        continue
      }

      // Non-retryable or max retries reached
      break
    }
  }

  // All retries exhausted
  const errorMsg =
    lastError instanceof Error
      ? lastError.message
      : lastError instanceof Response
        ? `HTTP ${lastError.status}`
        : 'Unknown error'

  return {
    success: false,
    error: `All ${attempts} attempts failed: ${errorMsg}`,
    attempts,
    totalTimeMs: Date.now() - startTime,
  }
}

/**
 * Execute with fallback chain
 */
export async function executeWithFallback<T>(
  primaryName: string,
  primary: () => Promise<T>,
  fallbacks: FallbackConfig<T>[],
  retryConfig?: Partial<RetryConfig>
): Promise<ResilientFetchResult<T>> {
  const startTime = Date.now()
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  let totalAttempts = 0

  // Try primary
  console.log(`[FallbackChain] Trying primary: ${primaryName}`)

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    totalAttempts++
    try {
      const result = await raceWithTimeout(primary(), cfg.timeoutMs)

      return {
        success: true,
        data: result,
        attempts: totalAttempts,
        totalTimeMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.log(`[FallbackChain] Primary attempt ${attempt + 1} failed: ${errorMsg}`)

      if (attempt < cfg.maxRetries && isRetryableError(error, cfg)) {
        const delay = calculateDelay(attempt, cfg)
        await sleep(delay)
        continue
      }
      break
    }
  }

  // Try fallbacks in order
  for (const fallback of fallbacks) {
    console.log(`[FallbackChain] Trying fallback: ${fallback.name}`)
    totalAttempts++

    try {
      const result = await raceWithTimeout(fallback.execute(), cfg.timeoutMs)

      return {
        success: true,
        data: result,
        attempts: totalAttempts,
        totalTimeMs: Date.now() - startTime,
        fallbackUsed: fallback.name,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.log(`[FallbackChain] Fallback ${fallback.name} failed: ${errorMsg}`)
      continue
    }
  }

  return {
    success: false,
    error: `All providers failed after ${totalAttempts} attempts`,
    attempts: totalAttempts,
    totalTimeMs: Date.now() - startTime,
  }
}

/**
 * Resilient Azure OpenAI call with built-in retry
 */
export async function resilientAzureCall<T>(
  endpoint: string,
  apiKey: string,
  body: unknown,
  config?: Partial<RetryConfig>
): Promise<ResilientFetchResult<T>> {
  const cfg = { ...RETRY_CONFIGS['azure-openai'], ...config }

  return resilientFetch<T>(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    },
    cfg,
    async (response) => response.json() as Promise<T>
  )
}

/**
 * Create a retryable wrapper for any async function
 */
export function withRetry<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  config?: Partial<RetryConfig>
): (...args: Args) => Promise<ResilientFetchResult<T>> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  return async (...args: Args): Promise<ResilientFetchResult<T>> => {
    const startTime = Date.now()
    let lastError: unknown
    let attempts = 0

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      attempts = attempt + 1

      try {
        const result = await raceWithTimeout(fn(...args), cfg.timeoutMs)

        return {
          success: true,
          data: result,
          attempts,
          totalTimeMs: Date.now() - startTime,
        }
      } catch (error) {
        lastError = error
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.log(`[withRetry] Attempt ${attempts} failed: ${errorMsg}`)

        if (attempt < cfg.maxRetries) {
          const delay = calculateDelay(attempt, cfg)
          await sleep(delay)
          continue
        }
      }
    }

    const errorMsg = lastError instanceof Error ? lastError.message : 'Unknown error'
    return {
      success: false,
      error: `All ${attempts} attempts failed: ${errorMsg}`,
      attempts,
      totalTimeMs: Date.now() - startTime,
    }
  }
}
