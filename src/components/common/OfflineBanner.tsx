import { useEffect, useState } from 'react'
import { WifiOff, Inbox } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/shared/useOnlineStatus'
import { countPending, onOutboxChange } from '@/lib/offlineOutbox'

/**
 * Bandeau fin affiché en haut de l'app dès que la connexion est perdue,
 * avec compteur d'éléments en file d'attente.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const n = await countPending().catch(() => 0)
      if (!cancelled) setPending(n)
    }
    void refresh()
    const off = onOutboxChange(() => void refresh())
    const interval = window.setInterval(() => void refresh(), 15_000)
    return () => {
      cancelled = true
      off()
      window.clearInterval(interval)
    }
  }, [])

  if (online && pending === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[100] px-3 py-1.5 text-xs font-medium text-white shadow-md flex items-center justify-center gap-2 ${
        online ? 'bg-blue-600' : 'bg-amber-600'
      }`}
      style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}
    >
      {online ? (
        <>
          <Inbox className="h-3.5 w-3.5" />
          <span>
            {pending === 1
              ? "1 élément en file d'attente — envoi en cours…"
              : `${pending} éléments en file d'attente — envoi en cours…`}
          </span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>
            Hors ligne — vous pouvez consulter les pages déjà visitées
            {pending > 0 ? `, ${pending} en file d'attente` : ''}
          </span>
        </>
      )}
    </div>
  )
}
