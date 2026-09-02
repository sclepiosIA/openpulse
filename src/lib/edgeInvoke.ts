/**
 * Shim `@/lib/edgeInvoke` — wrapper minimaliste autour de `supabase.functions.invoke`
 * avec retry exponentiel borné et support `AbortSignal`.
 */
import { supabase } from '@/integrations/supabase/client';

export interface InvokeWithRetryOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /** Tentatives supplémentaires après l'appel initial (défaut 2). */
  retries?: number;
  /** Délai initial entre tentatives en ms (défaut 500). */
  baseDelayMs?: number;
  /** Plafond du délai en ms (défaut 5000). */
  maxDelayMs?: number;
  /** Signal d'annulation (unmount). */
  signal?: AbortSignal;
}

export interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function shouldRetry(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const e = error as { status?: number; context?: { status?: number } };
  const status = e.status ?? e.context?.status;
  if (status == null) return true;
  return RETRYABLE.has(status);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export async function invokeWithRetry<T = unknown>(
  fnName: string,
  options: InvokeWithRetryOptions = {},
): Promise<InvokeResult<T>> {
  const { body, headers, retries = 2, baseDelayMs = 500, maxDelayMs = 5000, signal } = options;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      return { data: null, error: new Error('Aborted') };
    }
    try {
      const { data, error } = await supabase.functions.invoke<T>(fnName, {
        body: body as never,
        headers,
      });
      if (error) {
        lastError = error;
        if (attempt < retries && shouldRetry(error)) {
          const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs) * (0.5 + Math.random() / 2);
          await sleep(delay, signal);
          continue;
        }
        return { data: null, error: error as Error };
      }
      return { data: (data ?? null) as T | null, error: null };
    } catch (err) {
      lastError = err;
      if (attempt < retries && shouldRetry(err)) {
        const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs) * (0.5 + Math.random() / 2);
        try {
          await sleep(delay, signal);
        } catch {
          return { data: null, error: new Error('Aborted') };
        }
        continue;
      }
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
  return {
    data: null,
    error: lastError instanceof Error ? lastError : new Error('invokeWithRetry: max retries exceeded'),
  };
}
