/**
 * Feature flag backend email (lot 1 Azure Smart Inbox).
 *
 * `VITE_EMAIL_BACKEND` sélectionne le backend de la messagerie `/emails` :
 * - `supabase` (défaut) : comportement actuel, rien ne change ;
 * - `hybrid`   : UI Supabase existante + supervision/sync Azure additive ;
 * - `azure`    : futur backend `openpulse-email-api` (lots suivants).
 *
 * Toute valeur absente ou inconnue retombe sur `supabase` : le flag est
 * fail-safe et ne peut pas casser la messagerie existante.
 */
import type { EmailBackendMode } from '@/types/emailAzure';

export const EMAIL_BACKEND_MODES: readonly EmailBackendMode[] = [
  'supabase',
  'azure',
  'hybrid',
] as const;

export const DEFAULT_EMAIL_BACKEND: EmailBackendMode = 'supabase';

/** Parse une valeur brute d'env vers un mode valide (fallback `supabase`). */
export function parseEmailBackend(raw: string | null | undefined): EmailBackendMode {
  const value = (raw ?? '').trim().toLowerCase();
  return (EMAIL_BACKEND_MODES as readonly string[]).includes(value)
    ? (value as EmailBackendMode)
    : DEFAULT_EMAIL_BACKEND;
}

/** Backend email actif, lu depuis `import.meta.env.VITE_EMAIL_BACKEND`. */
export function getEmailBackend(): EmailBackendMode {
  return parseEmailBackend(import.meta.env.VITE_EMAIL_BACKEND as string | undefined);
}

/** Vrai si la couche Azure (supervision, sync, IA) doit être visible. */
export function isAzureEmailBackendEnabled(): boolean {
  const backend = getEmailBackend();
  return backend === 'azure' || backend === 'hybrid';
}

/** Vrai si le backend Supabase historique reste la source de vérité UI. */
export function isSupabaseEmailBackendActive(): boolean {
  return getEmailBackend() !== 'azure';
}

/**
 * Base URL du `openpulse-email-api` (ex : https://openpulse-email-api.<region>.azurecontainerapps.io).
 * `null` si non configurée — les appels Azure doivent alors être désactivés.
 */
export function getEmailAzureApiBaseUrl(): string | null {
  const raw = (import.meta.env.VITE_EMAIL_AZURE_API_URL as string | undefined)?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}
