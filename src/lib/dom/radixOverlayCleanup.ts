/**
 * Radix UI Overlay Cleanup Utility
 *
 * Nettoie les locks globaux laissés par Radix UI (Dialog, DropdownMenu, Popover, etc.)
 * qui peuvent bloquer la navigation et les interactions utilisateur.
 */

interface CleanupOptions {
  /** Si true, envoie un Escape global et nettoie les portals orphelins */
  aggressive?: boolean
  /** Si true, affiche des logs de debug */
  debug?: boolean
}

/**
 * Vérifie si un vrai dialog/alertdialog est actuellement ouvert
 */
export const hasOpenDialog = (): boolean => {
  // Garde SSR / test : la fonction peut être appelée via un setTimeout différé
  // après le teardown de l'environnement jsdom (document undefined).
  if (typeof document === 'undefined') return false
  const openDialogs = document.querySelectorAll(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
  )
  return openDialogs.length > 0
}

/**
 * Vérifie si le body est actuellement verrouillé par Radix
 */
export const isBodyLocked = (): boolean => {
  if (typeof document === 'undefined') return false
  return (
    document.body.hasAttribute('data-scroll-locked') ||
    document.body.style.pointerEvents === 'none' ||
    document.body.style.overflow === 'hidden' ||
    document.documentElement.style.overflow === 'hidden'
  )
}

/**
 * Nettoie tous les locks Radix UI du DOM
 */
export const cleanupRadixUIState = (options: CleanupOptions = {}): void => {
  // Garde SSR / test : un nettoyage différé (setTimeout) peut se déclencher
  // après le teardown de jsdom — éviter "document is not defined".
  if (typeof document === 'undefined') return
  const { aggressive = false, debug = false } = options

  // Ne pas nettoyer si un vrai dialog est ouvert (sauf en mode agressif)
  if (!aggressive && hasOpenDialog()) {
    if (debug) {
      console.debug('[RadixCleanup] Skipped - dialog is open')
    }
    return
  }

  const state = {
    hadScrollLock: document.body.hasAttribute('data-scroll-locked'),
    bodyOverflow: document.body.style.overflow,
    bodyPointerEvents: document.body.style.pointerEvents,
    htmlOverflow: document.documentElement.style.overflow,
    portalsCount: document.querySelectorAll('[data-radix-portal]').length,
  }

  if (debug) {
    console.debug('[RadixCleanup] Before cleanup:', state)
  }

  // En mode agressif, envoyer Escape pour fermer les menus/popovers
  if (aggressive) {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    )
  }

  // Nettoyer body
  if (document.body.hasAttribute('data-scroll-locked')) {
    document.body.removeAttribute('data-scroll-locked')
  }

  // Réinitialiser pointer-events (body + html)
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = ''
  }
  if (document.documentElement.style.pointerEvents === 'none') {
    document.documentElement.style.pointerEvents = ''
  }

  // Réinitialiser overflow sur body
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = ''
  }

  // Réinitialiser overflow sur html
  if (document.documentElement.style.overflow === 'hidden') {
    document.documentElement.style.overflow = ''
  }

  // En mode agressif, nettoyer les portals Radix orphelins et les focus guards
  if (aggressive) {
    // Retirer les portals sans contenu ouvert (même s'ils contiennent du DOM fermé)
    const portals = document.querySelectorAll('[data-radix-portal]')
    portals.forEach((portal) => {
      const hasOpenContent = portal.querySelector('[data-state="open"]')
      if (!hasOpenContent) {
        portal.remove()
      }
    })

    // Retirer les focus guards orphelins laissés par Radix
    const focusGuards = document.querySelectorAll('[data-radix-focus-guard]')
    focusGuards.forEach((guard) => guard.remove())

    // Retirer les aria-hidden injectés par Radix sur le body direct children
    document.querySelectorAll('body > [data-aria-hidden="true"]').forEach((el) => {
      el.removeAttribute('aria-hidden')
      el.removeAttribute('data-aria-hidden')
    })
  }

  if (debug) {
    console.debug('[RadixCleanup] After cleanup:', {
      hasScrollLock: document.body.hasAttribute('data-scroll-locked'),
      bodyOverflow: document.body.style.overflow,
      bodyPointerEvents: document.body.style.pointerEvents,
      htmlOverflow: document.documentElement.style.overflow,
      portalsRemaining: document.querySelectorAll('[data-radix-portal]').length,
    })
  }
}

/**
 * Hook-style cleanup qui s'exécute en deux temps (immédiat + différé)
 * pour attraper les effets asynchrones de Radix
 */
export const cleanupRadixUIStateDelayed = (options: CleanupOptions = {}): void => {
  // Nettoyage immédiat
  cleanupRadixUIState(options)

  // Nettoyage différé pour les effets async
  setTimeout(() => cleanupRadixUIState(options), 0)
  setTimeout(() => cleanupRadixUIState(options), 100)
}

/**
 * Crée un watchdog qui surveille et répare les locks orphelins
 * @returns Fonction de cleanup pour arrêter le watchdog
 */
export const createRadixWatchdog = (intervalMs = 500, debug = false): (() => void) => {
  const intervalId = setInterval(() => {
    // Si le body est verrouillé mais qu'aucun dialog n'est ouvert, c'est un bug
    if (isBodyLocked() && !hasOpenDialog()) {
      if (debug) {
        console.debug('[RadixWatchdog] Detected orphan lock, cleaning up...')
      }
      cleanupRadixUIState({ aggressive: false, debug })
    }
  }, intervalMs)

  return () => clearInterval(intervalId)
}
