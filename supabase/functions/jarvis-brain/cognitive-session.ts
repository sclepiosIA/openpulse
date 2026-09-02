/**
 * JARVIS 12.0 - Cognitive Session Manager
 * 
 * Gère la mémoire de travail multi-tours pour des conversations naturelles.
 * Maintient le contexte, résout les coréférences et détecte les clarifications nécessaires.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface WorkingMemoryItem {
  type: 'entity' | 'intent' | 'result' | 'clarification';
  key: string;
  value: unknown;
  timestamp: number;
  turnIndex: number;
  confidence: number;
}

export interface CoreferenceEntry {
  pronoun: string;
  referent: string;
  referentType: 'person' | 'etablissement' | 'task' | 'email' | 'document' | 'amount' | 'date';
  confidence: number;
  turnIndex: number;
}

export interface ClarificationRequest {
  id: string;
  question: string;
  options?: string[];
  context: string;
  priority: 'low' | 'medium' | 'high';
  answered: boolean;
  answer?: string;
}

export interface CognitiveSession {
  id: string;
  userId: string;
  sessionContext: Record<string, unknown>;
  workingMemory: WorkingMemoryItem[];
  clarificationsPending: ClarificationRequest[];
  coreferenceMap: Record<string, CoreferenceEntry>;
  emotionalState: {
    tone: 'neutral' | 'urgent' | 'frustrated' | 'positive' | 'formal' | 'casual';
    urgency: number;
    sentiment: number;
  };
  turnCount: number;
  lastIntentType: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// Patterns de coréférence en français
const COREFERENCE_PATTERNS = {
  // Pronoms personnels
  pronouns: {
    'il': ['person', 'etablissement'],
    'elle': ['person', 'etablissement'],
    'ils': ['person', 'etablissement'],
    'elles': ['person', 'etablissement'],
    'lui': ['person'],
    'leur': ['person', 'etablissement'],
  },
  // Pronoms démonstratifs
  demonstratives: {
    'celui-ci': ['entity'],
    'celle-ci': ['entity'],
    'ceux-ci': ['entity'],
    'celles-ci': ['entity'],
    'celui-là': ['entity'],
    'celle-là': ['entity'],
    'ce': ['entity', 'task', 'email'],
    'cet': ['entity'],
    'cette': ['entity'],
    'ces': ['entity'],
    'ça': ['entity', 'task'],
    'cela': ['entity'],
  },
  // Références temporelles
  temporal: {
    'le même': ['entity', 'date'],
    'la même': ['entity', 'date'],
    'les mêmes': ['entity'],
    'comme hier': ['action', 'date'],
    'comme avant': ['action'],
    'comme la dernière fois': ['action'],
    'encore': ['action'],
    'à nouveau': ['action'],
  },
  // Références possessives
  possessives: {
    'son': ['entity_of_person'],
    'sa': ['entity_of_person'],
    'ses': ['entity_of_person'],
    'leur': ['entity_of_person'],
    'leurs': ['entity_of_person'],
  },
};

/**
 * Récupère ou crée une session cognitive pour un utilisateur
 */
