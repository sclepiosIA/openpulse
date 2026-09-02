/**
 * useJarvisActionContext - Gestion du contexte d'actions Jarvis
 * 
 * Permet de récupérer les actions en cours/pausées et de les reprendre.
 * 
 * PHASE 3 FIX: Utilise fromExtended() au lieu de supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { fromExtended } from '@/lib/supabaseTyped';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { JarvisActionContextRow } from '@/types/supabase-extensions';

export type ActionContextStatus = 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface JarvisActionContext {
  id: string;
  user_id: string;
  action_type: string;
  action_data: Record<string, unknown>;
  status: ActionContextStatus;
  original_message: string | null;
  conversation_id: string | null;
  last_interaction_at: string;
  created_at: string;
}

const ACTION_CONTEXT_KEY = 'jarvis-action-context';

export function useJarvisActionContext() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending action contexts
  const { data: pendingContexts, isLoading } = useQuery({
    queryKey: [ACTION_CONTEXT_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await fromExtended('jarvis_action_context')
        .select('id, user_id, action_type, action_data, status, original_message, conversation_id, last_interaction_at, created_at')
        .eq('user_id', user.id)
        .in('status', ['in_progress', 'paused'])
        .order('last_interaction_at', { ascending: false })
        .limit(10);

      if (error) {
        debug.error('[useJarvisActionContext] Error:', error);
        return [];
      }

      return (data || []) as JarvisActionContextRow[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  // Resume an action (execute it via background job)
  const resumeActionMutation = useMutation({
    mutationFn: async (contextId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get the context
      const { data: context, error: fetchError } = await fromExtended('jarvis_action_context')
        .select('id, user_id, action_type, action_data, status, original_message, conversation_id, last_interaction_at, created_at')
        .eq('id', contextId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError || !context) {
        throw new Error('Action context not found');
      }

      // Create a background job for this action
      const { data: job, error: jobError } = await fromExtended('jarvis_background_jobs')
        .insert({
          user_id: user.id,
          action_type: context.action_type,
          action_data: context.action_data,
          status: 'queued',
          progress: 0,
        })
        .select()
        // safe: guaranteed-row
        .single();

      if (jobError) throw jobError;

      // Trigger the worker
      await supabase.functions.invoke('jarvis-background-worker', {
        body: { job_id: job.id, user_id: user.id }
      });

      // Mark context as in_progress
      await fromExtended('jarvis_action_context')
        .update({ 
          status: 'in_progress',
          last_interaction_at: new Date().toISOString()
        })
        .eq('id', contextId);

      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTION_CONTEXT_KEY] });
      toast({
        title: '🔄 Action reprise',
        description: 'L\'exécution continue en arrière-plan',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
    },
  });

  // Cancel/dismiss an action context
  const cancelContextMutation = useMutation({
    mutationFn: async (contextId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await fromExtended('jarvis_action_context')
        .update({ status: 'cancelled' })
        .eq('id', contextId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTION_CONTEXT_KEY] });
      toast({
        title: 'Action annulée',
      });
    },
  });

  // Pause an action
  const pauseContextMutation = useMutation({
    mutationFn: async (contextId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await fromExtended('jarvis_action_context')
        .update({ 
          status: 'paused',
          last_interaction_at: new Date().toISOString()
        })
        .eq('id', contextId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTION_CONTEXT_KEY] });
    },
  });

  // Get formatted summary for display
  const getContextSummary = (context: JarvisActionContext): string => {
    const actionLabels: Record<string, string> = {
      send_email: '📧 Email',
      create_task: '✅ Tâche',
      schedule_meeting: '📅 Réunion',
      update_status: '🔄 Mise à jour',
      close_ticket: '🎫 Ticket',
    };

    const label = actionLabels[context.action_type] || context.action_type;
    const message = context.original_message?.substring(0, 50) || '';
    
    return `${label}: ${message}${message.length >= 50 ? '...' : ''}`;
  };

  return {
    pendingContexts: pendingContexts || [],
    isLoading,
    hasPendingContexts: (pendingContexts?.length || 0) > 0,
    pendingCount: pendingContexts?.length || 0,
    
    resumeAction: resumeActionMutation.mutateAsync,
    cancelContext: cancelContextMutation.mutateAsync,
    pauseContext: pauseContextMutation.mutateAsync,
    getContextSummary,
    
    isResuming: resumeActionMutation.isPending,
    isCancelling: cancelContextMutation.isPending,
  };
}
