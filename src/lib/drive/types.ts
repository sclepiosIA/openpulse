/**
 * Types Gestion Drive (backend Azure `openpulse-gestion-drive-api`).
 *
 * Étape 1 du plan "Gestion Drive Custom Architecture" (Milestone 2) :
 * `/documents` évolue en façade hybride derrière le feature flag
 * `VITE_DOCUMENTS_BACKEND=legacy|azure|hybrid`, sans toucher au
 * backend Supabase existant (`@/types/documents` reste la source
 * de vérité du mode legacy).
 */

/** Mode backend de la page /documents. */
export type DocumentsBackend = 'legacy' | 'azure' | 'hybrid';

export const DOCUMENTS_BACKENDS: readonly DocumentsBackend[] = ['legacy', 'azure', 'hybrid'];

export function isDocumentsBackend(value: unknown): value is DocumentsBackend {
  return typeof value === 'string' && (DOCUMENTS_BACKENDS as readonly string[]).includes(value);
}

/** Types d'espace côté API Drive (miroir de `drive_spaces.type`). */
export type DriveSpaceType = 'gsi' | 'etablissement' | 'project' | 'dpo' | 'template' | 'personal';

export type DriveSpaceSensitivity = 'standard' | 'sensitive' | 'hds' | 'dpo_restricted';

export type DriveSyncPolicy = 'allowed' | 'web_only' | 'approval_required';

export interface DriveSpace {
  id: string;
  name: string;
  slug: string;
  type: DriveSpaceType;
  etablissement_id: string | null;
  sensitivity: DriveSpaceSensitivity;
  sync_policy: DriveSyncPolicy;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export type DriveNodeStatus = 'active' | 'deleted' | 'archived' | 'quarantine';

export interface DriveFolder {
  id: string;
  space_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  status: DriveNodeStatus;
  created_at: string;
  updated_at: string;
}

export interface DriveFile {
  id: string;
  space_id: string;
  folder_id: string | null;
  name: string;
  path: string;
  content_type: string | null;
  size_bytes: number;
  sha256: string | null;
  etag: string | null;
  current_version: number;
  status: DriveNodeStatus;
  /** Métadonnées preuve DPO/RSSI (plan §11). */
  reference_framework: 'rgpd' | 'hds' | 'iso27001' | 'ai_act' | null;
  evidence_status: 'current' | 'to_review' | 'archive' | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

/** Réponse `GET /api/drive/tree?space_id=...`. */
export interface DriveTree {
  space_id: string;
  folders: DriveFolder[];
  files: DriveFile[];
}

export type DriveEventType =
  | 'file_created'
  | 'file_updated'
  | 'file_deleted'
  | 'file_restored'
  | 'file_moved'
  | 'folder_created'
  | 'folder_deleted'
  | 'folder_moved'
  | 'permission_changed'
  | 'lock_changed';

export interface DriveChangeEvent {
  id: number;
  space_id: string;
  file_id: string | null;
  folder_id: string | null;
  event_type: DriveEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface DriveChangesResponse {
  events: DriveChangeEvent[];
  last_event_id: number;
}

/** Corps `POST /api/drive/upload-intent` (plan §7). */
export interface DriveUploadIntentRequest {
  space_id: string;
  path: string;
  size_bytes: number;
  sha256?: string;
  mtime?: string;
  base_file_id?: string | null;
  base_version?: number | null;
  content_type?: string | null;
}

export interface DriveUploadIntentResponse {
  action: 'upload' | 'noop' | 'conflict';
  upload_url: string | null;
  upload_token?: string | null;
  file_id: string;
  version: number;
  blob_container?: string | null;
  blob_name?: string | null;
  conflict: boolean;
  conflict_reason?: string | null;
  expires_at?: string | null;
}

export interface DriveUploadCompleteRequest {
  upload_token: string;
  file_id: string;
  version: number;
  etag?: string;
  sha256?: string;
  size_bytes?: number;
}

export interface DriveDownloadUrlResponse {
  download_url: string;
  expires_at: string;
}

/* ------------------------------------------------------------------ */
/* Permissions Drive (P1 gouvernance — plan §4.3)                      */
/* ------------------------------------------------------------------ */

/** Rôles de permission (miroir de `drive_permissions.permission`). */
export type DrivePermissionRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'uploader'
  | 'no_sync_local';

export const DRIVE_PERMISSION_ROLES: readonly DrivePermissionRole[] = [
  'owner',
  'admin',
  'editor',
  'viewer',
  'uploader',
  'no_sync_local',
];

/** Types de sujet (miroir de `drive_permissions.subject_type`). */
export type DrivePermissionSubjectType = 'user' | 'team' | 'role' | 'establishment';

export const DRIVE_PERMISSION_SUBJECT_TYPES: readonly DrivePermissionSubjectType[] = [
  'user',
  'team',
  'role',
  'establishment',
];

export interface DrivePermission {
  id: string;
  space_id: string;
  folder_id: string | null;
  file_id: string | null;
  subject_type: DrivePermissionSubjectType;
  subject_id: string;
  permission: DrivePermissionRole;
  created_by: string | null;
  created_at: string;
}

/** Réponse `GET /api/drive/permissions?...`. */
export interface DrivePermissionsResponse {
  space_id: string;
  folder_id: string | null;
  file_id: string | null;
  permissions: DrivePermission[];
}

/** Corps `POST /api/drive/permissions`. */
export interface DrivePermissionCreateRequest {
  space_id: string;
  folder_id?: string | null;
  file_id?: string | null;
  subject_type: DrivePermissionSubjectType;
  subject_id: string;
  permission: DrivePermissionRole;
}

/** Portée de consultation des permissions (espace, dossier ou fichier). */
export interface DrivePermissionScope {
  spaceId: string;
  folderId?: string | null;
  fileId?: string | null;
}

/** Erreur normalisée du client Drive (réseau ou HTTP non-2xx). */
export class DriveApiError extends Error {
  readonly status: number | null;
  readonly endpoint: string;

  constructor(message: string, endpoint: string, status: number | null = null) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}
