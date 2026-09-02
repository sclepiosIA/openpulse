/**
 * jarvis-orchestrator - Orchestrateur Multi-Agent JARVIS 12.0
 * 
 * Décompose les requêtes complexes et délègue à des agents spécialisés :
 * - Agent CRM : Pipeline, établissements, contacts
 * - Agent RH : Équipe, absences, salaires
 * - Agent Trésorerie : CA, factures, prévisions
 * - Agent Support : Tickets, satisfaction
 * - Agent R&D : Sprints, user stories, backlog
 * 
 * Synthèse unifiée des résultats multi-agents
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

type AgentType = 'crm' | 'rh' | 'tresorerie' | 'support' | 'rd' | 'formation' | 'emails';

interface AgentResult {
  agent: AgentType;
  success: boolean;
  data: Record<string, unknown>;
  summary: string;
  execution_time_ms: number;
}

interface OrchestratorRequest {
  query: string;
  context?: Record<string, unknown>;
  agents?: AgentType[];
  user_id: string;
}

// Keywords pour identifier les agents nécessaires
const AGENT_KEYWORDS: Record<AgentType, string[]> = {
  crm: ['pipeline', 'prospect', 'client', 'établissement', 'commercial', 'vente', 'contact', 'rendez-vous', 'rdv'],
  rh: ['équipe', 'salaire', 'absence', 'congé', 'employé', 'collaborateur', 'masse salariale', 'rh', 'paie'],
  tresorerie: ['facture', 'paiement', 'trésorerie', 'ca', 'chiffre', 'qonto', 'banque', 'dépense', 'revenu', 'budget'],
  support: ['ticket', 'support', 'bug', 'problème', 'assistance', 'réclamation'],
  rd: ['sprint', 'epic', 'user story', 'backlog', 'développement', 'fonctionnalité', 'release'],
  formation: ['formation', 'session', 'émargement', 'certif', 'formateur'],
  emails: ['email', 'mail', 'message', 'courrier', 'réponse', 'envoi'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const request: OrchestratorRequest = await req.json();
    const { query, context } = request;
    const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : request.user_id;

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('user_id', user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Déterminer les agents nécessaires
    const requiredAgents = request.agents || detectRequiredAgents(query.toLowerCase());
    console.log(`[orchestrator] Query: "${query.slice(0, 50)}..." requires agents: ${requiredAgents.join(', ')}`);

    // 2. Exécuter les agents en parallèle
    const startTime = Date.now();
    const agentPromises = requiredAgents.map(agent => 
      executeAgent(supabase, agent, profile.id, query, context)
    );

    const agentResults = await Promise.all(agentPromises);
    const totalTime = Date.now() - startTime;

    // 3. Synthétiser les résultats
    const synthesis = synthesizeResults(query, agentResults);

    // 4. Log l'orchestration
    await supabase.from('ai_processing_log').insert({
      processing_type: 'orchestration',
      model_used: 'jarvis-orchestrator',
      success: true,
      processing_duration_ms: totalTime,
      result: {
        query,
        agents_used: requiredAgents,
        results_count: agentResults.filter(r => r.success).length,
      },
      processed_by: profile.id,
    });

    return new Response(JSON.stringify({
      success: true,
      query,
      agents_used: requiredAgents,
      results: agentResults,
      synthesis,
      total_execution_time_ms: totalTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[orchestrator] Error:', error);
    return buildErrorResponse('jarvis-orchestrator', error, corsHeaders, 500);
  }
});

function detectRequiredAgents(query: string): AgentType[] {
  const agents: Set<AgentType> = new Set();

  for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (query.includes(keyword)) {
        agents.add(agent as AgentType);
      }
    }
  }

  // Requêtes génériques → plusieurs agents
  if (query.includes('réunion') || query.includes('meeting') || query.includes('prépare')) {
    agents.add('crm');
    agents.add('tresorerie');
    if (query.includes('équipe')) agents.add('rh');
  }

  if (query.includes('rapport') || query.includes('récap') || query.includes('bilan')) {
    agents.add('crm');
    agents.add('tresorerie');
  }

  // Si aucun agent détecté, utiliser CRM par défaut
  if (agents.size === 0) {
    agents.add('crm');
  }

  return Array.from(agents);
}

async function executeAgent(
  supabase: any,
  agent: AgentType,
  profileId: string,
  query: string,
  context?: Record<string, unknown>
): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    let data: Record<string, unknown> = {};
    let summary = '';

    switch (agent) {
      case 'crm': {
        // Pipeline commercial
        const { data: prospects } = await supabase
          .from('etablissements')
          .select('id, nom, statut, ville, valeur_contrat, created_at')
          .eq('statut', 'Prospect')
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: contracts } = await supabase
          .from('etablissements')
          .select('id, nom, statut, valeur_contrat')
          .eq('statut', 'Contractuel')
          .limit(10);

        const { data: production } = await supabase
          .from('etablissements')
          .select('id, nom')
          .eq('statut', 'Production');

        const pipelineValue = (prospects || []).reduce((sum: number, p: any) => sum + (p.valeur_contrat || 0), 0);
        
        data = {
          prospects: prospects || [],
          contracts: contracts || [],
          production_count: production?.length || 0,
          pipeline_value: pipelineValue,
        };
        summary = `${prospects?.length || 0} prospects (${pipelineValue.toLocaleString('fr-FR')}€), ${contracts?.length || 0} en contractualisation, ${production?.length || 0} en production`;
        break;
      }

      case 'rh': {
        // Données équipe
        const { data: team } = await supabase
          .from('profiles')
          .select('id, full_name, fonction, email')
          .eq('est_actif', true)
          .limit(50);

        // Absences en cours
        const today = new Date().toISOString().slice(0, 10);
        const { data: absences } = await supabase
          .from('rh_absences')
          .select('id, type, date_debut, date_fin, profile_id')
          .lte('date_debut', today)
          .gte('date_fin', today);

        // Masse salariale du mois
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: salaires } = await supabase
          .from('rh_salaires_mensuels')
          .select('net_a_payer, cout_employeur')
          .eq('mois', currentMonth);

        const masseSalarialeNette = (salaires || []).reduce((sum: number, s: any) => sum + (s.net_a_payer || 0), 0);
        const coutTotal = (salaires || []).reduce((sum: number, s: any) => sum + (s.cout_employeur || 0), 0);

        data = {
          team_count: team?.length || 0,
          team: team || [],
          absences_today: absences?.length || 0,
          masse_salariale_nette: masseSalarialeNette,
          cout_total: coutTotal,
        };
        summary = `${team?.length || 0} collaborateurs, ${absences?.length || 0} absents aujourd'hui, masse salariale: ${masseSalarialeNette.toLocaleString('fr-FR')}€`;
        break;
      }

      case 'tresorerie': {
        // CA du mois
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const { data: revenus } = await supabase
          .from('tresorerie_revenus')
          .select('montant, statut')
          .gte('date_operation', startOfMonth.toISOString());

        const caEncaisse = (revenus || [])
          .filter((r: any) => r.statut === 'encaisse')
          .reduce((sum: number, r: any) => sum + r.montant, 0);

        const caPrevu = (revenus || [])
          .reduce((sum: number, r: any) => sum + r.montant, 0);

        // Factures impayées
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: unpaidInvoices } = await supabase
          .from('factures')
          .select('id, numero, montant_total')
          .in('statut', ['Envoyée', 'En retard'])
          .lt('date_echeance', thirtyDaysAgo);

        const unpaidTotal = (unpaidInvoices || []).reduce((sum: number, f: any) => sum + (f.montant_total || 0), 0);

        data = {
          ca_encaisse: caEncaisse,
          ca_prevu: caPrevu,
          unpaid_invoices_count: unpaidInvoices?.length || 0,
          unpaid_total: unpaidTotal,
        };
        summary = `CA du mois: ${caEncaisse.toLocaleString('fr-FR')}€ encaissé / ${caPrevu.toLocaleString('fr-FR')}€ prévu. ${unpaidInvoices?.length || 0} factures impayées (${unpaidTotal.toLocaleString('fr-FR')}€)`;
        break;
      }

      case 'support': {
        const { data: openTickets } = await supabase
          .from('support_tickets')
          .select('id, subject, status, priority, created_at')
          .in('status', ['open', 'in_progress'])
          .order('created_at', { ascending: true })
          .limit(20);

        const criticalCount = (openTickets || []).filter((t: any) => t.priority === 'critical').length;

        data = {
          open_tickets: openTickets || [],
          open_count: openTickets?.length || 0,
          critical_count: criticalCount,
        };
        summary = `${openTickets?.length || 0} tickets ouverts dont ${criticalCount} critiques`;
        break;
      }

      case 'rd': {
        // Sprint actif
        const today = new Date().toISOString().slice(0, 10);
        const { data: activeSprint } = await supabase
          .from('rd_sprints')
          .select('id, nom, date_debut, date_fin, objectif')
          .lte('date_debut', today)
          .gte('date_fin', today)
          .single();

        // User stories du sprint
        let storiesData: any[] = [];
        if (activeSprint) {
          const { data: stories } = await supabase
            .from('rd_user_stories')
            .select('id, titre, statut, points')
            .eq('sprint_id', activeSprint.id);
          storiesData = stories || [];
        }

        const totalPoints = storiesData.reduce((sum, s) => sum + (s.points || 0), 0);
        const donePoints = storiesData
          .filter(s => s.statut === 'done')
          .reduce((sum, s) => sum + (s.points || 0), 0);

        data = {
          active_sprint: activeSprint,
          stories_count: storiesData.length,
          total_points: totalPoints,
          done_points: donePoints,
          velocity: totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0,
        };
        summary = activeSprint 
          ? `Sprint "${activeSprint.nom}": ${donePoints}/${totalPoints} points (${Math.round((donePoints / totalPoints) * 100)}%)`
          : 'Aucun sprint actif';
        break;
      }

      case 'formation': {
        // Sessions à venir
        const today = new Date().toISOString().slice(0, 10);
        const { data: upcomingSessions } = await supabase
          .from('sessions_formation')
          .select('id, titre, date_debut, etablissement_id')
          .gte('date_debut', today)
          .order('date_debut', { ascending: true })
          .limit(10);

        data = {
          upcoming_sessions: upcomingSessions || [],
          sessions_count: upcomingSessions?.length || 0,
        };
        summary = `${upcomingSessions?.length || 0} sessions de formation à venir`;
        break;
      }

      case 'emails': {
        const { data: unreadThreads } = await supabase
          .from('email_threads')
          .select('id, subject, ai_generated_title, last_message_date')
          .gt('unread_count', 0)
          .eq('is_archived', false)
          .order('last_message_date', { ascending: false })
          .limit(15);

        data = {
          unread_threads: unreadThreads || [],
          unread_count: unreadThreads?.length || 0,
        };
        summary = `${unreadThreads?.length || 0} emails non lus`;
        break;
      }
    }

    return {
      agent,
      success: true,
      data,
      summary,
      execution_time_ms: Date.now() - startTime,
    };

  } catch (error) {
    console.error(`[orchestrator] Agent ${agent} failed:`, error);
    return {
      agent,
      success: false,
      data: { error: error instanceof Error ? error.message : 'Agent failed' },
      summary: `Erreur agent ${agent}`,
      execution_time_ms: Date.now() - startTime,
    };
  }
}

function synthesizeResults(query: string, results: AgentResult[]): string {
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    return 'Aucune donnée disponible pour cette requête.';
  }

  const parts: string[] = [];
  
  for (const result of successfulResults) {
    if (result.summary) {
      parts.push(`**${result.agent.toUpperCase()}**: ${result.summary}`);
    }
  }

  return parts.join('\n\n');
}
