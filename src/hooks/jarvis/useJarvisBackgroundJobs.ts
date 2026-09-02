/**
 * useJarvisBackgroundJobs - Suivi des jobs en arrière-plan de Jarvis
 * 
 * Permet de suivre les jobs en cours, afficher leur progression
 * et recevoir des notifications à la complétion.
 * 
 * PHASE 3 FIX: Utilise fromExtended() au lieu de supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debug } from '@/lib/debug';
import { supabase } from '@/integrations/supabase/client';
import { fromExtended } from '@/lib/supabaseTyped';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useEffect, useRef } from 'react';
import type { JarvisBackgroundJobRow } from '@/types/supabase-extensions';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JarvisBackgroundJob {
  id: string;
  user_id: string;
  action_type: string;
  action_data: Record<string, unknown>;
  status: JobStatus;
  progress: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const BACKGROUND_JOBS_KEY = 'jarvis-background-jobs';

export function useJarvisBackgroundJobs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active jobs (not completed/failed)
  const { data: activeJobs, isLoading } = useQuery({
    queryKey: [BACKGROUND_JOBS_KEY, user?.id, 'active'],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await fromExtended('jarvis_background_jobs')
        .select('id, user_id, action_type, action_data, status, progress, result, error_message, retry_count, max_retries, started_at, completed_at, created_at')
        .eq('user_id', user.id)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false });

      if (error) {
        debug.error('[useJarvisBackgroundJobs] Error:', error);
        return [];
      }

      return (data || []) as JarvisBackgroundJobRow[];
    },
    enabled: !!user?.id,
    refetchInterval: (query) => {
      if ((query.state.data?.length ?? 0) === 0) return false;
      return document.visibilityState === 'visible' ? 10_000 : false;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch recent completed jobs (last hour)
  const { data: recentJobs } = useQuery({
    queryKey: [BACKGROUND_JOBS_KEY, user?.id, 'recent'],
    queryFn: async () => {
      if (!user?.id) return [];

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data, error } = await fromExtended('jarvis_background_jobs')
        .select('id, user_id, action_type, action_data, status, progress, result, error_message, retry_count, max_retries, started_at, completed_at, created_at')
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed'])
        .gte('completed_at', oneHourAgo)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) return [];
      return (data || []) as JarvisBackgroundJobRow[];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  // Create a new background job
  const createJobMutation = useMutation({
    mutationFn: async (params: {
      action_type: string;
      action_data: Record<string, unknown>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await fromExtended('jarvis_background_jobs')
        .insert({
          user_id: user.id,
          action_type: params.action_type,
          action_data: params.action_data,
          status: 'queued',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger the background worker
      await supabase.functions.invoke('jarvis-background-worker', {
        body: { job_id: data.id, user_id: user.id }
      });

      return data as JarvisBackgroundJobRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BACKGROUND_JOBS_KEY] });
      toast({
        title: '🚀 Job lancé',
        description: 'L\'action s\'exécute en arrière-plan',
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

  // Cancel a job
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await fromExtended('jarvis_background_jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId)
        .eq('user_id', user.id)
        .in('status', ['queued', 'processing']);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BACKGROUND_JOBS_KEY] });
      toast({
        title: 'Job annulé',
      });
    },
  });

  // Stabilize toast via useRef to avoid re-subscribe loops
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`jarvis-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jarvis_background_jobs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const job = payload.new as JarvisBackgroundJobRow;
          
          // Show toast on completion
          if (job.status === 'completed') {
            toastRef.current({
              title: '✅ JARVIS - Terminé',
              description: getActionLabel(job.action_type),
            });
          } else if (job.status === 'failed') {
            toastRef.current({
              title: '❌ JARVIS - Échec',
              description: job.error_message || 'L\'action a échoué',
              variant: 'destructive',
            });
          }

          // Refresh queries
          queryClient.invalidateQueries({ queryKey: [BACKGROUND_JOBS_KEY] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Computed values
  const hasActiveJobs = (activeJobs?.length || 0) > 0;
  const activeCount = activeJobs?.length || 0;
  const processingJob = activeJobs?.find(j => j.status === 'processing');

  return {
    activeJobs: activeJobs || [],
    recentJobs: recentJobs || [],
    isLoading,
    hasActiveJobs,
    activeCount,
    processingJob,
    
    createJob: createJobMutation.mutateAsync,
    cancelJob: cancelJobMutation.mutateAsync,
    
    isCreating: createJobMutation.isPending,
    isCancelling: cancelJobMutation.isPending,
  };
}

function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    send_email: 'Email envoyé avec succès',
    create_task: 'Tâche créée avec succès',
    update_status: 'Statut mis à jour',
    close_ticket: 'Ticket clôturé',
    schedule_meeting: 'Réunion planifiée',
  };
  return labels[actionType] || `Action "${actionType}" terminée`;
}
