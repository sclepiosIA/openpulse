/**
 * JARVIS 12.0 - Hook pour la gestion des sessions cognitives
 * 
 * Gère la mémoire de travail multi-tours côté client.
 * Maintient le contexte conversationnel pour des interactions naturelles.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';
import type { Json } from '@/integrations/supabase/types';
export interface WorkingMemoryItem {
  type: 'entity' | 'intent' | 'result' | 'clarification';
  key: string;
  value: unknown;
  timestamp: number;
  turnIndex: number;
  confidence: number;
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
  workingMemory: WorkingMemoryItem[];
  clarificationsPending: ClarificationRequest[];
  emotionalState: {
    tone: 'neutral' | 'urgent' | 'frustrated' | 'positive' | 'formal' | 'casual';
    urgency: number;
    sentiment: number;
  };
  turnCount: number;
  lastIntentType: string | null;
}

interface CoreferenceResolution {
  original: string;
  resolved: string;
}

// Patterns de coréférence en français (côté client pour résolution rapide)
const COREFERENCE_PATTERNS = {
  demonstratives: ['celui-ci', 'celle-ci', 'ceux-ci', 'celles-ci', 'ce', 'cet', 'cette', 'ces', 'ça', 'cela'],
  pronouns: ['il', 'elle', 'ils', 'elles', 'lui', 'leur'],
  temporal: ['le même', 'la même', 'comme hier', 'comme avant', 'encore', 'à nouveau'],
};

export function useJarvisCognitiveSession() {
  const { user } = useAuth();
  const [session, setSession] = useState<CognitiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sessionRef = useRef<CognitiveSession | null>(null);

  // Garder la référence synchronisée
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /**
   * Initialise ou récupère la session cognitive
   */
  const initSession = useCallback(async () => {
    if (!user?.id) return null;
    
    setIsLoading(true);
    try {
      // Chercher une session active
      const { data: existingSession } = await supabase
        .from('jarvis_cognitive_sessions')
        .select('id, user_id, session_context, working_memory, clarifications_pending, coreference_map, emotional_state, turn_count, last_intent_type, expires_at, created_at, updated_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        const mapped: CognitiveSession = {
          id: existingSession.id,
          workingMemory: (existingSession.working_memory as unknown as WorkingMemoryItem[]) || [],
          clarificationsPending: (existingSession.clarifications_pending as unknown as ClarificationRequest[]) || [],
          emotionalState: (existingSession.emotional_state as unknown as CognitiveSession['emotionalState']) || { tone: 'neutral', urgency: 0, sentiment: 0 },
          turnCount: existingSession.turn_count || 0,
          lastIntentType: existingSession.last_intent_type,
        };
        setSession(mapped);
        return mapped;
      }

      // Créer une nouvelle session
      const newSession = {
        user_id: user.id,
        session_context: {},
        working_memory: [],
        clarifications_pending: [],
        coreference_map: {},
        emotional_state: { tone: 'neutral', urgency: 0, sentiment: 0 },
        turn_count: 0,
        last_intent_type: null,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };

      const { data: createdSession, error } = await supabase
        .from('jarvis_cognitive_sessions')
        .insert(newSession)
        .select()
        .single();

      if (error) throw error;

      const mapped: CognitiveSession = {
        id: createdSession.id,
        workingMemory: [],
        clarificationsPending: [],
        emotionalState: { tone: 'neutral', urgency: 0, sentiment: 0 },
        turnCount: 0,
        lastIntentType: null,
      };
      setSession(mapped);
      return mapped;
    } catch (error) {
      debug.error('Error initializing cognitive session:', error);
      // Session locale en fallback
      const localSession: CognitiveSession = {
        id: crypto.randomUUID(),
        workingMemory: [],
        clarificationsPending: [],
        emotionalState: { tone: 'neutral', urgency: 0, sentiment: 0 },
        turnCount: 0,
        lastIntentType: null,
      };
      setSession(localSession);
      return localSession;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Ajoute un élément à la mémoire de travail
   */
  const addToMemory = useCallback((item: Omit<WorkingMemoryItem, 'timestamp' | 'turnIndex'>) => {
    setSession(prev => {
      if (!prev) return prev;
      
      const newItem: WorkingMemoryItem = {
        ...item,
        timestamp: Date.now(),
        turnIndex: prev.turnCount,
      };
      
      // Limiter à 50 items
      const workingMemory = [...prev.workingMemory, newItem].slice(-50);
      
      return { ...prev, workingMemory };
    });
  }, []);

  /**
   * Résout les coréférences dans un message
   */
  const resolveCorefereces = useCallback((message: string): { 
    resolvedMessage: string; 
    resolutions: CoreferenceResolution[] 
  } => {
    const currentSession = sessionRef.current;
    if (!currentSession || currentSession.workingMemory.length === 0) {
      return { resolvedMessage: message, resolutions: [] };
    }

    let resolvedMessage = message;
    const resolutions: CoreferenceResolution[] = [];
    const lowerMessage = message.toLowerCase();

    // Trouver les entités récentes
    const recentEntities = currentSession.workingMemory
      .filter(item => item.type === 'entity')
      .sort((a, b) => b.timestamp - a.timestamp);

    // Résoudre les démonstratifs
    for (const pattern of COREFERENCE_PATTERNS.demonstratives) {
      if (lowerMessage.includes(pattern)) {
        const entity = recentEntities[0];
        if (entity) {
          resolutions.push({ original: pattern, resolved: String(entity.value) });
          resolvedMessage = resolvedMessage.replace(
            new RegExp(`\\b${pattern}\\b`, 'gi'), 
            String(entity.value)
          );
        }
      }
    }

    // Résoudre les pronoms
    for (const pattern of COREFERENCE_PATTERNS.pronouns) {
      if (new RegExp(`\\b${pattern}\\b`, 'i').test(message)) {
        const personEntity = recentEntities.find(e => e.key.includes('person'));
        if (personEntity) {
          resolutions.push({ original: pattern, resolved: String(personEntity.value) });
          resolvedMessage = resolvedMessage.replace(
            new RegExp(`\\b${pattern}\\b`, 'gi'), 
            String(personEntity.value)
          );
        }
      }
    }

    // Résoudre les références temporelles
    for (const pattern of COREFERENCE_PATTERNS.temporal) {
      if (lowerMessage.includes(pattern)) {
        const actionEntity = currentSession.workingMemory.find(
          item => item.type === 'intent' && item.turnIndex === currentSession.turnCount - 1
        );
        if (actionEntity) {
          resolutions.push({ original: pattern, resolved: `[répéter: ${actionEntity.key}]` });
        }
      }
    }

    return { resolvedMessage, resolutions };
  }, []);

  /**
   * Détecte si une clarification est nécessaire
   */
  const checkClarificationNeeded = useCallback((message: string): ClarificationRequest | null => {
    const currentSession = sessionRef.current;
    const lowerMessage = message.toLowerCase();

    // Ambiguïté sur le destinataire
    if (/\b(envoie|contacte|appelle)\b/i.test(message) && !/@/.test(message)) {
      const recentContacts = currentSession?.workingMemory.filter(
        item => item.type === 'entity' && item.key.includes('person')
      ) || [];

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
          options: recentContacts.slice(0, 4).map(c => String(c.value)),
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
      const hasRecentAction = currentSession?.workingMemory.some(
        item => item.type === 'intent' && item.turnIndex === (currentSession?.turnCount || 0) - 1
      );
      
      if (!hasRecentAction) {
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
  }, []);

  /**
   * Ajoute une clarification en attente
   */
  const addClarification = useCallback((clarification: ClarificationRequest) => {
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        clarificationsPending: [...prev.clarificationsPending, clarification],
      };
    });
  }, []);

  /**
   * Répond à une clarification
   */
  const answerClarification = useCallback((clarificationId: string, answer: string) => {
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        clarificationsPending: prev.clarificationsPending.map(c =>
          c.id === clarificationId ? { ...c, answered: true, answer } : c
        ),
      };
    });
  }, []);

  /**
   * Met à jour l'état émotionnel
   */
  const updateEmotionalState = useCallback((newState: Partial<CognitiveSession['emotionalState']>) => {
    setSession(prev => {
      if (!prev) return prev;
      const alpha = 0.7; // Poids de la nouvelle mesure
      return {
        ...prev,
        emotionalState: {
          tone: newState.tone ?? prev.emotionalState.tone,
          urgency: Math.round(
            alpha * (newState.urgency ?? prev.emotionalState.urgency) + 
            (1 - alpha) * prev.emotionalState.urgency
          ),
          sentiment: alpha * (newState.sentiment ?? prev.emotionalState.sentiment) + 
            (1 - alpha) * prev.emotionalState.sentiment,
        },
      };
    });
  }, []);

  /**
   * Incrémente le compteur de tours
   */
  const incrementTurn = useCallback(() => {
    setSession(prev => {
      if (!prev) return prev;
      return { ...prev, turnCount: prev.turnCount + 1 };
    });
  }, []);

  /**
   * Sauvegarde la session en base de données
   */
  const saveSession = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession || !user?.id) return;

    try {
      await supabase
        .from('jarvis_cognitive_sessions')
        .update({
          working_memory: JSON.parse(JSON.stringify(currentSession.workingMemory)) as Json,
          clarifications_pending: JSON.parse(JSON.stringify(currentSession.clarificationsPending)) as Json,
          emotional_state: JSON.parse(JSON.stringify(currentSession.emotionalState)) as Json,
          turn_count: currentSession.turnCount,
          last_intent_type: currentSession.lastIntentType,
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', currentSession.id);
    } catch (error) {
      debug.error('Error saving cognitive session:', error);
    }
  }, [user?.id]);

  /**
   * Réinitialise la session
   */
  const resetSession = useCallback(async () => {
    if (!user?.id) return;
    
    // Supprimer les anciennes sessions
    await supabase
      .from('jarvis_cognitive_sessions')
      .delete()
      .eq('user_id', user.id);
    
    // Créer une nouvelle session
    await initSession();
  }, [user?.id, initSession]);

  /**
   * Génère un résumé du contexte pour le prompt
   */
  const getContextSummary = useCallback((): string => {
    const currentSession = sessionRef.current;
    if (!currentSession) return '';

    const lines: string[] = [];

    if (currentSession.turnCount > 0) {
      lines.push(`[Tour ${currentSession.turnCount + 1} de la conversation]`);
    }

    if (currentSession.emotionalState.urgency > 5) {
      lines.push(`⚠️ Urgence détectée (niveau ${currentSession.emotionalState.urgency}/10)`);
    }

    if (currentSession.emotionalState.sentiment < -0.3) {
      lines.push(`💡 Adapter le ton : utilisateur potentiellement frustré`);
    }

    const recentEntities = currentSession.workingMemory
      .filter(item => item.type === 'entity')
      .slice(-5);

    if (recentEntities.length > 0) {
      lines.push('\nContexte récent:');
      recentEntities.forEach(e => {
        lines.push(`- ${e.key}: ${e.value}`);
      });
    }

    return lines.join('\n');
  }, []);

  // Auto-sauvegarde périodique
  useEffect(() => {
    if (!session) return;
    
    const saveInterval = setInterval(saveSession, 30000); // Toutes les 30 secondes
    
    return () => clearInterval(saveInterval);
  }, [session, saveSession]);

  return {
    session,
    isLoading,
    initSession,
    addToMemory,
    resolveCorefereces,
    checkClarificationNeeded,
    addClarification,
    answerClarification,
    updateEmotionalState,
    incrementTurn,
    saveSession,
    resetSession,
    getContextSummary,
  };
}
