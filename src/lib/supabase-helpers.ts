/**
 * Helpers typés pour Supabase
 * 
 * Ces helpers permettent de requêter des vues et tables non-typées
 * avec un typage explicite, évitant les casts `supabase as any`.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Helper pour requêter une vue non-typée avec typage explicite
 * @param viewName - Nom de la vue Supabase
 * @param query - Colonnes à sélectionner (défaut: '*')
 * @returns Données typées ou erreur
 * 
 * @example
 * ```typescript
 * const { data, error } = await queryView<UserEmailAccountSafe[]>(
 *   'user_email_accounts_safe',
 *   'id, email_address, is_active'
 * );
 * ```
 */
export async function queryView<T>(
  viewName: string,
  query: string = '*'
): Promise<{ data: T | null; error: Error | null }> {
  const { data, error } = await (supabase as unknown as { 
    from: (table: string) => { select: (query: string) => Promise<{ data: unknown; error: Error | null }> } 
  })
    .from(viewName)
    .select(query);
  
  return { data: data as T | null, error };
}

/**
 * Helper pour requêter une vue avec filtre eq
 */
export async function queryViewWithFilter<T>(
  viewName: string,
  column: string,
  value: string | number | boolean,
  query: string = '*'
): Promise<{ data: T | null; error: Error | null }> {
  const { data, error } = await (supabase as unknown as { 
    from: (table: string) => { 
      select: (query: string) => { 
        eq: (col: string, val: unknown) => Promise<{ data: unknown; error: Error | null }> 
      } 
    } 
  })
    .from(viewName)
    .select(query)
    .eq(column, value);
  
  return { data: data as T | null, error };
}

// ============================================
// Types pour les vues et tables non-typées
// ============================================

/**
 * Type pour les prévisions pipeline avec relations établissement
 */
export interface PrevisionWithEtablissement {
  id: string;
  etablissement_id: string;
  date_signature_estimee: string;
  montant_initial_estime: number | null;
  montant_mensuel_estime: number | null;
  probabilite: number;
  type_offre: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  etablissements: {
    nom: string;
    ville: string | null;
    statut: string | null;
    pallier_vise: number | null;
    nombre_passages_urgences_annuel: number | null;
  } | null;
}

/**
 * Type pour les comptes email utilisateur (vue sécurisée)
 */
export interface UserEmailAccountSafe {
  id: string;
  email_address: string;
  is_active: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
  profile_id?: string;
}

/**
 * Type pour les données de bulletin de salaire après parsing
 */
export interface ParsedBulletinData {
  salaire_brut?: number;
  salaire_net?: number;
  cout_employeur?: number;
  conges_payes?: number;
  heures_travaillees?: number;
  primes?: Record<string, number>;
  cotisations?: Record<string, number>;
}

// ============================================
// Constantes pour les tables non-typées
// ============================================

/** Liste des vues disponibles dans le projet */
export const SUPABASE_VIEWS = {
  USER_EMAIL_ACCOUNTS_SAFE: 'user_email_accounts_safe',
  PREVISIONS_PIPELINE: 'previsions_pipeline',
  PROFILES_PUBLIC_SECURE: 'profiles_public_secure',
  EMAIL_THREADS_HEALTH: 'email_threads_health',
  EMAIL_THREADS_LIST_VIEW: 'email_threads_list_view',
  CSM_DATA_TO_COMPLETE: 'csm_data_to_complete',
} as const;
