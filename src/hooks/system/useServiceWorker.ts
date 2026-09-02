import { useEffect } from 'react'
import { isPreviewContext } from '@/lib/isPreviewContext'

const APP_SW_PATHS = ['/sw.js', '/service-worker.js']
const APP_CACHE_PATTERNS = [
  /(^|-)precache-v\d+-/,
  /(^|-)runtime-/,
  /(^|-)googleAnalytics-/,
  /^workbox-/,
  /^html-cache/,
  /^static-resources/,
  /^supabase-rest/,
  /^supabase-api-cache/,
  /^images-cache/,
  /^styles-cache/,
  /^scripts-cache/,
  /^fonts-cache/,
]

async function unregisterAppShellWorkers() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.allSettled(
      registrations
        .filter((registration) =>
          APP_SW_PATHS.some(
            (path) =>
              registration.active?.scriptURL.endsWith(path) ||
              registration.installing?.scriptURL.endsWith(path) ||
              registration.waiting?.scriptURL.endsWith(path)
          )
        )
        .map((registration) => registration.unregister())
    )
  }

  if (!('caches' in window)) return

  const cacheNames = await caches.keys()
  await Promise.allSettled(
    cacheNames
      .filter((name) => APP_CACHE_PATTERNS.some((pattern) => pattern.test(name)))
      .map((name) => caches.delete(name))
  )
}

export function useServiceWorker() {
  useEffect(() => {
    // Preview/dev/iframe : on nettoie tout SW et on ne réenregistre rien.
    if (isPreviewContext()) {
      void unregisterAppShellWorkers().catch((error) =>
        import.meta.env.DEV ? console.warn('[SW cleanup] Failed', error) : undefined
      )
      return
    }

    // Prod : enregistrer le SW push (public/sw.js). Il ne fait pas d'app-shell
    // caching, uniquement les handlers push/notificationclick.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
        if (import.meta.env.DEV) console.warn('[SW] register failed', error)
      })
    }
  }, [])

  return {
    needRefresh: false,
    offlineReady: false,
    updateServiceWorker: () => undefined,
  }
}
