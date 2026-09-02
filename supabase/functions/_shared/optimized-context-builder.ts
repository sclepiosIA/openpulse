/**
 * JARVIS 11.0 - Optimized Context Builder
 * 
 * Optimisations de latence:
 * 1. Context budget RÉDUIT de 30-50% vs v10
 * 2. Requêtes établissements FUSIONNÉES (3→1)
 * 3. Cache mémoire pour contextes répétés
 * 4. Colonnes sélectionnées MINIMALES
 * 5. Early exit si système OFFLINE
 */

import { createClient } from "@supabase/supabase-js";

// ============================================================
// Context Budget - REDUCED for better latency
// ============================================================
export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';

export interface ContextBudget {
  teamLimit: number;
  tasksLimit: number;
  overdueTasksLimit: number;
  establishmentsLimit: number;
  emailsLimit: number;
  eventsLimit: number;
  ticketsLimit: number;
  groupsLimit: number;
  partnersLimit: number;
}

// V15 BALANCED: Reasonable limits for quality + acceptable latency
const CONTEXT_BUDGETS: Record<SystemHealthStatus, ContextBudget> = {
  HEALTHY: {
    teamLimit: 15,
    tasksLimit: 12,
    overdueTasksLimit: 5,
    establishmentsLimit: 10,
    emailsLimit: 8,
    eventsLimit: 6,
    ticketsLimit: 5,
    groupsLimit: 8,
    partnersLimit: 8,
  },
  DEGRADED: {
    teamLimit: 8,
    tasksLimit: 5,
    overdueTasksLimit: 3,
    establishmentsLimit: 5,
    emailsLimit: 3,
    eventsLimit: 3,
    ticketsLimit: 3,
    groupsLimit: 5,
    partnersLimit: 5,
  },
  UNHEALTHY: {
    teamLimit: 3,
    tasksLimit: 3,
    overdueTasksLimit: 2,
    establishmentsLimit: 3,
    emailsLimit: 2,
    eventsLimit: 2,
    ticketsLimit: 2,
    groupsLimit: 3,
    partnersLimit: 3,
  },
  OFFLINE: {
    teamLimit: 0,
    tasksLimit: 3,
    overdueTasksLimit: 2,
    establishmentsLimit: 0,
    emailsLimit: 0,
    eventsLimit: 0,
    ticketsLimit: 0,
    groupsLimit: 0,
    partnersLimit: 0,
  },
};

export function getContextBudget(healthStatus: SystemHealthStatus): ContextBudget {
  return CONTEXT_BUDGETS[healthStatus] || CONTEXT_BUDGETS.HEALTHY;
}

// ============================================================
// In-Memory Context Cache (TTL: 60s)
// ============================================================
interface CachedContext {
  context: string;
  timestamp: number;
}

const contextCache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 120_000; // 120 seconds (was 60s) for more cache hits

