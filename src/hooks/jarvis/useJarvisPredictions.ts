/**
 * useJarvisPredictions - Hook pour les prédictions intelligentes Jarvis
 * 
 * Consomme le moteur prédictif et affiche des suggestions proactives
 */

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';

export interface Prediction {
  action_type: string;
  description: string;
  confidence: number;
  suggested_time?: string;
  context?: Record<string, unknown>;
  reason: string;
}

export interface PredictionStats {
  total_actions: number;
  peak_hours: number[];
  peak_days: number[];
  most_common_actions: { action: string; count: number }[];
}

interface PredictionsResponse {
  success: boolean;
  predictions: Prediction[];
  behavior_stats: PredictionStats;
  generated_at: string;
}

const PREDICTIONS_QUERY_KEY = 'jarvis-predictions';
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function useJarvisPredictions() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [acceptedPredictions, setAcceptedPredictions] = useState<Set<string>>(new Set());
  const [dismissedPredictions, setDismissedPredictions] = useState<Set<string>>(new Set());

  // Fetch predictions from the predictive engine
  const { data, isLoading, error, refetch } = useQuery<PredictionsResponse>({
    queryKey: [PREDICTIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('jarvis-predictive-engine', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data as PredictionsResponse;
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Filter out dismissed predictions
  const activePredictions = data?.predictions.filter(
    p => !dismissedPredictions.has(`${p.action_type}-${p.reason}`)
  ) || [];

  // Get top prediction
  const topPrediction = activePredictions[0] || null;

  // Accept a prediction (track for learning)
  const acceptPrediction = useCallback(async (prediction: Prediction) => {
    const key = `${prediction.action_type}-${prediction.reason}`;
    setAcceptedPredictions(prev => new Set([...prev, key]));

    // Log acceptance for learning (using jarvis_conversations as tracking)
    try {
      debug.log('[Predictions] Accepted:', prediction.action_type);
    } catch (error) {
      debug.error('[Predictions] Failed to log acceptance:', error);
    }
  }, []);

  // Dismiss a prediction
  const dismissPrediction = useCallback(async (prediction: Prediction) => {
    const key = `${prediction.action_type}-${prediction.reason}`;
    setDismissedPredictions(prev => new Set([...prev, key]));

    // Log dismissal for learning
    try {
      debug.log('[Predictions] Dismissed:', prediction.action_type);
    } catch (error) {
      debug.error('[Predictions] Failed to log dismissal:', error);
    }
  }, []);

  // Get contextual suggestions based on current page
  const getContextualSuggestions = useCallback((currentPath: string): Prediction[] => {
    if (!activePredictions.length) return [];

    const suggestions: Prediction[] = [];

    // Filter predictions relevant to current context
    if (currentPath.includes('/emails')) {
      suggestions.push(...activePredictions.filter(p => 
        p.action_type.includes('email') || p.action_type === 'daily_briefing'
      ));
    } else if (currentPath.includes('/etablissements')) {
      suggestions.push(...activePredictions.filter(p =>
        p.action_type.includes('pipeline') || p.action_type.includes('prospect')
      ));
    } else if (currentPath.includes('/tresorerie')) {
      suggestions.push(...activePredictions.filter(p =>
        p.action_type.includes('invoice') || p.action_type.includes('cashflow')
      ));
    } else if (currentPath.includes('/taches') || currentPath.includes('/tasks')) {
      suggestions.push(...activePredictions.filter(p =>
        p.action_type.includes('task') || p.action_type.includes('review')
      ));
    }

    // Add general suggestions if not enough contextual ones
    if (suggestions.length < 2) {
      const generalSuggestions = activePredictions.filter(p =>
        !suggestions.includes(p) && p.confidence > 0.6
      ).slice(0, 2 - suggestions.length);
      suggestions.push(...generalSuggestions);
    }

    return suggestions;
  }, [activePredictions]);

  // Get prediction command for Jarvis
  const getPredictionCommand = useCallback((prediction: Prediction): string => {
    const commands: Record<string, string> = {
      'daily_briefing': 'Donne-moi un briefing de ma journée',
      'weekly_review': 'Montre-moi le pipeline commercial et les objectifs de la semaine',
      'weekly_summary': 'Fais un récapitulatif de ma semaine',
      'end_of_day_review': 'Quelles tâches dois-je terminer avant de partir ?',
      'check_emails': 'Quels sont les emails importants non traités ?',
      'review_tasks': 'Montre-moi mes tâches en retard',
      'check_pipeline': 'Quel est l\'état du pipeline commercial ?',
      'check_invoices': 'Y a-t-il des factures impayées ?',
      'query_database': 'Recherche dans la base de données',
      'send_email': 'Aide-moi à rédiger un email',
      'create_task': 'Crée une nouvelle tâche',
    };

    return commands[prediction.action_type] || prediction.description;
  }, []);

  // Get confidence level label
  const getConfidenceLabel = useCallback((confidence: number): string => {
    if (confidence >= 0.9) return 'Très pertinent';
    if (confidence >= 0.75) return 'Pertinent';
    if (confidence >= 0.5) return 'Suggéré';
    return 'Peut-être utile';
  }, []);

  // Check if it's a good time to show predictions
  const shouldShowPredictions = useCallback((): boolean => {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Working hours on weekdays
    const isWorkingHour = hour >= 8 && hour <= 19;
    const isWeekday = day >= 1 && day <= 5;
    
    return isWorkingHour && isWeekday && activePredictions.length > 0;
  }, [activePredictions]);

  return {
    // Data
    predictions: activePredictions,
    topPrediction,
    behaviorStats: data?.behavior_stats,
    generatedAt: data?.generated_at,

    // State
    isLoading,
    error,
    acceptedCount: acceptedPredictions.size,
    dismissedCount: dismissedPredictions.size,

    // Actions
    acceptPrediction,
    dismissPrediction,
    refetch,
    getContextualSuggestions,
    getPredictionCommand,
    getConfidenceLabel,
    shouldShowPredictions,
  };
}
