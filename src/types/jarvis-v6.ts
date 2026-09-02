/**
 * JARVIS 6.0 - Types pour le système Omniscient & Unifié
 * 
 * Définit les types TypeScript pour l'architecture multi-agent avancée,
 * le mode vocal avec handoff, les actions automatiques et l'apprentissage.
 */

import type { AgentId, AgentDomain, AgentVoice, AgentStatus } from './jarvis-agents';

// ============================================
// VOICE ENGINE - Multi-Agent Handoff
// ============================================

/** Mapping voix Azure par agent */
export const AGENT_VOICE_MAP: Record<AgentId | 'prime', AgentVoice | 'coral'> = {
  prime: 'coral',
  sophia: 'shimmer',
  marcus: 'echo',
  olivia: 'alloy',
  noah: 'nova',
  emma: 'fable',
  alex: 'onyx',
};

/** État du moteur vocal */
export interface VoiceEngineState {
  isConnected: boolean;
  currentVoice: AgentVoice | 'coral';
  currentAgent: AgentId | 'prime';
  isUserSpeaking: boolean;
  isAgentSpeaking: boolean;
  userTranscript: string;
  agentTranscript: string;
  pendingHandoff?: VoiceHandoffRequest;
}

/** Requête de handoff vocal */
export interface VoiceHandoffRequest {
  fromAgent: AgentId | 'prime';
  toAgent: AgentId;
  reason: string;
  context: Record<string, unknown>;
  announcementText?: string;
}

/** Conférence vocale multi-agents */
export interface VoiceConferenceState {
  isActive: boolean;
  participants: AgentId[];
  currentSpeaker?: AgentId;
  speakingOrder: AgentId[];
  transcript: VoiceConferenceTranscriptEntry[];
}

export interface VoiceConferenceTranscriptEntry {
  agentId: AgentId | 'user';
  text: string;
  timestamp: string;
}

/** Intention vocale détectée */
export interface VoiceIntent {
  type: 'handoff' | 'conference' | 'action' | 'query' | 'confirmation';
  targetAgent?: AgentId;
  actionName?: string;
  confidence: number;
  rawTranscript: string;
}

// ============================================
// PROACTIVE ENGINE - Learning & Predictions
// ============================================

/** Types de patterns d'usage */
export type PatternType = 'sequence' | 'preference' | 'timing' | 'correlation';

/** Pattern d'usage appris */
export interface UsagePattern {
  id: string;
  userId: string;
  patternType: PatternType;
  patternData: PatternData;
  confidence: number;
  occurrences: number;
  lastOccurredAt: string;
  createdAt: string;
}

/** Données de pattern selon le type */
export type PatternData = 
  | SequencePatternData
  | PreferencePatternData
  | TimingPatternData
  | CorrelationPatternData;

export interface SequencePatternData {
  actions: string[];
  avgDurationMs: number;
  context?: Record<string, unknown>;
}

export interface PreferencePatternData {
  category: string;
  preference: string;
  value: unknown;
  alternativeRejected?: string;
}

export interface TimingPatternData {
  action: string;
  dayOfWeek: number[];
  hourRange: [number, number];
  frequency: 'daily' | 'weekly' | 'monthly';
}

export interface CorrelationPatternData {
  trigger: { event: string; condition?: Record<string, unknown> };
  consequence: { action: string; delay?: number };
  strength: number;
}

/** Niveaux d'autonomie pour actions auto */
export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export const AUTONOMY_LEVELS: Record<AutonomyLevel, {
  name: string;
  description: string;
  allowedActionTypes: string[];
}> = {
  0: { name: 'Off', description: 'Aucune action automatique', allowedActionTypes: [] },
  1: { name: 'Suggest', description: 'Suggestions uniquement', allowedActionTypes: ['notification'] },
  2: { name: 'Safe', description: 'Actions sûres automatiques', allowedActionTypes: ['notification', 'archive', 'reminder', 'tag'] },
  3: { name: 'Moderate', description: 'Actions modérées auto', allowedActionTypes: ['notification', 'archive', 'reminder', 'tag', 'followup', 'draft'] },
  4: { name: 'Full', description: 'Autonomie totale', allowedActionTypes: ['*'] },
};

/** Action automatique */
export interface AutoAction {
  id: string;
  userId: string;
  agentId: AgentId;
  actionType: string;
  actionData: Record<string, unknown>;
  triggerPatternId?: string;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  result?: Record<string, unknown>;
  createdAt: string;
  executedAt?: string;
}

/** Alerte contextuelle intelligente */
export interface ContextualAlert {
  id: string;
  type: 'meeting_prep' | 'deadline' | 'anomaly' | 'opportunity' | 'followup';
  agentId: AgentId;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  context: Record<string, unknown>;
  suggestedAction?: {
    type: string;
    data: Record<string, unknown>;
    description: string;
  };
  expiresAt?: string;
  createdAt: string;
}

