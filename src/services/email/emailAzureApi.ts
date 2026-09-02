/**
 * Client léger du futur `openpulse-email-api` (Azure Container Apps).
 *
 * Lot 1 : lecture seule de la supervision sync (`GET /api/email/sync/status`).
 * - Aucun secret côté front : l'auth se fait via le token de session existant
 *   passé par l'appelant (header Authorization), jamais de clé statique.
 * - Si `VITE_EMAIL_AZURE_API_URL` n'est pas configurée, les fonctions
 *   renvoient un état `unconfigured` sans jeter — l'UI Supabase actuelle
 *   n'est jamais impactée.
 */
import { getEmailAzureApiBaseUrl } from '@/lib/emailBackend';
import type { EmailAzureSyncStatusResponse } from '@/types/emailAzure';

export type EmailAzureSyncStatusResult =
  | { state: 'ok'; data: EmailAzureSyncStatusResponse }
  | { state: 'unconfigured' }
  | { state: 'error'; message: string };

export interface FetchEmailAzureSyncStatusOptions {
  /** Jeton d'accès (session Supabase/Azure AD) ajouté en Bearer si fourni. */
  accessToken?: string | null;
  /** Injectable pour les tests. Défaut : fetch global. */
  fetchImpl?: typeof fetch;
  /** Base URL injectable pour les tests. Défaut : env VITE_EMAIL_AZURE_API_URL. */
  baseUrl?: string | null;
  signal?: AbortSignal;
}

export async function fetchEmailAzureSyncStatus(
  options: FetchEmailAzureSyncStatusOptions = {},
): Promise<EmailAzureSyncStatusResult> {
  const baseUrl =
    options.baseUrl !== undefined ? options.baseUrl : getEmailAzureApiBaseUrl();
  if (!baseUrl) return { state: 'unconfigured' };

  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  try {
    const response = await fetchImpl(`${baseUrl}/api/email/sync/status`, {
      method: 'GET',
      headers,
      signal: options.signal,
    });
    if (!response.ok) {
      return { state: 'error', message: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as EmailAzureSyncStatusResponse;
    if (!data || data.backend !== 'azure' || !Array.isArray(data.accounts)) {
      return { state: 'error', message: 'Réponse sync/status invalide' };
    }
    return { state: 'ok', data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réseau inconnue';
    return { state: 'error', message };
  }
}
