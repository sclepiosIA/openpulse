/**
 * JARVIS 16.0 - Smart Retry & Resilience
 * 
 * Provides exponential backoff retry, per-tool circuit breakers,
 * and graceful fallback for tool execution.
 */

import { ToolResult } from "./tools-executor.ts";

// ============================================================
// Exponential Backoff Configuration
// ============================================================
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableErrors: [
    'timeout', 'ECONNRESET', 'ECONNREFUSED', 'fetch failed',
    'network error', '503', '502', '429', 'rate limit',
    'AbortError', 'socket hang up'
  ],
};

// Per-category retry configs
const TOOL_RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  // External API calls: more retries
  send_email: { maxRetries: 3, baseDelayMs: 1000 },
  sync_qonto_transactions: { maxRetries: 3, baseDelayMs: 2000 },
  web_search: { maxRetries: 2, baseDelayMs: 1000 },
  web_scrape: { maxRetries: 2, baseDelayMs: 1000 },
  // AI tools: retry once with longer delay
  translate_email: { maxRetries: 1, baseDelayMs: 2000 },
  correct_email: { maxRetries: 1, baseDelayMs: 2000 },
  ai_assist_story: { maxRetries: 1, baseDelayMs: 2000 },
  parse_payslip: { maxRetries: 1, baseDelayMs: 3000 },
  // DB queries: fast retry
  query_database: { maxRetries: 2, baseDelayMs: 300 },
  // No retry for sensitive operations
  delete_task: { maxRetries: 0 },
  delete_calendar_event: { maxRetries: 0 },
  convert_devis_to_invoice: { maxRetries: 0 },
};

function getRetryConfig(toolName: string): RetryConfig {
  const override = TOOL_RETRY_CONFIGS[toolName] || {};
  return { ...DEFAULT_RETRY_CONFIG, ...override };
}

function isRetryableError(error: string, config: RetryConfig): boolean {
  const lower = error.toLowerCase();
  return config.retryableErrors.some(e => lower.includes(e.toLowerCase()));
}

function computeDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff with jitter
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * config.baseDelayMs * 0.5;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

// ============================================================
// Per-Tool Circuit Breaker (lightweight, in-memory)
// ============================================================
interface ToolCircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half_open';
  openedAt: number;
}

const toolCircuits = new Map<string, ToolCircuitState>();

const CIRCUIT_THRESHOLDS = {
  failureThreshold: 3,    // Open after 3 consecutive failures
  resetTimeoutMs: 30000,  // Try again after 30s
  halfOpenMaxAttempts: 1,  // Allow 1 attempt in half-open
};

function getCircuitState(toolName: string): ToolCircuitState {
  if (!toolCircuits.has(toolName)) {
    toolCircuits.set(toolName, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
      openedAt: 0,
    });
  }
  return toolCircuits.get(toolName)!;
}

function isCircuitOpen(toolName: string): boolean {
  const circuit = getCircuitState(toolName);
  
  if (circuit.state === 'open') {
    // Check if we should transition to half-open
    if (Date.now() - circuit.openedAt >= CIRCUIT_THRESHOLDS.resetTimeoutMs) {
      circuit.state = 'half_open';
      console.log(`[SmartRetry] Circuit ${toolName}: open → half_open`);
      return false;
    }
    return true;
  }
  
  return false;
}

function recordCircuitSuccess(toolName: string): void {
  const circuit = getCircuitState(toolName);
  circuit.failures = 0;
  if (circuit.state === 'half_open') {
    circuit.state = 'closed';
    console.log(`[SmartRetry] Circuit ${toolName}: half_open → closed`);
  }
}

function recordCircuitFailure(toolName: string): void {
  const circuit = getCircuitState(toolName);
  circuit.failures++;
  circuit.lastFailureTime = Date.now();
  
  if (circuit.failures >= CIRCUIT_THRESHOLDS.failureThreshold && circuit.state === 'closed') {
    circuit.state = 'open';
    circuit.openedAt = Date.now();
    console.log(`[SmartRetry] Circuit ${toolName}: closed → open (${circuit.failures} failures)`);
  } else if (circuit.state === 'half_open') {
    circuit.state = 'open';
    circuit.openedAt = Date.now();
    console.log(`[SmartRetry] Circuit ${toolName}: half_open → open (failed again)`);
  }
}

// ============================================================
// Main: Execute Tool with Smart Retry
// ============================================================
export async function executeWithSmartRetry(
  toolName: string,
  executor: () => Promise<ToolResult>
): Promise<ToolResult> {
  // Check circuit breaker
  if (isCircuitOpen(toolName)) {
    console.log(`[SmartRetry] Circuit OPEN for ${toolName} - skipping execution`);
    return {
      success: false,
      error: `⚠️ L'outil "${toolName}" est temporairement indisponible (trop d'échecs récents). Réessayez dans quelques secondes.`,
      execution_time_ms: 0,
    };
  }

  const config = getRetryConfig(toolName);
  let lastError: string = '';

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = computeDelay(attempt - 1, config);
        console.log(`[SmartRetry] ${toolName}: retry #${attempt} after ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }

      const result = await executor();
      
      if (result.success) {
        recordCircuitSuccess(toolName);
        if (attempt > 0) {
          console.log(`[SmartRetry] ${toolName}: succeeded on attempt ${attempt + 1}`);
        }
        return result;
      }

      // Check if error is retryable
      lastError = result.error || 'Unknown error';
      if (!isRetryableError(lastError, config)) {
        // Non-retryable error: don't retry but record for circuit
        recordCircuitFailure(toolName);
        return result;
      }

      console.log(`[SmartRetry] ${toolName}: retryable error on attempt ${attempt + 1}: ${lastError.substring(0, 100)}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown exception';
      if (!isRetryableError(lastError, config)) {
        recordCircuitFailure(toolName);
        return {
          success: false,
          error: lastError,
          execution_time_ms: 0,
        };
      }
      console.log(`[SmartRetry] ${toolName}: exception on attempt ${attempt + 1}: ${lastError.substring(0, 100)}`);
    }
  }

  // All retries exhausted
  recordCircuitFailure(toolName);
  return {
    success: false,
    error: `⚠️ L'outil "${toolName}" a échoué après ${config.maxRetries + 1} tentatives: ${lastError}`,
    execution_time_ms: 0,
  };
}

/**
 * Get circuit breaker status for all tools (for observability)
 */
export function getAllCircuitStates(): Record<string, { state: string; failures: number }> {
  const states: Record<string, { state: string; failures: number }> = {};
  toolCircuits.forEach((circuit, name) => {
    states[name] = { state: circuit.state, failures: circuit.failures };
  });
  return states;
}
