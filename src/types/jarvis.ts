/**
 * JARVIS 12.0 - Assistant IA Autonome Proactif
 * Types TypeScript pour l'intégration complète avec GPT-5 Tool Calling
 * 60+ outils métier (CRM, RH, Trésorerie, R&D, Support, Formations)
 */

// ============================================================
// Types de base
// ============================================================

export type JarvisTriggerType = 
  | 'new_email' 
  | 'task_due' 
  | 'calendar_reminder' 
  | 'support_ticket' 
  | 'manual'
  | 'analyze'
  | 'summarize';

export type JarvisQuickAction = 
  | 'summarize_emails'
  | 'prioritize_tasks'
  | 'check_support'
  | 'generate_report'
  | 'analyze_context';

export type JarvisActionType = 
  | 'send_email' 
  | 'create_task' 
  | 'update_status' 
  | 'close_ticket' 
  | 'schedule_meeting'
  | 'draft_response'
  | 'summarize'
  | 'analyze'
  | 'remind'
  | 'query'
  | 'search'
  | 'none';

export type JarvisActionStatus = 
  | 'pending' 
  | 'approved' 
  | 'modified' 
  | 'rejected' 
  | 'executed' 
  | 'expired' 
  | 'error';

export type JarvisNotificationFrequency = 
  | 'immediate' 
  | 'batched_hourly' 
  | 'batched_daily';

export type KBBaseType = 'solution' | 'internal';

// ============================================================
// Conversation Types (JARVIS 12.0)
// ============================================================

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: ToolCall[];
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'requires_confirmation';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  execution_time_ms: number;
}

export interface JarvisConversation {
  id: string;
  user_id: string;
  title: string | null;
  messages: ConversationMessage[];
  context: Record<string, unknown>;
  tool_executions: ToolCall[];
  model_used: string;
  total_tokens: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_autonomous: boolean;
}

// ============================================================
// Capabilities (JARVIS 12.0)
// ============================================================

export interface JarvisCapability {
  name: string;
  description: string;
  category: 'query' | 'action' | 'analysis' | 'generation' | 'search';
  requires_confirmation: boolean;
  examples: string[];
}

export const JARVIS_CAPABILITIES: JarvisCapability[] = [
  {
    name: 'query_database',
    description: 'Interroger les données CRM',
    category: 'query',
    requires_confirmation: false,
    examples: ['Combien d\'établissements en production ?', 'Liste mes tâches en retard']
  },
  {
    name: 'send_email',
    description: 'Envoyer des emails',
    category: 'action',
    requires_confirmation: true,
    examples: ['Envoie un email de relance à X', 'Réponds à ce thread']
  },
  {
    name: 'create_task',
    description: 'Créer des tâches',
    category: 'action',
    requires_confirmation: false,
    examples: ['Crée une tâche pour rappeler le client', 'Ajoute un rappel pour demain']
  },
  {
    name: 'schedule_meeting',
    description: 'Planifier des réunions',
    category: 'action',
    requires_confirmation: false,
    examples: ['Planifie une démo demain à 14h', 'Bloque 1h pour un call']
  },
  {
    name: 'search_knowledge_base',
    description: 'Rechercher dans la documentation',
    category: 'search',
    requires_confirmation: false,
    examples: ['Comment configurer le module X ?', 'Quelle est la procédure pour Y ?']
  },
  {
    name: 'calculate_metrics',
    description: 'Calculer des métriques',
    category: 'analysis',
    requires_confirmation: false,
    examples: ['Quel est l\'état du pipeline ?', 'Taux de complétion des tâches']
  },
  {
    name: 'get_user_context',
    description: 'Obtenir le contexte utilisateur',
    category: 'query',
    requires_confirmation: false,
    examples: ['Résume ma journée', 'Qu\'est-ce qui est urgent ?']
  }
];

// ============================================================
// Déclencheur Jarvis
// ============================================================

export interface JarvisTrigger {
  type: JarvisTriggerType;
  user_id: string;
  context: {
    thread_id?: string;
    task_id?: string;
    event_id?: string;
    ticket_id?: string;
    etablissement_id?: string;
    priority?: string;
    custom_prompt?: string;
    conversation_history?: Array<{ role: string; content: string }>;
    quick_action?: JarvisQuickAction;
  };
}

