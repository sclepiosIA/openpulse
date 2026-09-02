/**
 * JARVIS PRIME - Orchestrateur Multi-Agent Principal
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

// Agent definitions inlined
type AgentId = 'sophia' | 'marcus' | 'olivia' | 'noah' | 'emma' | 'alex';

const AGENT_KEYWORDS: Record<AgentId, string[]> = {
  sophia: ['pipeline', 'prospect', 'client', 'établissement', 'commercial', 'vente', 'contact', 'rdv', 'contrat'],
  marcus: ['équipe', 'salaire', 'absence', 'congé', 'employé', 'collaborateur', 'rh', 'paie', 'recrutement'],
  olivia: ['facture', 'paiement', 'trésorerie', 'ca', 'chiffre', 'qonto', 'banque', 'dépense', 'budget'],
  noah: ['sprint', 'epic', 'user story', 'backlog', 'développement', 'fonctionnalité', 'release', 'vélocité'],
  emma: ['ticket', 'support', 'bug', 'problème', 'assistance', 'réclamation', 'satisfaction'],
  alex: ['analyse', 'métrique', 'kpi', 'rapport', 'tendance', 'statistique', 'performance', 'objectif'],
};

const AGENT_INFO: Record<AgentId, { name: string; emoji: string; domain: string }> = {
  sophia: { name: 'SOPHIA', emoji: '👩‍💼', domain: 'CRM & Commercial' },
  marcus: { name: 'MARCUS', emoji: '👨‍💼', domain: 'RH & People' },
  olivia: { name: 'OLIVIA', emoji: '👩‍💻', domain: 'Trésorerie & Finance' },
  noah: { name: 'NOAH', emoji: '👨‍🔬', domain: 'R&D & Produit' },
  emma: { name: 'EMMA', emoji: '👩‍🎨', domain: 'Support & Clients' },
  alex: { name: 'ALEX', emoji: '📊', domain: 'Analytics & BI' },
};

function detectRequiredAgents(query: string): AgentId[] {
  const normalizedQuery = query.toLowerCase();
  const detectedAgents = new Set<AgentId>();

  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) {
        detectedAgents.add(agentId as AgentId);
        break;
      }
    }
  }

  if (normalizedQuery.includes('brief') || normalizedQuery.includes('standup') || normalizedQuery.includes('point')) {
    return ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];
  }

  if (detectedAgents.size === 0) {
    detectedAgents.add('sophia');
  }

  return Array.from(detectedAgents);
}

interface PrimeRequest {
  query: string;
  conversation_id?: string;
  context?: Record<string, unknown>;
  preferred_agent?: AgentId;
  force_agents?: AgentId[];
  user_id: string;
}

interface AgentResult {
  agent_id: AgentId;
  agent_name: string;
  emoji: string;
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
  tool_calls?: Array<{ name: string; result: unknown }>;
  execution_time_ms: number;
  handoff_to?: AgentId;
}

// Azure OpenAI Configuration
const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const request: PrimeRequest = await req.json();
    const { query, conversation_id, context, preferred_agent, force_agents } = request;
    const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : request.user_id;

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, fonction')
      .eq('user_id', user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Déterminer les agents à mobiliser
    let selectedAgents: AgentId[];
    if (force_agents && force_agents.length > 0) {
      selectedAgents = force_agents;
    } else if (preferred_agent) {
      selectedAgents = [preferred_agent];
    } else {
      selectedAgents = detectRequiredAgents(query);
    }

    console.log(`[jarvis-prime] Query: "${query.slice(0, 50)}..." → Agents: ${selectedAgents.join(', ')}`);

    // 2. Exécuter les agents en parallèle
    const agentPromises = selectedAgents.map(agentId => 
      executeAgent(supabase, agentId, profile.id, query, context)
    );

    const agentResults = await Promise.all(agentPromises);
    const successfulResults = agentResults.filter(r => r.success);

    // 3. Générer une synthèse si plusieurs agents
    let synthesis = '';
    if (selectedAgents.length > 1) {
      synthesis = await generateSynthesis(query, agentResults, profile.full_name);
    } else if (successfulResults.length === 1) {
      synthesis = successfulResults[0].response;
    }

    // 4. Logger l'interaction
    const conversationId = conversation_id || crypto.randomUUID();
    
    // Log chaque interaction agent
    for (const result of agentResults) {
      await supabase.from('jarvis_agent_interactions').insert({
        user_id,
        agent_name: result.agent_id,
        query,
        response: result.response,
        tool_calls: result.tool_calls || null,
        execution_time_ms: result.execution_time_ms,
        handoff_to: result.handoff_to || null,
      }).catch(() => {}); // Ignore si table n'existe pas encore
    }

    // 5. Vérifier les handoffs
    const handoffs = agentResults
      .filter(r => r.handoff_to)
      .map(r => ({ from: r.agent_id, to: r.handoff_to!, reason: 'Context transfer' }));

    const totalTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      query,
      conversation_id: conversationId,
      selected_agents: selectedAgents,
      results: agentResults,
      synthesis,
      handoffs,
      total_execution_time_ms: totalTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[jarvis-prime] Error:', error);
    return buildErrorResponse('jarvis-prime', error, corsHeaders, 500);
  }
});

/**
 * Exécute un agent spécifique avec son contexte et ses outils
 */
