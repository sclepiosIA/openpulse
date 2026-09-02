import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import App from './App'
import './index.css'
import { performanceMonitor } from './lib/performance'
import { pwaAnalytics } from './lib/pwa-analytics'
import { consoleCapture } from './lib/consoleCapture'
import { frontendErrorCapture } from './lib/frontendErrorCapture'
import { installConsoleErrorFilter } from './lib/consoleErrorFilter'
import { installToastCapture } from './lib/toastCapture'
import { initLiveUpdates } from './lib/liveUpdates'
import { observability } from './lib/observability'
import { webVitalsCapture } from './lib/webVitalsCapture'
import { applyPulseTheme } from './lib/pulsePreferences'

// Appliquer le thème Pulse (bulles + fond) au chargement pour couvrir aussi le chat flottant
try {
  applyPulseTheme()
} catch {
  /* noop */
}

// Initialiser la capture des logs console pour les feedbacks utilisateurs
consoleCapture.init()
// Initialiser la capture des erreurs frontend vers Supabase
frontendErrorCapture.init()
// Capturer chaque toast d'erreur/avertissement affiché à l'utilisateur
installToastCapture()
// OBS-3 : intercepter window.fetch pour signaler les erreurs HTTP non triviales
observability.installFetchInterceptor()
// OBS-4 : capter Core Web Vitals (LCP/INP/CLS/FCP/TTFB) — sampling 10 %
webVitalsCapture.init()
// Capgo Live Updates OTA (no-op sur web, actif sur iOS/Android natif).
// Permet de pousser des bundles JS sans rebuild App Store / Play Store.
void initLiveUpdates()
// Détection iframe tierce - désactiver SW pour éviter les problèmes de cache
const isThirdPartyIframe = (() => {
  try {
    return (
      window.self !== window.top &&
      document.referrer &&
      !document.referrer.includes(window.location.origin)
    )
  } catch {
    return true
  }
})()

if (isThirdPartyIframe && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV)
    console.info('[Main] Third-party iframe detected, unregistering Service Workers')
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  })
  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  }
}

// Initialiser le monitoring de performance avec protection
try {
  performanceMonitor.init()
} catch (error) {
  if (import.meta.env.DEV) console.error('Failed to initialize performance monitor:', error)
}

// Initialiser le tracking PWA/mobile avec protection
try {
  pwaAnalytics.init()
} catch (error) {
  if (import.meta.env.DEV) console.error('Failed to initialize PWA analytics:', error)
}

// Détection robuste des erreurs d'import dynamique (multi-langues)
function isDynamicImportError(message: string): boolean {
  if (!message) return false

  // Strict patterns only – no generic "Network error" or "Failed to import"
  const patterns = [
    'Loading chunk',
    'dynamically imported module',
    'ChunkLoadError',
    'importé dynamiquement',
    'module importado dinámicamente',
    'importação dinâmica',
    'chunk loading',
  ]

  return patterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
}

// Compteur d'échecs pour la bouée de sauvetage
let chunkFailCount = 0
let lastChunkFailTime = 0
const CHUNK_FAIL_WINDOW = 10000 // 10 secondes
const MAX_CHUNK_FAILS = 2

// Protection contre les reloads en boucle
let lastReload = 0
const RELOAD_THROTTLE = 5000 // 5 secondes entre les reloads

// Tentative proactive de skipWaiting sur le Service Worker
async function attemptServiceWorkerUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      if (registration.waiting) {
        if (import.meta.env.DEV) console.info('[SW Recovery] Attempting skipWaiting before reload')
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        // Attendre un peu pour que le SW puisse se mettre à jour
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  } catch (error) {
    console.warn('[SW Recovery] Failed to update service worker:', error)
  }
}

