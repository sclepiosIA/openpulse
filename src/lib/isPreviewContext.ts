/**
 * Detect preview / dev / iframe / kill-switch context.
 *
 * Shared by useServiceWorker, ErrorBoundary, lazyWithRetry to avoid
 * destructive auto-reloads while iterating inside the aperçu tiers iframe
 * (where HMR invalidates lazy chunks and would otherwise trigger a loop of
 * full-page reloads).
 */
export function isPreviewContext(): boolean {
  if (typeof window === 'undefined') return false

  const hostname = window.location.hostname
  const params = new URLSearchParams(window.location.search)
  const isIframe = (() => {
    try {
      return window.self !== window.top
    } catch {
      return true
    }
  })()

  return (
    !import.meta.env.PROD ||
    isIframe ||
    hostname.startsWith('id-preview--') ||
    hostname.startsWith('preview--') ||
    hostname === 'previsualisation.example.org' ||
    hostname.endsWith('.previsualisation.example.org') ||
    hostname === 'previsualisation-dev.example.org' ||
    hostname.endsWith('.previsualisation-dev.example.org') ||
    hostname === 'beta.generation.example.org' ||
    hostname.endsWith('.beta.generation.example.org') ||
    params.get('sw') === 'off' ||
    params.get('no-sw') === '1' ||
    (window as unknown as { __NO_SW__?: boolean }).__NO_SW__ === true
  )
}
