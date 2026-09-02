/**
 * useJarvisOptimisticUI - Optimistic UI for Jarvis actions
 * 
 * Provides instant feedback by showing actions as completed
 * before backend confirmation, with rollback on failure.
 */

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/shared/use-toast';

export type OptimisticStatus = 'pending' | 'optimistic' | 'confirmed' | 'failed' | 'rolled_back';

export interface OptimisticAction {
  id: string;
  toolName: string;
  displayText: string;
  status: OptimisticStatus;
  startedAt: number;
  confirmedAt?: number;
  errorMessage?: string;
}

interface UseJarvisOptimisticUIReturn {
  optimisticActions: OptimisticAction[];
  startOptimisticAction: (id: string, toolName: string, displayText: string) => void;
  confirmAction: (id: string) => void;
  failAction: (id: string, error: string) => void;
  rollbackAction: (id: string) => void;
  clearCompletedActions: () => void;
  getActionStatus: (id: string) => OptimisticStatus | undefined;
  isActionPending: (id: string) => boolean;
}

export function useJarvisOptimisticUI(): UseJarvisOptimisticUIReturn {
  const [optimisticActions, setOptimisticActions] = useState<OptimisticAction[]>([]);
  const { toast } = useToast();
  const rollbackTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Start an optimistic action - shows immediately as successful
  const startOptimisticAction = useCallback((id: string, toolName: string, displayText: string) => {
    const action: OptimisticAction = {
      id,
      toolName,
      displayText,
      status: 'optimistic',
      startedAt: Date.now(),
    };
    
    setOptimisticActions(prev => [...prev, action]);
    
    // Show immediate success feedback
    toast({
      title: '⚡ ' + displayText,
      description: 'En cours...',
      duration: 3000,
    });

    // Auto-timeout for rollback if no confirmation after 30s
    const timeout = setTimeout(() => {
      failAction(id, 'Timeout - action non confirmée');
    }, 30000);
    rollbackTimeouts.current.set(id, timeout);
  }, [toast]);

  // Confirm the action was successful
  const confirmAction = useCallback((id: string) => {
    // Clear any pending rollback timeout
    const timeout = rollbackTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      rollbackTimeouts.current.delete(id);
    }

    setOptimisticActions(prev => 
      prev.map(action => 
        action.id === id 
          ? { ...action, status: 'confirmed', confirmedAt: Date.now() }
          : action
      )
    );

    const action = optimisticActions.find(a => a.id === id);
    if (action) {
      const latencyMs = Date.now() - action.startedAt;
      toast({
        title: '✅ ' + action.displayText,
        description: `Confirmé en ${(latencyMs / 1000).toFixed(1)}s`,
        duration: 2000,
      });
    }
  }, [optimisticActions, toast]);

  // Mark action as failed
  const failAction = useCallback((id: string, error: string) => {
    // Clear any pending rollback timeout
    const timeout = rollbackTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      rollbackTimeouts.current.delete(id);
    }

    setOptimisticActions(prev => 
      prev.map(action => 
        action.id === id 
          ? { ...action, status: 'failed', errorMessage: error }
          : action
      )
    );

    const action = optimisticActions.find(a => a.id === id);
    toast({
      title: '❌ Échec: ' + (action?.displayText || 'Action'),
      description: error,
      variant: 'destructive',
      duration: 5000,
    });
  }, [optimisticActions, toast]);

  // Rollback an optimistic action
  const rollbackAction = useCallback((id: string) => {
    failAction(id, 'Action annulée');
    setOptimisticActions(prev =>
      prev.map(action =>
        action.id === id
          ? { ...action, status: 'rolled_back' }
          : action
      )
    );
  }, [failAction]);

  // Clear completed actions from the list
  const clearCompletedActions = useCallback(() => {
    setOptimisticActions(prev => 
      prev.filter(action => action.status === 'pending' || action.status === 'optimistic')
    );
  }, []);

  // Get action status
  const getActionStatus = useCallback((id: string): OptimisticStatus | undefined => {
    return optimisticActions.find(a => a.id === id)?.status;
  }, [optimisticActions]);

  // Check if action is pending
  const isActionPending = useCallback((id: string): boolean => {
    const status = getActionStatus(id);
    return status === 'pending' || status === 'optimistic';
  }, [getActionStatus]);

  return {
    optimisticActions,
    startOptimisticAction,
    confirmAction,
    failAction,
    rollbackAction,
    clearCompletedActions,
    getActionStatus,
    isActionPending,
  };
}