// Gestion des échecs répétés avec bouée de sauvetage
function handleChunkLoadFailure(errorMessage: string, chunkUrl?: string): void {
  const now = Date.now()

  // Nettoyer les anciens échecs (fenêtre glissante)
  if (now - lastChunkFailTime > CHUNK_FAIL_WINDOW) {
    chunkFailCount = 0
  }

  chunkFailCount++
  lastChunkFailTime = now

  // Breadcrumb Sentry pour observabilité
  const sentryWindow = window as typeof window & {
    Sentry?: import('@/types/global').WindowWithSentry['Sentry']
  }
  if (typeof window !== 'undefined' && sentryWindow.Sentry) {
    sentryWindow.Sentry.addBreadcrumb({
      category: 'chunk-load-fail',
      message: 'Dynamic import chunk loading failed',
      level: 'warning',
      data: {
        errorMessage,
        chunkUrl,
        failCount: chunkFailCount,
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        timestamp: now,
      },
    })
  }

  console.warn(`[Chunk Recovery] Failure #${chunkFailCount}:`, {
    errorMessage,
    chunkUrl,
    route: window.location.pathname,
    online: navigator.onLine,
  })

  // Log repeated failures but do NOT redirect – let ErrorBoundary handle it
  if (chunkFailCount > MAX_CHUNK_FAILS) {
    console.error(
      `[Chunk Recovery] Too many failures (${chunkFailCount}), user should reload manually via error boundary`
    )
    return
  }

  // Ne PAS recharger automatiquement - laisser RouterErrorBoundary gérer
  // Le hardRecover de index.html couvre les cas extrêmes
  if (now - lastReload > RELOAD_THROTTLE) {
    lastReload = now
    console.warn('[Chunk Recovery] Chunk error detected, user can reload via error boundary')
    // Tenter un SW update en arrière-plan sans reload
    attemptServiceWorkerUpdate().catch(() => {})
  } else {
    console.warn('[Chunk Recovery] Recovery throttled, waiting...')
  }
}

// Gestionnaire global d'erreurs de chargement de modules
window.addEventListener('error', (event) => {
  const errorMessage = event.message || event.error?.message || ''

  if (isDynamicImportError(errorMessage)) {
    // Extraire l'URL du chunk si disponible
    const target = event.target as HTMLScriptElement | HTMLLinkElement | null
    const chunkUrl = event.filename || (target && 'src' in target ? target.src : target?.href) || ''
    handleChunkLoadFailure(errorMessage, chunkUrl)
  }
})

// Gestionnaire d'erreurs de promesses non capturées
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || String(event.reason) || ''

  if (isDynamicImportError(errorMessage)) {
    event.preventDefault()
    handleChunkLoadFailure(errorMessage)
  }
})

// Gestionnaire d'erreurs DOM removeChild/appendChild
window.addEventListener(
  'error',
  (event) => {
    const errorMessage = event.error?.message || ''

    // Détecter les erreurs DOM de manipulation de nœuds
    if (
      errorMessage.includes('removeChild') ||
      errorMessage.includes('appendChild') ||
      errorMessage.includes('insertBefore')
    ) {
      console.warn('[DOM Recovery] Caught DOM manipulation error, attempting recovery')

      // Empêcher la propagation de l'erreur
      event.preventDefault()

      // Breadcrumb Sentry pour observabilité
      const sentryWindow2 = window as typeof window & {
        Sentry?: import('@/types/global').WindowWithSentry['Sentry']
      }
      if (typeof window !== 'undefined' && sentryWindow2.Sentry) {
        sentryWindow2.Sentry.addBreadcrumb({
          category: 'dom-error',
          message: 'DOM manipulation error caught and handled',
          level: 'warning',
          data: {
            errorMessage,
            route: window.location.pathname,
            stack: event.error?.stack,
          },
        })
      }

      // Forcer un re-render léger en nettoyant les portals
      setTimeout(() => {
        // Nettoyer les attributs de verrouillage du scroll qui peuvent causer des problèmes
        document.body.removeAttribute('data-scroll-locked')
        document.body.style.removeProperty('pointer-events')

        // Retirer les overlays orphelins
        const overlays = document.querySelectorAll('[data-radix-portal]')
        overlays.forEach((overlay) => {
          if (overlay.children.length === 0) {
            overlay.remove()
          }
        })
      }, 0)
    }
  },
  true
)

// Install filtered console.error (suppresses known non-actionable errors)
installConsoleErrorFilter()

// Wrapper global avec try-catch pour capturer les erreurs fatales au montage
try {
  if (import.meta.env.DEV) console.info('[Main] About to mount React')
  createRoot(document.getElementById('root')!).render(<App />)
  if (import.meta.env.DEV) console.info('[Main] React mounted successfully')
} catch (error) {
  console.error('[Main] Fatal error during React mount:', error)
  // Afficher une erreur dans le DOM
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;padding:20px;text-align:center;">
      <p style="color:#ef4444;font-size:16px;font-weight:600;">Erreur de chargement de l'application</p>
      <p style="color:#666;font-size:14px;">Une erreur s'est produite lors du chargement.</p>
      <button id="reload-fatal-app" style="padding:8px 16px;background:#353a46;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px;">Actualiser la page</button>
    </div>`
    document
      .getElementById('reload-fatal-app')
      ?.addEventListener('click', () => window.location.reload())
  }
}
