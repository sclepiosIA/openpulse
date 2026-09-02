/**
 * Types stricts pour le système d'emails
 * Remplace tous les `any` pour améliorer la sécurité des types
 */

export type EmailCategory = 
  | 'formation'
  | 'support'
  | 'commercial'
  | 'administratif'
  | 'technique'
  | 'autre';

export type EmailPriority = 'high' | 'medium' | 'low';

export type EmailMailbox = 'inbox' | 'sent' | 'trash' | 'all';

export type ParticipantType = 'from' | 'to' | 'cc' | 'bcc';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailParticipant {
  email: string;
  name: string | null;
  type: ParticipantType;
}

export interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  created_at: string;
  last_sync_at: string | null;
  profile_id: string;
}

// Safe version without encrypted_password (from view)
export interface EmailAccountSafe {
  id: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  sync_enabled: boolean;
  is_shared: boolean;
  last_sync_at: string | null;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  created_at: string;
  updated_at: string;
}

export interface Etablissement {
  id: string;
  nom: string;
  ville: string;
  code_postal?: string;
  region: string;
  statut?: string;
  type?: string;
  logo_url?: string | null;
}

export interface GroupeEtablissement {
  id: string;
  nom: string;
  type?: string;
}

export interface Partenaire {
  id: string;
  nom: string;
  ville?: string;
  logo_url?: string | null;
  type_partenaire?: string;
}

export interface Contact {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  fonction: string;
  etablissement_id: string;
  groupe_id: string | null;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  storage_bucket: string;
  downloaded: boolean;
  created_at: string;
  imap_part_id: string | null;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  message_id: string;
  imap_uid: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  reply_to: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  sent_date: string;
  received_date: string;
  is_read: boolean;
  is_draft: boolean;
  is_sent: boolean;
  has_attachments: boolean;
  attachments_count: number;
  flags: string[] | null;
  reference_headers: string[] | null;
  in_reply_to: string | null;
  created_at: string;
  // Relations
  attachments?: EmailAttachment[];
}

export interface EmailThread {
  id: string;
  thread_id: string;
  user_email_account_id: string;
  subject: string;
  participants: Record<string, unknown>;
  last_message_date: string;
  message_count: number;
  unread_count: number;
  last_message_from_email?: string | null;
  last_message_from_name?: string | null;
  last_message_is_sent?: boolean | null;
  last_inbound_from_email?: string | null;
  last_inbound_from_name?: string | null;
  last_inbound_date?: string | null;
  is_archived: boolean;
  is_spam: boolean;
  is_deleted: boolean;
  is_hors_etablissement?: boolean;
  is_processed?: boolean;
  processed_at?: string | null;
  processed_by?: string | null;
  category: EmailCategory | string | null;
  priority: EmailPriority | null;
  tags: string[];
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  ai_summary: string | null;
  ai_generated_title: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  ai_confidence_score: number | null;
  ai_last_processed_at: string | null;
  needs_manual_review: boolean;
  auto_created_etablissement: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations préchargées
  account?: {
    email_address: string;
    display_name?: string;
  };
  etablissement?: Etablissement;
  groupe?: GroupeEtablissement;
  partenaire?: Partenaire;
  messages?: EmailMessage[];
  // Computed fields (from enriched data)
  hasReply?: boolean;
}

export interface EmailThreadWithRelations extends EmailThread {
  account: {
    email_address: string;
    display_name?: string;
  };
  messages: EmailMessage[];
  contacts?: Contact[];
}

export interface EmailDraft {
  id: string;
  user_id: string;
  account_id: string;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body: string | null;
  attachments: Record<string, any>[] | null;
  created_at: string;
  updated_at: string;
}

export interface EmailFilters {
  search: string;
  category: EmailCategory | null;
  priority: EmailPriority | null;
  unreadOnly: boolean;
  unprocessedOnly: boolean;
  hasAttachments: boolean;
  etablissementId: string | null;
  groupeId: string | null;
  partenaireId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  mailbox: EmailMailbox;
}

export interface EmailSyncStatus {
  is_syncing: boolean;
  last_sync_at: string | null;
  emails_synced: number;
  errors_count: number;
  current_account?: string;
}

export interface EmailClassification {
  thread_id: string;
  category: EmailCategory;
  priority: EmailPriority;
  tags: string[];
  confidence_score: number;
  suggested_etablissement_id?: string;
  suggested_groupe_id?: string;
  suggested_partenaire_id?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: number;
}
