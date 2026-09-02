// Types partagés UI ↔ backend Tauri (miroir de sync-core::models côté Rust).

export type SyncPolicy = 'allowed' | 'web_only' | 'approval_required'
export type Sensitivity = 'standard' | 'sensitive' | 'hds' | 'dpo_restricted'
export type SpaceType = 'gsi' | 'etablissement' | 'project' | 'dpo' | 'template' | 'personal'

export interface Space {
  id: string
  name: string
  slug: string
  space_type: SpaceType
  sync_policy: SyncPolicy
  sensitivity: Sensitivity
}

export interface SessionInfo {
  user_email: string
  display_name: string
  device_registered: boolean
}

export interface ClientConfig {
  api_base_url: string
  sync_root: string | null
  machine_id: string
  device_name: string
  selected_space_ids: string[]
  poll_interval_secs: number
  debounce_ms: number
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'paused' | 'error' | 'offline'
  pending_uploads: number
  pending_downloads: number
  conflicts: number
  errors: number
  last_sync_at: number | null
}

/** Progression du pull sync (miroir de src-tauri::sync::PullProgress). */
export interface PullProgress {
  running: boolean
  phase: 'idle' | 'listing' | 'downloading' | 'done' | 'error'
  current_space: string | null
  total_files: number
  processed_files: number
  downloaded_files: number
  skipped_files: number
  failed_files: number
  current_file: string | null
  last_error: string | null
  last_event_id: number
  finished_at: number | null
}

/** Progression du push sync (miroir de src-tauri::push_sync::PushProgress). */
export interface PushProgress {
  running: boolean
  phase: 'idle' | 'scanning' | 'uploading' | 'done' | 'error'
  scanned_files: number
  queued_files: number
  uploaded_files: number
  noop_files: number
  conflict_files: number
  failed_files: number
  rescheduled_files: number
  pending_ops: number
  last_error: string | null
  finished_at: number | null
}

export type SyncLogLevel = 'info' | 'warn' | 'error'

/** Ligne du journal de synchronisation exportable (miroir de sync_log::LogEntry). */
export interface SyncLogEntry {
  /** Epoch secondes UTC. */
  ts: number
  level: SyncLogLevel
  scope: 'pull' | 'push' | 'system' | string
  message: string
}

export type FileAction =
  | 'copy_link'
  | 'open_in_gestion'
  | 'reveal_in_file_manager'
  | 'download'
  | 'keep_local'
  | 'unpin'
  | 'free_space'

export type PinState = 'pinned' | 'unpinned' | 'evicted'

export type SyncState =
  | 'idle'
  | 'pending_upload'
  | 'pending_download'
  | 'uploading'
  | 'downloading'
  | 'conflict'
  | 'error'
  | 'ignored'

export interface FileEntry {
  local_path: string
  space_id: string
  file_id: string | null
  folder_id: string | null
  sha256: string | null
  etag: string | null
  version: number
  size_bytes: number
  mtime: number
  sync_state: SyncState
  pin_state: PinState
  last_error: string | null
  updated_at: number
  actions: FileAction[]
}

export interface PinResult {
  local_path: string
  pin_state: PinState
  needs_download: boolean
}

export interface EvictReport {
  local_path: string
  freed_bytes: number
}

/** Un espace web_only ne doit jamais être proposé à la sync locale. */
export function isSpaceSyncable(space: Space): boolean {
  return space.sync_policy === 'allowed'
}