function getCachedContext(profileId: string, healthStatus: SystemHealthStatus): string | null {
  const cacheKey = `${profileId}_${healthStatus}`;
  const cached = contextCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[ContextBuilder] ✅ Cache HIT for ${profileId}`);
    return cached.context;
  }
  
  return null;
}

function setCachedContext(profileId: string, healthStatus: SystemHealthStatus, context: string): void {
  const cacheKey = `${profileId}_${healthStatus}`;
  contextCache.set(cacheKey, { context, timestamp: Date.now() });
  
  // Cleanup old entries (keep max 100)
  if (contextCache.size > 100) {
    const oldestKey = contextCache.keys().next().value;
    if (oldestKey) contextCache.delete(oldestKey);
  }
}

// ============================================================
// Health Status Fetcher
// ============================================================
export async function getSystemHealthStatus(
  supabase: ReturnType<typeof createClient>
): Promise<SystemHealthStatus> {
  try {
    const { data } = await supabase
      .from('jarvis_circuit_state')
      .select('state')
      .eq('circuit_name', 'azure_openai')
      .maybeSingle();
    
    if (!data) return 'HEALTHY';
    
    const circuitState = data.state;
    if (circuitState === 'OPEN') return 'UNHEALTHY';
    if (circuitState === 'HALF_OPEN') return 'DEGRADED';
    return 'HEALTHY';
  } catch {
    return 'HEALTHY';
  }
}

// ============================================================
// Rich Context Data Types
// ============================================================
interface TeamMember {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  fonction: string | null;
}

interface Task {
  id: string;
  titre: string;
  statut: string | null;
  priorite: string | null;
  echeance: string | null;
}

interface Establishment {
  id: string;
  nom: string;
  ville: string | null;
  statut: string | null;
  commercial_id: string | null;
  chef_projet_id: string | null;
  csm_id: string | null;
}

interface EmailThread {
  id: string;
  subject: string | null;
  ai_generated_title: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
}

interface SupportTicket {
  id: string;
  titre: string;
  priorite: string | null;
}

interface GroupPartner {
  id: string;
  nom: string;
}

interface RichContextData {
  team: TeamMember[];
  myTasks: Task[];
  overdueTasks: Task[];
  myEstablishments: Array<{ id: string; nom: string; ville: string | null; statut: string | null; role: string }>;
  unreadEmails: EmailThread[];
  upcomingEvents: CalendarEvent[];
  openTickets: SupportTicket[];
  groups: GroupPartner[];
  partners: GroupPartner[];
}

// ============================================================
// OPTIMIZED Context Builder
// ============================================================
export async function buildOptimizedContext(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  healthStatus: SystemHealthStatus = 'HEALTHY'
): Promise<string> {
  const startTime = Date.now();
  
  // Check cache first
  const cached = getCachedContext(profileId, healthStatus);
  if (cached) {
    return cached;
  }
  
  const limits = getContextBudget(healthStatus);
  
  // Early exit for OFFLINE mode
  if (healthStatus === 'OFFLINE' || Object.values(limits).every(v => v === 0)) {
    console.log('[ContextBuilder] ⚠️ System offline - minimal context');
    return '';
  }
  
  const now = new Date().toISOString();
  
  try {
    // OPTIMIZATION 1: Execute ALL queries in parallel
    // OPTIMIZATION 2: Minimal column selection
    // OPTIMIZATION 3: SINGLE establishments query (was 3 separate)
    const [
      teamResult,
      myTasksResult,
      overdueTasksResult,
      establishmentsResult,  // MERGED: Single query for all roles
      unreadEmailsResult,
      upcomingEventsResult,
      openTicketsResult,
      groupsResult,
      partnersResult
    ] = await Promise.all([
      // 1. Team members (minimal columns)
      limits.teamLimit > 0 
        ? supabase
            .from('profiles')
            .select('id, prenom, nom, email, fonction')
            .eq('actif', true)
            .limit(limits.teamLimit)
        : Promise.resolve({ data: [] }),
      
      // 2. My current tasks
      supabase
        .from('taches')
        .select('id, titre, statut, priorite, echeance')
        .eq('responsable_id', profileId)
        .in('statut', ['A faire', 'En cours'])
        .order('echeance', { ascending: true, nullsFirst: false })
        .limit(limits.tasksLimit),
      
      // 3. Overdue tasks
      supabase
        .from('taches')
        .select('id, titre, echeance')
        .eq('responsable_id', profileId)
        .lt('echeance', now)
        .not('statut', 'in', '(\"Terminé\",\"Annulé\")')
        .limit(limits.overdueTasksLimit),
      
      // 4. MERGED: All establishments where user has a role (single OR query)
      limits.establishmentsLimit > 0 
        ? supabase
            .from('etablissements')
            .select('id, nom, ville, statut, commercial_id, chef_projet_id, csm_id')
            .or(`commercial_id.eq.${profileId},chef_projet_id.eq.${profileId},csm_id.eq.${profileId}`)
            .limit(limits.establishmentsLimit)
        : Promise.resolve({ data: [] }),
      
      // 5. Unread emails (minimal columns)
      limits.emailsLimit > 0 
        ? supabase
            .from('email_threads')
            .select('id, subject, ai_generated_title')
            .gt('unread_count', 0)
            .eq('is_deleted', false)
            .eq('is_archived', false)
            .order('last_message_date', { ascending: false })
            .limit(limits.emailsLimit)
        : Promise.resolve({ data: [] }),
      
      // 6. Upcoming events (minimal columns)
      limits.eventsLimit > 0 
        ? supabase
            .from('calendar_events')
            .select('id, title, start_time')
            .gte('start_time', now)
            .order('start_time', { ascending: true })
            .limit(limits.eventsLimit)
        : Promise.resolve({ data: [] }),
      
      // 7. Open support tickets (minimal columns)
      limits.ticketsLimit > 0 
        ? supabase
            .from('support_tickets')
            .select('id, titre, priorite')
            .in('statut', ['Ouvert', 'En cours'])
            .limit(limits.ticketsLimit)
        : Promise.resolve({ data: [] }),
      
      // 8. Groups (minimal columns)
      limits.groupsLimit > 0 
        ? supabase
            .from('groupes_etablissements')
            .select('id, nom')
            .limit(limits.groupsLimit)
        : Promise.resolve({ data: [] }),
      
      // 9. Partners (minimal columns)
      limits.partnersLimit > 0 
        ? supabase
            .from('partenaires')
            .select('id, nom')
            .limit(limits.partnersLimit)
        : Promise.resolve({ data: [] }),
    ]);

    // Process establishments with roles (OPTIMIZED: single pass)
    const myEstablishments: RichContextData['myEstablishments'] = [];
    for (const est of (establishmentsResult.data as Establishment[] || [])) {
      const roles: string[] = [];
      if (est.commercial_id === profileId) roles.push('Commercial');
      if (est.chef_projet_id === profileId) roles.push('Chef de projet');
      if (est.csm_id === profileId) roles.push('CSM');
      
      myEstablishments.push({
        id: est.id,
        nom: est.nom,
        ville: est.ville,
        statut: est.statut,
        role: roles.join(', ') || 'Assigné'
      });
    }

    // Build context data
    const data: RichContextData = {
      team: (teamResult.data as TeamMember[]) || [],
      myTasks: (myTasksResult.data as Task[]) || [],
      overdueTasks: (overdueTasksResult.data as Task[]) || [],
      myEstablishments,
      unreadEmails: (unreadEmailsResult.data as EmailThread[]) || [],
      upcomingEvents: (upcomingEventsResult.data as CalendarEvent[]) || [],
      openTickets: (openTicketsResult.data as SupportTicket[]) || [],
      groups: (groupsResult.data as GroupPartner[]) || [],
      partners: (partnersResult.data as GroupPartner[]) || [],
    };

    const context = formatContext(data);
    
    // Cache the result
    setCachedContext(profileId, healthStatus, context);
    
    const duration = Date.now() - startTime;
    console.log(`[ContextBuilder] ✅ Built in ${duration}ms (${context.length} chars, health=${healthStatus})`);
    
    return context;
  } catch (error) {
    console.error('[ContextBuilder] ❌ Error:', error);
    return '';
  }
}

// ============================================================
// Context Formatter (COMPACT)
// ============================================================
function formatContext(data: RichContextData): string {
  const sections: string[] = [];
  
  // Team (compact format)
  if (data.team.length > 0) {
    const teamList = data.team.map(p => 
      `${p.prenom || ''} ${p.nom || ''} <${p.email || '?'}>${p.fonction ? ` - ${p.fonction}` : ''}`
    ).join(' | ');
    sections.push(`👥 ÉQUIPE (${data.team.length}): ${teamList}`);
  }

  // Tasks
  if (data.myTasks.length > 0) {
    const taskList = data.myTasks.map(t => {
      const prio = t.priorite ? `[${t.priorite.charAt(0).toUpperCase()}]` : '';
      const date = t.echeance ? ` (${formatShortDate(t.echeance)})` : '';
      return `[${t.id}]${prio}${t.titre}${date}`;
    }).join(' | ');
    sections.push(`📋 TÂCHES (${data.myTasks.length}): ${taskList}`);
    sections.push(`📝 Pour référencer une tâche, utilise: [[task:ID|titre]]`);
  }

  // Overdue tasks (ALERT)
  if (data.overdueTasks.length > 0) {
    const overdueList = data.overdueTasks.map(t => `[${t.id}]${t.titre}`).join(', ');
    sections.push(`⚠️ EN RETARD (${data.overdueTasks.length}): ${overdueList}`);
  }

  // Establishments
  if (data.myEstablishments.length > 0) {
    const estList = data.myEstablishments.map(e => 
      `[${e.id}]${e.nom}${e.ville ? ` (${e.ville})` : ''} [${e.role}]`
    ).join(' | ');
    sections.push(`🏥 ÉTABLISSEMENTS (${data.myEstablishments.length}): ${estList}`);
    sections.push(`📝 Pour référencer un établissement, utilise: [[etablissement:ID|nom]]`);
  }

  // Emails (with IDs for reference links)
  if (data.unreadEmails.length > 0) {
    const emailList = data.unreadEmails.map(e => 
      `[${e.id}]${e.ai_generated_title || e.subject || 'Sans sujet'}`
    ).join(' | ');
    sections.push(`📧 EMAILS NON LUS (${data.unreadEmails.length}): ${emailList}`);
    sections.push(`📝 Pour référencer un email, utilise: [[email:ID|titre]]`);
  }

  // Events
  if (data.upcomingEvents.length > 0) {
    const eventList = data.upcomingEvents.map(e => 
      `[${e.id}]${e.title} (${formatShortDateTime(e.start_time)})`
    ).join(' | ');
    sections.push(`📅 ÉVÉNEMENTS: ${eventList}`);
    sections.push(`📝 Pour référencer un événement, utilise: [[event:ID|titre]]`);
  }

  // Tickets
  if (data.openTickets.length > 0) {
    const ticketList = data.openTickets.map(t => 
      `[${t.id}][${t.priorite?.charAt(0).toUpperCase() || 'N'}] ${t.titre}`
    ).join(' | ');
    sections.push(`🎫 TICKETS (${data.openTickets.length}): ${ticketList}`);
    sections.push(`📝 Pour référencer un ticket, utilise: [[ticket:ID|titre]]`);
  }

  // Groups & Partners (single line)
  const refs: string[] = [];
  if (data.groups.length > 0) {
    refs.push(`Groupes: ${data.groups.map(g => g.nom).join(', ')}`);
  }
  if (data.partners.length > 0) {
    refs.push(`Partenaires: ${data.partners.map(p => p.nom).join(', ')}`);
  }
  if (refs.length > 0) {
    sections.push(`🏢 ${refs.join(' | ')}`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `

=== CONTEXTE ===
${sections.join('\n')}
================`;
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return "auj";
  if (date.toDateString() === tomorrow.toDateString()) return "dem";
  
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatShortDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return `${formatShortDate(isoDate)} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ============================================================
// Exports
// ============================================================
export { CONTEXT_BUDGETS };
