// Centre de notifications du shell Gestion Desktop (plan §5 — Phase 2).
// Cloche + badge non lus dans le coin du shell ; panneau déroulant listant
// l'historique (poll + événement Tauri temps réel), actions "tout lire" /
// "vider", indicateur ne pas déranger.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearNotifications,
  listNotifications,
  markNotificationsRead,
  onNewNotification,
  MODULE_LABELS,
} from "../api/notificationsClient";
import type {
  NotificationCenterSnapshot,
  NotificationModuleId,
} from "../api/notificationsClient";

const POLL_MS = 15_000;

const MODULE_ICONS: Record<string, string> = {
  pulse: "💬",
  mail: "✉️",
  todo: "✅",
  drive: "📁",
  system: "🖥️",
};

function moduleLabel(module: string): string {
  return MODULE_LABELS[module as NotificationModuleId] ?? module;
}

function formatTime(epochSecs: number): string {
  const d = new Date(epochSecs * 1000);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString("fr-FR")} ${time}`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<NotificationCenterSnapshot | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(() => {
    listNotifications().then(setSnapshot).catch(console.error);
  }, []);

  // Poll périodique + rafraîchissement temps réel via l'événement Tauri.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    let unlisten: (() => void) | undefined;
    onNewNotification(() => refresh())
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      clearInterval(id);
      unlisten?.();
    };
  }, [refresh]);

  // Fermeture au clic extérieur ou à la touche Échap.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const unread = snapshot?.unread_count ?? 0;
  const dndActive = snapshot?.do_not_disturb_active ?? false;
  const items = snapshot?.items ?? [];

  async function onMarkAllRead() {
    await markNotificationsRead().catch(console.error);
    refresh();
  }

  async function onClear() {
    await clearNotifications().catch(console.error);
    refresh();
  }

  async function onItemClick(id: string) {
    await markNotificationsRead(id).catch(console.error);
    refresh();
  }

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        className="notification-bell"
        aria-label={
          unread > 0 ? `Notifications (${unread} non lue${unread > 1 ? "s" : ""})` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{dndActive ? "🔕" : "🔔"}</span>
        {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="notification-panel" role="region" aria-label="Centre de notifications">
          <div className="notification-panel-header">
            <strong>Notifications</strong>
            {dndActive && <span className="badge badge-dnd">Ne pas déranger</span>}
          </div>

          {items.length === 0 ? (
            <p className="muted notification-empty">Aucune notification.</p>
          ) : (
            <ul className="notification-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notification-item${n.read ? "" : " notification-item-unread"}`}
                    onClick={() => onItemClick(n.id)}
                    title={n.read ? undefined : "Marquer comme lue"}
                  >
                    <span className="notification-item-icon" aria-hidden="true">
                      {MODULE_ICONS[n.module] ?? "🔔"}
                    </span>
                    <span className="notification-item-content">
                      <span className="notification-item-title">{n.title}</span>
                      {n.body && <span className="notification-item-body">{n.body}</span>}
                      <span className="notification-item-meta">
                        {moduleLabel(n.module)} · {formatTime(n.created_at)}
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
        </div>
      )}
    </div>
  );
}
