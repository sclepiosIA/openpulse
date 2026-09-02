/**
 * Types pour le scoring comportemental & l'attribution multi-touch
 * Priorité 8 — voir docs/scoring-comportemental.md
 */

export type BehavioralEventType =
  | 'email_opened'
  | 'email_clicked'
  | 'email_replied'
  | 'meeting_attended'
  | 'meeting_no_show'
  | 'task_completed'
  | 'document_viewed'
  | 'quick_response';

export type AttributionChannel =
  | 'email_outbound'
  | 'email_inbound'
  | 'meeting'
  | 'call'
  | 'referral'
  | 'event'
  | 'document'
  | 'task'
  | 'other';

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay';

export interface BehavioralEvent {
  id: string;
  etablissement_id: string;
  contact_id: string | null;
  event_type: BehavioralEventType;
  occurred_at: string;
  weight: number;
  source_id: string | null;
  source_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AttributionTouchpoint {
  id: string;
  etablissement_id: string;
  channel: AttributionChannel;
  occurred_at: string;
  weight: number;
  user_id: string | null;
  source_id: string | null;
  source_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ScoreSnapshot {
  id: string;
  etablissement_id: string;
  score: number;
  static_score: number;
  behavioral_score: number;
  engagement_velocity: number;
  factors: Array<{ label: string; points: number; detail: string }>;
  computed_at: string;
}

export interface BehavioralScoreResult {
  behavioral_score: number;
  engagement_velocity: number;
  last_event_at: string | null;
  raw_score: number;
}

export interface AttributionResult {
  model: AttributionModel;
  by_channel: Record<AttributionChannel, number>;
  by_user: Record<string, number>;
  first_touch: { channel: AttributionChannel; occurred_at: string; user_id: string | null } | null;
  last_touch: { channel: AttributionChannel; occurred_at: string; user_id: string | null } | null;
}

export const BEHAVIORAL_EVENT_LABELS: Record<BehavioralEventType, string> = {
  email_opened: 'Email ouvert',
  email_clicked: 'Lien cliqué',
  email_replied: 'Réponse email',
  meeting_attended: 'RDV honoré',
  meeting_no_show: 'RDV manqué',
  task_completed: 'Tâche terminée',
  document_viewed: 'Document consulté',
  quick_response: 'Réponse rapide (<4h)',
};

export const ATTRIBUTION_CHANNEL_LABELS: Record<AttributionChannel, string> = {
  email_outbound: 'Email sortant',
  email_inbound: 'Email entrant',
  meeting: 'Rendez-vous',
  call: 'Appel',
  referral: 'Recommandation',
  event: 'Événement',
  document: 'Document',
  task: 'Tâche',
  other: 'Autre',
};

export const SCORE_TIERS = [
  { min: 80, label: 'Chaud', color: 'emerald' },
  { min: 60, label: 'Tiède', color: 'amber' },
  { min: 40, label: 'À travailler', color: 'orange' },
  { min: 0, label: 'Froid', color: 'red' },
] as const;

export function getScoreTier(score: number) {
  return SCORE_TIERS.find(t => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}
