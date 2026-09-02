import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseBrowser';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

export interface AIActionData {
  titre?: string;
  nom?: string;
  id?: string;
  // Email composer specific fields
  to?: string[];
  cc?: string[];
  subject?: string;
  body?: string;
  etablissement_id?: string;
  // Generic fields
  [key: string]: string | number | boolean | undefined | null | string[];
}

export interface AIAction {
  type: 'open_email_composer' | 'open_task' | 'open_etablissement' | 'open_email' | 'created_task' | 'created_etablissement' | 'updated_etablissement';
  data: AIActionData;
}

export interface EntityLink {
  type: 'etablissement' | 'tache' | 'contact' | 'email' | 'groupe' | 'partenaire';
  id: string;
  name: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  actions?: AIAction[];
  entityLinks?: EntityLink[];
}

interface UsePulseAIChatOptions {
  conversationId?: string;
  onAction?: (action: AIAction) => void;
  globalMode?: boolean;
}

export function usePulseAIChat({ conversationId, onAction, globalMode = false }: UsePulseAIChatOptions = {}) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMessage: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: AIChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Non authentifié');
      }

      // Build messages for API (all previous + new user message)
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Call edge function with streaming support
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/pulse-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            messages: apiMessages,
            global_mode: globalMode,
            stream: true, // Request streaming
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Trop de requêtes. Veuillez patienter quelques secondes.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Check if response is streaming (SSE)
      if (contentType.includes('text/event-stream') && response.body) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let actions: AIAction[] | undefined;
        let entityLinks: EntityLink[] | undefined;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') break;
            
            try {
              const parsed = JSON.parse(data);
              
              // Handle different event types
              if (parsed.type === 'content') {
                fullContent += parsed.content || '';
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: fullContent, isStreaming: true }
                    : m
                ));
              } else if (parsed.type === 'actions') {
                actions = parsed.actions;
              } else if (parsed.type === 'entityLinks') {
                entityLinks = parsed.entityLinks;
              } else if (parsed.type === 'complete') {
                // Final message with all data - prefer parsed.message if available
                if (parsed.message && parsed.message.trim()) {
                  fullContent = parsed.message;
                }
                actions = parsed.actions;
                entityLinks = parsed.entityLinks;
              } else if (parsed.choices?.[0]?.delta?.content) {
                // Handle Azure SSE format
                fullContent += parsed.choices[0].delta.content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: fullContent, isStreaming: true }
                    : m
                ));
              }
            } catch (e) {
              // Incomplete JSON, will be completed in next chunk
            }
          }
        }

        // Finalize streaming message with improved fallback
        const finalContent = fullContent.trim() || 'Analyse terminée. Aucune information trouvée pour cette requête.';
        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { ...m, content: finalContent, isStreaming: false, actions, entityLinks }
            : m
        ));

      } else {
        // Handle non-streaming response (fallback)
        const data = await response.json();
        const messageContent = data.message || data.error || 'Désolé, je n\'ai pas pu générer de réponse.';
        const actions = data.actions as AIAction[] | undefined;
        const entityLinks = data.entityLinks as EntityLink[] | undefined;

        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { ...m, content: messageContent, isStreaming: false, actions, entityLinks }
            : m
        ));

        // Trigger actions callback if provided
        if (actions && actions.length > 0 && onAction) {
          for (const action of actions) {
            if (action.type === 'created_task' || action.type === 'created_etablissement' || action.type === 'updated_etablissement') {
              toast({
                title: action.type === 'created_task' ? 'Tâche créée' : 
                       action.type === 'created_etablissement' ? 'Établissement créé' : 
                       'Établissement mis à jour',
                description: action.data?.titre || action.data?.nom || 'Action effectuée',
              });
            }
          }
        }
      }

    } catch (error: unknown) {
      debug.error('AI Chat error:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
      } else {
        const errMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { ...m, content: `Erreur: ${errMsg}`, isStreaming: false }
            : m
        ));
        
        toast({
          title: 'Erreur IA',
          description: sanitizeSupabaseError(error),
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, messages, isLoading, toast, onAction, globalMode]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const executeAction = useCallback((action: AIAction) => {
    if (onAction) {
      onAction(action);
    }
  }, [onAction]);

  return {
    messages,
    isLoading,
    sendMessage,
    cancelRequest,
    clearMessages,
    executeAction,
  };
}
