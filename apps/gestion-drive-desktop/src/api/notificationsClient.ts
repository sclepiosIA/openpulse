// Client notifications + préférences du shell Gestion Desktop.
// Deux modes, comme driveClient :
//  - Tauri : invoke() vers preferences.rs / notifications.rs.
//  - Navigateur pur : mock local (itération UI sans toolchain Rust).

export type NotificationModuleId = 'pulse' | 'mail' | 'todo' | 'drive' | 'system'

export interface ModuleNotificationPrefs {
  pulse: boolean
  mail: boolean
  todo: boolean
  drive: boolean
}

export interface DoNotDisturbPrefs {
  enabled: boolean
  schedule_enabled: boolean
  /** Minutes depuis minuit, heure locale (peut franchir minuit). */
  start_minutes: number
  end_minutes: number
}

export interface AppPreferences {
  notifications: ModuleNotificationPrefs
  do_not_disturb: DoNotDisturbPrefs
  launch_at_login: boolean
  sync_paused: boolean
  drive_auto_connect: boolean
  poll_interval_secs: number
}

export interface NotificationRecord {
  id: string
  module: string
  title: string
  body: string
  created_at: number
  read: boolean
  delivered_natively: boolean
}

export interface NotificationCenterSnapshot {
  items: NotificationRecord[]
  unread_count: number
  do_not_disturb_active: boolean
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  notifications: { pulse: true, mail: true, todo: true, drive: true },
  do_not_disturb: {
    enabled: false,
    schedule_enabled: false,
    start_minutes: 22 * 60,
    end_minutes: 8 * 60,
  },
  launch_at_login: false,
  sync_paused: false,
  drive_auto_connect: false,
  poll_interval_secs: 60,
}

/** Libellés FR des modules (UI préférences + centre). */
export const MODULE_LABELS: Record<NotificationModuleId, string> = {
  pulse: 'Pulse',
  mail: 'Mail',
  todo: 'Todo',
  drive: 'Drive',
  system: 'Système',
}

function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

// ---------------------------------------------------------------------------
// Logique pure partagée (miroir de preferences.rs — testée côté TS aussi)
// ---------------------------------------------------------------------------

/** Le mode ne pas déranger est-il actif à `localMinutes` ? */
export function isDndActive(dnd: DoNotDisturbPrefs, localMinutes: number): boolean {
  if (dnd.enabled) return true
  if (!dnd.schedule_enabled || dnd.start_minutes === dnd.end_minutes) return false
  if (dnd.start_minutes < dnd.end_minutes) {
    return localMinutes >= dnd.start_minutes && localMinutes < dnd.end_minutes
  }
  return localMinutes >= dnd.start_minutes || localMinutes < dnd.end_minutes
}

/** Une notification de ce module doit-elle être affichée nativement ? */
export function shouldDeliverNatively(
  prefs: AppPreferences,
  module: NotificationModuleId,
  localMinutes: number
): boolean {
  const moduleEnabled = module === 'system' ? true : prefs.notifications[module]
  return moduleEnabled && !isDndActive(prefs.do_not_disturb, localMinutes)
}

/** "HH:MM" ↔ minutes depuis minuit, pour les inputs time de l'UI. */
export function minutesToTime(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return 0
  const h = Math.max(0, Math.min(23, parseInt(match[1], 10)))
  const m = Math.max(0, Math.min(59, parseInt(match[2], 10)))
  return h * 60 + m
}

// ---------------------------------------------------------------------------
// Mock navigateur
// ---------------------------------------------------------------------------

let browserPrefs: AppPreferences = structuredClone(DEFAULT_PREFERENCES)
let browserNotifications: NotificationRecord[] = []
const BROWSER_MAX_HISTORY = 200

function localMinutesNow(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/** Réinitialise le mock navigateur (tests). */
export function __resetBrowserMocks(): void {
  browserPrefs = structuredClone(DEFAULT_PREFERENCES)
  browserNotifications = []
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export async function getPreferences(): Promise<AppPreferences> {
  if (hasTauri()) return invoke<AppPreferences>('get_preferences')
  return structuredClone(browserPrefs)
}

export async function setPreferences(preferences: AppPreferences): Promise<AppPreferences> {
  if (hasTauri()) {
    const saved = await invoke<AppPreferences>('set_preferences', { preferences })
    const autostart = await import('@tauri-apps/plugin-autostart')
    if (saved.launch_at_login) await autostart.enable()
    else await autostart.disable()
    return saved
  }
  browserPrefs = structuredClone(preferences)
  return structuredClone(browserPrefs)
}

export async function setDoNotDisturb(enabled: boolean): Promise<AppPreferences> {
  if (hasTauri()) return invoke<AppPreferences>('set_do_not_disturb', { enabled })
  browserPrefs.do_not_disturb.enabled = enabled
  return structuredClone(browserPrefs)
}

export async function sendNotification(
  module: NotificationModuleId,
  title: string,
  body = ''
): Promise<NotificationRecord> {
  if (hasTauri()) {
    try {
      const { isPermissionGranted, requestPermission } =
        await import('@tauri-apps/plugin-notification')
      if (!(await isPermissionGranted())) {
        await requestPermission()
      }
    } catch {
      // L'IPC Rust tentera quand même l'envoi et enregistrera l'échec dans le centre.
    }
    return invoke<NotificationRecord>('notify', { request: { module, title, body } })
  }
  const record: NotificationRecord = {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    module,
    title,
    body,
    created_at: Math.floor(Date.now() / 1000),
    read: false,
    delivered_natively: shouldDeliverNatively(browserPrefs, module, localMinutesNow()),
  }
  browserNotifications.unshift(record)
  browserNotifications = browserNotifications.slice(0, BROWSER_MAX_HISTORY)
  return record
}

export async function listNotifications(): Promise<NotificationCenterSnapshot> {
  if (hasTauri()) return invoke<NotificationCenterSnapshot>('list_notifications')
  return {
    items: [...browserNotifications],
    unread_count: browserNotifications.filter((n) => !n.read).length,
    do_not_disturb_active: isDndActive(browserPrefs.do_not_disturb, localMinutesNow()),
  }
}

/** Marque une notification (ou toutes si id omis) comme lue(s). */
export async function markNotificationsRead(id?: string): Promise<number> {
  if (hasTauri()) return invoke<number>('mark_notifications_read', { id: id ?? null })
  let updated = 0
  for (const n of browserNotifications) {
    if ((id === undefined || n.id === id) && !n.read) {
      n.read = true
      updated += 1
    }
  }
  return updated
}

export async function clearNotifications(): Promise<void> {
  if (hasTauri()) return invoke<void>('clear_notifications')
  browserNotifications = []
}

/**
 * Abonnement aux nouvelles notifications (événement Tauri).
 * Retourne une fonction de désabonnement. No-op hors Tauri (le mock
 * fonctionne par polling).
 */
export async function onNewNotification(
  handler: (record: NotificationRecord) => void
): Promise<() => void> {
  if (!hasTauri()) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<NotificationRecord>('gestion://notification', (event) => {
    handler(event.payload)
  })
  return unlisten
}
