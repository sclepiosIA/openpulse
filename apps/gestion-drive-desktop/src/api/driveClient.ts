// Client API du front. Deux modes :
//  - Tauri : passe par invoke() vers les commandes Rust (mock côté Rust).
//  - Navigateur pur (npm run dev hors Tauri) : mock TypeScript local,
//    pratique pour itérer sur l'UI sans toolchain Rust.

import type {
  ClientConfig,
  EvictReport,
  FileEntry,
  PinResult,
  PullProgress,
  PushProgress,
  SessionInfo,
  Space,
  SyncLogEntry,
  SyncStatus,
} from './types'
import { isSpaceSyncable } from './types'

function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const SESSION_REVOKED_PREFIX = 'SESSION_REVOKED:'

export function isConfirmedSessionRevocation(message: string): boolean {
  return message.trimStart().startsWith(SESSION_REVOKED_PREFIX)
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

// ---------------------------------------------------------------------------
// Mock navigateur (aligné sur commands.rs::mock_spaces)
// ---------------------------------------------------------------------------

export const MOCK_SPACES: Space[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'OpenPulse — Documents généraux',
    slug: 'openpulse-general',
    space_type: 'gsi',
    sync_policy: 'allowed',
    sensitivity: 'standard',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Établissement — CH Démo',
    slug: 'etab-ch-demo',
    space_type: 'etablissement',
    sync_policy: 'allowed',
    sensitivity: 'sensitive',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'DPO/RSSI — Preuves',
    slug: 'dpo-preuves',
    space_type: 'dpo',
    sync_policy: 'web_only',
    sensitivity: 'dpo_restricted',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Templates & liasses',
    slug: 'templates',
    space_type: 'template',
    sync_policy: 'allowed',
    sensitivity: 'standard',
  },
]

const browserMockConfig: ClientConfig = {
  api_base_url: 'http://localhost:8787',
  sync_root: null,
  machine_id: 'browser-mock',
  device_name: 'Navigateur (mock)',
  selected_space_ids: [],
  poll_interval_secs: 30,
  debounce_ms: 2000,
}

const browserSyncLogs: SyncLogEntry[] = []

function appendBrowserSyncLog(
  level: SyncLogEntry['level'],
  scope: SyncLogEntry['scope'],
  message: string
): void {
  browserSyncLogs.unshift({
    ts: Math.floor(Date.now() / 1000),
    level,
    scope,
    message,
  })
  browserSyncLogs.splice(2000)
}

// ---------------------------------------------------------------------------
// API publique du front
// ---------------------------------------------------------------------------

export interface DriveSessionHandoff {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userEmail: string
  displayName: string
}

export async function loginWithDriveSession(handoff: DriveSessionHandoff): Promise<SessionInfo> {
  if (!handoff.accessToken.trim()) throw new Error('Jeton Drive requis')
  if (handoff.refreshToken.length < 32 || handoff.refreshToken.length > 1024) {
    throw new Error('Jeton de renouvellement Drive invalide')
  }
  if (handoff.expiresAt <= Date.now() / 1000) throw new Error('Jeton Drive expiré')
  if (!handoff.userEmail.includes('@')) throw new Error('Identité Drive invalide')
  if (hasTauri()) {
    return invoke<SessionInfo>('login_with_drive_session', {
      accessToken: handoff.accessToken,
      refreshToken: handoff.refreshToken,
      expiresAt: handoff.expiresAt,
      userEmail: handoff.userEmail,
      displayName: handoff.displayName,
    })
  }
  return {
    user_email: handoff.userEmail,
    display_name: handoff.displayName,
    device_registered: true,
  }
}

export async function setDriveAutoConnect(enabled: boolean): Promise<void> {
  if (hasTauri()) await invoke<void>('set_drive_auto_connect', { enabled })
}

export async function logout(): Promise<void> {
  if (hasTauri()) await invoke<void>('logout')
  window.dispatchEvent(new Event('gestion-desktop-drive-auth-disabled'))
}

export async function getSavedSession(): Promise<SessionInfo | null> {
  if (hasTauri()) return invoke<SessionInfo | null>('get_saved_session')
  return null
}

/** Réinitialise uniquement la session web embarquée (cookies/cache/localStorage PWA). */
export async function resetPwaSession(): Promise<void> {
  if (hasTauri()) return invoke<void>('reset_pwa_session')
}

export async function getConfig(): Promise<ClientConfig> {
  if (hasTauri()) return invoke<ClientConfig>('get_config')
  return { ...browserMockConfig }
}

export async function setSyncRoot(path: string): Promise<void> {
  if (hasTauri()) return invoke<void>('set_sync_root', { path })
  browserMockConfig.sync_root = path
}

export async function listSpaces(): Promise<Space[]> {
  if (hasTauri()) return invoke<Space[]>('list_spaces_real')
  return MOCK_SPACES
}

/** Retourne les ids réellement retenus (les web_only sont filtrés). */
export async function selectSpaces(spaceIds: string[]): Promise<string[]> {
  if (hasTauri()) return invoke<string[]>('select_spaces', { spaceIds })
  const allowed = MOCK_SPACES.filter((s) => isSpaceSyncable(s) && spaceIds.includes(s.id)).map(
    (s) => s.id
  )
  browserMockConfig.selected_space_ids = allowed
  return allowed
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (hasTauri()) return invoke<SyncStatus>('sync_status')
  return {
    state: 'idle',
    pending_uploads: 0,
    pending_downloads: 0,
    conflicts: 0,
    errors: 0,
    last_sync_at: null,
  }
}

