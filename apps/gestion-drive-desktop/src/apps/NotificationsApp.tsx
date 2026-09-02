// Centre de notifications en mode panneau (shell PWA plein écran).
// Aucune surcouche permanente : ce module s'ouvre depuis le menu natif/tray
// (gestion://navigate → "notifications"), comme Drive et Préférences.
// Historique in-app + actions "tout lire" / "vider" + indicateur DND.

import { useCallback, useEffect, useState } from 'react'
import {
  clearNotifications,
  listNotifications,
  markNotificationsRead,
  onNewNotification,
  MODULE_LABELS,
} from '../api/notificationsClient'
import type { NotificationCenterSnapshot, NotificationModuleId } from '../api/notificationsClient'

const POLL_MS = 15_000

const MODULE_ICONS: Record<string, string> = {
  pulse: '💬',
  mail: '✉️',
  todo: '✅',
  drive: '📁',
  system: '🖥️',
}

function moduleLabel(module: string): string {
  return MODULE_LABELS[module as NotificationModuleId] ?? module
}

export function formatNotificationTime(epochSecs: number, now: Date = new Date()): string {
  const d = new Date(epochSecs * 1000)
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString('fr-FR')} ${time}`
}

export default function NotificationsApp() {
  const [snapshot, setSnapshot] = useState<NotificationCenterSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    listNotifications()
      .then((s) => {
        setSnapshot(s)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  // Poll périodique + rafraîchissement temps réel via l'événement Tauri.
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    let unlisten: (() => void) | undefined
    onNewNotification(() => refresh())
      .then((fn) => {
        unlisten = fn
      })
      .catch(console.error)
    return () => {
      clearInterval(id)
      unlisten?.()
    }
  }, [refresh])

  const unread = snapshot?.unread_count ?? 0
  const dndActive = snapshot?.do_not_disturb_active ?? false
  const items = snapshot?.items ?? []

  async function onMarkAllRead() {
    await markNotificationsRead().catch(console.error)
    refresh()
  }

  async function onClear() {
    await clearNotifications().catch(console.error)
    refresh()
  }

  async function onItemClick(id: string) {
    await markNotificationsRead(id).catch(console.error)
    refresh()
  }

  return (
    <section className="card" aria-label="Centre de notifications">
      <div className="notification-panel-header">
        <h1>Notifications{unread > 0 ? ` (${unread})` : ''}</h1>
        {dndActive && <span className="badge badge-dnd">Ne pas déranger</span>}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="muted notification-empty">Aucune notification.</p>
      ) : (
        <ul className="notification-list">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`notification-item${n.read ? '' : ' notification-item-unread'}`}
                onClick={() => onItemClick(n.id)}
                title={n.read ? undefined : 'Marquer comme lue'}
              >
                <span className="notification-item-icon" aria-hidden="true">
                  {MODULE_ICONS[n.module] ?? '🔔'}
                </span>
                <span className="notification-item-content">
                  <span className="notification-item-title">{n.title}</span>
                  {n.body && <span className="notification-item-body">{n.body}</span>}
                  <span className="notification-item-meta">
                    {moduleLabel(n.module)} · {formatNotificationTime(n.created_at)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="notification-panel-actions">
        <button className="secondary" onClick={onMarkAllRead} disabled={unread === 0}>
          Tout marquer comme lu
        </button>
        <button className="secondary" onClick={onClear} disabled={items.length === 0}>
          Vider
        </button>
      </div>
    </section>
  )
}
