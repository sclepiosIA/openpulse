import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';

interface SummaryResult {
  summary?: string;
  key_points?: string[];
  decisions?: string[];
  open_questions?: string[];
}

export function usePulseWidgetSummaries() {
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const generateSummary = useCallback(async (conversationId: string) => {
    // Prevent duplicate requests
    if (loadingIds.has(conversationId)) return;

    setLoadingIds(prev => new Set(prev).add(conversationId));

    try {
      const { data, error } = await supabase.functions.invoke('pulse-ai-summarize', {
        body: { 
          conversation_id: conversationId, 
          action: 'summarize' 
        }
      });

      if (error) {
        debug.error('[PulseWidget] Summary error:', error);
        toast.error('Erreur lors de la génération du résumé');
        return;
      }

      // Extract summary from the result
      const result = data?.result as SummaryResult | string;
      let summaryText: string;

      if (typeof result === 'string') {
        summaryText = result;
      } else if (result?.summary) {
        summaryText = result.summary;
      } else {
        summaryText = 'Résumé non disponible';
      }

      setSummaries(prev => new Map(prev).set(conversationId, summaryText));
      toast.success('Résumé généré');
    } catch (err) {
      debug.error('[PulseWidget] Summary failed:', err);
      toast.error('Erreur lors de la génération du résumé');
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    }
  }, [loadingIds]);

  const getSummary = useCallback((conversationId: string) => {
    return summaries.get(conversationId);
  }, [summaries]);

  const isLoading = useCallback((conversationId: string) => {
    return loadingIds.has(conversationId);
  }, [loadingIds]);

  return { 
    summaries, 
    loadingIds, 
    generateSummary, 
    getSummary, 
    isLoading 
  };
}
