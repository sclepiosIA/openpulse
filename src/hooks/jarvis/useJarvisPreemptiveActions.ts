 /**
  * JARVIS V12.0 - Hook pour les actions préemptives
  * 
  * Gère les actions anticipées que Jarvis peut proposer avant que l'utilisateur ne les demande
  */
 
 import { useState, useEffect, useCallback } from 'react';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/shared/useAuth';
 import { debug } from '@/lib/debug';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
 
 export interface PreemptiveAction {
   id: string;
   type: string;
   title: string;
   description: string;
   priority: 'low' | 'medium' | 'high' | 'critical';
   suggestedAction: {
     type: string;
     data: Record<string, any>;
     preview?: string;
   };
   context: {
     entityType?: string;
     entityId?: string;
     reason: string;
   };
   expiresAt?: string;
   createdAt: string;
 }
 
 const QUERY_KEY = 'jarvis-preemptive-actions';
 
 export function useJarvisPreemptiveActions() {
   const { user } = useAuth();
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [executingId, setExecutingId] = useState<string | null>(null);
 
   // Fetch pending preemptive actions
   const { data: actions = [], isLoading, refetch } = useQuery({
     queryKey: [QUERY_KEY, user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
 
       const { data, error } = await supabase.functions.invoke('jarvis-preemptive-actions', {
         body: { action: 'get_pending' }
       });
 
       if (error) {
         debug.error('Failed to fetch preemptive actions:', error);
         return [];
       }
 
       return (data?.actions || []) as PreemptiveAction[];
     },
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    });
 
   // Execute a preemptive action
   const executeMutation = useMutation({
     mutationFn: async (actionId: string) => {
       setExecutingId(actionId);
       
       const { data, error } = await supabase.functions.invoke('jarvis-preemptive-actions', {
         body: { action: 'execute', actionId }
       });
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data, actionId) => {
       queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
       
       const action = actions.find(a => a.id === actionId);
       toast({
         title: "✅ Action exécutée",
         description: action?.title || "L'action préemptive a été exécutée"
       });
     },
     onError: (error: Error) => {
       toast({
         title: "Erreur",
         description: sanitizeSupabaseError(error),
         variant: "destructive"
       });
     },
     onSettled: () => {
       setExecutingId(null);
     }
   });
 
   // Dismiss a preemptive action
   const dismissMutation = useMutation({
     mutationFn: async (actionId: string) => {
       const { error } = await supabase.functions.invoke('jarvis-preemptive-actions', {
         body: { action: 'dismiss', actionId }
       });
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
     }
   });
 
   // Trigger a scan for new preemptive actions
   const scanForActions = useCallback(async () => {
     try {
       await supabase.functions.invoke('jarvis-preemptive-actions', {
         body: { action: 'scan' }
       });
       refetch();
     } catch (error) {
       debug.error('Failed to scan for preemptive actions:', error);
     }
   }, [refetch]);
 
   // Get actions by priority
   const criticalActions = actions.filter(a => a.priority === 'critical');
   const highPriorityActions = actions.filter(a => a.priority === 'high');
   const mediumPriorityActions = actions.filter(a => a.priority === 'medium');
   const lowPriorityActions = actions.filter(a => a.priority === 'low');
 
   // Get actions by type
   const getActionsByType = useCallback((type: string) => {
     return actions.filter(a => a.type === type);
   }, [actions]);
 
   return {
     actions,
     isLoading,
     executingId,
     
     // By priority
     criticalActions,
     highPriorityActions,
     mediumPriorityActions,
     lowPriorityActions,
     
     // Helpers
     hasActions: actions.length > 0,
     hasCritical: criticalActions.length > 0,
     totalCount: actions.length,
     
     // Actions
     executeAction: executeMutation.mutateAsync,
     dismissAction: dismissMutation.mutateAsync,
     scanForActions,
     refetch,
     getActionsByType,
     
     // Loading states
     isExecuting: executeMutation.isPending,
     isDismissing: dismissMutation.isPending
   };
 }
 
 /**
  * Component to display preemptive action notifications
  */
 export function usePreemptiveActionNotifications() {
   const { actions, hasCritical, criticalActions } = useJarvisPreemptiveActions();
   const { toast } = useToast();
   const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
 
   // Notify for critical actions
   useEffect(() => {
     for (const action of criticalActions) {
       if (!notifiedIds.has(action.id)) {
         toast({
           title: `🚨 ${action.title}`,
           description: action.description,
           variant: "destructive",
           duration: 10000
         });
         setNotifiedIds(prev => new Set([...prev, action.id]));
       }
     }
   }, [criticalActions, notifiedIds, toast]);
 
   return {
     hasCritical,
     criticalCount: criticalActions.length
   };
 }