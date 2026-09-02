/**
 * Safe Async Utilities
 * Provides error handling wrappers for async operations
 */

import { debug } from './debug';

/**
 * Result type for safe async operations
 */
export type SafeResult<T> = 
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: Error };

/**
 * Wrap an async operation with error handling
 * Never throws - always returns a result object
 * 
 * @param promise - The promise to wrap
 * @param context - Context string for logging
 * @returns SafeResult with either data or error
 * 
 * @example
 * const result = await safeAsync(fetchData(), 'FetchUsers');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function safeAsync<T>(
  promise: Promise<T>,
  context: string
): Promise<SafeResult<T>> {
  try {
    const data = await promise;
    return { success: true, data, error: null };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    debug.error(`[${context}] Async error:`, error.message);
    return { success: false, data: null, error };
  }
}

/**
 * Wrap an async operation, returning null on error
 * Simpler alternative when you just need the data or null
 * 
 * @param promise - The promise to wrap
 * @param context - Context string for logging
 * @returns Data or null on error
 * 
 * @example
 * const data = await safeAsyncNull(fetchData(), 'FetchUsers');
 * if (data) {
 *   // Use data
 * }
 */
export async function safeAsyncNull<T>(
  promise: Promise<T>,
  context: string
): Promise<T | null> {
  const result = await safeAsync(promise, context);
  return result.success ? result.data : null;
}

/**
 * Execute an async function with a timeout
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param context - Context string for logging
 * @returns Data or throws on timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`[${context}] Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param options - Retry options
 * @returns Result of the function
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    context?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    context = 'RetryAsync'
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        debug.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`[${context}] All ${maxRetries + 1} attempts failed`);
}