const idlePullProgress: PullProgress = {
  running: false,
  phase: 'idle',
  current_space: null,
  total_files: 0,
  processed_files: 0,
  downloaded_files: 0,
  skipped_files: 0,
  failed_files: 0,
  current_file: null,
  last_error: null,
  last_event_id: 0,
  finished_at: null,
}

/** Lance un cycle de pull sync (tree → changes → downloads) en arrière-plan. */
export async function runPullSync(): Promise<void> {
  if (hasTauri()) return invoke<void>('run_pull_sync')
  appendBrowserSyncLog('info', 'pull', 'Cycle de réception mock terminé : aucun fichier à recevoir')
}

/** Progression du pull sync en cours (à poller). */
export async function getPullProgress(): Promise<PullProgress> {
  if (hasTauri()) return invoke<PullProgress>('pull_progress')
  return { ...idlePullProgress }
}

const idlePushProgress: PushProgress = {
  running: false,
  phase: 'idle',
  scanned_files: 0,
  queued_files: 0,
  uploaded_files: 0,
  noop_files: 0,
  conflict_files: 0,
  failed_files: 0,
  rescheduled_files: 0,
  pending_ops: 0,
  last_error: null,
  finished_at: null,
}

/** Lance un cycle de push sync (scan local → upload Azure) en arrière-plan. */
export async function runPushSync(): Promise<void> {
  if (hasTauri()) return invoke<void>('run_push_sync')
  appendBrowserSyncLog('info', 'push', "Cycle d'envoi mock terminé : aucun fichier à envoyer")
}

/** Progression du push sync en cours (à poller). */
export async function getPushProgress(): Promise<PushProgress> {
  if (hasTauri()) return invoke<PushProgress>('push_progress')
  return { ...idlePushProgress }
}

/** Ouvre le sélecteur de dossier natif (Tauri) ou un prompt (navigateur). */
export async function pickFolder(): Promise<string | null> {
  if (hasTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const picked = await open({
      directory: true,
      multiple: false,
      title: 'Choisir le dossier Gestion Drive',
    })
    return typeof picked === 'string' ? picked : null
  }
  return window.prompt('Chemin du dossier à synchroniser :', '~/GestionDrive')
}

/** Dernières lignes du journal de synchronisation, plus récentes d'abord. */
export async function getSyncLogs(limit = 50): Promise<SyncLogEntry[]> {
  if (hasTauri()) return invoke<SyncLogEntry[]>('get_sync_logs', { limit })
  return browserSyncLogs.slice(0, limit)
}

/** Exporte le journal complet côté Tauri ; en navigateur, retourne un chemin mock lisible. */
export async function exportSyncLogs(): Promise<string> {
  if (hasTauri()) return invoke<string>('export_sync_logs')
  if (browserSyncLogs.length === 0) {
    throw new Error("Journal vide : lancez d'abord une synchronisation")
  }
  return 'journal-mock://gestion-drive-sync.log'
}

/** Vide le journal de diagnostic sync. */
export async function clearSyncLogs(): Promise<void> {
  if (hasTauri()) return invoke<void>('clear_sync_logs')
  browserSyncLogs.splice(0)
}

export async function getLocalFiles(limit = 500, offset = 0): Promise<FileEntry[]> {
  if (hasTauri()) return invoke<FileEntry[]>('list_local_files', { limit, offset })
  return []
}

export async function copyDriveLink(localPath: string): Promise<string> {
  if (hasTauri()) return invoke<string>('copy_drive_link', { localPath })
  throw new Error('Action disponible uniquement dans l’app desktop installée')
}

export async function openInGestion(localPath: string): Promise<string> {
  if (hasTauri()) return invoke<string>('open_in_gestion', { localPath })
  throw new Error('Action disponible uniquement dans l’app desktop installée')
}

export async function revealInFileManager(localPath: string): Promise<void> {
  if (hasTauri()) return invoke<void>('reveal_in_file_manager', { localPath })
  throw new Error('Action disponible uniquement dans l’app desktop installée')
}

export async function pinFile(localPath: string): Promise<PinResult> {
  if (hasTauri()) return invoke<PinResult>('pin_file', { localPath })
  return { local_path: localPath, pin_state: 'pinned', needs_download: false }
}

export async function unpinFile(localPath: string): Promise<PinResult> {
  if (hasTauri()) return invoke<PinResult>('unpin_file', { localPath })
  return { local_path: localPath, pin_state: 'unpinned', needs_download: false }
}

export async function evictFile(localPath: string): Promise<EvictReport> {
  if (hasTauri()) return invoke<EvictReport>('evict_file', { localPath })
  throw new Error('Libérer l’espace nécessite l’app desktop installée')
}

/** « Télécharger » : re-matérialise un fichier libéré sans l'épingler. */
export async function downloadFile(localPath: string): Promise<PinResult> {
  if (hasTauri()) return invoke<PinResult>('download_file', { localPath })
  return { local_path: localPath, pin_state: 'unpinned', needs_download: true }
}
