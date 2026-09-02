/**
 * JARVIS 6.0 - Configuration des Agents Multi-Voix
 * 
 * Définit les agents spécialisés avec leurs voix Azure distinctes
 * pour le handoff vocal dynamique
 */

import type { AgentId, JarvisAgent } from '@/types/jarvis-agents';

// Voix Azure GPT Realtime disponibles
export type AzureVoice = 'alloy' | 'shimmer' | 'echo' | 'nova' | 'fable' | 'onyx' | 'coral';

// Mapping Agent → Voix Azure
export const AGENT_VOICE_MAP: Record<AgentId | 'prime', AzureVoice> = {
  prime: 'coral',     // Jarvis Prime - Coordonnateur neutre
  sophia: 'shimmer',  // CRM - Dynamique, persuasive
  marcus: 'echo',     // RH - Calme, posée
  olivia: 'alloy',    // Trésorerie - Précise, professionnelle
  noah: 'nova',       // R&D - Enthousiaste, technique
  emma: 'fable',      // Support - Chaleureuse, patiente
  alex: 'onyx',       // Analyst - Analytique, confiante
};

// Configuration complète des agents Jarvis
export const JARVIS_AGENTS: Record<AgentId, JarvisAgent> = {
  sophia: {
    id: 'sophia',
    name: 'Sophia',
    displayName: 'Sophia',
    domain: 'crm',
    voice: 'shimmer',
    color: 'hsl(330, 80%, 55%)',
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-rose-600',
    emoji: '💼',
    personality: 'Dynamique et orientée résultats',
    shortDescription: 'Experte CRM et relations clients',
    systemPromptKey: 'crm_specialist',
    allowedTools: [
      'search_etablissements', 'get_etablissement_details', 'create_etablissement',
      'update_etablissement', 'search_contacts', 'create_task', 'search_tasks',
      'get_pipeline_stats', 'send_email', 'suggest_email_response'
    ],
    allowedTables: ['etablissements', 'contacts', 'taches', 'email_threads'],
    keywords: ['client', 'prospect', 'établissement', 'commercial', 'vente', 'pipeline', 'contrat', 'relance', 'CRM'],
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus',
    displayName: 'Marcus',
    domain: 'rh',
    voice: 'echo',
    color: 'hsl(210, 70%, 55%)',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-indigo-600',
    emoji: '👥',
    personality: 'Calme et bienveillant',
    shortDescription: 'Expert RH et gestion d\'équipe',
    systemPromptKey: 'rh_specialist',
    allowedTools: [
      'get_team_members', 'get_employee_details', 'create_absence',
      'get_absences', 'get_rh_stats', 'search_candidates'
    ],
    allowedTables: ['profiles', 'absences', 'salaires', 'candidates'],
    keywords: ['équipe', 'collaborateur', 'absence', 'congé', 'recrutement', 'paie', 'salaire', 'RH', 'employé'],
  },
  olivia: {
    id: 'olivia',
    name: 'Olivia',
    displayName: 'Olivia',
    domain: 'tresorerie',
    voice: 'alloy',
    color: 'hsl(145, 70%, 45%)',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-green-600',
    emoji: '💰',
    personality: 'Précise et méthodique',
    shortDescription: 'Experte trésorerie et finances',
    systemPromptKey: 'finance_specialist',
    allowedTools: [
      'get_treasury_stats', 'get_factures', 'get_depenses',
      'get_qonto_balance', 'get_bank_transactions', 'create_facture'
    ],
    allowedTables: ['factures', 'depenses', 'revenus', 'qonto_transactions'],
    keywords: ['facture', 'paiement', 'trésorerie', 'budget', 'dépense', 'revenu', 'banque', 'Qonto', 'finance'],
  },
  noah: {
    id: 'noah',
    name: 'Noah',
    displayName: 'Noah',
    domain: 'rd',
    voice: 'nova',
    color: 'hsl(270, 70%, 55%)',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-violet-600',
    emoji: '🔬',
    personality: 'Passionné et innovant',
    shortDescription: 'Expert R&D et développement',
    systemPromptKey: 'rd_specialist',
    allowedTools: [
      'get_rd_stats', 'get_sprints', 'get_epics', 'get_user_stories',
      'create_user_story', 'update_story_status', 'generate_rd_content'
    ],
    allowedTables: ['rd_epics', 'rd_user_stories', 'rd_sprints'],
    keywords: ['sprint', 'epic', 'story', 'développement', 'R&D', 'backlog', 'vélocité', 'bug', 'feature'],
  },
  emma: {
    id: 'emma',
    name: 'Emma',
    displayName: 'Emma',
    domain: 'support',
    voice: 'fable',
    color: 'hsl(35, 90%, 55%)',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-orange-600',
    emoji: '🎧',
    personality: 'Empathique et patiente',
    shortDescription: 'Experte support client',
    systemPromptKey: 'support_specialist',
    allowedTools: [
      'get_support_tickets', 'create_support_ticket', 'update_ticket_status',
      'get_support_stats', 'search_knowledge_base'
    ],
    allowedTables: ['support_tickets', 'email_threads'],
    keywords: ['ticket', 'support', 'problème', 'aide', 'incident', 'bug', 'assistance', 'client'],
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    displayName: 'Alex',
    domain: 'analytics',
    voice: 'onyx',
    color: 'hsl(195, 80%, 50%)',
    gradientFrom: 'from-cyan-500',
    gradientTo: 'to-teal-600',
    emoji: '📊',
    personality: 'Analytique et perspicace',
    shortDescription: 'Expert données et insights',
    systemPromptKey: 'analytics_specialist',
    allowedTools: [
      'get_global_stats', 'get_conversion_metrics', 'analyze_trends',
      'generate_report', 'get_predictions', 'get_insights'
    ],
    allowedTables: ['ai_analysis_log', 'jarvis_predictions'],
    keywords: ['stats', 'analyse', 'rapport', 'tendance', 'KPI', 'métrique', 'prédiction', 'insight', 'dashboard'],
  },
};