// ============================================================
// Source documentaire KB
// ============================================================

export interface JarvisKBSource {
  article_id: string;
  titre: string;
  base_type: KBBaseType;
  excerpt: string;
  relevance: number;
  dpi?: string;
  module?: string;
}

// ============================================================
// Action proposée
// ============================================================

export interface JarvisProposedAction {
  type: JarvisActionType;
  data: JarvisActionData;
  preview_text: string;
  confidence_score: number;
  reasoning: string;
}

export interface JarvisActionData {
  // Pour send_email
  to?: string;
  cc?: string[];
  subject?: string;
  body?: string;
  thread_id?: string;
  
  // Pour create_task
  titre?: string;
  description?: string;
  priorite?: string;
  assignee_id?: string;
  etablissement_id?: string;
  date_echeance?: string;
  
  // Pour update_status
  entity_type?: string;
  entity_id?: string;
  new_status?: string;
  
  // Pour close_ticket
  ticket_id?: string;
  resolution_note?: string;
  
  // Pour schedule_meeting
  title?: string;
  start_time?: string;
  end_time?: string;
  attendees?: string[];
  location?: string;
  video_conference_url?: string;

  // Pour query results
  response_text?: string;
}

// ============================================================
// Action en attente (table jarvis_pending_actions)
// ============================================================

export interface JarvisPendingAction {
  id: string;
  user_id: string;
  trigger_type: JarvisTriggerType;
  trigger_entity_id: string | null;
  trigger_entity_type: string | null;
  context: JarvisContext;
  proposed_action: JarvisProposedAction;
  kb_sources: JarvisKBSource[];
  status: JarvisActionStatus;
  ai_response: string | null;
  user_modification: string | null;
  execution_result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
  executed_at: string | null;
  user_feedback: string | null;
  feedback_rating: number | null;
}

// ============================================================
// Contexte enrichi
// ============================================================

export interface JarvisContext {
  etablissement?: {
    id: string;
    nom: string;
    statut: string | null;
    dpi?: string | null;
    module?: string | null;
    ville?: string | null;
  };
  email_thread?: {
    id: string;
    subject: string;
    messages: Array<{
      id: string;
      from_address: string;
      content_preview: string;
      sent_at: string;
    }>;
  };
  task?: {
    id: string;
    titre: string;
    priorite: string;
    statut: string;
    date_echeance: string | null;
  };
  ticket?: {
    id: string;
    titre: string;
    priority: string;
    status: string;
    description: string | null;
  };
  calendar_event?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
  };
  contacts?: Array<{
    id: string;
    nom: string;
    prenom: string;
    email: string | null;
    fonction: string | null;
  }>;
  recent_interactions?: Array<{
    type: string;
    summary: string;
    date: string;
  }>;
  kb_articles_used?: Array<{
    id: string;
    titre: string;
    base_type: KBBaseType;
    relevance_score: number;
  }>;
}

// ============================================================
// Préférences utilisateur (table jarvis_preferences)
// ============================================================

export interface JarvisPreferences {
  user_id: string;
  enabled: boolean;
  voice_enabled: boolean;
  proactive_mode: boolean;
  confidence_threshold: number;
  auto_approve_above: number;
  notification_frequency: JarvisNotificationFrequency;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferred_voice: string;
  voice_speed: number;
  wake_word: string;
  formal_tone: boolean;
  include_sources: boolean;
  max_actions_per_hour: number;
  triggers_enabled: {
    new_email: boolean;
    task_due: boolean;
    calendar_reminder: boolean;
    support_ticket: boolean;
  };
  created_at: string;
  updated_at: string;
}

// ============================================================
// Historique des actions (table jarvis_action_history)
// ============================================================

export interface JarvisActionHistory {
  id: string;
  user_id: string;
  action_id: string | null;
  action_type: JarvisActionType;
  trigger_type: JarvisTriggerType;
  confidence_score: number | null;
  was_modified: boolean;
  was_approved: boolean | null;
  execution_time_ms: number | null;
  kb_articles_count: number;
  kb_base_types: KBBaseType[];
  created_at: string;
}

