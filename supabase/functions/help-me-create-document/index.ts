/**
 * help-me-create-document - Génère des documents structurés (rapports, plans d'action, comptes-rendus)
 * à partir de sources internes sélectionnées, via Azure GPT-5.4
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGpt5Mini } from "../_shared/azure-gpt5-mini.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

type DocType = 'compte_rendu' | 'plan_action' | 'rapport' | 'synthese' | 'note_interne';
type SourceType = 'emails' | 'etablissements' | 'taches' | 'contacts' | 'calendar'
  | 'factures' | 'devis' | 'contrats' | 'avoirs' | 'forum' | 'rd'
  | 'formations' | 'recrutement' | 'support' | 'tresorerie' | 'documents';

interface RequestBody {
  document_type: DocType;
  title: string;
  instructions?: string;
  sources: SourceType[];
  source_filters?: {
    etablissement_id?: string;
    date_from?: string;
    date_to?: string;
    search_query?: string;
  };
  tone?: 'formal' | 'concise' | 'detailed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // V2d hardening — per-token rate limit (heavy AI generation)
    const rlKey = `help-me-create-document:${authHeader.slice(-32)}`;
    const rl = checkRateLimit(rlKey, { limit: 10, windowSec: 60 });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Trop de requêtes, veuillez patienter.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec ?? 60) }
      });
    }


    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    // User-scoped client so RLS enforces per-user/per-org access on all source queries.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentification invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const body: RequestBody = await req.json();
    const { document_type, title, instructions, sources, source_filters, tone = 'formal' } = body;

    if (!document_type || !title || !sources?.length) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants: document_type, title, sources' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Sanitize search_query to prevent PostgREST filter injection ──
    const rawQuery = source_filters?.search_query;
    const safeQuery = typeof rawQuery === 'string'
      ? rawQuery.replace(/[,().\"\\%*:]/g, ' ').trim().slice(0, 200)
      : '';
    const hasSearch = safeQuery.length > 0;

    // ── Fetch source data in parallel ──
    const sourceData: Record<string, string> = {};
    const fetchPromises: Promise<void>[] = [];


    // ── EMAILS ──
    if (sources.includes('emails')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('email_threads')
          .select('subject, ai_generated_title, ai_summary, category, last_message_at')
          .order('last_message_at', { ascending: false })
          .limit(40);

        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        if (source_filters?.date_from) query = query.gte('last_message_at', source_filters.date_from);
        if (hasSearch) query = query.or(`subject.ilike.%${safeQuery}%,ai_summary.ilike.%${safeQuery}%`);
        const { data } = await query;
        if (data?.length) {
          sourceData['emails'] = data.map(t =>
            `- [${t.category || 'Email'}] ${t.ai_generated_title || t.subject}: ${t.ai_summary || '(pas de résumé)'}`
          ).join('\n');
        }
      })());
    }

    // ── ÉTABLISSEMENTS ──
    if (sources.includes('etablissements')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('etablissements')
          .select('nom, ville, statut, type_etablissement, ca_mensuel, phase_projet, notes_suivi, date_signature_contrat, mrr')
        if (hasSearch) query = query.ilike('nom', `%${safeQuery}%`);

        if (source_filters?.etablissement_id) query = query.eq('id', source_filters.etablissement_id);
        if (source_filters?.search_query) query = query.ilike('nom', `%${source_filters.search_query}%`);
        const { data } = await query;
        if (data?.length) {
          sourceData['etablissements'] = data.map(e =>
            `- ${e.nom} (${e.ville || '?'}) — Statut: ${e.statut}, Phase: ${e.phase_projet || 'N/A'}, CA: ${e.ca_mensuel || 0}€/mois, MRR: ${e.mrr || 0}€${e.date_signature_contrat ? `, Signé: ${e.date_signature_contrat}` : ''}${e.notes_suivi ? `, Notes: ${e.notes_suivi.substring(0, 200)}` : ''}`
          ).join('\n');
        }
      })());
    }

    // ── TÂCHES (accès global) ──
    if (sources.includes('taches')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('taches')
          .select('titre, statut, priorite, date_echeance, description, etablissement:etablissements(nom)')
          .order('date_echeance', { ascending: true })
        if (hasSearch) query = query.ilike('titre', `%${safeQuery}%`);

        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        if (source_filters?.date_from) query = query.gte('date_echeance', source_filters.date_from);
        if (source_filters?.search_query) query = query.ilike('titre', `%${source_filters.search_query}%`);
        const { data } = await query;
        if (data?.length) {
          sourceData['taches'] = data.map(t => {
            const etab = (t.etablissement as any)?.nom || '';
            return `- [${t.statut}/${t.priorite}] ${t.titre}${etab ? ` (${etab})` : ''}${t.date_echeance ? ` — Échéance: ${t.date_echeance}` : ''}`;
          }).join('\n');
        }
      })());
    }

    // ── CONTACTS ──
    if (sources.includes('contacts')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('contacts')
          .select('nom, prenom, fonction, email, telephone, etablissement:etablissements(nom)')
          .limit(30);
        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        const { data } = await query;
        if (data?.length) {
          sourceData['contacts'] = data.map(c => {
            const etab = (c.etablissement as any)?.nom || '';
            return `- ${c.prenom || ''} ${c.nom} — ${c.fonction || 'N/A'}${etab ? ` (${etab})` : ''}${c.email ? ` — ${c.email}` : ''}`;
          }).join('\n');
        }
      })());
    }

    // ── CALENDRIER + ICS LOOKUP ──
    if (sources.includes('calendar')) {
      fetchPromises.push((async () => {
        const [eventsResult, icsResult] = await Promise.all([
          supabase
            .from('calendar_events')
            .select('id, title, description, start_time, end_time, location, status')
            .gte('start_time', source_filters?.date_from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
            .order('start_time', { ascending: false })
            .limit(25),
          supabase
            .from('calendar_invitation_suggestions')
            .select('calendar_uid, event_summary, event_dtstart, event_dtend, event_location, created_calendar_event_id')
            .order('created_at', { ascending: false })
            .limit(50),
        ]);
        const parts: string[] = [];
        if (eventsResult.data?.length) {
          parts.push(eventsResult.data.map(e =>
            `- [ID:${e.id}] ${e.title} — ${new Date(e.start_time).toLocaleDateString('fr-FR')}${e.location ? ` (${e.location})` : ''}${e.description ? `: ${e.description.substring(0, 150)}` : ''}`
          ).join('\n'));
        }
        // ICS UID lookup table for the LLM
        if (icsResult.data?.length) {
          parts.push('\nTable de correspondance ICS UID → Événement:\n' + icsResult.data.map(s =>
            `  ICS_UID="${s.calendar_uid}" → "${s.event_summary}" le ${s.event_dtstart ? new Date(s.event_dtstart).toLocaleDateString('fr-FR') : '?'}${s.event_location ? ` à ${s.event_location}` : ''}${s.created_calendar_event_id ? ` [EVENT_ID:${s.created_calendar_event_id}]` : ''}`
          ).join('\n'));
        }
        if (parts.length) sourceData['calendar'] = parts.join('\n');
      })());
    }

    // ── FACTURES ──
    if (sources.includes('factures')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('factures')
          .select('numero, client_nom, montant_ttc, statut, date_emission, date_echeance')
          .order('date_emission', { ascending: false })
          .limit(50);
        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        if (source_filters?.date_from) query = query.gte('date_emission', source_filters.date_from);
        if (source_filters?.date_to) query = query.lte('date_emission', source_filters.date_to);
        const { data } = await query;
        if (data?.length) {
          sourceData['factures'] = data.map(f =>
            `- ${f.numero} — ${f.client_nom}: ${f.montant_ttc}€ TTC, Statut: ${f.statut}, Émise: ${f.date_emission}${f.date_echeance ? `, Échéance: ${f.date_echeance}` : ''}`
          ).join('\n');
        }
      })());
    }

    // ── DEVIS ──
    if (sources.includes('devis')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('devis')
          .select('numero, client_nom, montant_ttc, statut, date_creation, date_validite')
          .order('date_creation', { ascending: false })
          .limit(30);
        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        if (source_filters?.date_from) query = query.gte('date_creation', source_filters.date_from);
        const { data } = await query;
        if (data?.length) {
          sourceData['devis'] = data.map(d =>
            `- ${d.numero} — ${d.client_nom}: ${d.montant_ttc}€ TTC, Statut: ${d.statut}, Créé: ${d.date_creation}${d.date_validite ? `, Validité: ${d.date_validite}` : ''}`
          ).join('\n');
        }
      })());
    }

    // ── CONTRATS ──
    if (sources.includes('contrats')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('contrats')
          .select('reference, type_contrat, montant_mensuel, statut, date_debut, date_fin, etablissement:etablissements(nom)')
          .order('date_debut', { ascending: false })
          .limit(30);
        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        const { data } = await query;
        if (data?.length) {
          sourceData['contrats'] = data.map(c => {
            const etab = (c.etablissement as any)?.nom || '';
            return `- ${c.reference || 'N/A'} — Type: ${c.type_contrat}, ${c.montant_mensuel || 0}€/mois, Statut: ${c.statut}${etab ? ` (${etab})` : ''}, Du ${c.date_debut || '?'} au ${c.date_fin || '?'}`;
          }).join('\n');
        }
      })());
    }

    // ── AVOIRS ──
    if (sources.includes('avoirs')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('avoirs')
          .select('numero, client_nom, montant_ttc, statut, date_emission, motif')
          .order('date_emission', { ascending: false })
          .limit(30);
        if (source_filters?.etablissement_id) query = query.eq('etablissement_id', source_filters.etablissement_id);
        const { data } = await query;
        if (data?.length) {
          sourceData['avoirs'] = data.map(a =>
            `- ${a.numero} — ${a.client_nom}: ${a.montant_ttc}€ TTC, Statut: ${a.statut}, Motif: ${a.motif}, Émis: ${a.date_emission}`
          ).join('\n');
        }
      })());
    }

    // ── FORUM ──
    if (sources.includes('forum')) {
      fetchPromises.push((async () => {
        const { data } = await supabase
          .from('forum_posts')
          .select('titre, theme, contenu, nombre_commentaires, upvotes, resolu, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        if (data?.length) {
          sourceData['forum'] = data.map(p =>
            `- [${p.theme}] ${p.titre} — ${p.nombre_commentaires || 0} commentaires, ${p.upvotes || 0} votes${p.resolu ? ' ✓ Résolu' : ''}, ${new Date(p.created_at).toLocaleDateString('fr-FR')}`
          ).join('\n');
        }
      })());
    }

    // ── R&D (Epics + Sprints + Stories) ──
    if (sources.includes('rd')) {
      fetchPromises.push((async () => {
        const [epics, sprints, stories] = await Promise.all([
          supabase.from('rd_epics').select('titre, statut, priorite, couleur, projet:rd_projets(nom)').limit(20),
          supabase.from('rd_sprints').select('nom, numero, statut, date_debut, date_fin, velocity_prevue, velocity_reelle').order('numero', { ascending: false }).limit(10),
          supabase.from('rd_user_stories').select('titre, statut, points, priorite').limit(30),
        ]);
        const parts: string[] = [];
        if (epics.data?.length) {
          parts.push('Epics:\n' + epics.data.map(e => `  - [${e.statut}/${e.priorite}] ${e.titre}${(e.projet as any)?.nom ? ` (${(e.projet as any).nom})` : ''}`).join('\n'));
        }
        if (sprints.data?.length) {
          parts.push('Sprints:\n' + sprints.data.map(s => `  - ${s.nom} (#${s.numero}) — ${s.statut}, Vélocité: ${s.velocity_reelle ?? '?'}/${s.velocity_prevue ?? '?'}, ${s.date_debut} → ${s.date_fin}`).join('\n'));
        }
        if (stories.data?.length) {
          const byStatus: Record<string, number> = {};
          let totalPts = 0;
          for (const s of stories.data) {
            byStatus[s.statut] = (byStatus[s.statut] || 0) + 1;
            totalPts += s.points || 0;
          }
          parts.push(`Stories: ${stories.data.length} total, ${totalPts} points — ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
        }
        if (parts.length) sourceData['rd'] = parts.join('\n\n');
      })());
    }

    // ── FORMATIONS ──
    if (sources.includes('formations')) {
      fetchPromises.push((async () => {
        const { data } = await supabase
          .from('formation_sessions')
          .select('titre, type_formation, date_debut, date_fin, statut, nombre_participants, etablissement:etablissements(nom)')
          .order('date_debut', { ascending: false })
          .limit(20);
        if (data?.length) {
          sourceData['formations'] = data.map(f => {
            const etab = (f.etablissement as any)?.nom || '';
            return `- ${f.titre} — ${f.type_formation || 'N/A'}, ${f.date_debut}${f.date_fin ? ` → ${f.date_fin}` : ''}, ${f.nombre_participants || 0} participants, ${f.statut}${etab ? ` (${etab})` : ''}`;
          }).join('\n');
        }
      })());
    }

    // ── RECRUTEMENT ──
    if (sources.includes('recrutement')) {
      fetchPromises.push((async () => {
        const { data } = await supabase
          .from('candidates')
          .select('nom, prenom, poste_vise, statut, source, score_global, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        if (data?.length) {
          sourceData['recrutement'] = data.map(c =>
            `- ${c.prenom || ''} ${c.nom} — Poste: ${c.poste_vise || 'N/A'}, Statut: ${c.statut}, Score: ${c.score_global ?? 'N/A'}, Source: ${c.source || '?'}`
          ).join('\n');
        }
      })());
    }

    // ── SUPPORT TICKETS ──
    if (sources.includes('support')) {
      fetchPromises.push((async () => {
        const { data } = await supabase
          .from('support_tickets')
          .select('numero_ticket, titre, statut, priorite, date_ouverture, etablissement:etablissements(nom)')
          .order('date_ouverture', { ascending: false })
          .limit(30);
        if (data?.length) {
          sourceData['support'] = data.map(t => {
            const etab = (t.etablissement as any)?.nom || '';
            return `- #${t.numero_ticket} [${t.priorite}] ${t.titre} — ${t.statut}${etab ? ` (${etab})` : ''}, Ouvert: ${t.date_ouverture}`;
          }).join('\n');
        }
      })());
    }

    // ── TRÉSORERIE (Revenus + Dépenses) ──
    if (sources.includes('tresorerie')) {
      fetchPromises.push((async () => {
        const [revenus, depenses] = await Promise.all([
          supabase.from('tresorerie_revenus').select('nom, montant, statut, date_prevu, categorie_code').order('date_prevu', { ascending: false }).limit(30),
          supabase.from('tresorerie_depenses').select('nom, montant, statut, date_prevu, categorie_code').order('date_prevu', { ascending: false }).limit(30),
        ]);
        const parts: string[] = [];
        if (revenus.data?.length) {
          const total = revenus.data.reduce((s, r) => s + (r.montant || 0), 0);
          parts.push(`Revenus (${revenus.data.length}, total: ${total.toFixed(2)}€):\n` + revenus.data.map(r =>
            `  - ${r.nom}: ${r.montant}€, ${r.statut}, Prévu: ${r.date_prevu || '?'}${r.categorie_code ? `, Cat: ${r.categorie_code}` : ''}`
          ).join('\n'));
        }
        if (depenses.data?.length) {
          const total = depenses.data.reduce((s, d) => s + (d.montant || 0), 0);
          parts.push(`Dépenses (${depenses.data.length}, total: ${total.toFixed(2)}€):\n` + depenses.data.map(d =>
            `  - ${d.nom}: ${d.montant}€, ${d.statut}, Prévu: ${d.date_prevu || '?'}${d.categorie_code ? `, Cat: ${d.categorie_code}` : ''}`
          ).join('\n'));
        }
        if (parts.length) sourceData['tresorerie'] = parts.join('\n\n');
      })());
    }

    // ── DOCUMENTS GED ──
    if (sources.includes('documents')) {
      fetchPromises.push((async () => {
        let query = supabase
          .from('documents')
          .select('name, mime_type, description, tags, source_type, created_at, file_size_bytes')
          .is('deleted_at', null)
          .eq('is_latest', true)
          .order('created_at', { ascending: false })
          .limit(50);
        if (hasSearch) query = query.or(`name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`);

        if (source_filters?.date_from) query = query.gte('created_at', source_filters.date_from);
        if (source_filters?.date_to) query = query.lte('created_at', source_filters.date_to);
        const { data } = await query;
        if (data?.length) {
          sourceData['documents'] = data.map(d => {
            const size = d.file_size_bytes ? `${(d.file_size_bytes / 1024).toFixed(0)} Ko` : '?';
            const tags = d.tags && (d.tags as string[]).length ? ` [${(d.tags as string[]).join(', ')}]` : '';
            return `- ${d.name} (${d.mime_type || '?'}, ${size}) — Source: ${d.source_type || 'upload'}, ${new Date(d.created_at).toLocaleDateString('fr-FR')}${d.description ? `, ${d.description.substring(0, 100)}` : ''}${tags}`;
          }).join('\n');
        }
      })());
    }

    await Promise.all(fetchPromises);

    // ── Build prompts ──
    const docTypeLabels: Record<DocType, string> = {
      compte_rendu: 'Compte-rendu professionnel',
      plan_action: "Plan d'action structuré avec objectifs, actions, responsables et échéances",
      rapport: 'Rapport détaillé avec analyse, constats et recommandations',
      synthese: 'Note de synthèse concise avec points clés',
      note_interne: 'Note interne informative',
    };

    const toneInstructions: Record<string, string> = {
      formal: 'Adopte un ton professionnel et formel.',
      concise: 'Sois concis et direct. Privilégie les listes à puces.',
      detailed: 'Sois détaillé et exhaustif. Développe chaque point.',
    };

    const systemPrompt = `Tu es un assistant professionnel spécialisé dans la rédaction de documents d'entreprise en français.
Tu génères des documents HTML structurés et bien formatés, prêts à être imprimés ou exportés en PDF.

Règles absolues:
- Génère UNIQUEMENT du HTML valide (pas de markdown)
- Utilise des balises sémantiques: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>, <strong>, <em>
- Inclus une date dans l'en-tête (date du jour: ${new Date().toLocaleDateString('fr-FR')})
- Structure clairement avec des sections numérotées
- ${toneInstructions[tone]}
- N'invente JAMAIS de données: utilise uniquement les informations fournies dans les sources
- Si des données manquent, indique [À COMPLÉTER]
- Ajoute des styles inline pour un rendu propre (font-family: system-ui; line-height: 1.6)
- Pour les données financières, utilise des tableaux HTML bien formatés
- Inclus des liens internes quand pertinent (ex: <a href="/etablissements/ID">Nom</a>)

RÈGLES ICS UID (OBLIGATOIRES):
- Si tu rencontres un ICS UID (identifiant de type "xxx@google.com" ou "xxx@domain"), ne le laisse JAMAIS en texte brut
- Utilise la table de correspondance ICS UID fournie dans les sources calendrier pour résoudre chaque UID
- Si une correspondance existe, génère: <a href="/calendrier?event={EVENT_ID}" class="ics-link" data-ics-uid="{uid}" title="{summary} — {date}">{summary}</a>
- Si aucune correspondance n'existe, génère: <span class="ics-uid" title="ICS: {uid}">{uid court}</span>
- Ne jamais écrire [ICS UID: xxx] en texte brut`;

    let userPrompt = `Génère un document de type: ${docTypeLabels[document_type]}

Titre du document: "${title}"
${instructions ? `\nInstructions spécifiques: ${instructions}` : ''}

=== SOURCES DE DONNÉES ===\n`;

    const sourceLabels: Record<string, string> = {
      emails: '📧 Emails récents',
      etablissements: '🏥 Établissements',
      taches: '✅ Tâches',
      contacts: '👤 Contacts',
      calendar: '📅 Événements calendrier',
      factures: '🧾 Factures',
      devis: '📋 Devis',
      contrats: '📄 Contrats',
      avoirs: '↩️ Avoirs',
      forum: '💬 Forum interne',
      rd: '🔬 R&D / Agile',
      formations: '🎓 Formations',
      recrutement: '👥 Recrutement',
      support: '🎧 Tickets support',
      tresorerie: '💰 Trésorerie',
      documents: '📁 Documents GED',
    };

    for (const [key, value] of Object.entries(sourceData)) {
      userPrompt += `\n--- ${sourceLabels[key] || key} ---\n${value}\n`;
    }

    if (Object.keys(sourceData).length === 0) {
      userPrompt += '\n(Aucune donnée source trouvée — génère un document avec la structure appropriée et des emplacements [À COMPLÉTER])\n';
    }

    // ── Call GPT-5 ──
    const result = await callGpt5Mini(systemPrompt, userPrompt, {
      maxTokens: 8000,
      timeout: 90000,
    });

    return new Response(JSON.stringify({
      success: true,
      html: result.content,
      title,
      document_type,
      sources_used: Object.keys(sourceData),
      usage: result.usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[help-me-create-document] Error:', error);
    return buildErrorResponse('help-me-create-document', error, corsHeaders, 500);
  }
});
