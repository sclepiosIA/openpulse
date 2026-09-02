/**
 * JARVIS 16.0 - Dynamic Page Context Enrichment
 * 
 * Fetches full entity details based on the active page context.
 * Supports ALL modules: CRM, Emails, Support, R&D, Recrutement,
 * Contrats, Trésorerie, Formations, Calendrier, Documents, Forum, Pulse, RH/People
 */

import { createClient } from "@supabase/supabase-js";

interface PageContext {
  module: string;
  type: string;
  entityId?: string;
  tab?: string;
  filter?: string;
}

export function parsePageContext(contextString: string | null): PageContext | null {
  if (!contextString) return null;
  const lines = contextString.split('\n');
  const ctx: Partial<PageContext> = {};
  for (const line of lines) {
    const match = line.match(/^\[(\w+):\s*(.+)\]$/);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      switch (key) {
        case 'module': ctx.module = value; break;
        case 'type': ctx.type = value; break;
        case 'entity_id': ctx.entityId = value; break;
        case 'tab': ctx.tab = value; break;
        case 'filter': ctx.filter = value; break;
      }
    }
  }
  return (ctx.module && ctx.type) ? (ctx as PageContext) : null;
}

export async function enrichWithPageContext(
  supabase: ReturnType<typeof createClient>,
  pageContextString: string | null,
  profileId: string
): Promise<string> {
  const ctx = parsePageContext(pageContextString);
  if (!ctx) return '';

  const sections: string[] = [];
  sections.push(`\n🖥️ PAGE ACTIVE: ${ctx.module} > ${ctx.type}${ctx.tab ? ` > ${ctx.tab}` : ''}`);

  if (!ctx.entityId) return sections.join('\n');

  try {
    switch (ctx.module) {
      case 'CRM': {
        const enrichment = await enrichEstablishment(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'EMAILS': {
        const enrichment = await enrichEmailThread(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'SUPPORT': {
        const enrichment = await enrichTicket(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'R&D': {
        const enrichment = await enrichRdEntity(supabase, ctx.entityId, ctx.type);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'RECRUTEMENT': {
        const enrichment = await enrichCandidate(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'CONTRATS': {
        const enrichment = await enrichContrat(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'TRÉSORERIE': {
        const enrichment = await enrichTresorerie(supabase, ctx.entityId, ctx.type);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'FORMATIONS': {
        const enrichment = await enrichFormation(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'CALENDRIER': {
        const enrichment = await enrichCalendarEvent(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'DOCUMENTS': {
        const enrichment = await enrichDocument(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'FORUM': {
        const enrichment = await enrichForumPost(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'PULSE': {
        const enrichment = await enrichPulseConversation(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
      case 'RH': {
        const enrichment = await enrichEmployeeDossier(supabase, ctx.entityId);
        if (enrichment) sections.push(enrichment);
        break;
      }
    }
  } catch (error) {
    console.error('[DynamicPageContext] Error enriching context:', error);
  }

  return sections.join('\n');
}

// ============================================================
// Entity Enrichment Functions
// ============================================================

async function enrichEstablishment(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const [etabResult, tasksResult, contactsResult] = await Promise.all([
    supabase.from('etablissements').select('id, nom, statut, phase, ville, code_postal, telephone, email, commercial_id, chef_projet_id, csm_id, date_signature, ca_mensuel, nombre_utilisateurs, created_at').eq('id', id).maybeSingle(),
    supabase.from('taches').select('id, titre, statut, priorite, echeance').eq('etablissement_id', id).in('statut', ['A faire', 'En cours']).order('echeance', { ascending: true, nullsFirst: false }).limit(8),
    supabase.from('contacts').select('id, prenom, nom, email, fonction, telephone').eq('etablissement_id', id).limit(5),
  ]);
  if (!etabResult.data) return null;
  const e = etabResult.data;
  const lines: string[] = [];
  lines.push(`📍 ÉTABLISSEMENT ACTIF: [[etablissement:${e.id}|${e.nom}]]`);
  lines.push(`  Statut: ${e.statut || '?'} | Phase: ${e.phase || '?'} | Ville: ${e.ville || '?'} ${e.code_postal || ''}`);
  if (e.ca_mensuel) lines.push(`  CA mensuel: ${e.ca_mensuel.toLocaleString('fr-FR')}€`);
  if (e.nombre_utilisateurs) lines.push(`  Utilisateurs: ${e.nombre_utilisateurs}`);
  if (e.date_signature) lines.push(`  Signé le: ${new Date(e.date_signature).toLocaleDateString('fr-FR')}`);
  if (contactsResult.data?.length) {
    const contactList = contactsResult.data.map((c: any) => `[[contact:${c.id}|${c.prenom} ${c.nom}]] (${c.fonction || '?'}) ${c.email || ''}`).join(' | ');
    lines.push(`  👤 Contacts (${contactsResult.data.length}): ${contactList}`);
  }
  if (tasksResult.data?.length) {
    const taskList = tasksResult.data.map((t: any) => `[[task:${t.id}|${t.titre}]] [${t.statut}]${t.echeance ? ` (${new Date(t.echeance).toLocaleDateString('fr-FR')})` : ''}`).join(' | ');
    lines.push(`  📋 Tâches actives (${tasksResult.data.length}): ${taskList}`);
  }
  return lines.join('\n');
}

async function enrichEmailThread(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: thread } = await supabase.from('email_threads').select('id, subject, ai_generated_title, category, etablissement_id, last_message_date, unread_count').eq('id', id).maybeSingle();
  if (!thread) return null;
  const lines = [`📧 EMAIL ACTIF: [[email:${thread.id}|${thread.ai_generated_title || thread.subject || 'Sans sujet'}]]`, `  Catégorie: ${thread.category || '?'} | Non lus: ${thread.unread_count || 0}`];
  if (thread.etablissement_id) lines.push(`  Lié à: [[etablissement:${thread.etablissement_id}|établissement]]`);
  return lines.join('\n');
}

async function enrichTicket(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: ticket } = await supabase.from('support_tickets').select('id, titre, description, statut, priorite, assigned_to, etablissement_id, created_at').eq('id', id).maybeSingle();
  if (!ticket) return null;
  const lines = [`🎫 TICKET ACTIF: [[ticket:${ticket.id}|${ticket.titre}]]`, `  Statut: ${ticket.statut || '?'} | Priorité: ${ticket.priorite || '?'}`];
  if (ticket.description) lines.push(`  Description: ${ticket.description.substring(0, 200)}`);
  return lines.join('\n');
}

async function enrichRdEntity(supabase: ReturnType<typeof createClient>, id: string, type: string): Promise<string | null> {
  if (type === 'sprint' || type === 'sprints') {
    const { data: sprint } = await supabase.from('rd_sprints').select('id, name, status, start_date, end_date, goal').eq('id', id).maybeSingle();
    if (!sprint) return null;
    return `🏃 SPRINT ACTIF: ${sprint.name} [${sprint.status}] (${sprint.start_date} → ${sprint.end_date})${sprint.goal ? `\n  Objectif: ${sprint.goal}` : ''}`;
  }
  if (type === 'epic' || type === 'epics') {
    const { data: epic } = await supabase.from('rd_epics').select('id, title, status, priority, description').eq('id', id).maybeSingle();
    if (!epic) return null;
    return `📦 EPIC ACTIF: ${epic.title} [${epic.status}] [${epic.priority}]${epic.description ? `\n  ${epic.description.substring(0, 200)}` : ''}`;
  }
  return null;
}

async function enrichCandidate(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: candidate } = await supabase.from('candidates').select('id, nom, prenom, email, poste_vise, statut, score_global, source').eq('id', id).maybeSingle();
  if (!candidate) return null;
  return `👤 CANDIDAT ACTIF: ${candidate.prenom} ${candidate.nom}\n  Poste: ${candidate.poste_vise || '?'} | Statut: ${candidate.statut || '?'} | Score: ${candidate.score_global || '?'}/100`;
}

// ============================================================
// NEW Enrichment Functions (Phase 1 - Vision complète)
// ============================================================

async function enrichContrat(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: contrat } = await supabase.from('contrats').select('id, numero, titre, statut, type, etablissement_id, date_debut, date_fin, montant_total, signataire_nom').eq('id', id).maybeSingle();
  if (!contrat) return null;
  const lines = [`📑 CONTRAT ACTIF: ${contrat.numero || contrat.titre || 'Sans titre'}`, `  Statut: ${contrat.statut || '?'} | Type: ${contrat.type || '?'}`];
  if (contrat.montant_total) lines.push(`  Montant: ${contrat.montant_total.toLocaleString('fr-FR')}€`);
  if (contrat.date_debut) lines.push(`  Période: ${contrat.date_debut} → ${contrat.date_fin || '?'}`);
  if (contrat.etablissement_id) lines.push(`  Établissement: [[etablissement:${contrat.etablissement_id}|voir]]`);
  return lines.join('\n');
}

async function enrichTresorerie(supabase: ReturnType<typeof createClient>, id: string, type: string): Promise<string | null> {
  if (type === 'facture') {
    const { data: facture } = await supabase.from('factures').select('id, numero, client_nom, montant_ttc, statut, date_emission, date_echeance, etablissement_id').eq('id', id).maybeSingle();
    if (!facture) return null;
    return `🧾 FACTURE ACTIVE: ${facture.numero || '?'} - ${facture.client_nom || '?'}\n  Montant: ${facture.montant_ttc?.toLocaleString('fr-FR') || '?'}€ TTC | Statut: ${facture.statut || '?'}\n  Émise: ${facture.date_emission || '?'} | Échéance: ${facture.date_echeance || '?'}`;
  }
  // Generic tresorerie view
  return null;
}

async function enrichFormation(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: session } = await supabase.from('sessions_formation').select('id, titre, date_debut, date_fin, statut, formateur, etablissement_id, lieu').eq('id', id).maybeSingle();
  if (!session) return null;
  const lines = [`🎓 SESSION FORMATION: ${session.titre || '?'}`, `  Statut: ${session.statut || '?'} | Dates: ${session.date_debut || '?'} → ${session.date_fin || '?'}`];
  if (session.formateur) lines.push(`  Formateur: ${session.formateur}`);
  if (session.lieu) lines.push(`  Lieu: ${session.lieu}`);
  if (session.etablissement_id) lines.push(`  Établissement: [[etablissement:${session.etablissement_id}|voir]]`);
  return lines.join('\n');
}

async function enrichCalendarEvent(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: event } = await supabase.from('calendar_events').select('id, title, description, start_time, end_time, location, status, etablissement_id').eq('id', id).maybeSingle();
  if (!event) return null;
  const lines = [`📅 ÉVÉNEMENT: [[event:${event.id}|${event.title}]]`, `  ${new Date(event.start_time).toLocaleString('fr-FR')} → ${new Date(event.end_time).toLocaleString('fr-FR')}`];
  if (event.location) lines.push(`  Lieu: ${event.location}`);
  if (event.description) lines.push(`  Description: ${event.description.substring(0, 200)}`);
  return lines.join('\n');
}

async function enrichDocument(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: doc } = await supabase.from('documents').select('id, nom, type, taille_bytes, created_at, etablissement_id, uploaded_by').eq('id', id).maybeSingle();
  if (!doc) return null;
  const size = doc.taille_bytes ? `${(doc.taille_bytes / 1024 / 1024).toFixed(1)} Mo` : '?';
  return `📄 DOCUMENT: ${doc.nom}\n  Type: ${doc.type || '?'} | Taille: ${size} | Créé: ${doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '?'}`;
}

async function enrichForumPost(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: post } = await supabase.from('forum_posts').select('id, titre, contenu, categorie, author_id, created_at, votes_count, comments_count').eq('id', id).maybeSingle();
  if (!post) return null;
  return `💬 POST FORUM: ${post.titre || 'Sans titre'}\n  Catégorie: ${post.categorie || '?'} | 👍 ${post.votes_count || 0} | 💬 ${post.comments_count || 0}\n  ${(post.contenu || '').substring(0, 200)}`;
}

async function enrichPulseConversation(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: conv } = await supabase.from('pulse_conversations').select('id, title, type, created_at').eq('id', id).maybeSingle();
  if (!conv) return null;
  return `💬 CONVERSATION PULSE: ${conv.title || 'Sans titre'} [${conv.type || '?'}]`;
}

async function enrichEmployeeDossier(supabase: ReturnType<typeof createClient>, id: string): Promise<string | null> {
  const { data: profile } = await supabase.from('profiles').select('id, prenom, nom, email, fonction, telephone, date_embauche, type_contrat, actif').eq('id', id).maybeSingle();
  if (!profile) return null;
  const lines = [`👤 EMPLOYÉ: ${profile.prenom || ''} ${profile.nom || ''}`, `  Fonction: ${profile.fonction || '?'} | Contrat: ${profile.type_contrat || '?'} | Actif: ${profile.actif ? 'Oui' : 'Non'}`];
  if (profile.date_embauche) lines.push(`  Embauché le: ${new Date(profile.date_embauche).toLocaleDateString('fr-FR')}`);
  if (profile.email) lines.push(`  Email: ${profile.email}`);
  return lines.join('\n');
}