export async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string
): Promise<CognitiveSession> {
  // Chercher une session active non expirée
  const { data: existingSession, error: fetchError } = await supabase
    .from('jarvis_cognitive_sessions')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (existingSession && !fetchError) {
    return mapDbToSession(existingSession);
  }
  
  // Créer une nouvelle session
  const newSession = {
    user_id: userId,
    session_context: {},
    working_memory: [],
    clarifications_pending: [],
    coreference_map: {},
    emotional_state: { tone: 'neutral', urgency: 0, sentiment: 0 },
    turn_count: 0,
    last_intent_type: null,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 heures
  };
  
  const { data: createdSession, error: createError } = await supabase
    .from('jarvis_cognitive_sessions')
    .insert(newSession)
    .select()
    .single();
  
  if (createError) {
    console.error('Error creating cognitive session:', createError);
    // Retourner une session en mémoire en cas d'erreur
    return {
      id: crypto.randomUUID(),
      userId,
      sessionContext: {},
      workingMemory: [],
      clarificationsPending: [],
      coreferenceMap: {},
      emotionalState: { tone: 'neutral', urgency: 0, sentiment: 0 },
      turnCount: 0,
      lastIntentType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
  }
  
  return mapDbToSession(createdSession);
}

/**
 * Met à jour une session cognitive
 */
export async function updateSession(
  supabase: SupabaseClient,
  session: CognitiveSession
): Promise<void> {
  const dbSession = {
    session_context: session.sessionContext,
    working_memory: session.workingMemory,
    clarifications_pending: session.clarificationsPending,
    coreference_map: session.coreferenceMap,
    emotional_state: session.emotionalState,
    turn_count: session.turnCount,
    last_intent_type: session.lastIntentType,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Prolonger la session
  };
  
  await supabase
    .from('jarvis_cognitive_sessions')
    .update(dbSession)
    .eq('id', session.id);
}

/**
 * Ajoute un élément à la mémoire de travail
 */
export function addToWorkingMemory(
  session: CognitiveSession,
  item: Omit<WorkingMemoryItem, 'timestamp' | 'turnIndex'>
): CognitiveSession {
  const newItem: WorkingMemoryItem = {
    ...item,
    timestamp: Date.now(),
    turnIndex: session.turnCount,
  };
  
  // Limiter la taille de la mémoire de travail (max 50 items)
  const workingMemory = [...session.workingMemory, newItem];
  if (workingMemory.length > 50) {
    workingMemory.shift();
  }
  
  return {
    ...session,
    workingMemory,
  };
}

/**
 * Résout les coréférences dans un message
 */
export function resolveCorefereces(
  message: string,
  session: CognitiveSession
): { resolvedMessage: string; resolutions: Array<{ original: string; resolved: string }> } {
  let resolvedMessage = message;
  const resolutions: Array<{ original: string; resolved: string }> = [];
  
  // Chercher les pronoms et démonstratifs dans le message
  const words = message.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    // Vérifier les pronoms
    if (word in COREFERENCE_PATTERNS.pronouns) {
      const referent = findReferentInMemory(session, COREFERENCE_PATTERNS.pronouns[word as keyof typeof COREFERENCE_PATTERNS.pronouns]);
      if (referent) {
        resolutions.push({ original: word, resolved: referent.value as string });
        resolvedMessage = resolvedMessage.replace(new RegExp(`\\b${word}\\b`, 'gi'), referent.value as string);
      }
    }
    
    // Vérifier les démonstratifs
    if (word in COREFERENCE_PATTERNS.demonstratives) {
      const referent = findReferentInMemory(session, COREFERENCE_PATTERNS.demonstratives[word as keyof typeof COREFERENCE_PATTERNS.demonstratives]);
      if (referent) {
        resolutions.push({ original: word, resolved: referent.value as string });
        resolvedMessage = resolvedMessage.replace(new RegExp(`\\b${word}\\b`, 'gi'), referent.value as string);
      }
    }
  }
  
  // Vérifier les patterns temporels multi-mots
  for (const [pattern, types] of Object.entries(COREFERENCE_PATTERNS.temporal)) {
    if (message.toLowerCase().includes(pattern)) {
      const referent = findReferentInMemory(session, types);
      if (referent) {
        resolutions.push({ original: pattern, resolved: referent.value as string });
        resolvedMessage = resolvedMessage.replace(new RegExp(pattern, 'gi'), referent.value as string);
      }
    }
  }
  
  return { resolvedMessage, resolutions };
}

/**
 * Trouve un référent dans la mémoire de travail
 */
function findReferentInMemory(
  session: CognitiveSession,
  allowedTypes: string[]
): WorkingMemoryItem | null {
  // Parcourir la mémoire en ordre inverse (plus récent d'abord)
  const sortedMemory = [...session.workingMemory].sort((a, b) => b.timestamp - a.timestamp);
  
  for (const item of sortedMemory) {
    if (item.type === 'entity' && allowedTypes.some(t => (item.key || '').includes(t))) {
      return item;
    }
  }
  
  return null;
}

/**
 * Détecte si une clarification est nécessaire
 */
