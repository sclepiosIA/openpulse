import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

type AIAction = 'summarize' | 'suggest_response' | 'extract_actions';

interface SummaryResult {
  summary: string;
  key_points: string[];
  decisions: string[];
  open_questions: string[];
}

interface SuggestionResult {
  suggestions: Array<{
    tone: string;
    text: string;
  }>;
}

interface ActionsResult {
  actions: Array<{
    description: string;
    assignee_hint: string;
    priority: 'haute' | 'moyenne' | 'basse';
    deadline_hint?: string;
  }>;
}

type AIResult = SummaryResult | SuggestionResult | ActionsResult;

export function usePulseAI() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<AIResult | null>(null);
  const { toast } = useToast();

  const processConversation = useCallback(async (
    conversationId: string,
    action: AIAction,
    messageIds?: string[]
  ): Promise<AIResult | null> => {
    setIsProcessing(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('pulse-ai-summarize', {
        body: {
          conversation_id: conversationId,
          action,
          message_ids: messageIds,
        },
      });

      if (error) throw error;

      const result = data.result as AIResult;
      setLastResult(result);
      
      toast({
        title: 'Analyse IA terminée',
        description: getSuccessMessage(action),
      });

      return result;
    } catch (error: unknown) {
      debug.error('AI processing error:', error);
      toast({
        title: 'Erreur IA',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const summarize = useCallback((conversationId: string, messageIds?: string[]) => {
    return processConversation(conversationId, 'summarize', messageIds);
  }, [processConversation]);

  const suggestResponse = useCallback((conversationId: string) => {
    return processConversation(conversationId, 'suggest_response');
  }, [processConversation]);

  const extractActions = useCallback((conversationId: string, messageIds?: string[]) => {
    return processConversation(conversationId, 'extract_actions', messageIds);
  }, [processConversation]);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    isProcessing,
    lastResult,
    summarize,
    suggestResponse,
    extractActions,
    clearResult,
  };
}

function getSuccessMessage(action: AIAction): string {
  switch (action) {
    case 'summarize':
      return 'Résumé généré avec succès';
    case 'suggest_response':
      return 'Suggestions de réponse générées';
    case 'extract_actions':
      return 'Actions extraites avec succès';
  }
}