// ============================================================
// Commandes vocales
// ============================================================

export type JarvisVoiceCommand = 
  | { type: 'approve'; actionId?: string }
  | { type: 'reject'; actionId?: string; reason?: string }
  | { type: 'modify'; actionId?: string }
  | { type: 'read'; what: 'action' | 'sources' | 'all' }
  | { type: 'ask'; query: string }
  | { type: 'list' }
  | { type: 'help' };

// ============================================================
// Réponses API
// ============================================================

export interface JarvisAgentResponse {
  success: boolean;
  action_id?: string;
  proposed_action?: JarvisProposedAction;
  kb_sources?: JarvisKBSource[];
  error?: string;
}

export interface JarvisExecuteResponse {
  success: boolean;
  action_id: string;
  action_type: JarvisActionType;
  result?: Record<string, unknown>;
  error?: string;
}

// ============================================================
// Réponse JARVIS 12.0 Brain
// ============================================================

export interface JarvisBrainResponse {
  success: boolean;
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  tool_results?: Array<{
    tool_call_id: string;
    name: string;
    result: ToolResult;
  }>;
  processing_time_ms: number;
  error?: string;
}

// ============================================================
// Notification Push Jarvis
// ============================================================

export interface JarvisPushNotification {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  actions: Array<{
    action: string;
    title: string;
  }>;
  data: {
    type: 'jarvis_action';
    action_id: string;
    preview_url: string;
    confidence: number;
    sources_count: number;
    trigger_type: JarvisTriggerType;
  };
}

// ============================================================
// Hook useJarvis return type (JARVIS 12.0)
// ============================================================

export interface JarvisAskResponse {
  success: boolean;
  preview_text?: string;
  reasoning?: string;
  action_type?: string;
  tool_calls?: ToolCall[];
}

export interface JarvisChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface UseJarvisReturn {
  // État
  isEnabled: boolean;
  isLoading: boolean;
  pendingActions: JarvisPendingAction[];
  pendingCount: number;
  
  // JARVIS 12.0: Chat conversationnel
  messages: JarvisChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<JarvisChatMessage[]>>;
  isTyping: boolean;
  chat: (message: string) => Promise<JarvisBrainResponse | null>;
  getPageContextForInjection: () => string | null;
  clearChat: () => void;
  
  // Mode autonome
  autonomousMode: boolean;
  setAutonomousMode: (enabled: boolean) => void;
  
  // Actions (legacy)
  approveAction: (actionId: string) => Promise<void>;
  modifyAction: (actionId: string, modifications: Partial<JarvisActionData>) => Promise<void>;
  rejectAction: (actionId: string, reason?: string) => Promise<void>;
  
  // Manuel - returns response for TTS integration
  askJarvis: (prompt: string, context?: Partial<JarvisTrigger['context']>) => Promise<JarvisAskResponse | null>;
  
  // Confirm pending tool call
  confirmToolCall: (toolCallId: string) => Promise<void>;
  rejectToolCall: (toolCallId: string) => Promise<void>;
  isConfirming: boolean;
  
  // Settings
  preferences: JarvisPreferences | null;
  updatePreferences: (prefs: Partial<JarvisPreferences>) => void;
  
  // Feedback
  submitFeedback: (actionId: string, rating: number, comment?: string) => Promise<void>;
  
  // History
  history: JarvisActionHistory[];
  loadMoreHistory: () => Promise<void>;
  
  // Capabilities
  capabilities: JarvisCapability[];
}

// ============================================================
// Hook useJarvisVoice return type
// ============================================================

export interface UseJarvisVoiceReturn {
  // Recognition (STT)
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  
  // Synthesis (TTS)
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  
  // Wake word detection
  isAwake: boolean;
  wakeWord: string;
  
  // Commandes vocales reconnues
  lastCommand: JarvisVoiceCommand | null;
  
  // Configuration
  setWakeWord: (word: string) => void;
  setVoiceSpeed: (speed: number) => void;
}
