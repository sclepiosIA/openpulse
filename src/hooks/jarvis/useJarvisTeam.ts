/**
 * useJarvisTeam - Hook de gestion de l'équipe multi-agent
 * 
 * Coordonne les interactions avec jarvis-prime et gère l'état
 * de la conversation multi-agent.
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import type {
  AgentId,
  AgentMessage,
  UserAgentPreferences,
  TeamStandupBriefing,
  JarvisTeamState,
} from '@/types/jarvis-agents';

// Agent metadata for UI
export const AGENT_METADATA: Record<AgentId, {
  name: string;
  displayName: string;
  emoji: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  domain: string;
}> = {
  sophia: {
    name: 'SOPHIA',
    displayName: 'Sophia',
    emoji: '👩‍💼',
    color: 'hsl(340, 82%, 52%)',
    gradientFrom: 'hsl(340, 82%, 52%)',
    gradientTo: 'hsl(350, 70%, 60%)',
    domain: 'CRM & Commercial',
  },
  marcus: {
    name: 'MARCUS',
    displayName: 'Marcus',
    emoji: '👨‍💼',
    color: 'hsl(210, 70%, 50%)',
    gradientFrom: 'hsl(210, 70%, 50%)',
    gradientTo: 'hsl(220, 60%, 60%)',
    domain: 'RH & People',
  },
  olivia: {
    name: 'OLIVIA',
    displayName: 'Olivia',
    emoji: '👩‍💻',
    color: 'hsl(160, 60%, 45%)',
    gradientFrom: 'hsl(160, 60%, 45%)',
    gradientTo: 'hsl(170, 50%, 55%)',
    domain: 'Trésorerie & Finance',
  },
  noah: {
    name: 'NOAH',
    displayName: 'Noah',
    emoji: '👨‍🔬',
    color: 'hsl(270, 60%, 55%)',
    gradientFrom: 'hsl(270, 60%, 55%)',
    gradientTo: 'hsl(280, 50%, 65%)',
    domain: 'R&D & Produit',
  },
  emma: {
    name: 'EMMA',
    displayName: 'Emma',
    emoji: '👩‍🎨',
    color: 'hsl(30, 80%, 55%)',
    gradientFrom: 'hsl(30, 80%, 55%)',
    gradientTo: 'hsl(40, 70%, 60%)',
    domain: 'Support & Clients',
  },
  alex: {
    name: 'ALEX',
    displayName: 'Alex',
    emoji: '📊',
    color: 'hsl(200, 70%, 50%)',
    gradientFrom: 'hsl(200, 70%, 50%)',
    gradientTo: 'hsl(210, 60%, 60%)',
    domain: 'Analytics & BI',
  },
};

const ALL_AGENTS: AgentId[] = ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];

interface UseJarvisTeamOptions {
  enabledAgents?: AgentId[];
  defaultAgent?: AgentId;
}

// Response from jarvis-prime (snake_case from Edge Function)
interface PrimeApiResponse {
  success: boolean;
  query: string;
  conversation_id: string;
  selected_agents: AgentId[];
  results: Array<{
    agent_id: AgentId;
    agent_name: string;
    emoji: string;
    success: boolean;
    response: string;
    data?: Record<string, unknown>;
    execution_time_ms: number;
    handoff_to?: AgentId;
  }>;
  synthesis: string;
  handoffs?: Array<{ from: AgentId; to: AgentId; reason: string }>;
  total_execution_time_ms: number;
}

export function useJarvisTeam(options: UseJarvisTeamOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [teamState, setTeamState] = useState<JarvisTeamState>({
    activeAgents: [],
    conversationHistory: [],
    isTeamMode: true,
    voiceHandoffs: [],
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  // User preferences for agents - stored in jarvis_user_memory
  // Simple localStorage-based preferences (can be replaced with DB later)
  const [preferences] = useState<UserAgentPreferences | null>(() => {
    try {
      const stored = localStorage.getItem('jarvis-agent-preferences');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const enabledAgents = options.enabledAgents || preferences?.enabledAgents || ALL_AGENTS;
  const defaultAgent = options.defaultAgent || preferences?.defaultAgent || 'sophia';

  /**
   * Send a message to the team via jarvis-prime
   */
  const sendToTeam = useCallback(async (
    query: string,
    sendOptions?: {
      preferredAgent?: AgentId;
      forceAgents?: AgentId[];
    }
  ): Promise<PrimeApiResponse | null> => {
    if (!user?.id || isProcessing) return null;

    setIsProcessing(true);
    
    // Add user message to history
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      agentId: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    
    setTeamState(prev => ({
      ...prev,
      conversationHistory: [...prev.conversationHistory, userMessage],
    }));

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-prime', {
        body: {
          query,
          conversation_id: conversationIdRef.current,
          preferred_agent: sendOptions?.preferredAgent,
          force_agents: sendOptions?.forceAgents,
          user_id: user.id,
        },
      });

      if (error) throw error;

      const response = data as PrimeApiResponse;
      conversationIdRef.current = response.conversation_id;

      // Update active agents
      setTeamState(prev => ({
        ...prev,
        activeAgents: response.selected_agents,
      }));

      // Add agent responses to history
      const agentMessages: AgentMessage[] = response.results.map(result => ({
        id: crypto.randomUUID(),
        agentId: result.agent_id,
        content: result.response,
        timestamp: new Date().toISOString(),
        metadata: { data: result.data },
      }));

      setTeamState(prev => ({
        ...prev,
        conversationHistory: [...prev.conversationHistory, ...agentMessages],
        activeAgents: [],
      }));

      // Handle handoffs
      if (response.handoffs && response.handoffs.length > 0) {
        setTeamState(prev => ({
          ...prev,
          voiceHandoffs: [
            ...prev.voiceHandoffs,
            ...response.handoffs!.map(h => ({
              fromAgent: h.from,
              toAgent: h.to,
              reason: h.reason,
              contextPassed: {},
              timestamp: new Date().toISOString(),
            })),
          ],
        }));
      }

      return response;

    } catch (error) {
      debug.error('[useJarvisTeam] Error:', error);
      toast({
        title: "Erreur",
        description: "L'équipe n'a pas pu traiter votre demande",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, isProcessing, toast]);

  /**
   * Send a message to a specific agent
   */
  const sendToAgent = useCallback(async (
    agentId: AgentId,
    query: string
  ): Promise<PrimeApiResponse | null> => {
    return sendToTeam(query, { forceAgents: [agentId] });
  }, [sendToTeam]);

  /**
   * Request the daily team standup
   */
  const requestStandup = useCallback(async (): Promise<TeamStandupBriefing | null> => {
    if (!user?.id) return null;

    setIsProcessing(true);
    setTeamState(prev => ({
      ...prev,
      activeAgents: ALL_AGENTS,
    }));

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-team-standup', {
        body: {
          user_id: user.id,
          include_agents: enabledAgents,
        },
      });

      if (error) throw error;

      // Add standup message to history
      const standupMessage: AgentMessage = {
        id: crypto.randomUUID(),
        agentId: 'prime',
        content: data.briefing_text,
        timestamp: new Date().toISOString(),
        metadata: { sections: data.sections },
      };

      setTeamState(prev => ({
        ...prev,
        conversationHistory: [...prev.conversationHistory, standupMessage],
        activeAgents: [],
      }));

      return data as TeamStandupBriefing;

    } catch (error) {
      debug.error('[useJarvisTeam] Standup error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le briefing",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, enabledAgents, toast]);

  /**
   * Clear the conversation history
   */
  const clearConversation = useCallback(() => {
    setTeamState({
      activeAgents: [],
      conversationHistory: [],
      isTeamMode: true,
      voiceHandoffs: [],
    });
    conversationIdRef.current = null;
  }, []);

  /**
   * Toggle team mode (multi-agent vs single agent)
   */
  const toggleTeamMode = useCallback(() => {
    setTeamState(prev => ({
      ...prev,
      isTeamMode: !prev.isTeamMode,
    }));
  }, []);

  /**
   * Set the current speaking agent (for UI)
   */
  const setCurrentSpeaker = useCallback((agentId: AgentId | undefined) => {
    setTeamState(prev => ({
      ...prev,
      currentSpeaker: agentId,
    }));
  }, []);

  return {
    // State
    teamState,
    isProcessing,
    enabledAgents,
    defaultAgent,
    preferences,
    
    // Agent metadata
    agents: AGENT_METADATA,
    allAgents: ALL_AGENTS,
    
    // Actions
    sendToTeam,
    sendToAgent,
    requestStandup,
    clearConversation,
    toggleTeamMode,
    setCurrentSpeaker,
    
    // Helpers
    getAgentMeta: (id: AgentId) => AGENT_METADATA[id],
    isAgentEnabled: (id: AgentId) => enabledAgents.includes(id),
  };
}
