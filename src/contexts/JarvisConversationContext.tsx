/**
 * JarvisConversationContext - Contexte isolé pour messages/streaming Jarvis
 * 
 * Sépare les données de conversation (messages, streaming, typing) du contexte UI
 * pour éviter les re-renders cascade sur tous les composants Jarvis globaux
 * (MiniFab, ProactiveNudge, AlertIndicator, etc.) quand le streaming est actif.
 * 
 * Seuls les composants du panel chat consomment ce contexte.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { JarvisChatMessage } from '@/types/jarvis';

export interface JarvisStreamState {
  isStreaming: boolean;
  currentContent: string;
  reasoningSteps: JarvisReasoningStep[];
}

export interface JarvisReasoningStep {
  step: number;
  phase: 'analyze' | 'context' | 'memory' | 'tools' | 'generate' | 'complete';
  label: string;
  detail?: string;
  status: 'active' | 'completed';
}

interface JarvisConversationContextValue {
  messages: JarvisChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<JarvisChatMessage[]>>;
  clearMessages: () => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  streamState: JarvisStreamState;
  setStreamState: React.Dispatch<React.SetStateAction<JarvisStreamState>>;
  resetStreamState: () => void;
}

const JarvisConversationContext = createContext<JarvisConversationContextValue | null>(null);

const INITIAL_STREAM_STATE: JarvisStreamState = {
  isStreaming: false,
  currentContent: '',
  reasoningSteps: [],
};

export function JarvisConversationProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<JarvisChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamState, setStreamState] = useState<JarvisStreamState>(INITIAL_STREAM_STATE);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamState(INITIAL_STREAM_STATE);
  }, []);

  const resetStreamState = useCallback(() => {
    setStreamState(INITIAL_STREAM_STATE);
  }, []);

  const value = useMemo<JarvisConversationContextValue>(() => ({
    messages,
    setMessages,
    clearMessages,
    isTyping,
    setIsTyping,
    streamState,
    setStreamState,
    resetStreamState,
  }), [messages, isTyping, streamState, clearMessages, resetStreamState]);

  return (
    <JarvisConversationContext.Provider value={value}>
      {children}
    </JarvisConversationContext.Provider>
  );
}

export function useJarvisConversation() {
  const context = useContext(JarvisConversationContext);
  if (!context) {
    throw new Error('useJarvisConversation must be used within JarvisConversationProvider');
  }
  return context;
}

export function useJarvisConversationOptional() {
  return useContext(JarvisConversationContext);
}
