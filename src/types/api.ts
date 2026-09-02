/**
 * Types pour le Module 10: API Publique & Marketplace
 */

export type ApiPermission = 'read' | 'write' | 'delete' | 'admin';

export interface ApiKey {
  id: string;
  nom: string;
  description: string | null;
  key_hash: string;
  key_prefix: string;
  permissions: ApiPermission[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  expires_at: string | null;
  last_used_at: string | null;
  total_requests: number;
  est_active: boolean;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface ApiLog {
  id: string;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number | null;
  request_body: Record<string, any> | null;
  response_body: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  api_key?: {
    nom: string;
    key_prefix: string;
  };
}

export type WebhookEvent = 
  | 'etablissement.created'
  | 'etablissement.updated'
  | 'etablissement.deleted'
  | 'contact.created'
  | 'contact.updated'
  | 'tache.created'
  | 'tache.completed'
  | 'ticket.created'
  | 'ticket.resolved'
  | 'invoice.created'
  | 'invoice.paid';

export interface Webhook {
  id: string;
  nom: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  est_actif: boolean;
  retry_count: number;
  timeout_seconds: number;
  headers: Record<string, string>;
  last_triggered_at: string | null;
  last_status: string | null;
  failure_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, any>;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  attempt_number: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export type OAuthScope = 'read' | 'write' | 'delete' | 'admin';

export interface OAuthApp {
  id: string;
  nom: string;
  description: string | null;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string[];
  scopes: OAuthScope[];
  logo_url: string | null;
  website_url: string | null;
  privacy_policy_url: string | null;
  est_active: boolean;
  est_verified: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OAuthToken {
  id: string;
  oauth_app_id: string;
  user_id: string;
  access_token_hash: string;
  refresh_token_hash: string | null;
  scopes: OAuthScope[];
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  oauth_app?: OAuthApp;
}

export type ConnectorCategory = 'crm' | 'erp' | 'comptabilite' | 'communication' | 'analytics' | 'sante' | 'autre';
export type ConnectorPriceType = 'free' | 'paid' | 'freemium';
export type SyncStatus = 'pending' | 'syncing' | 'success' | 'error';

export interface MarketplaceConnector {
  id: string;
  nom: string;
  slug: string;
  description: string | null;
  description_longue: string | null;
  categorie: ConnectorCategory;
  logo_url: string | null;
  developer_name: string | null;
  developer_url: string | null;
  documentation_url: string | null;
  prix_type: ConnectorPriceType;
  prix_mensuel: number | null;
  est_actif: boolean;
  est_certifie: boolean;
  note_moyenne: number | null;
  nombre_installations: number;
  configuration_schema: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConnectorInstallation {
  id: string;
  connector_id: string;
  installed_by: string;
  configuration: Record<string, any>;
  est_active: boolean;
  installed_at: string;
  last_sync_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  connector?: MarketplaceConnector;
}

export interface ApiStats {
  total_requests_today: number;
  total_requests_month: number;
  active_api_keys: number;
  active_webhooks: number;
  installed_connectors: number;
  avg_response_time_ms: number;
  error_rate: number;
}
