/**
 * jarvis-voice-intent - Détection d'intentions vocales pour le handoff multi-agent
 * 
 * JARVIS 6.0: Analyse le texte transcrit pour détecter les intentions de handoff,
 * les commandes de conférence et les actions spécifiques
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Agent keywords for intent detection
const AGENT_KEYWORDS: Record<string, string[]> = {
  prime: ['jarvis', 'coordinateur', 'chef', 'équipe complète', 'tout le monde', 'briefing'],
  sophia: ['sophia', 'client', 'prospect', 'commercial', 'vente', 'établissement', 'crm', 'relance', 'contrat'],
  marcus: ['marcus', 'rh', 'équipe', 'absence', 'congé', 'recrutement', 'paie', 'collaborateur', 'salaire'],
  olivia: ['olivia', 'trésorerie', 'facture', 'paiement', 'finance', 'budget', 'banque', 'dépense', 'qonto'],
  noah: ['noah', 'r&d', 'développement', 'sprint', 'epic', 'story', 'backlog', 'feature', 'bug'],
  emma: ['emma', 'support', 'ticket', 'problème', 'aide', 'incident', 'assistance'],
  alex: ['alex', 'analyse', 'stats', 'rapport', 'tendance', 'kpi', 'prédiction', 'insight', 'dashboard'],
};

// Conference trigger phrases
const CONFERENCE_TRIGGERS = [
  'briefing',
  'point complet',
  'tour de table',
  'réunion équipe',
  'tout le monde',
  'équipe complète',
  'avis de tous',
  'qu\'en pensez-vous tous',
];

// Direct handoff phrases
const HANDOFF_TRIGGERS = [
  'appelle',
  'passe à',
  'demande à',
  'qu\'en pense',
  'avis de',
  'parle à',
  'passe-moi',
  'je veux parler à',
];

interface VoiceIntent {
  type: 'handoff' | 'conference' | 'action' | 'question' | 'unknown';
  targetAgent?: string;
  conferenceAgents?: string[];
  confidence: number;
  originalText: string;
  suggestedResponse?: string;
}

/**
 * Normalise le texte pour la comparaison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/['']/g, "'")
    .trim();
}

/**
 * Détecte si le texte déclenche une conférence
 */
function detectConference(normalizedText: string): boolean {
  return CONFERENCE_TRIGGERS.some(trigger => normalizedText.includes(trigger));
}

/**
 * Détecte si le texte déclenche un handoff direct
 */
function detectDirectHandoff(normalizedText: string): { agent: string; confidence: number } | null {
  // Check for explicit agent name mention
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        // Check if it's a direct handoff phrase
        const isDirectHandoff = HANDOFF_TRIGGERS.some(trigger => normalizedText.includes(trigger));
        if (isDirectHandoff || keyword === agentId) {
          return { agent: agentId, confidence: 0.9 };
        }
      }
    }
  }
  return null;
}

/**
 * Détecte l'agent le plus pertinent basé sur le contexte
 */
function detectContextualAgent(normalizedText: string): { agent: string; confidence: number } | null {
  const scores: Record<string, number> = {};
  
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    scores[agentId] = 0;
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        scores[agentId] += keyword.length; // Weight by keyword length
      }
    }
  }
  
  // Find best match
  let bestAgent: string | null = null;
  let bestScore = 0;
  
  for (const [agentId, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agentId;
    }
  }
  
  if (bestAgent && bestScore > 3) {
    return { agent: bestAgent, confidence: Math.min(0.9, 0.3 + bestScore * 0.1) };
  }
  
  return null;
}

/**
 * Génère une réponse suggérée pour le handoff
 */
function getHandoffSuggestion(agentId: string): string {
  const suggestions: Record<string, string[]> = {
    prime: ["Je reprends la coordination.", "Jarvis à l'écoute."],
    sophia: ["Sophia prend le relais pour la partie commerciale.", "Je m'occupe de ce client."],
    marcus: ["Marcus à votre service pour les RH.", "Je prends en charge cette question d'équipe."],
    olivia: ["Olivia prend la main pour la trésorerie.", "Je m'occupe des finances."],
    noah: ["Noah au clavier pour la R&D.", "Je prends en charge cette question technique."],
    emma: ["Emma ici pour le support.", "Je m'occupe de ce problème."],
    alex: ["Alex prend le relais pour l'analyse.", "Je vais examiner ces données."],
  };
  
  const agentSuggestions = suggestions[agentId] || suggestions.prime;
  return agentSuggestions[Math.floor(Math.random() * agentSuggestions.length)];
}

serve(async (req) => {
  // CORS preflight
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
    const body = await req.json();
    const { text, currentAgent } = body;
    const userId = auth.isServiceCall ? body.userId : auth.userId;
    
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[jarvis-voice-intent] Analyzing text:', text);
    console.log('[jarvis-voice-intent] Current agent:', currentAgent);

    const normalizedText = normalizeText(text);
    let intent: VoiceIntent;

    // 1. Check for conference trigger
    if (detectConference(normalizedText)) {
      console.log('[jarvis-voice-intent] Conference detected');
      intent = {
        type: 'conference',
        conferenceAgents: ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'],
        confidence: 0.95,
        originalText: text,
        suggestedResponse: "Je lance le briefing d'équipe. Chaque membre va intervenir.",
      };
    }
    // 2. Check for direct handoff
    else {
      const directHandoff = detectDirectHandoff(normalizedText);
      
      if (directHandoff && directHandoff.agent !== currentAgent) {
        console.log('[jarvis-voice-intent] Direct handoff to:', directHandoff.agent);
        intent = {
          type: 'handoff',
          targetAgent: directHandoff.agent,
          confidence: directHandoff.confidence,
          originalText: text,
          suggestedResponse: getHandoffSuggestion(directHandoff.agent),
        };
      }
      // 3. Check for contextual agent switch
      else {
        const contextualAgent = detectContextualAgent(normalizedText);
        
        if (contextualAgent && contextualAgent.agent !== currentAgent && contextualAgent.confidence > 0.5) {
          console.log('[jarvis-voice-intent] Contextual handoff to:', contextualAgent.agent);
          intent = {
            type: 'handoff',
            targetAgent: contextualAgent.agent,
            confidence: contextualAgent.confidence,
            originalText: text,
            suggestedResponse: getHandoffSuggestion(contextualAgent.agent),
          };
        }
        // 4. Regular question/action
        else {
          intent = {
            type: 'question',
            targetAgent: currentAgent || 'prime',
            confidence: 0.7,
            originalText: text,
          };
        }
      }
    }

    console.log('[jarvis-voice-intent] Intent result:', intent);

    // Log to database for learning
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase.from('jarvis_usage_patterns').insert({
          user_id: userId,
          pattern_type: 'voice_intent',
          pattern_data: {
            text: text.substring(0, 500),
            intent_type: intent.type,
            target_agent: intent.targetAgent,
            confidence: intent.confidence,
            current_agent: currentAgent,
          },
          confidence: intent.confidence,
        });
      } catch (logError: unknown) {
        console.warn('[jarvis-voice-intent] Failed to log pattern:', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        intent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[jarvis-voice-intent] Error:', error);
    return buildErrorResponse('jarvis-voice-intent', error, corsHeaders, 500);
  }
});
