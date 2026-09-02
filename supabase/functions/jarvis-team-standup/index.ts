/**
 * JARVIS Team Standup - Briefing quotidien automatisé
 * 
 * Génère un briefing coordonné de tous les agents pour
 * fournir une vue d'ensemble de la journée.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface StandupSection {
  agent_id: string;
  agent_name: string;
  emoji: string;
  highlights: string[];
  alerts: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
  metrics: Record<string, number>;
}

interface StandupRequest {
  user_id: string;
  include_agents?: string[];
}

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
    const request: StandupRequest = await req.json();
    const { include_agents } = request;
    const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : request.user_id;

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const sections: StandupSection[] = [];

    // ============================================================
    // SOPHIA - CRM
    // ============================================================
    const sophiaSection = await generateSophiaSection(supabase, profile.id);
    sections.push(sophiaSection);

    // ============================================================
    // MARCUS - RH
    // ============================================================
    const marcusSection = await generateMarcusSection(supabase, today);
    sections.push(marcusSection);

    // ============================================================
    // OLIVIA - Trésorerie
    // ============================================================
    const oliviaSection = await generateOliviaSection(supabase);
    sections.push(oliviaSection);

    // ============================================================
    // NOAH - R&D
    // ============================================================
    const noahSection = await generateNoahSection(supabase, today);
    sections.push(noahSection);

    // ============================================================
    // EMMA - Support
    // ============================================================
    const emmaSection = await generateEmmaSection(supabase);
    sections.push(emmaSection);

    // ============================================================
    // ALEX - Analytics
    // ============================================================
    const alexSection = await generateAlexSection(supabase, sections);
    sections.push(alexSection);

    // Filtrer les agents si demandé
    const filteredSections = include_agents?.length 
      ? sections.filter(s => include_agents.includes(s.agent_id))
      : sections;

    // Générer le briefing textuel
    const briefingText = generateBriefingText(profile.full_name, filteredSections);

    return new Response(JSON.stringify({
      success: true,
      date: today,
      user_name: profile.full_name,
      sections: filteredSections,
      briefing_text: briefingText,
      execution_time_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[jarvis-team-standup] Error:', error);
    return buildErrorResponse('jarvis-team-standup', error, corsHeaders, 500);
  }
});

async function generateSophiaSection(supabase: any, profileId: string): Promise<StandupSection> {
  const highlights: string[] = [];
  const alerts: StandupSection['alerts'] = [];
  const metrics: Record<string, number> = {};

  // Prospects à relancer (>7 jours sans activité)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: coldProspects } = await supabase
    .from('etablissements')
    .select('id, nom')
    .eq('statut', 'Prospect')
    .lt('updated_at', sevenDaysAgo)
    .limit(5);

  if (coldProspects?.length) {
    alerts.push({
      priority: 'medium',
      message: `${coldProspects.length} prospect(s) à relancer`,
    });
  }

  // Pipeline value
  const { data: prospects } = await supabase
    .from('etablissements')
    .select('valeur_contrat')
    .eq('statut', 'Prospect');

  const pipelineValue = (prospects || []).reduce((sum: number, p: any) => sum + (p.valeur_contrat || 0), 0);
  metrics.pipeline_value = pipelineValue;
  metrics.prospects_count = prospects?.length || 0;

  // Contrats en attente de signature
  const { data: pendingContracts } = await supabase
    .from('etablissements')
    .select('id, nom')
    .eq('statut', 'Contractuel avant sig');

  if (pendingContracts?.length) {
    highlights.push(`${pendingContracts.length} contrat(s) en attente de signature`);
    metrics.pending_contracts = pendingContracts.length;
  }

  highlights.push(`Pipeline: ${pipelineValue.toLocaleString('fr-FR')}€ (${prospects?.length || 0} prospects)`);

  return {
    agent_id: 'sophia',
    agent_name: 'SOPHIA',
    emoji: '👩‍💼',
    highlights,
    alerts,
    metrics,
  };
}

async function generateMarcusSection(supabase: any, today: string): Promise<StandupSection> {
  const highlights: string[] = [];
  const alerts: StandupSection['alerts'] = [];
  const metrics: Record<string, number> = {};

  // Absences du jour
  const { data: todayAbsences } = await supabase
    .from('rh_absences')
    .select('id, profile_id, type')
    .lte('date_debut', today)
    .gte('date_fin', today);

  metrics.absences_today = todayAbsences?.length || 0;

  if (todayAbsences?.length) {
    highlights.push(`${todayAbsences.length} collaborateur(s) absent(s) aujourd'hui`);
  } else {
    highlights.push('Pas d\'absence imprévue');
  }

  // Fins de période d'essai cette semaine
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: trialEndings } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('date_fin_periode_essai', 'is', null)
    .gte('date_fin_periode_essai', today)
    .lte('date_fin_periode_essai', nextWeek);

  if (trialEndings?.length) {
    alerts.push({
      priority: 'high',
      message: `${trialEndings.length} fin(s) de période d'essai cette semaine`,
    });
  }

  // Effectif actif
  const { data: activeTeam } = await supabase
    .from('profiles')
    .select('id')
    .eq('est_actif', true);

  metrics.team_count = activeTeam?.length || 0;
  highlights.push(`${activeTeam?.length || 0} collaborateurs actifs`);

  return {
    agent_id: 'marcus',
    agent_name: 'MARCUS',
    emoji: '👨‍💼',
    highlights,
    alerts,
    metrics,
  };
}

async function generateOliviaSection(supabase: any): Promise<StandupSection> {
  const highlights: string[] = [];
  const alerts: StandupSection['alerts'] = [];
  const metrics: Record<string, number> = {};

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

  metrics.ca_encaisse = caEncaisse;
  highlights.push(`CA encaissé ce mois: ${caEncaisse.toLocaleString('fr-FR')}€`);

  // Factures impayées > 30 jours
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: overdueInvoices } = await supabase
    .from('factures')
    .select('id, numero, montant_total')
    .in('statut', ['Envoyée', 'En retard'])
    .lt('date_echeance', thirtyDaysAgo);

  if (overdueInvoices?.length) {
    const overdueTotal = overdueInvoices.reduce((sum: number, f: any) => sum + (f.montant_total || 0), 0);
    alerts.push({
      priority: 'high',
      message: `${overdueInvoices.length} facture(s) impayée(s) > 30j (${overdueTotal.toLocaleString('fr-FR')}€)`,
    });
    metrics.overdue_invoices = overdueInvoices.length;
    metrics.overdue_total = overdueTotal;
  }

  // À encaisser
  const { data: pending } = await supabase
    .from('factures')
    .select('montant_total')
    .in('statut', ['Envoyée', 'En retard']);

  const toCollect = (pending || []).reduce((sum: number, f: any) => sum + (f.montant_total || 0), 0);
  metrics.to_collect = toCollect;
  highlights.push(`À encaisser: ${toCollect.toLocaleString('fr-FR')}€`);

  return {
    agent_id: 'olivia',
    agent_name: 'OLIVIA',
    emoji: '👩‍💻',
    highlights,
    alerts,
    metrics,
  };
}

async function generateNoahSection(supabase: any, today: string): Promise<StandupSection> {
  const highlights: string[] = [];
  const alerts: StandupSection['alerts'] = [];
  const metrics: Record<string, number> = {};

  // Sprint actif
  const { data: activeSprint } = await supabase
    .from('rd_sprints')
    .select('id, nom, date_debut, date_fin')
    .lte('date_debut', today)
    .gte('date_fin', today)
    .single();

  if (activeSprint) {
    // Stories du sprint
    const { data: stories } = await supabase
      .from('rd_user_stories')
      .select('id, statut, points')
      .eq('sprint_id', activeSprint.id);

    const totalPoints = (stories || []).reduce((sum: number, s: any) => sum + (s.points || 0), 0);
    const donePoints = (stories || [])
      .filter((s: any) => s.statut === 'done')
      .reduce((sum: number, s: any) => sum + (s.points || 0), 0);

    const velocity = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
    metrics.velocity = velocity;
    metrics.total_points = totalPoints;
    metrics.done_points = donePoints;

    highlights.push(`Sprint "${activeSprint.nom}": ${velocity}% (${donePoints}/${totalPoints} pts)`);

    // Alerte si vélocité < 70% à mi-parcours
    const sprintStart = new Date(activeSprint.date_debut).getTime();
    const sprintEnd = new Date(activeSprint.date_fin).getTime();
    const now = Date.now();
    const progress = (now - sprintStart) / (sprintEnd - sprintStart);

    if (progress > 0.5 && velocity < 70) {
      alerts.push({
        priority: 'high',
        message: `Sprint à risque: ${velocity}% à ${Math.round(progress * 100)}% du temps`,
      });
    }

    // Stories bloquées
    const blockedStories = (stories || []).filter((s: any) => s.statut === 'blocked').length;
    if (blockedStories > 0) {
      alerts.push({
        priority: 'medium',
        message: `${blockedStories} story(ies) bloquée(s)`,
      });
    }
  } else {
    highlights.push('Aucun sprint actif');
  }

  return {
    agent_id: 'noah',
    agent_name: 'NOAH',
    emoji: '👨‍🔬',
    highlights,
    alerts,
    metrics,
  };
}

async function generateEmmaSection(supabase: any): Promise<StandupSection> {
  const highlights: string[] = [];
  const alerts: StandupSection['alerts'] = [];
  const metrics: Record<string, number> = {};

  // Tickets ouverts
  const { data: openTickets } = await supabase
    .from('support_tickets')
    .select('id, priority, created_at')
    .in('status', ['open', 'in_progress']);

  metrics.open_tickets = openTickets?.length || 0;

  // Tickets critiques
  const criticalTickets = (openTickets || []).filter((t: any) => t.priority === 'critical');
  if (criticalTickets.length > 0) {
    alerts.push({
      priority: 'critical',
      message: `${criticalTickets.length} ticket(s) critique(s) ouvert(s)`,
    });
  }

  // Temps moyen de résolution (approximation)
  const { data: recentResolved } = await supabase
    .from('support_tickets')
    .select('created_at, resolved_at')
    .eq('status', 'resolved')
    .not('resolved_at', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(20);

  let avgResolutionHours = 0;
  if (recentResolved?.length) {
    const totalHours = recentResolved.reduce((sum: number, t: any) => {
      const created = new Date(t.created_at).getTime();
      const resolved = new Date(t.resolved_at).getTime();
      return sum + (resolved - created) / (1000 * 60 * 60);
    }, 0);
    avgResolutionHours = Math.round(totalHours / recentResolved.length * 10) / 10;
  }

  metrics.avg_resolution_hours = avgResolutionHours;
  highlights.push(`${openTickets?.length || 0} tickets ouverts`);
  if (avgResolutionHours > 0) {
    highlights.push(`Temps moyen de résolution: ${avgResolutionHours}h`);
  }

  return {
    agent_id: 'emma',
    agent_name: 'EMMA',
    emoji: '👩‍🎨',
    highlights,
    alerts,
    metrics,
  };
}

async function generateAlexSection(supabase: any, otherSections: StandupSection[]): Promise<StandupSection> {
  const highlights: string[] = [];
  const alerts: StandupSection['alerts'] = [];
  const metrics: Record<string, number> = {};

  // Consolider les métriques des autres agents
  const sophia = otherSections.find(s => s.agent_id === 'sophia');
  const olivia = otherSections.find(s => s.agent_id === 'olivia');
  const emma = otherSections.find(s => s.agent_id === 'emma');

  // Alertes critiques totales
  const totalCriticalAlerts = otherSections.reduce((sum, s) => 
    sum + s.alerts.filter(a => a.priority === 'critical' || a.priority === 'high').length
  , 0);

  if (totalCriticalAlerts > 0) {
    alerts.push({
      priority: 'high',
      message: `${totalCriticalAlerts} alerte(s) prioritaire(s) nécessitant attention`,
    });
  }

  // Synthèse
  if (sophia?.metrics.pipeline_value) {
    metrics.pipeline = sophia.metrics.pipeline_value;
  }
  if (olivia?.metrics.ca_encaisse) {
    metrics.ca_mtd = olivia.metrics.ca_encaisse;
  }
  if (emma?.metrics.open_tickets !== undefined) {
    metrics.tickets = emma.metrics.open_tickets;
  }

  // Tendance générale
  const issues = totalCriticalAlerts;
  if (issues === 0) {
    highlights.push('✅ Situation nominale, pas d\'alerte critique');
  } else if (issues <= 2) {
    highlights.push(`⚠️ ${issues} point(s) d'attention à traiter`);
  } else {
    highlights.push(`🚨 ${issues} alertes à traiter en priorité`);
  }

  return {
    agent_id: 'alex',
    agent_name: 'ALEX',
    emoji: '📊',
    highlights,
    alerts,
    metrics,
  };
}

function generateBriefingText(userName: string, sections: StandupSection[]): string {
  const date = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let text = `📋 **BRIEFING MATINAL** - ${date}\n\nBonjour ${userName} ! Voici le point de l'équipe :\n\n`;

  for (const section of sections) {
    text += `${section.emoji} **${section.agent_name}**\n`;
    
    for (const highlight of section.highlights) {
      text += `• ${highlight}\n`;
    }
    
    for (const alert of section.alerts) {
      const icon = alert.priority === 'critical' ? '🚨' : alert.priority === 'high' ? '⚠️' : '📌';
      text += `${icon} ${alert.message}\n`;
    }
    
    text += '\n';
  }

  return text.trim();
}
