/**
 * useJarvis - Hook principal pour l'assistant JARVIS 12.0
 * 
 * Chat conversationnel avec GPT-5 Tool Calling
 * - Mode chat avec streaming SSE
 * - Exécution d'outils en temps réel (60+ outils)
 * - Mode autonome pour actions automatiques
 * - Apprentissage adaptatif (useJarvisLearning)
 * - Interface vocale bidirectionnelle
 * - Intégration avec le système legacy d'actions pendantes
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { useJarvisPendingActions } from './useJarvisPendingActions';
import { useJarvisPreferences } from './useJarvisPreferences';
import { useJarvisLearning } from './useJarvisLearning';
import { useJarvisFocus } from './useJarvisFocus';
import { useJarvisProactiveAlerts } from './useJarvisProactiveAlerts';
import { useJarvisConversationOptional } from '@/contexts/JarvisConversationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { debug } from '@/lib/debug';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type {
  UseJarvisReturn,
  JarvisTrigger,
  JarvisActionData,
  JarvisChatMessage,
  JarvisBrainResponse,
  ToolCall,
} from '@/types/jarvis';
import { JARVIS_CAPABILITIES } from '@/types/jarvis';

// ANTI-SPAM: Minimum delay between calls (ms)
const THROTTLE_MS = 1000;

export function useJarvis(): UseJarvisReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const pendingActions = useJarvisPendingActions(userId);
  const preferencesHook = useJarvisPreferences(userId);
  const learning = useJarvisLearning();
  const focus = useJarvisFocus();
  const { unreadCount: proactiveUnreadCount } = useJarvisProactiveAlerts();

  // JARVIS 12.0: Chat state — lifted to JarvisConversationContext when available
  // Falls back to local useState if context is not mounted (shouldn't happen in normal flow)
  const conversationCtx = useJarvisConversationOptional();
  const [localMessages, setLocalMessages] = useState<JarvisChatMessage[]>([]);
  const [localIsTyping, setLocalIsTyping] = useState(false);
  
  // Use context state if available, otherwise local (graceful degradation)
  const messages = conversationCtx?.messages ?? localMessages;
  const setMessages = conversationCtx?.setMessages ?? setLocalMessages;
  const isTyping = conversationCtx?.isTyping ?? localIsTyping;
  const setIsTyping = conversationCtx?.setIsTyping ?? setLocalIsTyping;
  
  // Mode autonome toujours actif - les actions sensibles/critiques requièrent confirmation via UI
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[]>([]);
  
  // ANTI-SPAM: State for confirmation buttons
  const [isConfirming, setIsConfirming] = useState(false);

  // ANTI-SPAM: Refs for throttling
  const isProcessingRef = useRef(false);
  const lastCallTimeRef = useRef(0);

  // ============================================================
  // JARVIS 12.0: Chat with Brain
  // ============================================================
  // ============================================================
  // Page Context Injection for intelligent responses
  // ============================================================
  const getPageContextForInjection = useCallback((): string | null => {
    // This will be called during chat to inject context
    // We get context from URL parsing and page detection
    const path = window.location.pathname;
    const contextLines: string[] = [];
    
    // Detect module from path
    const modulePatterns: Array<{ pattern: RegExp; module: string; type: string }> = [
      // CRM
      { pattern: /^\/etablissements\/([a-f0-9-]+)/, module: 'CRM', type: 'établissement' },
      { pattern: /^\/etablissements$/, module: 'CRM', type: 'liste établissements' },
      { pattern: /^\/prospects/, module: 'CRM', type: 'prospects' },
      { pattern: /^\/deploiement/, module: 'CRM', type: 'déploiement' },
      { pattern: /^\/production/, module: 'CRM', type: 'production' },
      { pattern: /^\/groupes\/([a-f0-9-]+)/, module: 'CRM', type: 'groupe' },
      { pattern: /^\/groupes/, module: 'CRM', type: 'liste groupes' },
      { pattern: /^\/partenaires\/([a-f0-9-]+)/, module: 'CRM', type: 'partenaire' },
      { pattern: /^\/partenaires/, module: 'CRM', type: 'liste partenaires' },
      // RH / People
      { pattern: /^\/people\/([a-f0-9-]+)/, module: 'RH', type: 'dossier employé' },
      { pattern: /^\/people/, module: 'RH', type: 'équipe' },
      { pattern: /^\/competences/, module: 'RH', type: 'compétences' },
      // Trésorerie / Facturation
      { pattern: /^\/facturation\/([a-f0-9-]+)/, module: 'TRÉSORERIE', type: 'facture' },
      { pattern: /^\/facturation/, module: 'TRÉSORERIE', type: 'facturation' },
      { pattern: /^\/tresorerie/, module: 'TRÉSORERIE', type: 'finances' },
      // Contrats
      { pattern: /^\/contrats\/([a-f0-9-]+)/, module: 'CONTRATS', type: 'contrat' },
      { pattern: /^\/contrats/, module: 'CONTRATS', type: 'liste contrats' },
      // Emails
      { pattern: /^\/emails\/([a-f0-9-]+)/, module: 'EMAILS', type: 'thread' },
      { pattern: /^\/emails/, module: 'EMAILS', type: 'messagerie' },
      // R&D
      { pattern: /^\/rd/, module: 'R&D', type: 'sprints' },
      { pattern: /^\/gantt/, module: 'R&D', type: 'gantt' },
      // Support
      { pattern: /^\/support\/([a-f0-9-]+)/, module: 'SUPPORT', type: 'ticket' },
      { pattern: /^\/support/, module: 'SUPPORT', type: 'tickets' },
      // Formations
      { pattern: /^\/formations/, module: 'FORMATIONS', type: 'sessions' },
      // Calendrier & Booking
      { pattern: /^\/calendrier/, module: 'CALENDRIER', type: 'événements' },
      { pattern: /^\/booking/, module: 'CALENDRIER', type: 'réservations' },
      { pattern: /^\/visio/, module: 'CALENDRIER', type: 'visioconférence' },
      // Recrutement
      { pattern: /^\/recrutement\/([a-f0-9-]+)/, module: 'RECRUTEMENT', type: 'candidat' },
      { pattern: /^\/recrutement/, module: 'RECRUTEMENT', type: 'candidats' },
      // Documents & KB
      { pattern: /^\/documents/, module: 'DOCUMENTS', type: 'documents' },
      { pattern: /^\/knowledge-base/, module: 'KB', type: 'base de connaissances' },
      // Forum & Pulse
      { pattern: /^\/forum/, module: 'FORUM', type: 'discussions' },
      { pattern: /^\/pulse/, module: 'PULSE', type: 'conversations' },
      // Analytics & Rapports
      { pattern: /^\/rapports/, module: 'ANALYTICS', type: 'rapports' },
      { pattern: /^\/analytics/, module: 'ANALYTICS', type: 'analytics' },
      // Administration
      { pattern: /^\/parametres/, module: 'ADMIN', type: 'paramètres' },
      { pattern: /^\/profil/, module: 'PROFIL', type: 'mon profil' },
      // Tâches
      { pattern: /^\/todos/, module: 'TÂCHES', type: 'mes tâches' },
      // Dashboard
      { pattern: /^\/$/, module: 'DASHBOARD', type: 'accueil' },
    ];
    
    for (const { pattern, module, type } of modulePatterns) {
      const match = path.match(pattern);
      if (match) {
        contextLines.push(`[MODULE: ${module}]`);
        contextLines.push(`[TYPE: ${type}]`);
        if (match[1]) {
          contextLines.push(`[ENTITY_ID: ${match[1]}]`);
        }
        break;
      }
    }
    
    // Parse URL params for additional context
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    const filter = searchParams.get('filter');
    if (tab) contextLines.push(`[TAB: ${tab}]`);
    if (filter) contextLines.push(`[FILTER: ${filter}]`);
    
    return contextLines.length > 0 ? contextLines.join('\n') : null;
  }, []);

  const chat = useCallback(async (message: string): Promise<JarvisBrainResponse | null> => {
    if (!userId) {
      toast({ title: 'Non connecté', variant: 'destructive' });
      return null;
    }

    // Throttle check
    const now = Date.now();
    if (now - lastCallTimeRef.current < THROTTLE_MS || isProcessingRef.current) {
      debug.warn('[useJarvis] Throttled');
      return null;
    }

    lastCallTimeRef.current = now;
    isProcessingRef.current = true;
    setIsTyping(true);

    // JARVIS 8.0: Inject page context automatically
    const pageContext = getPageContextForInjection();
    const enrichedMessage = pageContext 
      ? `[CONTEXTE PAGE AUTOMATIQUE]\n${pageContext}\n\n[QUESTION]\n${message}`
      : message;

    // Add user message (show original, not enriched)
    const userMessage: JarvisChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call jarvis-brain with enriched message
      const { data, error } = await supabase.functions.invoke('jarvis-brain', {
        body: {
          user_id: userId,
          message: enrichedMessage, // Use enriched message with context
          conversation_history: conversationHistory,
          autonomous_mode: true  // Toujours actif - sécurité gérée par requiresConfirmation()
        }
      });

      if (error) throw error;

      const response = data as JarvisBrainResponse;

      // Add assistant message - check if any tool requires confirmation
      const assistantMessage: JarvisChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        toolCalls: response.tool_calls?.map(tc => {
          const result = response.tool_results?.find(tr => tr.tool_call_id === tc.id)?.result;
          // Check if this tool call requires confirmation
          const requiresConfirmation = result?.error === 'REQUIRES_CONFIRMATION';
          return {
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
            status: requiresConfirmation ? 'requires_confirmation' as const : 'completed' as const,
            result
          };
        }),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Check for pending tool calls requiring confirmation
      const pendingCalls = response.tool_results?.filter(
        tr => tr.result.error === 'REQUIRES_CONFIRMATION'
      );
      if (pendingCalls && pendingCalls.length > 0) {
        setPendingToolCalls(pendingCalls.map(pc => ({
          id: pc.tool_call_id,
          name: pc.name,
          arguments: (pc.result.data as { arguments?: Record<string, unknown> })?.arguments || {},
          status: 'requires_confirmation' as const
        })));
      }

      // Record for learning
      focus.recordActivity('jarvis_chat', userMessage.id, message.substring(0, 50));

      return response;
    } catch (error) {
      debug.error('[useJarvis] Chat error:', error);
      toast({ 
        title: 'Erreur', 
        description: 'Impossible de contacter Jarvis', 
        variant: 'destructive' 
      });
      return null;
    } finally {
      isProcessingRef.current = false;
      setIsTyping(false);
    }
  }, [userId, toast, messages, focus]);

  const clearChat = useCallback(() => {
    if (conversationCtx) {
      conversationCtx.clearMessages();
    } else {
      setMessages([]);
    }
    setPendingToolCalls([]);
  }, [conversationCtx, setMessages]);

  // ============================================================
  // Tool Call Confirmation
  // ============================================================
  // ============================================================
  // PHASE 4: Tool Call Confirmation avec timeout et feedback améliorés
  // ============================================================
  const confirmToolCall = useCallback(async (toolCallId: string) => {
    // ANTI-SPAM: Prevent multiple clicks
    if (isConfirming) {
      debug.log('[confirmToolCall] Already confirming, ignoring click');
      return;
    }
    
    setIsConfirming(true);
    const startTime = Date.now();
    
    try {
      debug.log('[confirmToolCall] START - toolCallId:', toolCallId);
      debug.log('[confirmToolCall] userId:', userId);
      
      if (!userId) {
        debug.warn('[confirmToolCall] No userId');
        toast({ title: 'Erreur', description: 'Non connecté', variant: 'destructive' });
        return;
      }
    
      const toolCall = pendingToolCalls.find(tc => tc.id === toolCallId);
      
      // Show loading toast immediately
      toast({ 
        title: '⏳ Exécution en cours...', 
        description: toolCall?.name || 'Action en cours',
        duration: 10000 
      });
      
      debug.log('[confirmToolCall] Invoking jarvis-brain with "oui" for DIRECT EXECUTION...');
      
      // PHASE 4 FIX: Direct API call with explicit timeout handling
      // Note: supabase-js doesn't support AbortController signal, but we track time client-side
      const { data, error } = await supabase.functions.invoke('jarvis-brain', {
        body: {
          user_id: userId,
          message: 'oui',  // Triggers DIRECT EXECUTION in jarvis-brain
          autonomous_mode: true
        }
      });

      const elapsedMs = Date.now() - startTime;
      debug.log(`[confirmToolCall] Response received in ${elapsedMs}ms:`, { 
        success: data?.success, 
        direct_execution: data?.direct_execution,
        error: error?.message 
      });

      if (error) {
        debug.error('[confirmToolCall] Supabase function error:', error);
        throw error;
      }

      // Remove from pending
      setPendingToolCalls(prev => prev.filter(tc => tc.id !== toolCallId));
      
      // Add confirmation to chat
      const confirmMsg: JarvisChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: '✅ Confirmé',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, confirmMsg]);
      
      // Add assistant response if any
      const responseContent = data?.content || data?.response;
      if (responseContent) {
        const assistantMsg: JarvisChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseContent,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
      
      // Show appropriate success/error toast
      if (data?.success !== false && data?.direct_execution) {
        toast({ 
          title: '✅ Action exécutée !', 
          description: `Terminé en ${(elapsedMs / 1000).toFixed(1)}s`,
          duration: 5000 
        });
      } else if (data?.success === false) {
        toast({ 
          title: '❌ Échec de l\'action', 
          description: responseContent?.substring(0, 100) || 'Erreur inconnue', 
          variant: 'destructive',
          duration: 8000 
        });
      } else {
        toast({ 
          title: '✅ Action traitée', 
          description: toolCall?.name || 'Terminé',
          duration: 5000 
        });
      }
      
    } catch (error: unknown) {
      const elapsedMs = Date.now() - startTime;
      debug.error(`[confirmToolCall] Error after ${elapsedMs}ms:`, error);
      
      // Use sanitizeSupabaseError for consistent error messages
      debug.error(`[confirmToolCall] Error after ${elapsedMs}ms:`, error);
      
      toast({ 
        title: '❌ Erreur d\'exécution', 
        description: sanitizeSupabaseError(error), 
        variant: 'destructive',
        duration: 8000 
      });
    } finally {
      setIsConfirming(false);
    }
  }, [pendingToolCalls, userId, toast, setMessages, isConfirming]);

  const rejectToolCall = useCallback(async (toolCallId: string): Promise<void> => {
    setPendingToolCalls(prev => prev.filter(tc => tc.id !== toolCallId));
    toast({ title: 'Action annulée' });
  }, [toast]);

  // ============================================================
  // Legacy: askJarvis (compatible with old jarvis-agent)
  // ============================================================
  const askJarvis = useCallback(async (prompt: string, context?: Partial<JarvisTrigger['context']>): Promise<{
    success: boolean;
    preview_text?: string;
    reasoning?: string;
    action_type?: string;
    tool_calls?: ToolCall[];
  } | null> => {
    if (!userId) {
      toast({ title: 'Non connecté', variant: 'destructive' });
      return null;
    }

    // Throttle check
    const now = Date.now();
    if (now - lastCallTimeRef.current < THROTTLE_MS || isProcessingRef.current) {
      debug.warn('[useJarvis] Throttled');
      return null;
    }

    lastCallTimeRef.current = now;
    isProcessingRef.current = true;

    try {
      toast({ title: '🤖 Jarvis analyse...', description: prompt.substring(0, 100) });

      // Enrich context with focus
      const enrichedContext = {
        custom_prompt: prompt,
        ...context,
        ...(focus.focusContext.etablissement_id && { etablissement_id: focus.focusContext.etablissement_id }),
      };

      // Get context prompt from focus
      const contextPrompt = focus.getContextPrompt();
      const fullPrompt = contextPrompt ? `${contextPrompt}\n\n${prompt}` : prompt;

      // Use jarvis-brain directly (no legacy fallback)
      const brainResponse = await chat(fullPrompt);
      
      if (brainResponse?.success) {
        focus.recordActivity('jarvis_prompt', 'manual', prompt.substring(0, 50));
        
        return {
          success: true,
          preview_text: brainResponse.content,
          reasoning: brainResponse.content,
          action_type: brainResponse.tool_calls?.[0]?.name || 'none',
          tool_calls: brainResponse.tool_calls?.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
            status: 'completed' as const
          }))
        };
      }

      toast({ title: 'Jarvis', description: 'Aucune réponse obtenue' });
      return { success: false };
    } catch (error) {
      debug.error('[useJarvis] Error:', error);
      toast({ title: 'Erreur', description: 'Impossible de contacter Jarvis', variant: 'destructive' });
      return null;
    } finally {
      isProcessingRef.current = false;
    }
  }, [userId, toast, pendingActions, focus, chat]);

  // ============================================================
  // Legacy: Action management
  // ============================================================
  const modifyAction = useCallback(async (actionId: string, modifications: Partial<JarvisActionData>) => {
    await pendingActions.modifyAndApprove(actionId, modifications);
    
    const action = pendingActions.pendingActions.find(a => a.id === actionId);
    if (action) {
      learning.recordAction({
        action_type: action.proposed_action?.type || 'none',
        trigger_type: action.trigger_type,
        was_approved: true,
        was_modified: true,
        confidence_score: action.proposed_action?.confidence_score || 0,
        modifications,
      });
    }
  }, [pendingActions, learning]);

  const approveActionWithLearning = useCallback(async (actionId: string) => {
    const action = pendingActions.pendingActions.find(a => a.id === actionId);
    
    await pendingActions.approveAction(actionId);
    
    if (action) {
      learning.recordAction({
        action_type: action.proposed_action?.type || 'none',
        trigger_type: action.trigger_type,
        was_approved: true,
        was_modified: false,
        confidence_score: action.proposed_action?.confidence_score || 0,
      });
    }
  }, [pendingActions, learning]);

  const rejectActionWithLearning = useCallback(async (actionId: string, reason?: string) => {
    const action = pendingActions.pendingActions.find(a => a.id === actionId);
    
    await pendingActions.rejectAction(actionId, reason);
    
    if (action) {
      learning.recordAction({
        action_type: action.proposed_action?.type || 'none',
        trigger_type: action.trigger_type,
        was_approved: false,
        was_modified: false,
        confidence_score: action.proposed_action?.confidence_score || 0,
      });
    }
  }, [pendingActions, learning]);

  const loadMoreHistory = useCallback(async () => {}, []);

  // ============================================================
  // Return
  // ============================================================
  return useMemo(() => ({
    // État
    isEnabled: preferencesHook.isEnabled,
    isLoading: pendingActions.isLoading || preferencesHook.isLoading,
    pendingActions: pendingActions.pendingActions,
    pendingCount: pendingActions.pendingCount + (proactiveUnreadCount || 0),
    
    // JARVIS 12.0: Chat
    messages,
    setMessages, // Exposé pour permettre la restauration des conversations
    isTyping,
    chat,
    clearChat,
    getPageContextForInjection,
    
    // Mode autonome (toujours actif, exposé pour compatibilité)
    autonomousMode: true,
    setAutonomousMode: () => {},  // No-op - mode toujours actif
    
    // Legacy actions
    approveAction: approveActionWithLearning,
    modifyAction,
    rejectAction: rejectActionWithLearning,
    askJarvis,
    
    // Tool call confirmation
    confirmToolCall,
    rejectToolCall,
    isConfirming,
    
    // Settings
    preferences: preferencesHook.preferences ?? null,
    updatePreferences: preferencesHook.updatePreferences,
    
    // Feedback
    submitFeedback: pendingActions.submitFeedback,
    
    // History
    history: [],
    loadMoreHistory,
    
    // Capabilities
    capabilities: JARVIS_CAPABILITIES,
  }), [
    preferencesHook, 
    pendingActions, 
    proactiveUnreadCount,
    messages,
    isTyping,
    chat,
    clearChat,
    getPageContextForInjection,
    
    modifyAction, 
    askJarvis, 
    loadMoreHistory, 
    approveActionWithLearning, 
    rejectActionWithLearning,
    confirmToolCall,
    rejectToolCall
  ]);
}

export { useJarvisPendingActions } from './useJarvisPendingActions';
export { useJarvisPreferences } from './useJarvisPreferences';
export { useJarvisVoice } from './useJarvisVoice';
export { useJarvisLearning } from './useJarvisLearning';
export { useJarvisFocus } from './useJarvisFocus';
export { useJarvisProactive } from './useJarvisProactive';
export { useJarvisStreaming } from './useJarvisStreaming';
export { useJarvisConversationPersistence } from './useJarvisConversationPersistence';
export { useJarvisContextualActions } from './useJarvisContextualActions';
export { useJarvisWorkflows, WORKFLOW_TEMPLATES } from './useJarvisWorkflows';
export { useJarvisKeyboardShortcuts } from './useJarvisKeyboardShortcuts';
