// Types pour le module de gestion documentaire centralisé

export interface Document {
  id: string;
  name: string;
  /**
   * Une ligne de `documents` est un FICHIER ou une PAGE, jamais les deux : la
   * contrainte `documents_fichier_ou_page` l'impose en base.
   *
   *   fichier -> `storage_path` renseigné, `content` nul
   *   page    -> `content` renseigné, `storage_path` nul
   *
   * D'où les trois champs nullables ci-dessous. Le typage les déclarait tous
   * obligatoires, ce qui rendait une page inexprimable : la colonne `content`
   * existait en base depuis la mise en place du wiki, mais aucun code ne
   * pouvait l'écrire sans que le compilateur refuse.
   */
  content?: string | null;
  file_size_bytes?: number | null;
  mime_type: string;
  storage_path?: string | null;
  storage_bucket: string;
  description?: string | null;
  tags?: string[] | null;
  source_type?: 'direct_upload' | 'native_editor' | 'migrated_tache' | 'migrated_rh' | 'migrated_email' | 'migrated_rd' | 'migrated_onboarding' | null;
  source_id?: string | null;
  version_number: number;
  is_latest: boolean;
  replaces_document_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  is_hard_deleted: boolean;
}

export interface DocumentRelation {
  id: string;
  document_id: string;
  related_tache_id?: string | null;
  related_etablissement_id?: string | null;
  related_contact_id?: string | null;
  related_profile_id?: string | null;
  related_groupe_id?: string | null;
  related_partenaire_id?: string | null;
  related_email_thread_id?: string | null;
  related_rd_user_story_id?: string | null;
  related_support_ticket_id?: string | null;
  relation_type?: 'source' | 'deliverable' | 'contrat' | 'facture' | 'rh' | 'procedure' | 'attachment' | 'reference' | 'archive' | 'other' | null;
  created_at: string;
  created_by?: string | null;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_with_user_id?: string | null;
  permission_level: 'view' | 'comment' | 'edit' | 'admin';
  shared_by: string;
  shared_at: string;
  expires_at?: string | null;
}

export interface DocumentAuditLog {
  id: number;
  document_id: string;
  action: 'created' | 'updated' | 'renamed' | 'downloaded' | 'viewed' | 'shared' | 'unshared' | 'permission_changed' | 'deleted' | 'restored' | 'hard_deleted' | 'version_created' | 'tagged' | 'relation_added' | 'relation_removed';
  performed_by: string;
  ip_address?: string | null;
  user_agent?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_at: string;
}

export interface DocumentStorageQuota {
  id: string;
  user_id: string;
  quota_bytes: number;
  used_bytes: number;
  last_updated: string;
}

// Types enrichis avec relations
export interface DocumentWithRelations extends Document {
  relations?: DocumentRelationExpanded[];
  shares?: DocumentShareExpanded[];
  creator?: {
    id: string;
    nom?: string;
    prenom?: string;
    avatar_url?: string;
  } | null;
  // folder_id is stored in DB but not in base Document type
  folder_id?: string | null;
}

export interface DocumentRelationExpanded extends DocumentRelation {
  etablissement?: { id: string; nom: string } | null;
  tache?: { id: string; titre: string } | null;
  groupe?: { id: string; nom: string } | null;
  partenaire?: { id: string; nom: string } | null;
  profile?: { id: string; nom?: string; prenom?: string } | null;
}

export interface DocumentShareExpanded extends DocumentShare {
  shared_with_user?: {
    id: string;
    nom?: string;
    prenom?: string;
    email?: string;
    avatar_url?: string;
  } | null;
  shared_by_user?: {
    id: string;
    nom?: string;
    prenom?: string;
  } | null;
}

// Types pour les uploads
export interface DocumentUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  documentId?: string;
}

export interface DocumentUploadOptions {
  description?: string;
  tags?: string[];
  folderId?: string; // Target folder ID - if null, DB trigger auto-assigns to "Autres documents"
  relatedEtablissementId?: string;
  relatedTacheId?: string;
  relatedProfileId?: string;
  relatedGroupeId?: string;
  relatedPartenaireId?: string;
  relatedEmailThreadId?: string;
  relatedRdUserStoryId?: string;
  relatedSupportTicketId?: string;
  relationType?: DocumentRelation['relation_type'];
}

// Types pour les filtres
export interface DocumentFilters {
  search?: string;
  mimeTypes?: string[];
  tags?: string[];
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  relatedEtablissementId?: string;
  relatedTacheId?: string;
  relatedProfileId?: string;
  showDeleted?: boolean;
}

// Types pour le tri
export type DocumentSortField = 'name' | 'created_at' | 'updated_at' | 'file_size_bytes';
export type DocumentSortOrder = 'asc' | 'desc';

export interface DocumentSort {
  field: DocumentSortField;
  order: DocumentSortOrder;
}

// Helpers pour les types MIME
export const MIME_TYPE_CATEGORIES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  pdf: ['application/pdf'],
  word: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  powerpoint: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  text: ['text/plain', 'text/csv'],
  archive: ['application/zip', 'application/x-rar-compressed'],
  video: ['video/mp4'],
  audio: ['audio/mpeg', 'audio/wav'],
} as const;

export function getMimeTypeCategory(mimeType: string): keyof typeof MIME_TYPE_CATEGORIES | 'other' {
  for (const [category, types] of Object.entries(MIME_TYPE_CATEGORIES)) {
    if ((types as readonly string[]).includes(mimeType)) {
      return category as keyof typeof MIME_TYPE_CATEGORIES;
    }
  }
  return 'other';
}

/**
 * Une PAGE n'a pas de taille de fichier : `file_size_bytes` y est NULL, et la
 * fonction rendait « NaN undefined » — `Math.log(null)` donne NaN, et
 * `sizes[NaN]` donne undefined. Le texte s'affichait tel quel dans les cartes
 * et l'aperçu. Seul le cas `=== 0` était traité.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}
