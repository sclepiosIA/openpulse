import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { debug } from '@/lib/debug'

/**
 * Auto-sync client-side pour compléter le CRON serveur (1 min).
 * - Sync au focus fenêtre (visibilitychange) si dernière sync > 30s
 * - Sync périodique toutes les 45s tant que l'onglet est visible
 * - Debounce interne pour éviter les doublons
 *
 * L'utilisateur voit donc les nouveaux mails :
 *   - < 60s en background (CRON pg_cron)
 *   - < 45s en foreground actif
 *   - Immédiatement au retour sur l'onglet
 */

const MIN_INTERVAL_MS = 30_000 // debounce global
const FOREGROUND_POLL_MS = 45_000

let lastSyncAt = 0
let inFlight: Promise<void> | null = null
// Comptes marqués comme non-syncables (404, decryption fail, sync_enabled=false).
// On les zappe pour la session pour ne pas spammer l'edge function.
const blockedAccounts = new Set<string>()

async function triggerSync(accountId: string | undefined, source: string) {
  if (!accountId || accountId === 'all') return
  if (blockedAccounts.has(accountId)) return
  if (Date.now() - lastSyncAt < MIN_INTERVAL_MS) return
  if (inFlight) return inFlight

  lastSyncAt = Date.now()
  inFlight = (async () => {
    try {
      debug.log(`[auto-sync] triggered (${source})`, { accountId })
      const { error } = await supabase.functions.invoke('sync-emails', {
        body: { account_id: accountId, mode: 'auto', trigger_source: source },
      })
      if (error) {
        // FunctionsHttpError expose le status HTTP. 4xx = compte inutilisable
        // (introuvable, désactivé, mot de passe non déchiffrable) → on blackliste
        // pour la session pour éviter la boucle de polling toutes les 45s.
        const status =
          (error as { status?: number; context?: { status?: number } })?.status ??
          (error as { context?: { status?: number } })?.context?.status
        if (status && status >= 400 && status < 500) {
          blockedAccounts.add(accountId)
          debug.warn('[auto-sync] account blacklisted (client-side)', { accountId, status })
        } else {
          debug.error('[auto-sync] error', error)
        }
      } else {
        window.dispatchEvent(new CustomEvent('email-realtime-update'))
      }
    } catch (e) {
      debug.error('[auto-sync] exception', e)
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export function useEmailAutoSync(accountId: string | undefined, enabled = true) {
  const accountRef = useRef(accountId)
  accountRef.current = accountId

  useEffect(() => {
    if (!enabled || !accountId || accountId === 'all') return

    // 1. Sync immédiate à l'entrée sur la page (respecte debounce global)
    triggerSync(accountRef.current, 'mount')

    // 2. Sync au retour de focus / onglet redevenant visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerSync(accountRef.current, 'focus')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    // 3. Polling foreground toutes les 45s
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerSync(accountRef.current, 'interval')
      }
    }, FOREGROUND_POLL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.clearInterval(interval)
    }
  }, [accountId, enabled])
}
