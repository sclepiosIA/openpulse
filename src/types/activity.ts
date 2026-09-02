/**
 * Types pour l'Activity Feed global
 */

export type ActivityType =
  | 'interaction'
  | 'tache'
  | 'calendar'
  | 'email'
  | 'devis'
  | 'facture'
  | 'signature'
  | 'workflow'
  | 'audit';

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  occurred_at: string;
  actor_user_id: string | null;
  actor_name: string;
  etablissement_id: string | null;
  etablissement_nom: string | null;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ActivityFeedFilters {
  types?: ActivityType[];
  user_ids?: string[];
  etablissement_ids?: string[];
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface ActivityFeedPage {
  items: ActivityFeedItem[];
  nextCursor: string | null;
}

export interface ActivityFeedStats {
  today: number;
  week: number;
  month: number;
  by_type: Partial<Record<ActivityType, number>>;
  by_user: Array<{ user_id: string; name: string; count: number }>;
}

export interface ActivityReaction {
  id: string;
  activity_key: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ActivityPin {
  user_id: string;
  activity_key: string;
  pinned_at: string;
  note: string | null;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  interaction: 'Interactions',
  tache: 'Tâches',
  calendar: 'Événements',
  email: 'Emails',
  devis: 'Devis',
  facture: 'Factures',
  signature: 'Signatures',
  workflow: 'Workflows',
  audit: 'Audit & sécurité',
};

export const ACTIVITY_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  gray: 'bg-muted text-muted-foreground',
};

export const REACTION_EMOJIS = ['👍', '❤️', '🎉', '👀', '🚀'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
