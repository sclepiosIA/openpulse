/**
 * Type definitions for error handling across the application
 * Eliminates `any` types in error callbacks
 */

/**
 * Common error structure from Supabase/PostgreSQL
 */
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Generic mutation error - can be a standard Error or Supabase error
 */
export type MutationError = Error | SupabaseError;

/**
 * Helper to extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Erreur inconnue';
}

/**
 * Helper to extract error code from Supabase error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}

/**
 * Helper to extract error details from Supabase error
 */
export function getErrorDetails(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    return String((error as { details: unknown }).details);
  }
  return undefined;
}

/**
 * Type for contract insert data that includes required fields
 */
export interface ContratInsertData {
  titre?: string;
  numero?: string;
  type?: string;
  statut?: string;
  etablissement_id?: string;
  contact_id?: string;
  commercial_id?: string;
  date_debut?: string;
  date_fin?: string;
  montant_annuel?: number;
  created_by?: string;
  clauses_selectionnees: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}
