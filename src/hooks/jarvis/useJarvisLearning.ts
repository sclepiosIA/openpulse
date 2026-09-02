/**
 * useJarvisLearning - Système d'apprentissage adaptatif de Jarvis
 * 
 * Analyse les patterns d'utilisation pour améliorer les suggestions futures.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import type { JarvisActionType, JarvisTriggerType } from '@/types/jarvis';

interface LearningPattern {
  action_type: JarvisActionType;
  trigger_type: JarvisTriggerType;
  approval_rate: number;
  modification_rate: number;
  avg_confidence_approved: number;
  avg_confidence_rejected: number;
  preferred_times: string[];
  common_modifications: Record<string, unknown>[];
  total_count: number;
}

interface JarvisInsights {
  patterns: LearningPattern[];
  suggestions: string[];
  optimal_threshold: number;
  peak_usage_hours: number[];
  most_useful_sources: Array<{ article_id: string; title: string; usage_count: number }>;
}

const LEARNING_QUERY_KEY = 'jarvis-learning';

export function useJarvisLearning() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Récupérer les insights d'apprentissage
  const insightsQuery = useQuery({
    queryKey: [LEARNING_QUERY_KEY, 'insights', userId],
    queryFn: async (): Promise<JarvisInsights> => {
      if (!userId) return getEmptyInsights();

      // Récupérer l'historique des actions
      const { data: history, error } = await supabase
        .from('jarvis_pending_actions')
        .select('id, user_id, trigger_type, proposed_action, status, user_modification, kb_sources, created_at, executed_at')
        .eq('user_id', userId)
        .in('status', ['executed', 'rejected', 'modified'])
        .order('created_at', { ascending: false })
        .limit(500);

      if (error || !history || history.length === 0) {
        return getEmptyInsights();
      }

      // Analyser les patterns
      const patterns = analyzePatterns(history);
      const suggestions = generateSuggestions(patterns);
      const optimalThreshold = calculateOptimalThreshold(history);
      const peakHours = findPeakUsageHours(history);
      const usefulSources = findMostUsefulSources(history);

      return {
        patterns,
        suggestions,
        optimal_threshold: optimalThreshold,
        peak_usage_hours: peakHours,
        most_useful_sources: usefulSources,
      };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Enregistrer une action pour l'apprentissage
  const recordAction = useMutation({
    mutationFn: async (data: {
      action_type: JarvisActionType;
      trigger_type: JarvisTriggerType;
      was_approved: boolean;
      was_modified: boolean;
      confidence_score: number;
      modifications?: Record<string, unknown>;
    }) => {
      // L'action est déjà enregistrée dans jarvis_pending_actions
      // Ce hook sert principalement à invalider le cache
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEARNING_QUERY_KEY] });
    },
  });

  // Obtenir le seuil de confiance recommandé pour un type d'action
  const getRecommendedThreshold = (actionType: JarvisActionType): number => {
    const pattern = insightsQuery.data?.patterns.find(p => p.action_type === actionType);
    if (!pattern || pattern.total_count < 10) {
      return 0.85; // Seuil par défaut
    }
    
    // Seuil entre la moyenne des approuvées et des rejetées
    const midPoint = (pattern.avg_confidence_approved + pattern.avg_confidence_rejected) / 2;
    return Math.max(0.7, Math.min(0.95, midPoint));
  };

  // Vérifier si une action devrait être auto-approuvée
  const shouldAutoApprove = (
    actionType: JarvisActionType,
    triggerType: JarvisTriggerType,
    confidenceScore: number
  ): boolean => {
    const pattern = insightsQuery.data?.patterns.find(
      p => p.action_type === actionType && p.trigger_type === triggerType
    );

    // Si pas assez de données, ne pas auto-approuver
    if (!pattern || pattern.total_count < 20) {
      return false;
    }

    // Si le taux d'approbation est > 90% et la confiance est suffisante
    if (pattern.approval_rate > 0.9 && confidenceScore >= pattern.avg_confidence_approved * 0.95) {
      return true;
    }

    return false;
  };

  return {
    insights: insightsQuery.data,
    isLoading: insightsQuery.isLoading,
    recordAction: recordAction.mutate,
    getRecommendedThreshold,
    shouldAutoApprove,
    refetch: insightsQuery.refetch,
  };
}

// ============================================================
// Fonctions utilitaires
// ============================================================

function getEmptyInsights(): JarvisInsights {
  return {
    patterns: [],
    suggestions: [],
    optimal_threshold: 0.85,
    peak_usage_hours: [],
    most_useful_sources: [],
  };
}

function analyzePatterns(history: unknown[]): LearningPattern[] {
  const grouped = new Map<string, unknown[]>();

  // Grouper par action_type + trigger_type
  for (const action of history) {
    const a = action as Record<string, unknown>;
    const proposedAction = a.proposed_action as Record<string, unknown> | undefined;
    const key = `${proposedAction?.type || 'unknown'}_${a.trigger_type}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(action);
  }

  const patterns: LearningPattern[] = [];

  for (const [key, actions] of grouped) {
    const [actionType, triggerType] = key.split('_');
    
    const approved = actions.filter(a => {
      const action = a as Record<string, unknown>;
      return action.status === 'executed';
    });
    const rejected = actions.filter(a => {
      const action = a as Record<string, unknown>;
      return action.status === 'rejected';
    });
    const modified = actions.filter(a => {
      const action = a as Record<string, unknown>;
      return action.user_modification !== null;
    });

    const avgConfidenceApproved = approved.length > 0
      ? approved.reduce((sum: number, a) => {
          const action = a as Record<string, unknown>;
          const proposedAction = action.proposed_action as Record<string, unknown> | undefined;
          return sum + (Number(proposedAction?.confidence_score) || 0);
        }, 0) / approved.length
      : 0;

    const avgConfidenceRejected = rejected.length > 0
      ? rejected.reduce((sum: number, a) => {
          const action = a as Record<string, unknown>;
          const proposedAction = action.proposed_action as Record<string, unknown> | undefined;
          return sum + (Number(proposedAction?.confidence_score) || 0);
        }, 0) / rejected.length
      : 0;

    // Analyser les heures d'utilisation
    const hours = actions.map(a => {
      const action = a as Record<string, unknown>;
      return new Date(action.created_at as string).getHours();
    });
    const preferredTimes = findPreferredTimes(hours);

    // Collecter les modifications communes
    const modifications = modified.map(a => {
      const action = a as Record<string, unknown>;
      try {
        return JSON.parse(action.user_modification as string || '{}');
      } catch {
        return {};
      }
    }).filter(m => Object.keys(m).length > 0);

    patterns.push({
      action_type: actionType as JarvisActionType,
      trigger_type: triggerType as JarvisTriggerType,
      approval_rate: approved.length / actions.length,
      modification_rate: modified.length / actions.length,
      avg_confidence_approved: avgConfidenceApproved,
      avg_confidence_rejected: avgConfidenceRejected,
      preferred_times: preferredTimes,
      common_modifications: modifications.slice(0, 5),
      total_count: actions.length,
    });
  }

  return patterns.sort((a, b) => b.total_count - a.total_count);
}

function generateSuggestions(patterns: LearningPattern[]): string[] {
  const suggestions: string[] = [];

  for (const pattern of patterns) {
    // Suggérer d'augmenter le seuil si beaucoup de rejets
    if (pattern.approval_rate < 0.5 && pattern.total_count >= 10) {
      suggestions.push(
        `Les actions "${pattern.action_type}" sont souvent rejetées. Augmentez le seuil de confiance pour ce type.`
      );
    }

    // Suggérer l'auto-approbation si taux très élevé
    if (pattern.approval_rate > 0.95 && pattern.total_count >= 20) {
      suggestions.push(
        `Vous approuvez presque toujours les "${pattern.action_type}". Activez l'auto-approbation pour gagner du temps.`
      );
    }

    // Suggérer d'ajuster les heures si pattern clair
    if (pattern.preferred_times.length > 0 && pattern.total_count >= 15) {
      suggestions.push(
        `Vous utilisez surtout Jarvis vers ${pattern.preferred_times.join(', ')}. Ajustez vos heures de silence.`
      );
    }
  }

  return suggestions.slice(0, 5);
}

function calculateOptimalThreshold(history: unknown[]): number {
  const approved = history.filter(a => {
    const action = a as Record<string, unknown>;
    return action.status === 'executed';
  });
  const rejected = history.filter(a => {
    const action = a as Record<string, unknown>;
    return action.status === 'rejected';
  });

  if (approved.length === 0 && rejected.length === 0) return 0.85;

  const avgApproved = approved.length > 0
    ? approved.reduce((sum: number, a) => {
        const action = a as Record<string, unknown>;
        const proposedAction = action.proposed_action as Record<string, unknown> | undefined;
        return sum + (Number(proposedAction?.confidence_score) || 0);
      }, 0) / approved.length
    : 0.85;

  const avgRejected = rejected.length > 0
    ? rejected.reduce((sum: number, a) => {
        const action = a as Record<string, unknown>;
        const proposedAction = action.proposed_action as Record<string, unknown> | undefined;
        return sum + (Number(proposedAction?.confidence_score) || 0);
      }, 0) / rejected.length
    : 0.5;

  // Le seuil optimal est légèrement au-dessus du point médian
  return Math.max(0.7, Math.min(0.95, (avgApproved + avgRejected) / 2 + 0.05));
}

function findPeakUsageHours(history: unknown[]): number[] {
  const hourCounts = new Map<number, number>();
  
  for (const action of history) {
    const a = action as Record<string, unknown>;
    const hour = new Date(a.created_at as string).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  // Trouver les heures avec le plus d'activité
  const sorted = [...hourCounts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 3).map(([hour]) => hour);
}

function findPreferredTimes(hours: number[]): string[] {
  const counts = new Map<number, number>();
  for (const h of hours) {
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 2).map(([h]) => `${h}h`);
}

function findMostUsefulSources(history: unknown[]): Array<{ article_id: string; title: string; usage_count: number }> {
  const sourceCounts = new Map<string, { title: string; count: number }>();
  
  for (const action of history) {
    const a = action as Record<string, unknown>;
    if (a.status !== 'executed') continue;
    
    const sources = a.kb_sources as Array<{ article_id: string; titre: string }> | undefined;
    if (!sources) continue;
    
    for (const source of sources) {
      const existing = sourceCounts.get(source.article_id);
      if (existing) {
        existing.count++;
      } else {
        sourceCounts.set(source.article_id, { title: source.titre, count: 1 });
      }
    }
  }

  return [...sourceCounts.entries()]
    .map(([id, { title, count }]) => ({ article_id: id, title, usage_count: count }))
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 10);
}
