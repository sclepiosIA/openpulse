import { useEffect } from 'react'
import { toast } from 'sonner'
import { flushOutbox } from '@/lib/offlineOutbox'

/**
 * Vide la file d'attente (emails + notes) au retour du réseau,
 * puis ré-essaye toutes les 60 s tant que des items restent en `failed`.
 * À monter une seule fois (au niveau App).
 */
export function useOutboxFlusher(): void {
  useEffect(() => {
    let cancelled = false

    const run = async (silent = false) => {
      try {
        const { sent, failed } = await flushOutbox()
        if (cancelled) return
        if (sent > 0 && !silent) {
          toast.success(
            sent === 1
              ? "1 élément envoyé depuis la file d'attente"
              : `${sent} éléments envoyés depuis la file d'attente`
          )
        }
        if (failed > 0 && !silent) {
          toast.error(
            failed === 1
              ? "Impossible d'envoyer un brouillon (réessai automatique)"
              : `Impossible d'envoyer ${failed} brouillons (réessai automatique)`
          )
        }
      } catch {
        /* swallow */
      }
    }

    // Tentative initiale silencieuse au mount (si déjà online + items en attente)
    void run(true)

    const onOnline = () => void run(false)
    window.addEventListener('online', onOnline)

    // Re-tentative périodique (60 s) en arrière-plan
    const interval = window.setInterval(() => {
      if (navigator.onLine) void run(true)
    }, 60_000)

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [])
}
