/**
 * Types for Supabase Realtime payload handling
 * Provides strict typing for realtime subscription callbacks
 */

/**
 * Generic realtime payload from Supabase
 */
export interface RealtimePayload<T> {
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  schema: string;
  table: string;
}

/**
 * Email thread realtime payload
 */
export interface EmailThreadRealtimePayload {
  id: string;
  subject: string;
  created_at: string;
  updated_at: string;
  last_message_date: string | null;
  unread_count: number;
  message_count: number;
  is_spam: boolean;
  is_deleted: boolean;
  is_archived: boolean;
  is_sent: boolean;
  category: string | null;
  priority: string | null;
  etablissement_id: string | null;
  partenaire_id: string | null;
  groupe_id: string | null;
  account_id: string;
}

/**
 * Satisfaction survey realtime payload
 */
export interface SatisfactionSurveyRealtimePayload {
  id: string;
  etablissement_id: string;
  created_at: string;
  note_globale?: number;
  commentaire?: string | null;
}

/**
 * Formation session realtime payload
 */
export interface FormationSessionRealtimePayload {
  id: string;
  etablissement_id: string;
  created_at: string;
  statut: string;
  date_session: string;
}

/**
 * Type guard for email thread payload
 */
export function isEmailThreadPayload(payload: unknown): payload is EmailThreadRealtimePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'created_at' in payload &&
    'unread_count' in payload
  );
}

/**
 * Type guard for satisfaction survey payload
 */
export function isSatisfactionPayload(payload: unknown): payload is SatisfactionSurveyRealtimePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'etablissement_id' in payload
  );
}
