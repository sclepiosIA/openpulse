/**
 * Types for email thread classification
 */

/**
 * Update payload for classifying an email thread
 */
export interface ThreadClassificationUpdate {
  etablissement_id?: string | null;
  partenaire_id?: string | null;
  groupe_id?: string | null;
}

/**
 * Parameters for classifying a thread
 */
export interface ClassifyThreadParams {
  threadId: string;
  etablissementId?: string | null;
  partenaireId?: string | null;
  groupeId?: string | null;
  etablissementNom?: string;
  partenaireNom?: string;
  groupeNom?: string;
}

/**
 * Result of a thread classification mutation
 */
export interface ClassifyThreadResult {
  threadId: string;
  etablissement_id?: string | null;
  partenaire_id?: string | null;
  groupe_id?: string | null;
}