async function executeAgent(
  supabase: any,
  agentId: AgentId,
  profileId: string,
  query: string,
  context?: Record<string, unknown>
): Promise<AgentResult> {
  const startTime = Date.now();
  const agent = AGENTS[agentId];

  try {
    // Récupérer les données spécifiques au domaine de l'agent
    const domainData = await fetchAgentDomainData(supabase, agent, profileId);

    // Construire le prompt pour l'agent
    const systemPrompt = buildAgentSystemPrompt(agent, domainData);
    
    // Appeler GPT-5 avec le contexte de l'agent
    const response = await callAgentLLM(agent, systemPrompt, query, domainData, context);

    // Détecter les handoffs potentiels
    const handoffTo = detectHandoff(agentId, query, response);

    return {
      agent_id: agentId,
      agent_name: agent.name,
      emoji: agent.emoji,
      success: true,
      response,
      data: domainData,
      execution_time_ms: Date.now() - startTime,
      handoff_to: handoffTo,
    };

  } catch (error) {
    console.error(`[jarvis-prime] Agent ${agentId} failed:`, error);
    return {
      agent_id: agentId,
      agent_name: agent.name,
      emoji: agent.emoji,
      success: false,
      response: `Erreur lors de l'exécution de l'agent ${agent.name}`,
      execution_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Récupère les données pertinentes pour le domaine de l'agent
 */
async function fetchAgentDomainData(
  supabase: any,
  agent: AgentDefinition,
  profileId: string
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  switch (agent.id) {
    case 'sophia': {
      // Pipeline CRM
      const [prospects, contracts, production] = await Promise.all([
        supabase.from('etablissements').select('id, nom, statut, ville, valeur_contrat').eq('statut', 'Prospect').order('created_at', { ascending: false }).limit(10),
        supabase.from('etablissements').select('id, nom, statut, valeur_contrat').in('statut', ['Contractuel avant sig', 'Contractuel post-sig']).limit(10),
        supabase.from('etablissements').select('id, nom').eq('statut', 'Production'),
      ]);
      
      const pipelineValue = (prospects.data || []).reduce((sum: number, p: any) => sum + (p.valeur_contrat || 0), 0);
      data.prospects = prospects.data || [];
      data.contracts = contracts.data || [];
      data.production_count = production.data?.length || 0;
      data.pipeline_value = pipelineValue;
      data.summary = `${prospects.data?.length || 0} prospects (${pipelineValue.toLocaleString('fr-FR')}€)`;
      break;
    }

    case 'marcus': {
      // Données RH
      const [team, absences, salaires] = await Promise.all([
        supabase.from('profiles').select('id, full_name, fonction, email').eq('est_actif', true).limit(50),
        supabase.from('rh_absences').select('*').gte('date_fin', new Date().toISOString().slice(0, 10)),
        supabase.from('rh_salaires_mensuels').select('net_a_payer, cout_employeur').eq('mois', new Date().toISOString().slice(0, 7)),
      ]);
      
      const masseSalariale = (salaires.data || []).reduce((sum: number, s: any) => sum + (s.net_a_payer || 0), 0);
      data.team = team.data || [];
      data.team_count = team.data?.length || 0;
      data.absences = absences.data || [];
      data.masse_salariale = masseSalariale;
      data.summary = `${team.data?.length || 0} collaborateurs, masse salariale: ${masseSalariale.toLocaleString('fr-FR')}€`;
      break;
    }

    case 'olivia': {
      // Données trésorerie
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      
      const [revenus, depenses, unpaid] = await Promise.all([
        supabase.from('tresorerie_revenus').select('montant, statut').gte('date_operation', startOfMonth.toISOString()),
        supabase.from('tresorerie_depenses').select('montant').gte('date_depense', startOfMonth.toISOString()),
        supabase.from('factures').select('id, numero, montant_total').in('statut', ['Envoyée', 'En retard']),
      ]);
      
      const caEncaisse = (revenus.data || []).filter((r: any) => r.statut === 'encaisse').reduce((sum: number, r: any) => sum + r.montant, 0);
      const totalDepenses = (depenses.data || []).reduce((sum: number, d: any) => sum + d.montant, 0);
      const unpaidTotal = (unpaid.data || []).reduce((sum: number, f: any) => sum + (f.montant_total || 0), 0);
      
      data.ca_encaisse = caEncaisse;
      data.depenses = totalDepenses;
      data.unpaid_count = unpaid.data?.length || 0;
      data.unpaid_total = unpaidTotal;
      data.summary = `CA: ${caEncaisse.toLocaleString('fr-FR')}€, ${unpaid.data?.length || 0} factures impayées`;
      break;
    }

    case 'noah': {
      // Données R&D
      const today = new Date().toISOString().slice(0, 10);
      const [sprint, stories] = await Promise.all([
        supabase.from('rd_sprints').select('*').lte('date_debut', today).gte('date_fin', today).single(),
        supabase.from('rd_user_stories').select('id, titre, statut, points').order('priorite', { ascending: true }).limit(20),
      ]);
      
      const totalPoints = (stories.data || []).reduce((sum: number, s: any) => sum + (s.points || 0), 0);
      const donePoints = (stories.data || []).filter((s: any) => s.statut === 'done').reduce((sum: number, s: any) => sum + (s.points || 0), 0);
      
      data.active_sprint = sprint.data;
      data.stories = stories.data || [];
      data.velocity = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
      data.summary = sprint.data ? `Sprint "${sprint.data.nom}": ${data.velocity}%` : 'Aucun sprint actif';
      break;
    }

    case 'emma': {
      // Données support
      const [tickets, critical] = await Promise.all([
        supabase.from('support_tickets').select('id, subject, status, priority, created_at').in('status', ['open', 'in_progress']).order('created_at', { ascending: true }).limit(20),
        supabase.from('support_tickets').select('id').eq('priority', 'critical').in('status', ['open', 'in_progress']),
      ]);
      
      data.open_tickets = tickets.data || [];
      data.critical_count = critical.data?.length || 0;
      data.summary = `${tickets.data?.length || 0} tickets ouverts, ${critical.data?.length || 0} critiques`;
      break;
    }

    case 'alex': {
      // Données analytics (agrégation multi-domaines)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      
      const [etabs, revenus, tasks] = await Promise.all([
        supabase.from('etablissements').select('id, statut'),
        supabase.from('tresorerie_revenus').select('montant').gte('date_operation', startOfMonth.toISOString()),
        supabase.from('taches').select('id, statut').eq('statut', 'Terminé').gte('updated_at', startOfMonth.toISOString()),
      ]);
      
      const prospects = (etabs.data || []).filter((e: any) => e.statut === 'Prospect').length;
      const production = (etabs.data || []).filter((e: any) => e.statut === 'Production').length;
      const caMTD = (revenus.data || []).reduce((sum: number, r: any) => sum + r.montant, 0);
      
      data.prospects_count = prospects;
      data.production_count = production;
      data.ca_mtd = caMTD;
      data.tasks_completed = tasks.data?.length || 0;
      data.summary = `${production} clients en production, CA MTD: ${caMTD.toLocaleString('fr-FR')}€`;
      break;
    }
  }

  return data;
}

/**
 * Construit le system prompt pour l'agent avec ses données
 */
function buildAgentSystemPrompt(agent: AgentDefinition, domainData: Record<string, unknown>): string {
  const dataContext = Object.entries(domainData)
    .filter(([key]) => key !== 'summary')
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');

  return `${agent.systemPrompt}

DONNÉES ACTUELLES DE TON DOMAINE:
${dataContext}

RÉSUMÉ: ${domainData.summary || 'Aucune donnée disponible'}`;
}

/**
 * Appelle le LLM avec le contexte de l'agent
 */
async function callAgentLLM(
  agent: AgentDefinition,
  systemPrompt: string,
  query: string,
  domainData: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<string> {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    // Fallback si pas d'Azure configuré
    return generateFallbackResponse(agent, query, domainData);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_completion_tokens: 1500,
        reasoning_effort: 'low',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        // Retry une fois
        return generateFallbackResponse(agent, query, domainData);
      }
      throw new Error(`Azure API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || generateFallbackResponse(agent, query, domainData);

  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[jarvis-prime] LLM call failed for ${agent.id}:`, error);
    return generateFallbackResponse(agent, query, domainData);
  }
}

/**
 * Génère une réponse de fallback basée sur les données
 */
function generateFallbackResponse(
  agent: AgentDefinition,
  query: string,
  domainData: Record<string, unknown>
): string {
  const summary = domainData.summary as string || 'Données non disponibles';
  return `${agent.emoji} **${agent.name}** - ${agent.shortDescription}\n\n${summary}`;
}

/**
 * Génère une synthèse multi-agents
 */
async function generateSynthesis(
  query: string,
  results: AgentResult[],
  userName?: string
): Promise<string> {
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    return 'Aucune donnée disponible.';
  }

  const parts = successfulResults.map(r => `${r.emoji} **${r.agent_name}**: ${r.response}`);
  
  const greeting = userName ? `${userName}, voici le point de l'équipe :\n\n` : 'Voici la synthèse :\n\n';
  
  return greeting + parts.join('\n\n');
}

/**
 * Détecte si un handoff vers un autre agent est nécessaire
 */
function detectHandoff(
  currentAgent: AgentId,
  query: string,
  response: string
): AgentId | undefined {
  const normalizedResponse = response.toLowerCase();
  
  // Détection de patterns de handoff
  if (currentAgent === 'sophia' && normalizedResponse.includes('impayé')) {
    return 'olivia';
  }
  if (currentAgent === 'sophia' && normalizedResponse.includes('ticket')) {
    return 'emma';
  }
  if (currentAgent === 'emma' && normalizedResponse.includes('bug') && normalizedResponse.includes('technique')) {
    return 'noah';
  }
  if (currentAgent === 'olivia' && normalizedResponse.includes('commercial')) {
    return 'sophia';
  }

  return undefined;
}
