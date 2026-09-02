/**
 * useJarvisPendingActions - Hook pour récupérer les actions en attente
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import type { JarvisPendingAction, JarvisActionStatus } from '@/types/jarvis';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

const JARVIS_PENDING_KEY = 'jarvis-pending-actions';

export function useJarvisPendingActions(userId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Récupérer les actions en attente
  const query = useQuery({
    queryKey: [JARVIS_PENDING_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('jarvis_pending_actions')
        .select('id, user_id, trigger_type, trigger_entity_type, trigger_entity_id, proposed_action, context, ai_response, status, expires_at, created_at, reviewed_at, user_feedback, feedback_rating, kb_sources')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        debug.error('[useJarvisPendingActions] Error:', error);
        throw error;
      }

      return (data || []) as unknown as JarvisPendingAction[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Approuver une action
  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke('jarvis-execute', {
        body: { action_id: actionId, user_id: userId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [JARVIS_PENDING_KEY] });
      toast({
        title: '✅ Action exécutée',
        description: data.action_type ? `${getActionLabel(data.action_type)} avec succès` : 'Action traitée',
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

  // Rejeter une action
  const rejectMutation = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason?: string }) => {
      if (!userId) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('jarvis_pending_actions')
        .update({ 
          status: 'rejected' as JarvisActionStatus,
          reviewed_at: new Date().toISOString(),
          user_feedback: reason || null
        })
        .eq('id', actionId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JARVIS_PENDING_KEY] });
      toast({
        title: 'Action ignorée',
        description: 'La suggestion a été rejetée',
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

  // Modifier puis approuver
  const modifyAndApproveMutation = useMutation({
    mutationFn: async ({ actionId, modifications }: { actionId: string; modifications: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke('jarvis-execute', {
        body: { 
          action_id: actionId, 
          user_id: userId,
          modifications 
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JARVIS_PENDING_KEY] });
      toast({
        title: '✅ Action modifiée et exécutée',
        description: 'Vos modifications ont été prises en compte',
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

  // Soumettre un feedback
  const feedbackMutation = useMutation({
    mutationFn: async ({ actionId, rating, comment }: { actionId: string; rating: number; comment?: string }) => {
      if (!userId) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('jarvis_pending_actions')
        .update({ 
          feedback_rating: rating,
          user_feedback: comment || null
        })
        .eq('id', actionId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Merci pour votre retour',
        description: 'Votre feedback aide à améliorer Jarvis',
      });
    },
  });

  return {
    pendingActions: query.data || [],
    pendingCount: query.data?.length || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    
    approveAction: (actionId: string) => approveMutation.mutateAsync(actionId),
    rejectAction: (actionId: string, reason?: string) => rejectMutation.mutateAsync({ actionId, reason }),
    modifyAndApprove: (actionId: string, modifications: Record<string, unknown>) => 
      modifyAndApproveMutation.mutateAsync({ actionId, modifications }),
    submitFeedback: (actionId: string, rating: number, comment?: string) =>
      feedbackMutation.mutateAsync({ actionId, rating, comment }),
    
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isModifying: modifyAndApproveMutation.isPending,
  };
}

function getActionLabel(actionType: string): string {
  switch (actionType) {
    case 'send_email': return 'Email envoyé';
    case 'create_task': return 'Tâche créée';
    case 'update_status': return 'Statut mis à jour';
    case 'close_ticket': return 'Ticket clôturé';
    case 'schedule_meeting': return 'Réunion planifiée';
    default: return 'Action effectuée';
  }
}
