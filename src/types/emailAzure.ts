/**
 * Types du socle Azure Smart Inbox (lot 1 — non destructif).
 *
 * Ces types décrivent le contrat client du futur `openpulse-email-api`
 * (Azure Container Apps) et les tables miroir `email_*_azure` d'Azure
 * PostgreSQL. Ils n'impactent PAS les types Supabase existants de
 * `src/types/email.ts` : le backend actuel reste inchangé tant que
 * `VITE_EMAIL_BACKEND` vaut `supabase` (défaut).
 *
 * Réf. plan : 2026-07-07 gestion-emails-azure-smart-inbox (§5, §6, §8).
 */

/** Sélecteur de backend email (feature flag `VITE_EMAIL_BACKEND`). */
export type EmailBackendMode = 'supabase' | 'azure' | 'hybrid';

/** Fournisseurs supportés par `email_accounts_azure.provider`. */
export type EmailAzureProvider =
  | 'imap_smtp'
  | 'microsoft_graph'
  | 'gmail_api'
  | 'shared_mailbox';

/** Statut d'un compte côté Azure. */
export type EmailAzureAccountStatus = 'active' | 'paused' | 'error' | 'disabled';

/** Miroir de la table `email_accounts_azure`. */
export interface EmailAccountAzure {
  id: string;
  profile_id: string;
  email_address: string;
  display_name: string | null;
  provider: EmailAzureProvider;
  is_shared: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
  status: EmailAzureAccountStatus;
  /** Référence Key Vault — jamais le secret lui-même. */
  secret_ref: string;
  created_at: string;
  updated_at: string;
}

/** Miroir de la table `email_sync_cursors`. */
export interface EmailSyncCursorAzure {
  account_id: string;
  provider: EmailAzureProvider;
  cursor: Record<string, unknown>;
  last_seen_uid: number | null;
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
  error_count: number;
  last_error: string | null;
  updated_at: string;
}

/** Types d'insight IA produits par `job-email-ai`. */
export type EmailAiInsightType =
  | 'summary'
  | 'classification'
  | 'action'
  | 'risk'
  | 'draft'
  | 'calendar'
  | 'crm_link';

/** Miroir de la table `email_ai_insights`. */
export interface EmailAiInsightAzure {
  id: string;
  thread_id: string;
  message_id: string | null;
  insight_type: EmailAiInsightType;
  model: string | null;
  confidence: number | null;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

/** Types d'action CRM suggérées/exécutées. */
export type EmailAzureActionType =
  | 'create_task'
  | 'create_ticket'
  | 'create_event'
  | 'link_contact'
  | 'link_etablissement'
  | 'draft_reply'
  | 'archive'
  | 'assign_owner';

export type EmailAzureActionStatus =
  | 'suggested'
  | 'accepted'
  | 'rejected'
  | 'done'
  | 'failed';

/** Miroir de la table `email_actions` (Azure). */
export interface EmailActionAzure {
  id: string;
  thread_id: string;
  action_type: EmailAzureActionType;
  status: EmailAzureActionStatus;
  assignee_profile_id: string | null;
  payload: Record<string, unknown>;
  created_by_ai: boolean;
  created_at: string;
  resolved_at: string | null;
}

/** Santé de sync d'une mailbox, exposée par `GET /api/email/sync/status`. */
export type EmailAzureMailboxHealth = 'healthy' | 'degraded' | 'error' | 'unknown';

export interface EmailAzureAccountSyncStatus {
  account_id: string;
  email_address: string;
  provider: EmailAzureProvider;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  error_count: number;
  pending_messages: number;
  health: EmailAzureMailboxHealth;
}

/** Réponse agrégée de `GET /api/email/sync/status` (`openpulse-email-api`). */
export interface EmailAzureSyncStatusResponse {
  backend: 'azure';
  generated_at: string;
  accounts: EmailAzureAccountSyncStatus[];
  queue: {
    /** Messages en attente de classification IA. */
    ai_pending: number;
    /** Messages non classés au total. */
    unclassified: number;
  };
}
