/**
 * JARVIS 12.0 - Types pour le système Multi-Agent
 * 
 * Définit les types TypeScript pour l'équipe d'assistants spécialisés
 */

// Identifiants des agents
export type AgentId = 'sophia' | 'marcus' | 'olivia' | 'noah' | 'emma' | 'alex';

// Domaines d'expertise
export type AgentDomain = 'crm' | 'rh' | 'tresorerie' | 'rd' | 'support' | 'analytics';

// Voix Azure GPT Realtime par agent
export type AgentVoice = 'shimmer' | 'echo' | 'alloy' | 'nova' | 'fable' | 'onyx';

// Statuts d'un agent
export type AgentStatus = 'idle' | 'thinking' | 'speaking' | 'executing' | 'error';

// Définition d'un agent
export interface JarvisAgent {
  id: AgentId;
  name: string;
  displayName: string;
  domain: AgentDomain;
  voice: AgentVoice;
  color: string; // Couleur HSL pour l'avatar
  gradientFrom: string;
  gradientTo: string;
  emoji: string;
  personality: string;
  shortDescription: string;
  systemPromptKey: string;
  allowedTools: string[];
  allowedTables: string[];
  keywords: string[];
}

// Message d'un agent dans la conversation
export interface AgentMessage {
  id: string;
  agentId: AgentId | 'user' | 'prime';
  content: string;
  timestamp: string;
  toolCalls?: AgentToolCall[];
  metadata?: Record<string, unknown>;
}

// Appel d'outil par un agent
export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: unknown;
}

// Résultat d'exécution d'un agent
export interface AgentExecutionResult {
  agentId: AgentId;
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
  toolCalls?: AgentToolCall[];
  executionTimeMs: number;
  handoffTo?: AgentId;
}

// Requête vers jarvis-prime
export interface JarvisPrimeRequest {
  query: string;
  conversationId?: string;
  context?: Record<string, unknown>;
  preferredAgent?: AgentId;
  forceAgents?: AgentId[];
}

// Réponse de jarvis-prime
export interface JarvisPrimeResponse {
  success: boolean;
  selectedAgents: AgentId[];
  results: AgentExecutionResult[];
  synthesis: string;
  totalExecutionTimeMs: number;
  conversationId: string;
}

// Configuration utilisateur pour les agents
export interface UserAgentPreferences {
  defaultAgent?: AgentId;
  enabledAgents: AgentId[];
  proactivityLevel: Record<AgentId, 'off' | 'low' | 'medium' | 'high'>;
  customNames?: Partial<Record<AgentId, string>>;
}

// Mémoire partagée entre agents
export interface SharedAgentMemory {
  id: string;
  agentId: AgentId;
  memoryKey: string;
  memoryValue: Record<string, unknown>;
  contextType?: string;
  expiresAt?: string;
  createdAt: string;
}

// Interaction agent (pour analytics)
export interface AgentInteraction {
  id: string;
  userId: string;
  agentId: AgentId;
  query: string;
  response?: string;
  toolCalls?: AgentToolCall[];
  satisfactionScore?: number;
  executionTimeMs: number;
  handoffTo?: AgentId;
  createdAt: string;
}

// Briefing quotidien (standup)
export interface TeamStandupBriefing {
  id: string;
  date: string;
  userId: string;
  sections: StandupSection[];
  generatedAt: string;
}

export interface StandupSection {
  agentId: AgentId;
  agentName: string;
  emoji: string;
  highlights: string[];
  alerts: StandupAlert[];
  metrics?: Record<string, number>;
}

export interface StandupAlert {
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  actionUrl?: string;
}

// Handoff vocal entre agents
export interface VoiceHandoff {
  fromAgent: AgentId;
  toAgent: AgentId;
  reason: string;
  contextPassed: Record<string, unknown>;
  timestamp: string;
}

// État du team panel
export interface JarvisTeamState {
  activeAgents: AgentId[];
  currentSpeaker?: AgentId;
  conversationHistory: AgentMessage[];
  isTeamMode: boolean;
  voiceHandoffs: VoiceHandoff[];
}