// Mots-clés pour la détection d'intention de handoff vocal
export const HANDOFF_TRIGGER_PHRASES: Record<AgentId | 'prime', string[]> = {
  prime: ['jarvis', 'coordinateur', 'chef', 'équipe complète', 'tout le monde'],
  sophia: ['sophia', 'client', 'prospect', 'commercial', 'vente', 'établissement', 'crm', 'relance'],
  marcus: ['marcus', 'rh', 'équipe', 'absence', 'congé', 'recrutement', 'paie', 'collaborateur'],
  olivia: ['olivia', 'trésorerie', 'facture', 'paiement', 'finance', 'budget', 'banque', 'dépense'],
  noah: ['noah', 'r&d', 'développement', 'sprint', 'epic', 'story', 'backlog', 'feature'],
  emma: ['emma', 'support', 'ticket', 'problème', 'aide', 'incident', 'assistance'],
  alex: ['alex', 'analyse', 'stats', 'rapport', 'tendance', 'kpi', 'prédiction', 'insight'],
};

// Phrases de handoff pour transition fluide
export const HANDOFF_PHRASES: Record<AgentId | 'prime', string[]> = {
  prime: [
    "Je reprends la main.",
    "Je coordonne depuis ici.",
    "Jarvis à l'écoute.",
  ],
  sophia: [
    "Sophia prend le relais pour la partie commerciale.",
    "Je m'occupe de ce client.",
    "Sophia ici, parlons business.",
  ],
  marcus: [
    "Marcus à votre service pour les RH.",
    "Je prends en charge cette question d'équipe.",
    "Marcus ici, parlons ressources humaines.",
  ],
  olivia: [
    "Olivia prend la main pour la trésorerie.",
    "Je m'occupe des finances.",
    "Olivia ici, voyons les chiffres.",
  ],
  noah: [
    "Noah au clavier pour la R&D.",
    "Je prends en charge cette question technique.",
    "Noah ici, parlons développement.",
  ],
  emma: [
    "Emma ici pour le support.",
    "Je m'occupe de ce problème.",
    "Emma à l'écoute, comment puis-je aider ?",
  ],
  alex: [
    "Alex prend le relais pour l'analyse.",
    "Je vais examiner ces données.",
    "Alex ici, analysons ensemble.",
  ],
};

/**
 * Détecte l'agent le plus approprié basé sur le texte
 */
export function detectAgentFromText(text: string): AgentId | 'prime' | null {
  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Score par agent
  const scores: Record<AgentId | 'prime', number> = {
    prime: 0,
    sophia: 0,
    marcus: 0,
    olivia: 0,
    noah: 0,
    emma: 0,
    alex: 0,
  };
  
  // Calculer les scores basés sur les mots-clés
  for (const [agentId, phrases] of Object.entries(HANDOFF_TRIGGER_PHRASES)) {
    for (const phrase of phrases) {
      const normalizedPhrase = phrase.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedText.includes(normalizedPhrase)) {
        scores[agentId as AgentId | 'prime'] += normalizedPhrase.length; // Score pondéré par longueur
      }
    }
  }
  
  // Trouver l'agent avec le meilleur score
  let bestAgent: AgentId | 'prime' | null = null;
  let bestScore = 0;
  
  for (const [agentId, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agentId as AgentId | 'prime';
    }
  }
  
  return bestScore > 0 ? bestAgent : null;
}

/**
 * Génère le prompt système pour un agent spécifique en mode vocal
 */
export function getAgentVoicePrompt(agentId: AgentId | 'prime', userName: string): string {
  if (agentId === 'prime') {
    return `Tu es JARVIS Prime, le coordinateur de l'équipe d'assistants IA de ${userName}. 
Tu parles avec une voix neutre et professionnelle. 
Quand une question concerne un domaine spécifique (CRM, RH, Finance, R&D, Support, Analytics), 
annonce que tu passes la parole à l'agent spécialisé.
Sois concis et efficace.`;
  }
  
  const agent = JARVIS_AGENTS[agentId];
  return `Tu es ${agent.name}, ${agent.shortDescription} de l'équipe JARVIS pour ${userName}.
Ta personnalité : ${agent.personality}.
Tu tutois ${userName} et parles de façon naturelle et concise.
Domaine d'expertise : ${agent.domain}.
Quand la conversation sort de ton domaine, propose de passer la parole à un collègue plus adapté.`;
}

/**
 * Obtient une phrase de handoff aléatoire pour un agent
 */
export function getRandomHandoffPhrase(agentId: AgentId | 'prime'): string {
  const phrases = HANDOFF_PHRASES[agentId];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
