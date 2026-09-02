/**
 * useJarvisAgentNegotiation - Hook pour la négociation inter-agents JARVIS 6.0
 * 
 * Gère les conflits de priorité entre agents et leur résolution.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { AgentId } from '@/types/jarvis-agents';
import { debug } from '@/lib/debug';

export interface NegotiationResult {
  has_conflict: boolean;
  can_proceed: boolean;
  winner?: AgentId;
  resolution?: string;
  must_wait?: boolean;
  wait_reason?: string;
  deferred_action?: string;
  defer_until?: string;
}

export interface NegotiationHistory {
  id: string;
  requesting_agent: AgentId;
  conflicting_agent: AgentId;
  conflict_type: string;
  resolution: string;
  winner_agent: AgentId;
  created_at: string;
}

export function useJarvisAgentNegotiation() {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [negotiations, setNegotiations] = useState<NegotiationHistory[]>([]);

  // Vérifier s'il y a un conflit avant d'agir
  const checkForConflict = useCallback(async (
    agentId: AgentId,
    entityId: string,
    entityType: string,
    plannedAction: string
  ): Promise<NegotiationResult> => {
    if (!user?.id) {
      return { has_conflict: false, can_proceed: true };
    }

    setIsChecking(true);

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-agent-negotiation', {
        body: {
          action: 'check_conflict',
          user_id: user.id,
          negotiation: {
            agent_id: agentId,
            entity_id: entityId,
            entity_type: entityType,
            planned_action: plannedAction,
          }
        }
      });

      if (error) throw error;

      return {
        has_conflict: data.has_conflict || false,
        can_proceed: data.can_proceed || true,
        winner: data.winner,
        resolution: data.resolution,
        must_wait: data.must_wait,
        wait_reason: data.wait_reason,
      };
    } catch (error) {
      debug.error('[useJarvisAgentNegotiation] Error:', error);
      // En cas d'erreur, permettre de continuer
      return { has_conflict: false, can_proceed: true };
    } finally {
      setIsChecking(false);
    }
  }, [user?.id]);

  // Déclencher une négociation directe
  const negotiate = useCallback(async (
    requestingAgent: AgentId,
    conflictingAgent: AgentId,
    conflictType: string,
    requestingAction: string,
    conflictingAction: string
  ): Promise<NegotiationResult> => {
    if (!user?.id) {
      return { has_conflict: true, can_proceed: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-agent-negotiation', {
        body: {
          action: 'negotiate',
          user_id: user.id,
          negotiation: {
            requesting_agent: requestingAgent,
            conflicting_agent: conflictingAgent,
            conflict_type: conflictType,
            requesting_action: requestingAction,
            conflicting_action: conflictingAction,
          }
        }
      });

      if (error) throw error;

      return {
        has_conflict: true,
        can_proceed: data.winner === requestingAgent,
        winner: data.winner,
        resolution: data.resolution,
        must_wait: data.winner !== requestingAgent,
        wait_reason: data.reason,
        deferred_action: data.deferred_action,
        defer_until: data.defer_until,
      };
    } catch (error) {
      debug.error('[useJarvisAgentNegotiation] Negotiate error:', error);
      return { has_conflict: true, can_proceed: false };
    }
  }, [user?.id]);

  // Récupérer l'historique des négociations
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-agent-negotiation', {
        body: {
          action: 'get_history',
          user_id: user.id,
        }
      });

      if (error) throw error;
      setNegotiations(data.negotiations || []);
    } catch (error) {
      debug.error('[useJarvisAgentNegotiation] Fetch history error:', error);
    }
  }, [user?.id]);

  // Résolution manuelle par l'utilisateur
  const resolveManually = useCallback(async (
    negotiationId: string,
    winnerAgent: AgentId,
    reason: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase.functions.invoke('jarvis-agent-negotiation', {
        body: {
          action: 'resolve_manually',
          user_id: user.id,
          negotiation: {
            negotiation_id: negotiationId,
            winner_agent: winnerAgent,
            user_reason: reason,
          }
        }
      });

      if (error) throw error;
      
      // Rafraîchir l'historique
      await fetchHistory();
      return true;
    } catch (error) {
      debug.error('[useJarvisAgentNegotiation] Manual resolve error:', error);
      return false;
    }
  }, [user?.id, fetchHistory]);

  return {
    isChecking,
    negotiations,
    checkForConflict,
    negotiate,
    fetchHistory,
    resolveManually,
  };
}
