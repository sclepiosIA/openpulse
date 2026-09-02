import { lazy, ComponentType } from 'react'
import { safeReload } from '@/lib/safeReload'
import { isPreviewContext } from '@/lib/isPreviewContext'
import { debug } from '@/lib/debug'

/**
 * Wrapper around React.lazy that retries dynamic imports on failure.
 * Handles cache invalidation errors during deployments by retrying
 * with a back-off, and falls back to a *guarded* reload via safeReload
 * (never destroys an in-progress user input).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 2,
  delay = 1000
) {
  return lazy(() => retryImport(importFn, retries, delay))
}

async function retryImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries: number,
  delay: number
): Promise<{ default: T }> {
  try {
    return await importFn()
  } catch (error) {
    if (retries <= 0) {
      debug.warn('[lazyWithRetry] Import failed after all retries', error)
      // En preview/dev, HMR invalide régulièrement les chunks lazy : ne PAS
      // recharger, laisser l'ErrorBoundary afficher son UI (bouton Réessayer).
      // En prod, tenter un safeReload guardé pour récupérer un nouveau build.
      if (!isPreviewContext()) {
        safeReload('lazyWithRetry')
      }
      throw error
    }

    await new Promise((resolve) => setTimeout(resolve, delay))
    return retryImport(importFn, retries - 1, delay)
  }
}
