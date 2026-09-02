/**
 * JARVIS Agent - Orchestrateur Principal
 * 
 * Assistant IA autonome proactif avec intégration de la base documentaire.
 * Analyse les événements déclencheurs, enrichit le contexte avec la KB,
 * et propose des actions pertinentes avec sources citées.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Configuration Azure GPT-5
const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

// Types
interface JarvisTrigger {
  type: 'new_email' | 'task_due' | 'calendar_reminder' | 'support_ticket' | 'manual' | 'analyze' | 'summarize';
  user_id: string;
  context: {
    thread_id?: string;
    task_id?: string;
    event_id?: string;
    ticket_id?: string;
    etablissement_id?: string;
    priority?: string;
    custom_prompt?: string;
    conversation_history?: Array<{ role: string; content: string }>;
    quick_action?: 'summarize_emails' | 'prioritize_tasks' | 'check_support' | 'generate_report' | 'analyze_context';
  };
}

interface KBArticle {
  id: string;
  titre: string;
  contenu: string;
  resume: string | null;
  base_type: 'solution' | 'internal';
  dpi: string | null;
  module: string | null;
  tags: string[] | null;
}

interface KBSource {
  article_id: string;
  titre: string;
  base_type: 'solution' | 'internal';
  excerpt: string;
  relevance: number;
  dpi?: string;
  module?: string;
}

interface ProposedAction {
  type: string;
  data: Record<string, unknown>;
  preview_text: string;
  confidence_score: number;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const trigger: JarvisTrigger = await req.json();
    if (!auth.isServiceCall && auth.userId) trigger.user_id = auth.userId;

    // Validation du trigger
    if (!trigger.type || !trigger.user_id) {
      throw new Error('Missing required fields: type and user_id');
    }

    console.log(`[JARVIS] Processing trigger: ${trigger.type} for user: ${trigger.user_id}`);

    // Initialisation Supabase avec service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Charger les préférences utilisateur
    const { data: preferences } = await supabase
      .from('jarvis_preferences')
      .select('*')
      .eq('user_id', trigger.user_id)
      .single();

    // Créer les préférences par défaut si inexistantes
    if (!preferences) {
      await supabase
        .from('jarvis_preferences')
        .insert({ user_id: trigger.user_id });
    }

    const userPrefs = preferences || {
      enabled: true,
      proactive_mode: true,
      confidence_threshold: 0.85,
      quiet_hours_enabled: false,
      triggers_enabled: {
        new_email: true,
        task_due: true,
        calendar_reminder: true,
        support_ticket: true
      }
    };

    // Vérifier si Jarvis est activé
    if (!userPrefs.enabled) {
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'Jarvis is disabled for this user' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier si le trigger est activé
    const triggersEnabled = userPrefs.triggers_enabled as Record<string, boolean>;
    if (trigger.type !== 'manual' && !triggersEnabled[trigger.type]) {
      return new Response(JSON.stringify({ 
        success: false, 
        reason: `Trigger ${trigger.type} is disabled` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier les heures de silence (sauf pour manual)
    if (userPrefs.quiet_hours_enabled && trigger.type !== 'manual') {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const quietStart = userPrefs.quiet_hours_start;
      const quietEnd = userPrefs.quiet_hours_end;
      
      if (currentTime >= quietStart || currentTime < quietEnd) {
        console.log('[JARVIS] Quiet hours active, skipping');
        return new Response(JSON.stringify({ 
          success: false, 
          reason: 'Quiet hours active' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Collecter le contexte CRM
    const crmContext = await collectCRMContext(supabase, trigger);

    // 3. Rechercher dans la base documentaire
    const kbResults = await searchKnowledgeBase(supabase, trigger, crmContext);

    // 4. Construire le prompt et appeler GPT-5
    const proposedAction = await analyzeWithGPT5(trigger, crmContext, kbResults, userPrefs);

    if (!proposedAction) {
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'No action proposed by AI' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. Persister l'action dans jarvis_pending_actions
    const { data: pendingAction, error: insertError } = await supabase
      .from('jarvis_pending_actions')
      .insert({
        user_id: trigger.user_id,
        trigger_type: trigger.type,
        trigger_entity_id: trigger.context.thread_id || trigger.context.task_id || trigger.context.ticket_id || trigger.context.event_id,
        trigger_entity_type: getTriggerEntityType(trigger.type),
        context: crmContext,
        proposed_action: proposedAction,
        kb_sources: kbResults.sources,
        ai_response: proposedAction.reasoning,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[JARVIS] Insert error:', insertError);
      throw new Error('Failed to persist pending action');
    }

    // 6. Envoyer notification push enrichie
    await sendJarvisNotification(supabase, trigger.user_id, pendingAction);

    const processingTime = Date.now() - startTime;
    console.log(`[JARVIS] Action proposed in ${processingTime}ms: ${proposedAction.type}`);

    return new Response(JSON.stringify({
      success: true,
      action_id: pendingAction.id,
      proposed_action: proposedAction,
      kb_sources: kbResults.sources,
      processing_time_ms: processingTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[JARVIS] Error:', errorMessage);
    
    return buildErrorResponse('jarvis-agent', error, corsHeaders, 500);
  }
});

// ============================================================
// Fonctions utilitaires
// ============================================================

function getTriggerEntityType(triggerType: string): string {
  switch (triggerType) {
    case 'new_email': return 'email_thread';
    case 'task_due': return 'tache';
    case 'calendar_reminder': return 'calendar_event';
    case 'support_ticket': return 'support_ticket';
    default: return 'manual';
  }
}

async function collectCRMContext(
  supabase: ReturnType<typeof createClient>,
  trigger: JarvisTrigger
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  try {
    // Récupérer l'établissement si disponible
    if (trigger.context.etablissement_id) {
      const { data: etablissement } = await supabase
        .from('etablissements')
        .select('id, nom, statut, ville, dpi, module_actif')
        .eq('id', trigger.context.etablissement_id)
        .single();
      
      if (etablissement) {
        context.etablissement = etablissement;
      }
    }

    // Selon le type de trigger
    switch (trigger.type) {
      case 'new_email':
        if (trigger.context.thread_id) {
          // Récupérer le thread email
          const { data: thread } = await supabase
            .from('email_threads')
            .select(`
              id, subject, ai_generated_title, category, tags,
              etablissement_id, groupe_id, partenaire_id,
              etablissements(id, nom, statut, dpi)
            `)
            .eq('id', trigger.context.thread_id)
            .single();

          if (thread) {
            context.email_thread = {
              id: thread.id,
              subject: thread.ai_generated_title || thread.subject,
              category: thread.category,
              tags: thread.tags
            };

            // Si pas d'établissement mais thread lié
            if (!context.etablissement && thread.etablissements) {
              context.etablissement = thread.etablissements;
            }
          }

          // Récupérer les derniers messages
          const { data: messages } = await supabase
            .from('email_messages')
            .select('id, from_address, to_addresses, body_text, sent_at')
            .eq('thread_id', trigger.context.thread_id)
            .order('sent_at', { ascending: false })
            .limit(5);

          if (messages && messages.length > 0) {
            context.email_messages = messages.map(m => ({
              id: m.id,
              from_address: m.from_address,
              content_preview: (m.body_text || '').substring(0, 500),
              sent_at: m.sent_at
            }));
          }
        }
        break;

      case 'task_due':
        if (trigger.context.task_id) {
          const { data: task } = await supabase
            .from('taches')
            .select(`
              id, titre, description, priorite, statut, date_echeance,
              etablissement_id, etablissements(id, nom, statut, dpi)
            `)
            .eq('id', trigger.context.task_id)
            .single();

          if (task) {
            context.task = {
              id: task.id,
              titre: task.titre,
              description: task.description,
              priorite: task.priorite,
              statut: task.statut,
              date_echeance: task.date_echeance
            };

            if (!context.etablissement && task.etablissements) {
              context.etablissement = task.etablissements;
            }
          }
        }
        break;

      case 'support_ticket':
        if (trigger.context.ticket_id) {
          const { data: ticket } = await supabase
            .from('support_tickets')
            .select(`
              id, titre, description, priority, status,
              etablissement_id, etablissements(id, nom, statut, dpi)
            `)
            .eq('id', trigger.context.ticket_id)
            .single();

          if (ticket) {
            context.ticket = {
              id: ticket.id,
              titre: ticket.titre,
              description: ticket.description,
              priority: ticket.priority,
              status: ticket.status
            };

            if (!context.etablissement && ticket.etablissements) {
              context.etablissement = ticket.etablissements;
            }
          }
        }
        break;

      case 'calendar_reminder':
        if (trigger.context.event_id) {
          const { data: event } = await supabase
            .from('calendar_events')
            .select('id, title, description, start_time, end_time, location, video_conference_url, etablissement_id')
            .eq('id', trigger.context.event_id)
            .single();

          if (event) {
            context.calendar_event = event;
          }
        }
        break;

      case 'manual':
        if (trigger.context.custom_prompt) {
          context.custom_prompt = trigger.context.custom_prompt;
        }
        
        // AUTO-FETCH: Detect email/task/support requests and fetch relevant data
        const prompt = (trigger.context.custom_prompt || '').toLowerCase();
        const quickAction = trigger.context.quick_action;
        
        // Email requests
        const isEmailRequest = 
          quickAction === 'summarize_emails' ||
          prompt.includes('email') || 
          prompt.includes('mail') ||
          prompt.includes('message') ||
          prompt.includes('résume') ||
          prompt.includes('resume');
        
        if (isEmailRequest) {
          console.log('[JARVIS] Detected email request, fetching unread threads...');
          const { data: unreadThreads } = await supabase
            .from('email_threads')
            .select(`
              id, subject, ai_generated_title, category, last_message_date,
              email_messages(id, from_address, body_text, is_read, sent_at)
            `)
            .gt('unread_count', 0)
            .eq('is_deleted', false)
            .order('last_message_date', { ascending: false })
            .limit(10);
          
          if (unreadThreads && unreadThreads.length > 0) {
            // Filter to get threads with unread messages
            const threadsWithUnread = unreadThreads.filter(t => 
              t.email_messages?.some((m: { is_read: boolean }) => !m.is_read)
            );
            
            context.unread_threads = threadsWithUnread.map(t => ({
              id: t.id,
              subject: t.ai_generated_title || t.subject,
              category: t.category,
              message_count: t.email_messages?.length || 0,
              last_from: t.email_messages?.[0]?.from_address,
              preview: t.email_messages?.[0]?.body_text?.substring(0, 300)
            }));
            context.unread_count = threadsWithUnread.length;
            context.total_recent_threads = unreadThreads.length;
            console.log(`[JARVIS] Found ${threadsWithUnread.length} threads with unread messages`);
          }
        }
        
        // Task requests
        const isTaskRequest =
          quickAction === 'prioritize_tasks' ||
          prompt.includes('tâche') ||
          prompt.includes('tache') ||
          prompt.includes('priorit') ||
          prompt.includes('todo');
        
        if (isTaskRequest) {
          console.log('[JARVIS] Detected task request, fetching pending tasks...');
          const { data: pendingTasks } = await supabase
            .from('taches')
            .select(`
              id, titre, description, priorite, statut, date_echeance,
              etablissements(id, nom)
            `)
            .in('statut', ['en_attente', 'en_cours'])
            .order('date_echeance', { ascending: true, nullsFirst: false })
            .limit(15);
          
          if (pendingTasks && pendingTasks.length > 0) {
            context.pending_tasks = pendingTasks.map(t => ({
              id: t.id,
              titre: t.titre,
              priorite: t.priorite,
              statut: t.statut,
              date_echeance: t.date_echeance,
              etablissement: (t.etablissements as { nom?: string })?.nom
            }));
            context.tasks_count = pendingTasks.length;
            console.log(`[JARVIS] Found ${pendingTasks.length} pending tasks`);
          }
        }
        
        // Support ticket requests
        const isSupportRequest =
          quickAction === 'check_support' ||
          prompt.includes('ticket') ||
          prompt.includes('support') ||
          prompt.includes('urgent');
        
        if (isSupportRequest) {
          console.log('[JARVIS] Detected support request, fetching open tickets...');
          const { data: openTickets } = await supabase
            .from('support_tickets')
            .select(`
              id, titre, description, priority, status, created_at,
              etablissements(id, nom)
            `)
            .in('status', ['open', 'in_progress'])
            .order('priority', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (openTickets && openTickets.length > 0) {
            context.open_tickets = openTickets.map(t => ({
              id: t.id,
              titre: t.titre,
              priority: t.priority,
              status: t.status,
              created_at: t.created_at,
              etablissement: (t.etablissements as { nom?: string })?.nom
            }));
            context.tickets_count = openTickets.length;
            console.log(`[JARVIS] Found ${openTickets.length} open tickets`);
          }
        }
        break;
    }

    // Récupérer les contacts liés à l'établissement
    if (context.etablissement) {
      const etab = context.etablissement as { id: string };
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, nom, prenom, email, fonction, telephone')
        .eq('etablissement_id', etab.id)
        .limit(5);

      if (contacts && contacts.length > 0) {
        context.contacts = contacts;
      }
    }

  } catch (error) {
    console.error('[JARVIS] Error collecting CRM context:', error);
  }

  return context;
}

async function searchKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  trigger: JarvisTrigger,
  crmContext: Record<string, unknown>
): Promise<{ articles: KBArticle[]; sources: KBSource[] }> {
  const sources: KBSource[] = [];
  const articles: KBArticle[] = [];

  try {
    // Déterminer le DPI et module de l'établissement
    const etablissement = crmContext.etablissement as { dpi?: string; module_actif?: string } | undefined;
    const dpi = etablissement?.dpi;

    // Construire une requête de recherche à partir du contexte
    let searchQuery = '';
    if (trigger.context.custom_prompt) {
      searchQuery = trigger.context.custom_prompt;
    } else if (crmContext.email_thread) {
      const thread = crmContext.email_thread as { subject?: string };
      searchQuery = thread.subject || '';
    } else if (crmContext.task) {
      const task = crmContext.task as { titre?: string };
      searchQuery = task.titre || '';
    } else if (crmContext.ticket) {
      const ticket = crmContext.ticket as { titre?: string };
      searchQuery = ticket.titre || '';
    }

    // Les PAGES du wiki remplacent les articles de la base de connaissances.
    //
    // Ce bloc interrogeait kb_articles (deux fois) et kb_faqs, tables retirees
    // avec le module. Les laisser aurait rendu l'assistant muet EN SILENCE :
    // une requete sur une table absente rend une erreur que ce code ignore
    // (`const { data } = await ...` sans lecture de `error`), donc `data` vaut
    // null, la boucle ne s'execute pas, et l'assistant repond sans source sans
    // que rien ne le signale.
    //
    // La source devient `documents` limitee aux pages — celles dont `content`
    // n'est pas nul. La recherche porte sur l'index plein texte quand une
    // question est posee, sinon sur les pages les plus recentes.
    let pagesQuery = supabase
      .from('documents')
      .select('id, name, description, content')
      .not('content', 'is', null)
      .is('deleted_at', null)
      .limit(20);

    if (searchQuery) {
      // Configuration NOMMEE et NON qualifiee par son schema : sans elle
      // PostgREST emploie pg_catalog.english alors que la colonne est
      // construite en francais sans accents ; avec le prefixe « public. » il
      // rend 400.
      pagesQuery = pagesQuery.textSearch('recherche', searchQuery, {
        type: 'websearch', config: 'francais_sans_accent',
      });
    } else {
      pagesQuery = pagesQuery.order('updated_at', { ascending: false });
    }

    const { data: pages, error: pagesError } = await pagesQuery;
    if (pagesError) {
      console.error('[jarvis-agent] lecture des pages impossible :', pagesError.message);
    }

    // Combiner tous les résultats
    const allResults: Array<{
      id: string;
      title: string;
      content: string;
      base_type: string;
      dpi?: string;
      module?: string;
      type: 'article' | 'faq';
    }> = [];

    if (pages) {
      for (const page of pages) {
        allResults.push({
          id: page.id,
          title: page.name,
          // Les balises HTML sont retirees : elles noieraient le classement
          // semantique sous des mots qui n'en sont pas.
          content: (page.description || page.content || '').replace(/<[^>]*>/g, ' ').trim(),
          base_type: 'solution',
          type: 'article',
        });
      }
    }

    // Si on a une query de recherche et Azure est configuré, faire un ranking sémantique
    if (searchQuery && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY && allResults.length > 5) {
      try {
        const rankedResults = await rankResultsWithAI(searchQuery, allResults);
        
        for (const result of rankedResults.slice(0, 10)) {
          sources.push({
            article_id: result.id,
            titre: result.title,
            base_type: result.base_type as 'solution' | 'internal',
            excerpt: result.content.substring(0, 300),
            relevance: result.relevance || 0.7,
            dpi: result.dpi,
            module: result.module
          });
        }
      } catch (rankError) {
        console.warn('[JARVIS] Semantic ranking failed, using default order:', rankError);
        // Fallback: ajouter les sources sans ranking
        for (const result of allResults.slice(0, 10)) {
          sources.push({
            article_id: result.id,
            titre: result.title,
            base_type: result.base_type as 'solution' | 'internal',
            excerpt: result.content.substring(0, 300),
            relevance: 0.7,
            dpi: result.dpi,
            module: result.module
          });
        }
      }
    } else {
      // Sans recherche sémantique, ajouter les sources par ordre de popularité
      for (const result of allResults.slice(0, 10)) {
        sources.push({
          article_id: result.id,
          titre: result.title,
          base_type: result.base_type as 'solution' | 'internal',
          excerpt: result.content.substring(0, 300),
          relevance: 0.7,
          dpi: result.dpi,
          module: result.module
        });
      }
    }

    console.log(`[JARVIS] Found ${sources.length} KB sources (${articles.length} articles) - Query: "${searchQuery.substring(0, 50)}..."`);

  } catch (error) {
    console.error('[JARVIS] Error searching KB:', error);
  }

  return { articles, sources };
}

// Ranking sémantique avec GPT-5
async function rankResultsWithAI(
  query: string,
  results: Array<{ id: string; title: string; content: string; base_type: string; dpi?: string; module?: string }>
): Promise<Array<{ id: string; title: string; content: string; base_type: string; dpi?: string; module?: string; relevance: number }>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const prompt = `Tu dois classer ces articles par pertinence pour la requête: "${query}"

Articles:
${results.map((r, i) => `[${i}] ${r.title}: ${r.content.substring(0, 150)}...`).join('\n')}

Retourne UNIQUEMENT un JSON: { "ranking": [{"index": 0, "relevance": 0.95}, ...] }
Classe du plus pertinent (relevance proche de 1) au moins pertinent (proche de 0).`;

    const response = await fetch(AZURE_OPENAI_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY!,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Tu es un assistant qui classe des articles par pertinence. Retourne uniquement du JSON.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 500,
        reasoning_effort: 'low',
        verbosity: 'low',
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const { ranking } = JSON.parse(content);
      if (Array.isArray(ranking)) {
        return ranking
          .filter((r: { index: number }) => r.index >= 0 && r.index < results.length)
          .map((r: { index: number; relevance: number }) => ({
            ...results[r.index],
            relevance: r.relevance || 0.5
          }));
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }

  return results.map(r => ({ ...r, relevance: 0.5 }));
}

async function analyzeWithGPT5(
  trigger: JarvisTrigger,
  crmContext: Record<string, unknown>,
  kbResults: { articles: KBArticle[]; sources: KBSource[] },
  userPrefs: Record<string, unknown>
): Promise<ProposedAction | null> {
  
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    console.error('[JARVIS] Azure OpenAI not configured');
    return null;
  }

  // Construire le prompt système
  const systemPrompt = buildSystemPrompt(userPrefs);
  
  // Construire le prompt utilisateur avec contexte
  const userPrompt = buildUserPrompt(trigger, crmContext, kbResults);

  // Appel GPT-5 avec AbortController (90s timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

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
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 3000,
        reasoning_effort: 'high',
        verbosity: 'medium',
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Retry sur rate limit (429)
    if (response.status === 429) {
      console.warn('[JARVIS] Rate limited (429), retrying in 1s...');
      await new Promise(r => setTimeout(r, 1000));
      
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), 90000);
      
      const retryResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 3000,
          reasoning_effort: 'high',
          verbosity: 'medium',
          response_format: { type: 'json_object' }
        }),
        signal: retryController.signal,
      });
      
      clearTimeout(retryTimeoutId);
      
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        console.error('[JARVIS] Azure API error after retry:', retryResponse.status, errorText);
        return null;
      }
      
      const retryData = await retryResponse.json();
      return parseGPT5Response(retryData);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JARVIS] Azure API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return parseGPT5Response(data);

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[JARVIS] Azure request timeout (90s)');
    } else {
      console.error('[JARVIS] Azure request error:', error);
    }
    return null;
  }
}

function buildSystemPrompt(userPrefs: Record<string, unknown>): string {
  const formalTone = userPrefs.formal_tone !== false;
  const toneStyle = formalTone 
    ? 'Professionnel et courtois ("Bien sûr, Monsieur/Madame")'
    : 'Amical mais professionnel';

  return `Tu es JARVIS, assistant IA professionnel de haut niveau pour OpenPulse.
Ton rôle est d'anticiper les besoins et de préparer des actions pertinentes.

PERSONNALITÉ:
- ${toneStyle}
- Proactif mais jamais intrusif
- Précis et factuel, toujours sourcé
- Tu t'adresses à l'utilisateur comme un assistant personnel de confiance

CONTEXTE DISPONIBLE:
1. DONNÉES CRM: Établissement, contacts, historique, tâches en cours
2. BASE SOLUTION: Documentation produit, guides DPI, FAQs clients
3. BASE INTERNE: Procédures, best practices, troubleshooting

RÈGLES IMPÉRATIVES:
- TOUJOURS citer les sources documentaires utilisées avec leurs IDs
- TOUJOURS expliquer ton raisonnement de manière concise
- JAMAIS inventer d'information non présente dans le contexte fourni
- Score de confiance entre 0.0 et 1.0 basé sur la qualité des sources et la clarté du contexte
- Si une conversation précédente est fournie, tiens-en compte pour la cohérence

TYPES D'ACTIONS POSSIBLES:
- send_email: Préparer un email de réponse (to, cc, subject, body, thread_id)
- create_task: Créer une nouvelle tâche (titre, description, priorite, date_echeance, etablissement_id)
- update_status: Mettre à jour un statut (entity_type, entity_id, new_status)
- close_ticket: Clôturer un ticket support (ticket_id, resolution_note)
- schedule_meeting: Planifier une réunion (title, start_time, end_time, location, attendees)
- draft_response: Rédiger une réponse sans l'envoyer (draft_text, context)
- summarize: Résumer des informations (summary_text, key_points)
- analyze: Analyser une situation et donner des recommandations (analysis, recommendations)
- remind: Créer un rappel intelligent (reminder_text, remind_at, context)

FORMAT DE RÉPONSE (JSON strict):
{
  "action_type": "send_email|create_task|update_status|close_ticket|schedule_meeting|draft_response|summarize|analyze|remind|none",
  "action_data": {
    // Données spécifiques à l'action
  },
  "preview_text": "Description claire et concise de l'action proposée en 1-2 phrases",
  "confidence_score": 0.85,
  "reasoning": "Explication du raisonnement en 2-3 phrases",
  "sources_used": [
    { "article_id": "...", "titre": "...", "base_type": "solution|internal", "relevance": "pourquoi cette source est pertinente" }
  ],
  "follow_up_suggestions": ["suggestion 1", "suggestion 2"]
}

Si l'utilisateur pose une question générale sans besoin d'action:
- action_type: "none"
- preview_text: Ta réponse conversationnelle
- reasoning: Pourquoi tu réponds ainsi

Si aucune action n'est pertinente, retourne action_type: "none" avec une explication.`;
}

function buildUserPrompt(
  trigger: JarvisTrigger,
  crmContext: Record<string, unknown>,
  kbResults: { articles: KBArticle[]; sources: KBSource[] }
): string {
  let prompt = `## ÉVÉNEMENT DÉCLENCHEUR\nType: ${trigger.type}\n`;

  // Quick actions préformatées
  if (trigger.context.quick_action) {
    const quickActionPrompts: Record<string, string> = {
      summarize_emails: 'Résume mes emails non lus et identifie les actions importantes à prendre.',
      prioritize_tasks: 'Analyse mes tâches en cours et aide-moi à prioriser. Quelles sont les plus urgentes ?',
      check_support: 'Y a-t-il des tickets support urgents nécessitant mon attention immédiate ?',
      generate_report: "Prépare un rapport d'activité récapitulant mes actions récentes.",
      analyze_context: 'Analyse le contexte actuel et suggère les prochaines étapes optimales.'
    };
    prompt += `Demande utilisateur: ${quickActionPrompts[trigger.context.quick_action] || trigger.context.quick_action}\n`;
  } else if (trigger.context.custom_prompt) {
    prompt += `Demande utilisateur: ${trigger.context.custom_prompt}\n`;
  }

  // Historique de conversation si présent
  if (trigger.context.conversation_history && trigger.context.conversation_history.length > 0) {
    prompt += `\n## HISTORIQUE DE CONVERSATION RÉCENT\n`;
    trigger.context.conversation_history.forEach((msg, i) => {
      prompt += `${msg.role === 'user' ? 'Utilisateur' : 'Jarvis'}: ${msg.content}\n`;
    });
    prompt += `\n`;
  }

  prompt += `\n## CONTEXTE CRM\n`;
  prompt += JSON.stringify(crmContext, null, 2);

  prompt += `\n\n## BASE DOCUMENTAIRE DISPONIBLE\n`;
  
  // Articles Solution
  const solutionSources = kbResults.sources.filter(s => s.base_type === 'solution');
  if (solutionSources.length > 0) {
    prompt += `\n### BASE SOLUTION (Documentation produit)\n`;
    solutionSources.slice(0, 5).forEach((source, i) => {
      prompt += `\n[SOL-${i+1}] ${source.titre} (ID: ${source.article_id})`;
      if (source.relevance) prompt += ` - Pertinence: ${Math.round(source.relevance * 100)}%`;
      prompt += `\n`;
      if (source.dpi) prompt += `DPI: ${source.dpi} `;
      if (source.module) prompt += `Module: ${source.module}`;
      if (source.dpi || source.module) prompt += `\n`;
      prompt += `${source.excerpt}...\n`;
    });
  }

  // Articles Internes
  const internalSources = kbResults.sources.filter(s => s.base_type === 'internal');
  if (internalSources.length > 0) {
    prompt += `\n### BASE INTERNE (Procédures équipe)\n`;
    internalSources.slice(0, 5).forEach((source, i) => {
      prompt += `\n[INT-${i+1}] ${source.titre} (ID: ${source.article_id})`;
      if (source.relevance) prompt += ` - Pertinence: ${Math.round(source.relevance * 100)}%`;
      prompt += `\n${source.excerpt}...\n`;
    });
  }

  prompt += `\n## INSTRUCTIONS\nAnalyse le contexte et la documentation disponible. Propose l'action la plus pertinente avec un score de confiance basé sur la qualité des informations disponibles.`;
  
  if (trigger.type === 'manual' && trigger.context.custom_prompt) {
    prompt += `\nSi la demande est conversationnelle et ne nécessite pas d'action concrète, réponds de manière utile via preview_text avec action_type: "none".`;
  }

  return prompt;
}

function parseGPT5Response(data: Record<string, unknown>): ProposedAction | null {
  try {
    const content = (data.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content;
    
    if (!content) {
      console.error('[JARVIS] No content in GPT-5 response');
      return null;
    }

    const parsed = JSON.parse(content);
    
    // FIXED: Return conversational action instead of null for 'none' type
    // This allows Jarvis to respond to questions without creating actionable tasks
    if (parsed.action_type === 'none') {
      console.log('[JARVIS] Conversational response:', parsed.preview_text?.substring(0, 100));
      return {
        type: 'none',
        data: { 
          response_text: parsed.preview_text,
          is_conversational: true 
        },
        preview_text: parsed.preview_text || "Je n'ai pas trouvé d'action spécifique à proposer.",
        confidence_score: parsed.confidence_score || 0.9,
        reasoning: parsed.reasoning || 'Réponse conversationnelle'
      };
    }

    return {
      type: parsed.action_type,
      data: parsed.action_data || {},
      preview_text: parsed.preview_text || 'Action proposée par Jarvis',
      confidence_score: parsed.confidence_score || 0.5,
      reasoning: parsed.reasoning || 'Analyse automatique'
    };

  } catch (error) {
    console.error('[JARVIS] Error parsing GPT-5 response:', error);
    return null;
  }
}

async function sendJarvisNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pendingAction: Record<string, unknown>
): Promise<void> {
  try {
    const action = pendingAction.proposed_action as ProposedAction;
    const sources = pendingAction.kb_sources as KBSource[];

    // Appeler send-push-notification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        title: `🤖 JARVIS - ${getActionTitle(action.type)}`,
        body: action.preview_text,
        data: {
          type: 'jarvis_action',
          action_id: pendingAction.id,
          confidence: action.confidence_score,
          sources_count: sources?.length || 0,
          trigger_type: pendingAction.trigger_type
        },
        tag: `jarvis-${pendingAction.id}`,
        app_scope: 'main'
      })
    });

    console.log('[JARVIS] Push notification sent');

  } catch (error) {
    console.error('[JARVIS] Error sending notification:', error);
  }
}

function getActionTitle(actionType: string): string {
  switch (actionType) {
    case 'send_email': return 'Email préparé';
    case 'create_task': return 'Tâche suggérée';
    case 'update_status': return 'Mise à jour proposée';
    case 'close_ticket': return 'Clôture ticket';
    case 'schedule_meeting': return 'Réunion à planifier';
    default: return 'Nouvelle action';
  }
}
