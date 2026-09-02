// Types pour le Module 6 : Chat Client en Direct

export interface LiveChatSettings {
  id: string;
  etablissement_id: string | null;
  is_global: boolean;
  is_enabled: boolean;
  welcome_message: string;
  offline_message: string;
  business_hours: BusinessHours;
  auto_reply_enabled: boolean;
  auto_reply_delay_seconds: number;
  max_queue_size: number;
  widget_color: string;
  widget_position: 'bottom-right' | 'bottom-left';
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  monday: DayHours | null;
  tuesday: DayHours | null;
  wednesday: DayHours | null;
  thursday: DayHours | null;
  friday: DayHours | null;
  saturday: DayHours | null;
  sunday: DayHours | null;
}

export interface DayHours {
  start: string;
  end: string;
}

export type ConversationStatus = 'waiting' | 'active' | 'resolved' | 'escalated' | 'ticket_created';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ConversationSource = 'widget' | 'portal' | 'internal';
export type MessageSenderType = 'visitor' | 'agent' | 'bot' | 'system';
export type MessageContentType = 'text' | 'image' | 'file' | 'action' | 'kb_article';

export interface LiveChatConversation {
  id: string;
  etablissement_id: string | null;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_metadata: Record<string, unknown>;
  assigned_to: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  source: ConversationSource;
  tags: string[];
  satisfaction_rating: number | null;
  satisfaction_comment: string | null;
  escalated_at: string | null;
  escalated_reason: string | null;
  ticket_id: string | null;
  resolved_at: string | null;
  first_response_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  etablissement?: { id: string; nom: string } | null;
  assigned_agent?: { id: string; nom: string; prenom: string } | null;
  messages?: LiveChatMessage[];
  last_message?: LiveChatMessage | null;
  unread_count?: number;
}

export interface LiveChatMessage {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  sender_id: string | null;
  content: string;
  content_type: MessageContentType;
  metadata: Record<string, unknown>;
  is_internal: boolean;
  read_at: string | null;
  created_at: string;
  // Relations
  sender?: { id: string; nom: string; prenom: string } | null;
}

export interface LiveChatAgent {
  id: string;
  profile_id: string;
  is_available: boolean;
  max_concurrent_chats: number;
  current_chat_count: number;
  specialties: string[];
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  profile?: { id: string; nom: string; prenom: string; avatar_url: string | null };
}

export interface LiveChatQuickReply {
  id: string;
  title: string;
  content: string;
  category: string | null;
  shortcut: string | null;
  usage_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveChatKPIs {
  total_conversations: number;
  active_conversations: number;
  waiting_conversations: number;
  resolved_today: number;
  avg_response_time_minutes: number;
  avg_resolution_time_minutes: number;
  satisfaction_avg: number;
  escalation_rate: number;
  agents_online: number;
}

// Labels et couleurs pour l'UI
export const STATUS_LABELS: Record<ConversationStatus, string> = {
  waiting: 'En attente',
  active: 'En cours',
  resolved: 'Résolu',
  escalated: 'Escaladé',
  ticket_created: 'Ticket créé',
};

export const STATUS_COLORS: Record<ConversationStatus, string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  active: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  escalated: 'bg-red-100 text-red-800',
  ticket_created: 'bg-purple-100 text-purple-800',
};

export const PRIORITY_LABELS: Record<ConversationPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

export const PRIORITY_COLORS: Record<ConversationPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export const SENDER_TYPE_LABELS: Record<MessageSenderType, string> = {
  visitor: 'Visiteur',
  agent: 'Agent',
  bot: 'Assistant IA',
  system: 'Système',
};
