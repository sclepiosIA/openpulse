/**
 * useJarvisStreaming - Hook pour le streaming de réponses Jarvis V3
 * 
 * V3 changes:
 * - Parse reasoning SSE events and expose reasoningSteps
 * - Client-side watchdog: if no delta/done arrives within 45s, auto-cancel
 * - Robust error recovery
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseBrowser';
import { useJarvisResponseCache } from './useJarvisResponseCache';
import { debug } from '@/lib/debug';

interface ToolExecution {
  tool: string;
  status: 'running' | 'success' | 'error';
  summary?: string;
  round?: number;
}

export interface ReasoningStep {
  step: number;
  phase: 'analyze' | 'context' | 'memory' | 'tools' | 'generate' | 'complete';
  label: string;
  detail?: string;
  status: 'active' | 'completed';
}

interface StreamingState {
  isStreaming: boolean;
  currentContent: string;
  isDone: boolean;
  error: string | null;
  tokensGenerated: number;
  streamDurationMs: number;
  activeTools: ToolExecution[];
  reasoningSteps: ReasoningStep[];
}

interface UseJarvisStreamingOptions {
  enableCache?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
  watchdogMs?: number;
}

interface UseJarvisStreamingReturn extends StreamingState {
  streamChat: (message: string, conversationHistory?: Array<{ role: string; content: string }>, pageContext?: string | null) => Promise<string | null>;
  cancelStream: () => void;
  resetStream: () => void;
  cacheStats: { hits: number; misses: number; entries: number; hitRate: string };
}

export type { ToolExecution };

const DEFAULT_OPTIONS: UseJarvisStreamingOptions = {
  enableCache: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeout: 90000,
  watchdogMs: 45000, // 45s without delta/done → auto-cancel
};

const INITIAL_STATE: StreamingState = {
  isStreaming: false,
  currentContent: '',
  isDone: false,
  error: null,
  tokensGenerated: 0,
  streamDurationMs: 0,
  activeTools: [],
  reasoningSteps: [],
};

export function useJarvisStreaming(options: UseJarvisStreamingOptions = {}): UseJarvisStreamingReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const startTimeRef = useRef(0);
  const isStreamingRef = useRef(false);
  const mountedRef = useRef(true);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  const safeSetState = useCallback((updater: StreamingState | ((prev: StreamingState) => StreamingState)) => {
    if (mountedRef.current) {
      setState(updater);
    }
  }, []);
  
  const cache = useJarvisResponseCache({
    maxEntries: 100,
    ttlMs: 30 * 60 * 1000,
    similarityThreshold: 0.85,
  });
  
  const [state, setState] = useState<StreamingState>(INITIAL_STATE);

  // Watchdog: reset timer whenever meaningful data arrives
  const resetWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      if (isStreamingRef.current) {
        debug.log('[useJarvisStreaming] Watchdog: no data for 45s, aborting');
        abortControllerRef.current?.abort();
      }
    }, finalOptions.watchdogMs!);
  }, [finalOptions.watchdogMs]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const resetStream = useCallback(() => {
    isStreamingRef.current = false;
    safeSetState(INITIAL_STATE);
    retryCountRef.current = 0;
    clearWatchdog();
  }, [safeSetState, clearWatchdog]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isStreamingRef.current = false;
    clearWatchdog();
    safeSetState(prev => ({ ...prev, isStreaming: false }));
  }, [safeSetState, clearWatchdog]);

  const streamChatInternal = useCallback(async (
    message: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    isRetry = false,
    pageContext?: string | null
  ): Promise<string | null> => {
    if (!user?.id) {
      toast({ title: 'Non connecté', variant: 'destructive' });
      return null;
    }

    if (isStreamingRef.current && !isRetry) {
      debug.log('[Jarvis Streaming] Already streaming, ignoring duplicate call');
      return null;
    }

    // Check cache
    if (finalOptions.enableCache && (!conversationHistory || conversationHistory.length === 0)) {
      const cachedResponse = cache.get(message);
      if (cachedResponse) {
        safeSetState({
          ...INITIAL_STATE,
          currentContent: cachedResponse,
          isDone: true,
          tokensGenerated: cachedResponse.length / 4,
        });
        return cachedResponse;
      }
    }

    if (!isRetry) {
      cancelStream();
    }
    
    isStreamingRef.current = true;
    
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, finalOptions.timeout);

    if (!isRetry) {
      startTimeRef.current = Date.now();
      safeSetState({
        ...INITIAL_STATE,
        isStreaming: true,
      });
    }

    // Start watchdog
    resetWatchdog();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        toast({ title: 'Session expirée', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
        safeSetState(prev => ({ ...prev, isStreaming: false }));
        isStreamingRef.current = false;
        clearWatchdog();
        return null;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/jarvis-brain-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            message,
            conversation_history: conversationHistory,
            ...(pageContext ? { page_context: pageContext } : {}),
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.status === 429) {
        if (retryCountRef.current < finalOptions.maxRetries!) {
          retryCountRef.current++;
          const delay = finalOptions.retryDelayMs! * Math.pow(2, retryCountRef.current - 1);
          debug.log(`[useJarvisStreaming] Rate limited, retrying in ${delay}ms (attempt ${retryCountRef.current})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return streamChatInternal(message, conversationHistory, true, pageContext);
        }
        throw new Error('Limite de requêtes atteinte. Réessayez dans quelques instants.');
      }

      if (response.status === 402) {
        throw new Error('Crédits épuisés. Veuillez recharger votre compte.');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Skip SSE comments (keepalive pings)
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.error) {
              safeSetState(prev => ({ ...prev, error: parsed.error, isStreaming: false }));
              toast({ title: 'Erreur', description: parsed.error, variant: 'destructive' });
              isStreamingRef.current = false;
              clearWatchdog();
              return null;
            }

            // *** NEW: Parse reasoning events ***
            if (parsed.type === 'reasoning') {
              resetWatchdog(); // reasoning = sign of life
              safeSetState(prev => {
                const existingIdx = prev.reasoningSteps.findIndex(s => s.step === parsed.step && s.phase === parsed.phase);
                let newSteps: ReasoningStep[];
                const step: ReasoningStep = {
                  step: parsed.step,
                  phase: parsed.phase,
                  label: parsed.label || parsed.phase,
                  detail: parsed.detail,
                  status: parsed.status || 'active',
                };
                if (existingIdx >= 0) {
                  newSteps = [...prev.reasoningSteps];
                  newSteps[existingIdx] = step;
                } else {
                  newSteps = [...prev.reasoningSteps, step];
                }
                return { ...prev, reasoningSteps: newSteps };
              });
              continue;
            }
            
            if (parsed.type === 'tool_start') {
              resetWatchdog();
              safeSetState(prev => ({
                ...prev,
                activeTools: [...prev.activeTools, {
                  tool: parsed.tool,
                  status: 'running' as const,
                  round: parsed.round,
                }],
              }));
              continue;
            }
            
            if (parsed.type === 'tool_result') {
              resetWatchdog();
              safeSetState(prev => ({
                ...prev,
                activeTools: prev.activeTools.map(t => 
                  t.tool === parsed.tool && t.status === 'running'
                    ? { ...t, status: parsed.success ? 'success' as const : 'error' as const, summary: parsed.summary }
                    : t
                ),
              }));
              continue;
            }

            if (parsed.type === 'delta' && parsed.content) {
              resetWatchdog();
              fullContent += parsed.content;
              tokenCount++;
              safeSetState(prev => ({ 
                ...prev, 
                currentContent: fullContent,
                tokensGenerated: tokenCount,
                streamDurationMs: Date.now() - startTimeRef.current,
              }));
              continue;
            }
            
            if (parsed.type === 'done') {
              clearWatchdog();
              const finalContent = parsed.content || fullContent;
              const duration = Date.now() - startTimeRef.current;
              
              // Keep isStreaming: true — the caller (sendMessage) will call resetStream()
              // AFTER persisting the assistant message, preventing the content flash.
              safeSetState(prev => ({ 
                ...prev, 
                isDone: true, 
                currentContent: finalContent,
                streamDurationMs: duration,
              }));
              
              if (finalOptions.enableCache && (!conversationHistory || conversationHistory.length === 0)) {
                cache.set(message, finalContent, duration);
              }
              
              retryCountRef.current = 0;
              continue;
            }

            // Any other event type = sign of life for watchdog
            resetWatchdog();
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      isStreamingRef.current = false;
      clearWatchdog();
      return fullContent;
    } catch (error) {
      clearTimeout(timeoutId);
      clearWatchdog();
      
      if (error instanceof Error && error.name === 'AbortError') {
        debug.log('[useJarvisStreaming] Stream cancelled or timed out');
        isStreamingRef.current = false;
        
        // Recover partial content
        const currentContent = state.currentContent;
        if (currentContent && currentContent.length > 20) {
          debug.log(`[useJarvisStreaming] Recovering partial content (${currentContent.length} chars)`);
          const partialContent = currentContent + '\n\n---\n*[Réponse interrompue — timeout]*';
          safeSetState(prev => ({
            ...prev,
            isStreaming: false,
            isDone: true,
            currentContent: partialContent,
          }));
          return partialContent;
        }
        
        safeSetState(prev => ({ ...prev, isStreaming: false }));
        return null;
      }
      
      if (error instanceof TypeError && retryCountRef.current < finalOptions.maxRetries!) {
        retryCountRef.current++;
        const delay = finalOptions.retryDelayMs! * Math.pow(2, retryCountRef.current - 1);
        debug.log(`[useJarvisStreaming] Network error, retrying in ${delay}ms (attempt ${retryCountRef.current})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return streamChatInternal(message, conversationHistory, true, pageContext);
      }
      
      debug.error('[useJarvisStreaming] Error:', error);
      safeSetState(prev => ({ ...prev, error: sanitizeSupabaseError(error), isStreaming: false }));
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
      isStreamingRef.current = false;
      return null;
    }
  }, [user, toast, cancelStream, cache, finalOptions, safeSetState, state.currentContent, resetWatchdog, clearWatchdog]);

  const streamChat = useCallback(async (
    message: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    pageContext?: string | null
  ): Promise<string | null> => {
    retryCountRef.current = 0;
    return streamChatInternal(message, conversationHistory, false, pageContext);
  }, [streamChatInternal]);

  return {
    ...state,
    streamChat,
    cancelStream,
    resetStream,
    cacheStats: cache.stats,
  };
}