// ============================================
// COLLABORATION - Multi-Agent Advanced
// ============================================

/** Type de mémoire partagée */
export type MemoryTerm = 'short' | 'medium' | 'long';

/** Entrée mémoire partagée inter-agents */
export interface SharedMemoryEntry {
  id: string;
  agentId: AgentId;
  memoryKey: string;
  memoryValue: Record<string, unknown>;
  term: MemoryTerm;
  contextType?: string;
  accessCount: number;
  lastAccessedAt: string;
  expiresAt?: string;
  createdAt: string;
}

/** Négociation entre agents */
export interface AgentNegotiation {
  id: string;
  userId: string;
  requestingAgent: AgentId;
  conflictingAgent: AgentId;
  conflictType: 'priority' | 'resource' | 'timing' | 'scope';
  conflictDetails: Record<string, unknown>;
  resolution?: 'requesting_wins' | 'conflicting_wins' | 'compromise' | 'escalate';
  winnerAgent?: AgentId;
  resolutionDetails?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

/** Workflow collaboratif inter-agents */
export interface CollaborativeWorkflow {
  id: string;
  name: string;
  description: string;
  agentSequence: AgentId[];
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStepIndex: number;
  context: Record<string, unknown>;
  results: WorkflowStepResult[];
  createdAt: string;
  completedAt?: string;
}

export interface WorkflowStep {
  agentId: AgentId;
  action: string;
  inputMapping?: Record<string, string>;
  outputKey: string;
  timeout?: number;
}

export interface WorkflowStepResult {
  stepIndex: number;
  agentId: AgentId;
  success: boolean;
  output: Record<string, unknown>;
  executionTimeMs: number;
  completedAt: string;
}

// ============================================
// UNIFIED INTERFACE - Premium UI
// ============================================

/** Mode d'interface unifié */
export type UnifiedMode = 'solo' | 'team' | 'focus' | 'voice' | 'conference';

/** État de l'interface unifiée */
export interface UnifiedPanelState {
  mode: UnifiedMode;
  activeAgent: AgentId | 'prime' | null;
  showAgentAvatars: boolean;
  isCompact: boolean;
  focusContext?: {
    page: string;
    entityType?: string;
    entityId?: string;
  };
}

/** Configuration d'affichage par agent */
export interface AgentDisplayConfig {
  id: AgentId;
  enabled: boolean;
  customName?: string;
  autonomyLevel: AutonomyLevel;
  proactivityLevel: 'off' | 'low' | 'medium' | 'high';
  voiceEnabled: boolean;
}

/** Geste de navigation */
export type GestureType = 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch-in' | 'pinch-out' | 'long-press' | 'double-tap';

export interface GestureAction {
  gesture: GestureType;
  action: string;
  params?: Record<string, unknown>;
}

// ============================================
// INTEGRATIONS - External Systems
// ============================================

/** Configuration webhook entrant */
export interface WebhookConfig {
  id: string;
  source: 'qonto' | 'github' | 'slack' | 'teams' | 'custom';
  targetAgent: AgentId;
  eventTypes: string[];
  isActive: boolean;
  secretHash?: string;
  createdAt: string;
}

/** Canal de sortie */
export type OutputChannel = 'email' | 'sms' | 'slack' | 'teams' | 'whatsapp' | 'push';

/** Action multi-canal */
export interface MultiChannelAction {
  id: string;
  channel: OutputChannel;
  recipientType: 'user' | 'contact' | 'etablissement' | 'custom';
  recipientId?: string;
  recipientAddress?: string;
  content: Record<string, unknown>;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  createdAt: string;
  sentAt?: string;
}

// ============================================
// ANALYTICS - Agent Performance
// ============================================

/** Métriques par agent */
export interface AgentMetrics {
  agentId: AgentId;
  period: 'day' | 'week' | 'month';
  periodStart: string;
  
  // Performance
  totalInteractions: number;
  avgResponseTimeMs: number;
  successRate: number;
  
  // Satisfaction
  feedbackPositive: number;
  feedbackNegative: number;
  satisfactionScore: number;
  
  // Domaine-spécifique
  domainMetrics: Record<string, number>;
  
  // Comparaison
  vsLastPeriod: {
    interactions: number;
    responseTime: number;
    successRate: number;
  };
}

/** Rapport automatique */
export interface AutoReport {
  id: string;
  type: 'weekly_performance' | 'monthly_summary' | 'quarterly_review';
  agentId?: AgentId; // null = équipe complète
  period: { start: string; end: string };
  sections: AutoReportSection[];
  highlights: string[];
  recommendations: string[];
  generatedAt: string;
}

export interface AutoReportSection {
  title: string;
  agentId?: AgentId;
  content: string;
  metrics?: Record<string, number>;
  charts?: { type: string; data: unknown }[];
}
