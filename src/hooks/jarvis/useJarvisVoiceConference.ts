/**
 * useJarvisVoiceConference - Hook pour les conférences vocales multi-agents
 * 
 * JARVIS 6.0: Orchestration de conversations où plusieurs agents
 * interviennent séquentiellement avec leurs voix distinctes
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { debug } from '@/lib/debug';
import type { AgentId } from '@/types/jarvis-agents';
import { AGENT_VOICE_MAP, JARVIS_AGENTS, getRandomHandoffPhrase } from '@/lib/jarvis-agents-config';

interface ConferenceParticipant {
  agentId: AgentId | 'prime';
  response: string;
  status: 'pending' | 'speaking' | 'done';
}

interface ConferenceSession {
  id: string;
  topic: string;
  participants: ConferenceParticipant[];
  currentSpeaker: AgentId | 'prime' | null;
  status: 'preparing' | 'active' | 'completed';
}

interface UseJarvisVoiceConferenceReturn {
  session: ConferenceSession | null;
  isConferenceActive: boolean;
  currentSpeaker: AgentId | 'prime' | null;
  startConference: (topic: string, agents?: AgentId[]) => Promise<void>;
  stopConference: () => void;
  skipToNextSpeaker: () => void;
}

// Default agents for a full team briefing
const DEFAULT_CONFERENCE_AGENTS: AgentId[] = ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];

export function useJarvisVoiceConference(): UseJarvisVoiceConferenceReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<ConferenceSession | null>(null);
  const [currentSpeaker, setCurrentSpeaker] = useState<AgentId | 'prime' | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speakingQueueRef = useRef<ConferenceParticipant[]>([]);

  /**
   * Synthèse vocale via ElevenLabs ou Azure TTS
   */
  const speakText = useCallback(async (
    text: string, 
    agentId: AgentId | 'prime',
    signal?: AbortSignal
  ): Promise<void> => {
    const voice = AGENT_VOICE_MAP[agentId];
    
    try {
      // Call TTS edge function
      const { data, error } = await supabase.functions.invoke('jarvis-tts', {
        body: { text, voice, agentId },
      });
      
      if (error || !data?.audioUrl) {
        debug.warn('[VoiceConference] TTS failed, using Web Speech API');
        // Fallback to Web Speech API
        return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'fr-FR';
          utterance.rate = 1.0;
          utterance.pitch = agentId === 'olivia' ? 1.1 : agentId === 'marcus' ? 0.9 : 1.0;
          
          utterance.onend = () => resolve();
          utterance.onerror = (e) => reject(e);
          
          if (signal?.aborted) {
            reject(new Error('Aborted'));
            return;
          }
          
          speechSynthesis.speak(utterance);
        });
      }
      
      // Play audio
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      audioRef.current.src = data.audioUrl;
      await audioRef.current.play();
      
      // Wait for audio to finish
      await new Promise<void>((resolve, reject) => {
        if (!audioRef.current) return resolve();
        
        const onEnded = () => {
          audioRef.current?.removeEventListener('ended', onEnded);
          resolve();
        };
        
        const onError = (e: Event) => {
          audioRef.current?.removeEventListener('error', onError);
          reject(e);
        };
        
        audioRef.current.addEventListener('ended', onEnded);
        audioRef.current.addEventListener('error', onError);
        
        if (signal?.aborted) {
          audioRef.current.pause();
          reject(new Error('Aborted'));
        }
      });
      
    } catch (error) {
      if ((error as Error).message === 'Aborted') {
        debug.log('[VoiceConference] Speech aborted');
      } else {
        debug.error('[VoiceConference] Speech error:', error);
      }
    }
  }, []);

  /**
   * Obtient la réponse d'un agent pour le topic
   */
  const getAgentResponse = useCallback(async (
    agentId: AgentId,
    topic: string,
    previousResponses: string[]
  ): Promise<string> => {
    const agent = JARVIS_AGENTS[agentId];
    
    const { data, error } = await supabase.functions.invoke('jarvis-brain', {
      body: {
        query: `[Contexte: Briefing d'équipe sur "${topic}"]\n\n${
          previousResponses.length > 0 
            ? `Résumé des interventions précédentes:\n${previousResponses.join('\n')}\n\n` 
            : ''
        }En tant que ${agent.name} (${agent.shortDescription}), donne un bref résumé de ce qui te concerne sur ce sujet. 2-3 phrases maximum.`,
        agent_id: agentId,
        mode: 'conference',
      },
    });
    
    if (error) {
      return `Désolé, je n'ai pas pu analyser ce sujet pour le moment.`;
    }
    
    return data?.response || data?.content || 'Rien de particulier à signaler de mon côté.';
  }, []);

  /**
   * Lance la conférence avec les agents sélectionnés
   */
  const startConference = useCallback(async (
    topic: string,
    agents: AgentId[] = DEFAULT_CONFERENCE_AGENTS
  ) => {
    if (!user) {
      toast({ title: 'Non connecté', variant: 'destructive' });
      return;
    }
    
    debug.log('[VoiceConference] Starting conference on:', topic, 'with agents:', agents);
    
    // Initialize session
    const newSession: ConferenceSession = {
      id: crypto.randomUUID(),
      topic,
      participants: agents.map(agentId => ({
        agentId,
        response: '',
        status: 'pending',
      })),
      currentSpeaker: 'prime',
      status: 'preparing',
    };
    
    setSession(newSession);
    setCurrentSpeaker('prime');
    
    // Create abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      // Prime introduction
      const introText = `Briefing d'équipe sur : ${topic}. Je passe la parole à chaque membre de l'équipe.`;
      await speakText(introText, 'prime', signal);
      
      // Update session status
      setSession(prev => prev ? { ...prev, status: 'active' } : null);
      
      // Collect responses from each agent
      const responses: string[] = [];
      
      for (let i = 0; i < agents.length; i++) {
        if (signal.aborted) break;
        
        const agentId = agents[i];
        const agent = JARVIS_AGENTS[agentId];
        
        // Update current speaker
        setCurrentSpeaker(agentId);
        setSession(prev => {
          if (!prev) return null;
          const updated = { ...prev };
          updated.participants = updated.participants.map((p, idx) => ({
            ...p,
            status: idx === i ? 'speaking' : idx < i ? 'done' : 'pending',
          }));
          updated.currentSpeaker = agentId;
          return updated;
        });
        
        // Get agent response
        const response = await getAgentResponse(agentId, topic, responses);
        responses.push(`${agent.name}: ${response}`);
        
        // Update session with response
        setSession(prev => {
          if (!prev) return null;
          const updated = { ...prev };
          updated.participants = updated.participants.map((p, idx) => 
            idx === i ? { ...p, response } : p
          );
          return updated;
        });
        
        // Speak the response
        const handoffPhrase = getRandomHandoffPhrase(agentId);
        await speakText(`${handoffPhrase} ${response}`, agentId, signal);
        
        // Small pause between speakers
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Prime conclusion
      if (!signal.aborted) {
        setCurrentSpeaker('prime');
        await speakText(
          `Merci à tous pour ce briefing. Y a-t-il des questions ?`,
          'prime',
          signal
        );
      }
      
      // Mark as completed
      setSession(prev => prev ? { ...prev, status: 'completed', currentSpeaker: null } : null);
      setCurrentSpeaker(null);
      
    } catch (error) {
      debug.error('[VoiceConference] Conference error:', error);
      if ((error as Error).message !== 'Aborted') {
        toast({
          title: 'Erreur de conférence',
          description: 'La conférence a été interrompue.',
          variant: 'destructive',
        });
      }
    }
  }, [user, toast, speakText, getAgentResponse]);

  /**
   * Arrête la conférence en cours
   */
  const stopConference = useCallback(() => {
    debug.log('[VoiceConference] Stopping conference');
    
    // Abort ongoing operations
    abortControllerRef.current?.abort();
    
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Cancel speech synthesis
    speechSynthesis.cancel();
    
    // Reset state
    setSession(null);
    setCurrentSpeaker(null);
    speakingQueueRef.current = [];
  }, []);

  /**
   * Passe au speaker suivant
   */
  const skipToNextSpeaker = useCallback(() => {
    if (!session || session.status !== 'active') return;
    
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    speechSynthesis.cancel();
    
    debug.log('[VoiceConference] Skipping to next speaker');
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      speechSynthesis.cancel();
    };
  }, []);

  return {
    session,
    isConferenceActive: session?.status === 'active',
    currentSpeaker,
    startConference,
    stopConference,
    skipToNextSpeaker,
  };
}
