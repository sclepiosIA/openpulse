/**
 * useJarvisEnhanced - Hook principal Jarvis 9.0
 * 
 * Fournit les fonctionnalités avancées:
 * - Prédictions comportementales
 * - Workflows automatisés
 * - Apprentissage actif
 * - Exécution parallèle
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

export interface BehaviorPrediction {
  action: string;
  probability: number;
  reason: string;
  executableCommand?: string;
  category?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  triggerCommand: string;
  stepsCount: number;
  estimatedDurationMs: number;
}

export interface LearningMetrics {
  totalInteractions: number;
  acceptanceRate: number;
  topActions: { action: string; count: number }[];
  suggestions: string[];
}

interface PredictiveResponse {
  success: boolean;
  predictions: BehaviorPrediction[];
  behavior_stats: {
    total_actions: number;
    peak_hours: number[];
    peak_days: number[];
    most_common_actions: { action: string; count: number }[];
  };
}

interface WorkflowResponse {
  success: boolean;
  workflows: WorkflowTemplate[];
}

interface LearningResponse {
  success: boolean;
  metrics: LearningMetrics;
  report?: {
    period: string;
    acceptance_rate: number;
    recommendations: string[];
  };
}

export function useJarvisEnhanced() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState(false);

  // Fetch predictions
  const { data: predictionsData, isLoading: isPredictionsLoading, refetch: refetchPredictions } = useQuery({
    queryKey: ['jarvis-predictions', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.functions.invoke<PredictiveResponse>('jarvis-predictive-engine', {
        body: {},
      });
      
      if (error) {
        debug.error('Predictions error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch available workflows
  const { data: workflowsData, isLoading: isWorkflowsLoading } = useQuery({
    queryKey: ['jarvis-workflows', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.functions.invoke<WorkflowResponse>('jarvis-workflow-engine', {
        body: { action: 'list', user_id: user.id },
      });
      
      if (error) {
        debug.error('Workflows error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch learning metrics
  const { data: learningData, isLoading: isLearningLoading } = useQuery({
    queryKey: ['jarvis-learning', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.functions.invoke<LearningResponse>('jarvis-learning-engine', {
        body: { action: 'get_metrics', user_id: user.id },
      });
      
      if (error) {
        debug.error('Learning error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Execute workflow mutation
  const executeWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, params }: { workflowId: string; params?: Record<string, unknown> }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      setIsExecutingWorkflow(true);
      
      const { data, error } = await supabase.functions.invoke('jarvis-workflow-engine', {
        body: {
          action: 'execute',
          workflow_id: workflowId,
          params,
          user_id: user.id,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setIsExecutingWorkflow(false);
      toast({
        title: 'Workflow exécuté',
        description: `${data.execution?.steps_executed?.length || 0} étapes complétées`,
      });
      queryClient.invalidateQueries({ queryKey: ['jarvis-learning', user?.id] });
    },
    onError: (error) => {
      setIsExecutingWorkflow(false);
      toast({
        title: 'Erreur workflow',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
    },
  });

  // Record feedback mutation
  const recordFeedbackMutation = useMutation({
    mutationFn: async ({ actionType, accepted, feedbackScore }: { 
      actionType: string; 
      accepted: boolean; 
      feedbackScore?: number 
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('jarvis-learning-engine', {
        body: {
          action: 'record_feedback',
          user_id: user.id,
          data: {
            action_type: actionType,
            accepted,
            feedback_score: feedbackScore,
            execution_time_ms: 0,
          },
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-learning', user?.id] });
    },
  });

  // Get contextual predictions based on current time
  const getContextualPredictions = useCallback((): BehaviorPrediction[] => {
    if (!predictionsData?.predictions) return [];
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Filter predictions relevant to current context
    return predictionsData.predictions.filter(p => {
      // Boost morning predictions in the morning
      if (currentHour >= 8 && currentHour <= 10) {
        return p.reason.includes('morning') || p.probability > 0.6;
      }
      // Boost end-of-day predictions
      if (currentHour >= 17 && currentHour <= 19) {
        return p.reason.includes('end_of_day') || p.probability > 0.6;
      }
      return p.probability > 0.5;
    }).slice(0, 5);
  }, [predictionsData]);

  // Get suggested workflows based on time/context
  const getSuggestedWorkflows = useCallback((): WorkflowTemplate[] => {
    if (!workflowsData?.workflows) return [];
    
    const now = new Date();
    const isMonday = now.getDay() === 1;
    const isFriday = now.getDay() === 5;
    const isEndOfMonth = now.getDate() >= 28;
    const isMorning = now.getHours() >= 8 && now.getHours() <= 10;
    
    return workflowsData.workflows.filter(w => {
      if (isMonday && isMorning && w.id.includes('morning')) return true;
      if (isFriday && w.id.includes('weekly')) return true;
      if (isEndOfMonth && w.id.includes('monthly')) return true;
      return false;
    }).slice(0, 3);
  }, [workflowsData]);

  return {
    // Predictions
    predictions: predictionsData?.predictions || [],
    behaviorStats: predictionsData?.behavior_stats,
    isPredictionsLoading,
    getContextualPredictions,
    refetchPredictions,
    
    // Workflows
    workflows: workflowsData?.workflows || [],
    isWorkflowsLoading,
    executeWorkflow: executeWorkflowMutation.mutateAsync,
    isExecutingWorkflow,
    getSuggestedWorkflows,
    
    // Learning
    learningMetrics: learningData?.metrics,
    learningReport: learningData?.report,
    isLearningLoading,
    recordFeedback: recordFeedbackMutation.mutateAsync,
  };
}
