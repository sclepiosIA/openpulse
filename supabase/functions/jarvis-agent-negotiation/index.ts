/**
 * JARVIS 6.0 - Agent Negotiation System
 * 
 * Gère les conflits de priorité entre agents :
 * - Détection de conflits
 * - Résolution automatique basée sur des règles
 * - Escalade si nécessaire
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Priorités des types de conflits (plus haut = plus prioritaire)
const CONFLICT_PRIORITIES: Record<string, number> = {
  'critical_incident': 100,
  'security_alert': 95,
  'urgent_support': 90,
  'payment_issue': 85,
  'deadline_imminent': 80,
  'client_complaint': 75,
  'scheduled_task': 50,
  'routine_followup': 30,
  'general_outreach': 20,
};

// Règles de priorité par agent
const AGENT_BASE_PRIORITY: Record<string, number> = {
  'emma': 80,    // Support a souvent la priorité
  'olivia': 70,  // Finance/Trésorerie
  'noah': 60,    // R&D
  'sophia': 50,  // CRM
  'marcus': 50,  // RH
  'alex': 40,    // Analytics
  'prime': 100,  // Jarvis Prime peut tout override
};

interface NegotiationRequest {
  requesting_agent: string;
  conflicting_agent: string;
  conflict_type: string;
  entity_id?: string;
  entity_type?: string;
  requesting_action: string;
  conflicting_action: string;
  context?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, negotiation } = body;
    const user_id = auth.isServiceCall ? body.user_id : auth.userId;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Résoudre le profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user_id)
      .single();

    const profile_id = profile?.id || user_id;

    switch (action) {
      case 'check_conflict': {
        // Vérifier s'il y a un conflit potentiel
        const { agent_id, entity_id, entity_type, planned_action } = negotiation;

        // Chercher des actions en cours sur la même entité
        const { data: pendingActions } = await supabase
          .from('jarvis_pending_actions')
          .select('*')
          .eq('user_id', profile_id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString());

        // Filtrer les conflits potentiels
        const conflicts = (pendingActions || []).filter(pa => {
          const actionData = pa.action_data as Record<string, unknown>;
          return actionData.entity_id === entity_id && 
                 actionData.entity_type === entity_type &&
                 pa.agent_id !== agent_id;
        });

        if (conflicts.length === 0) {
          return new Response(JSON.stringify({ 
            success: true, 
            has_conflict: false,
            can_proceed: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Il y a un conflit - lancer la négociation
        const conflictingAction = conflicts[0];
        const resolution = resolveConflict({
          requesting_agent: agent_id,
          conflicting_agent: conflictingAction.agent_id,
          conflict_type: planned_action,
          requesting_action: planned_action,
          conflicting_action: conflictingAction.action_type,
        });

        // Enregistrer la négociation
        await supabase.from('jarvis_agent_negotiations').insert({
          user_id: profile_id,
          requesting_agent: agent_id,
          conflicting_agent: conflictingAction.agent_id,
          conflict_type: planned_action,
          resolution: resolution.resolution,
          winner_agent: resolution.winner,
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ 
          success: true, 
          has_conflict: true,
          can_proceed: resolution.winner === agent_id,
          resolution: resolution.resolution,
          winner: resolution.winner,
          must_wait: resolution.winner !== agent_id,
          wait_reason: resolution.reason,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'negotiate': {
        // Négociation directe entre deux agents
        const neg = negotiation as NegotiationRequest;
        const resolution = resolveConflict(neg);

        // Enregistrer
        await supabase.from('jarvis_agent_negotiations').insert({
          user_id: profile_id,
          requesting_agent: neg.requesting_agent,
          conflicting_agent: neg.conflicting_agent,
          conflict_type: neg.conflict_type,
          resolution: resolution.resolution,
          winner_agent: resolution.winner,
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ 
          success: true,
          ...resolution 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_history': {
        // Historique des négociations
        const { data: negotiations, error } = await supabase
          .from('jarvis_agent_negotiations')
          .select('*')
          .eq('user_id', profile_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true, 
          negotiations 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resolve_manually': {
        // Résolution manuelle par l'utilisateur
        const { negotiation_id, winner_agent, user_reason } = negotiation;

        const { error } = await supabase
          .from('jarvis_agent_negotiations')
          .update({
            winner_agent,
            resolution: `Manual: ${user_reason}`,
          })
          .eq('id', negotiation_id)
          .eq('user_id', profile_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error('[jarvis-agent-negotiation] Error:', error);
    return buildErrorResponse('jarvis-agent-negotiation', error, corsHeaders, 500);
  }
});

function resolveConflict(neg: NegotiationRequest): {
  winner: string;
  resolution: string;
  reason: string;
  deferred_action?: string;
  defer_until?: string;
} {
  const requestingPriority = calculatePriority(neg.requesting_agent, neg.requesting_action);
  const conflictingPriority = calculatePriority(neg.conflicting_agent, neg.conflicting_action);

  // Règle 1: Support critique gagne toujours
  if (neg.conflicting_action.includes('critical') || neg.conflict_type === 'critical_incident') {
    return {
      winner: neg.conflicting_agent,
      resolution: 'Critical incident takes priority',
      reason: `${neg.conflicting_agent} traite un incident critique. ${neg.requesting_agent} attend.`,
      deferred_action: neg.requesting_action,
      defer_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // +2h
    };
  }

  // Règle 2: Comparaison des priorités calculées
  if (requestingPriority > conflictingPriority) {
    return {
      winner: neg.requesting_agent,
      resolution: `Priority score: ${requestingPriority} > ${conflictingPriority}`,
      reason: `Action de ${neg.requesting_agent} plus prioritaire.`,
    };
  } else if (conflictingPriority > requestingPriority) {
    return {
      winner: neg.conflicting_agent,
      resolution: `Priority score: ${conflictingPriority} > ${requestingPriority}`,
      reason: `Action de ${neg.conflicting_agent} plus prioritaire.`,
      deferred_action: neg.requesting_action,
      defer_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h
    };
  }

  // Règle 3: Égalité - premier arrivé premier servi
  return {
    winner: neg.conflicting_agent,
    resolution: 'Equal priority - first come first served',
    reason: `Priorités égales. ${neg.conflicting_agent} était premier.`,
    deferred_action: neg.requesting_action,
    defer_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // +30min
  };
}

function calculatePriority(agentId: string, actionType: string): number {
  const basePriority = AGENT_BASE_PRIORITY[agentId] || 50;
  const actionPriority = CONFLICT_PRIORITIES[actionType] || 50;
  
  // Moyenne pondérée : action compte plus que l'agent
  return Math.round(basePriority * 0.3 + actionPriority * 0.7);
}