export function detectClarificationNeeded(
  message: string,
  session: CognitiveSession
): ClarificationRequest | null {
  const lowerMessage = message.toLowerCase();
  
  // Ambiguïté sur la cible
  if (/\b(envoie|contacte|appelle)\b/i.test(message) && !/@/.test(message)) {
    // Pas d'email explicite, vérifier si on a un contact récent en mémoire
    const recentContacts = session.workingMemory.filter(
      item => item.type === 'entity' && item.key.includes('person')
    );
    
    if (recentContacts.length === 0) {
      return {
        id: crypto.randomUUID(),
        question: "À qui souhaitez-vous envoyer ce message ?",
        context: 'contact_resolution',
        priority: 'high',
        answered: false,
      };
    } else if (recentContacts.length > 1) {
      return {
        id: crypto.randomUUID(),
        question: "Vous voulez envoyer à qui exactement ?",
        options: recentContacts.map(c => c.value as string),
        context: 'contact_disambiguation',
        priority: 'medium',
        answered: false,
      };
    }
  }
  
  // Ambiguïté temporelle
  if (/\b(plus tard|bientôt|prochainement)\b/i.test(message) && /\b(planifie|programme|rappelle)\b/i.test(message)) {
    return {
      id: crypto.randomUUID(),
      question: "Pour quand exactement souhaitez-vous planifier cela ?",
      options: ['Dans 1 heure', 'Demain matin', 'Demain après-midi', 'La semaine prochaine'],
      context: 'temporal_clarification',
      priority: 'medium',
      answered: false,
    };
  }
  
  // Action ambiguë
  if (/\b(fais|fait|faire)\s+(ça|cela|la même chose|pareil)\b/i.test(message)) {
    const lastAction = session.workingMemory.find(
      item => item.type === 'intent' && item.turnIndex === session.turnCount - 1
    );
    
    if (!lastAction) {
      return {
        id: crypto.randomUUID(),
        question: "Je ne suis pas sûr de comprendre. Que souhaitez-vous que je fasse ?",
        context: 'action_clarification',
        priority: 'high',
        answered: false,
      };
    }
  }
  
  return null;
}

/**
 * Met à jour l'état émotionnel de la session
 */
export function updateEmotionalState(
  session: CognitiveSession,
  emotionalContext: { tone: string; urgencyLevel: number; sentimentScore: number }
): CognitiveSession {
  // Faire une moyenne pondérée avec l'état précédent pour un lissage
  const alpha = 0.7; // Poids de la nouvelle mesure
  
  return {
    ...session,
    emotionalState: {
      tone: emotionalContext.tone as CognitiveSession['emotionalState']['tone'],
      urgency: Math.round(alpha * emotionalContext.urgencyLevel + (1 - alpha) * session.emotionalState.urgency),
      sentiment: alpha * emotionalContext.sentimentScore + (1 - alpha) * session.emotionalState.sentiment,
    },
  };
}

/**
 * Incrémente le compteur de tours
 */
export function incrementTurn(session: CognitiveSession): CognitiveSession {
  return {
    ...session,
    turnCount: session.turnCount + 1,
  };
}

/**
 * Génère un contexte enrichi pour le prompt GPT
 */
export function generateEnrichedContext(session: CognitiveSession): string {
  const lines: string[] = [];
  
  if (session.turnCount > 0) {
    lines.push(`[SESSION COGNITIVE - Tour ${session.turnCount + 1}]`);
  }
  
  // Ajouter l'état émotionnel si pertinent
  if (session.emotionalState.urgency > 5) {
    lines.push(`⚠️ Utilisateur en situation urgente (niveau ${session.emotionalState.urgency}/10)`);
  }
  if (session.emotionalState.sentiment < -0.3) {
    lines.push(`😟 Utilisateur potentiellement frustré - répondre avec empathie`);
  }
  
  // Ajouter le contexte de la mémoire de travail
  const recentEntities = session.workingMemory
    .filter(item => item.type === 'entity')
    .slice(-5);
  
  if (recentEntities.length > 0) {
    lines.push('\n[CONTEXTE RÉCENT]');
    recentEntities.forEach(entity => {
      lines.push(`- ${entity.key}: ${entity.value}`);
    });
  }
  
  // Ajouter les clarifications en attente
  const pendingClarifications = session.clarificationsPending.filter(c => !c.answered);
  if (pendingClarifications.length > 0) {
    lines.push('\n[CLARIFICATIONS EN ATTENTE]');
    pendingClarifications.forEach(c => {
      lines.push(`- ${c.question}`);
    });
  }
  
  return lines.length > 0 ? lines.join('\n') : '';
}

/**
 * Mappe les données DB vers l'interface CognitiveSession
 */
function mapDbToSession(dbRow: Record<string, unknown>): CognitiveSession {
  return {
    id: dbRow.id as string,
    userId: dbRow.user_id as string,
    sessionContext: (dbRow.session_context || {}) as Record<string, unknown>,
    workingMemory: (dbRow.working_memory || []) as WorkingMemoryItem[],
    clarificationsPending: (dbRow.clarifications_pending || []) as ClarificationRequest[],
    coreferenceMap: (dbRow.coreference_map || {}) as Record<string, CoreferenceEntry>,
    emotionalState: (dbRow.emotional_state || { tone: 'neutral', urgency: 0, sentiment: 0 }) as CognitiveSession['emotionalState'],
    turnCount: (dbRow.turn_count || 0) as number,
    lastIntentType: dbRow.last_intent_type as string | null,
    createdAt: dbRow.created_at as string,
    updatedAt: dbRow.updated_at as string,
    expiresAt: dbRow.expires_at as string,
  };
}
