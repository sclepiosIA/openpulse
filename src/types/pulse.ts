// Types pour le module Pulse (messagerie d'équipe)

export type MessageType = 'text' | 'system' | 'ai_suggestion' | 'task_update';
export type ConversationVisibility = 'private' | 'public';
export type MemberRole = 'admin' | 'member' | 'guest';
export type NotificationLevel = 'all' | 'mentions' | 'none';
export type PresenceStatus = 'active' | 'away' | 'offline' | 'busy' | 'dnd' | 'in_meeting';
export type TaskLinkType = 'mentions' | 'created_from' | 'status_update';
export type MediaFileType = 'image' | 'video' | 'audio' | 'document' | 'other';

// Statut personnalisé avec métadonnées
export interface CustomStatus {
  status: PresenceStatus;
  emoji?: string;
  text?: string;
  expiresAt?: string;
  isAutomatic?: boolean;
  calendarEventId?: string;
  calendarEventTitle?: string;
}

export interface PulseConversation {
  id: string;
  etablissement_id: string | null;
  name: string;
  description: string | null;
  visibility: ConversationVisibility;
  created_by: string | null;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  etablissement?: {
    id: string;
    nom: string;
    logo_url?: string | null;
  } | null;
  creator?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url?: string;
  } | null;
  members?: PulseConversationMember[];
  unread_count?: number;
  last_message?: PulseMessage | null;
}

export interface PulseConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  notification_level: NotificationLevel;
  last_read_at: string | null;
  joined_at: string;
  invited_by: string | null;
  // Relations
  user?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url?: string;
    email?: string;
  };
}

export interface PulseMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  content_html: string | null;
  parent_message_id: string | null;
  message_type: MessageType;
  edited_at: string | null;
  edited_by: string | null;
  edit_count: number;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
  ai_processed: boolean;
  reaction_count: number;
  reply_count: number;
  mentions: string[];
  metadata?: Record<string, unknown> | null; // Métadonnées optionnelles (ex: transcription_summary)
  created_at: string;
  // Relations
  user?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url?: string;
  };
  reactions?: PulseReaction[];
  media?: PulseMedia[];
  replies?: PulseMessage[];
  task_links?: PulseMessageTaskLink[];
  // Accusés de réception
  receipts?: PulseMessageReceipt[];
}

export interface PulseMessageReceipt {
  id: string;
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PulseMessageArchive {
  id: string;
  original_message_id: string;
  conversation_id: string;
  user_id: string | null;
  content_snapshot: {
    content: string;
    content_html: string | null;
    mentions: string[];
    created_at: string;
    edited_at: string | null;
    edit_count: number;
  };
  deleted_at: string;
  deleted_by: string | null;
  deletion_reason: string | null;
  restored: boolean;
  restored_at: string | null;
  restored_by: string | null;
  created_at: string;
}

export interface PulseMessageTaskLink {
  id: string;
  message_id: string;
  task_id: string;
  conversation_id: string;
  link_type: TaskLinkType;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Relations
  task?: {
    id: string;
    titre: string;
    statut: string;
    priorite: string;
  };
}

export interface PulseReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  // Relations
  user?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

export interface PulseMedia {
  id: string;
  message_id: string;
  file_url: string;
  thumbnail_url: string | null;
  file_type: MediaFileType;
  file_name: string;
  size_bytes: number;
  mime_type: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface PulseAIResponse {
  id: string;
  original_message_id: string | null;
  conversation_id: string;
  user_id: string;
  prompt: string;
  response_text: string;
  model: string;
  tokens_input: number | null;
  tokens_output: number | null;
  processing_time_ms: number | null;
  user_accepted: boolean | null;
  created_at: string;
}

export interface PulsePresence {
  id: string;
  user_id: string;
  conversation_id: string | null;
  status: PresenceStatus;
  last_seen_at: string;
  typing_until: string | null;
  // Nouveaux champs pour statuts enrichis
  custom_status?: string | null;
  custom_status_emoji?: string | null;
  status_expires_at?: string | null;
  calendar_event_id?: string | null;
  auto_status?: boolean;
  previous_status?: string | null;
  // Relations
  user?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url?: string;
  };
  // Relation optionnelle vers l'événement calendrier
  calendar_event?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  } | null;
}

export interface PulseAuditLogEntry {
  id: string;
  action: string;
  actor_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  task_id: string | null;
  details: Record<string, unknown>;
  status: 'success' | 'failure' | 'pending';
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Types pour les formulaires et mutations
export interface CreateConversationInput {
  name: string;
  description?: string;
  visibility?: ConversationVisibility;
  etablissement_id?: string;
  member_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateConversationInput {
  name?: string;
  description?: string;
  visibility?: ConversationVisibility;
  is_archived?: boolean;
}

export interface SendMessageInput {
  conversation_id: string;
  content: string;
  parent_message_id?: string;
  mentions?: string[];
}

export interface UpdateMessageInput {
  content: string;
}

export interface AddReactionInput {
  message_id: string;
  emoji: string;
}

export interface LinkTaskInput {
  message_id: string;
  task_id: string;
  link_type?: TaskLinkType;
}

export interface CreateTaskFromMessageInput {
  message_id: string;
  titre: string;
  description?: string;
  etablissement_id?: string;
  priorite?: string;
  date_echeance?: string;
}

// Statuts prédéfinis avec leurs icônes et couleurs
export const PRESENCE_STATUS_CONFIG: Record<PresenceStatus, {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  active: {
    label: 'En ligne',
    emoji: '🟢',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    description: 'Disponible',
  },
  away: {
    label: 'Absent',
    emoji: '🟡',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    description: 'Absent temporairement',
  },
  busy: {
    label: 'Occupé',
    emoji: '🔴',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    description: 'Ne pas déranger sauf urgence',
  },
  dnd: {
    label: 'Ne pas déranger',
    emoji: '⛔',
    color: 'text-red-600',
    bgColor: 'bg-red-600',
    description: 'Pas de notifications',
  },
  in_meeting: {
    label: 'En réunion',
    emoji: '📅',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    description: 'En réunion',
  },
  offline: {
    label: 'Hors ligne',
    emoji: '⚫',
    color: 'text-gray-400',
    bgColor: 'bg-gray-400',
    description: 'Hors ligne',
  },
};
