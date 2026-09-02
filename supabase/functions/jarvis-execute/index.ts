/**
 * JARVIS Execute - Exécution des Actions Approuvées
 * 
 * Exécute les actions validées par l'utilisateur:
 * - send_email: via send-email-reply
 * - create_task: insertion directe
 * - update_status: mise à jour entités
 * - close_ticket: fermeture ticket support
 * - schedule_meeting: création événement calendrier
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

interface ExecuteRequest {
  action_id: string;
  user_id: string;
  modifications?: Record<string, unknown>;
}

interface ActionData {
  // send_email
  to?: string;
  cc?: string[];
  subject?: string;
  body?: string;
  thread_id?: string;
  
  // create_task
  titre?: string;
  description?: string;
  priorite?: string;
  assignee_id?: string;
  etablissement_id?: string;
  date_echeance?: string;
  
  // update_status
  entity_type?: string;
  entity_id?: string;
  new_status?: string;
  
  // close_ticket
  ticket_id?: string;
  resolution_note?: string;
  
  // schedule_meeting
  title?: string;
  start_time?: string;
  end_time?: string;
  attendees?: string[];
  location?: string;
  video_conference_url?: string;
  calendar_id?: string;

  // draft_response / summarize / analyze / remind
  content?: string;
  summary?: string;
  analysis?: string;
  reminder_text?: string;
  reminder_date?: string;
  source_type?: string;
  source_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const request: ExecuteRequest = await req.json();

    if (!request.action_id) {
      throw new Error('Missing required field: action_id');
    }

    // Override user_id from JWT for non-service callers (prevent IDOR)
    if (!auth.isServiceCall && auth.userId) {
      request.user_id = auth.userId;
    }
    if (!request.user_id) {
      throw new Error('Missing required field: user_id');
    }

    console.log(`[JARVIS-EXECUTE] Processing action: ${request.action_id}`);

    // Initialisation Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer l'action pending
    const { data: pendingAction, error: fetchError } = await supabase
      .from('jarvis_pending_actions')
      .select('*')
      .eq('id', request.action_id)
      .eq('user_id', request.user_id)
      .single();

    if (fetchError || !pendingAction) {
      throw new Error('Action not found or unauthorized');
    }

    // Vérifier le statut
    if (pendingAction.status !== 'pending' && pendingAction.status !== 'approved') {
      throw new Error(`Action cannot be executed: status is ${pendingAction.status}`);
    }

    // Vérifier l'expiration
    if (new Date(pendingAction.expires_at) < new Date()) {
      await supabase
        .from('jarvis_pending_actions')
        .update({ status: 'expired' })
        .eq('id', request.action_id);
      
      throw new Error('Action has expired');
    }

    // Fusionner les modifications si présentes
    let actionData = pendingAction.proposed_action.data as ActionData;
    if (request.modifications) {
      actionData = { ...actionData, ...request.modifications };
    }

    const actionType = pendingAction.proposed_action.type as string;

    // Exécuter l'action selon son type
    let result: Record<string, unknown> = {};
    let success = true;
    let errorMessage: string | null = null;

    try {
      switch (actionType) {
        case 'send_email':
          result = await executeSendEmail(supabase, supabaseUrl, supabaseKey, actionData, request.user_id);
          break;

        case 'create_task':
          result = await executeCreateTask(supabase, actionData, request.user_id);
          break;

        case 'update_status':
          result = await executeUpdateStatus(supabase, actionData);
          break;

        case 'close_ticket':
          result = await executeCloseTicket(supabase, actionData, request.user_id);
          break;

        case 'schedule_meeting':
          result = await executeScheduleMeeting(supabase, actionData, request.user_id);
          break;

        case 'draft_response':
          result = await executeDraftResponse(actionData);
          break;

        case 'summarize':
          result = await executeSummarize(actionData);
          break;

        case 'analyze':
          result = await executeAnalyze(actionData);
          break;

        case 'remind':
          result = await executeRemind(supabase, actionData, request.user_id);
          break;

        case 'none':
          // Action informative, pas d'exécution nécessaire
          result = { info_acknowledged: true };
          break;

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
    } catch (execError: unknown) {
      success = false;
      errorMessage = execError instanceof Error ? execError.message : 'Execution failed';
      console.error(`[JARVIS-EXECUTE] Execution error:`, execError);
    }

    const executionTime = Date.now() - startTime;

    // Mettre à jour le statut de l'action
    const newStatus = success ? 'executed' : 'error';
    await supabase
      .from('jarvis_pending_actions')
      .update({
        status: newStatus,
        execution_result: result,
        error_message: errorMessage,
        executed_at: new Date().toISOString(),
        user_modification: request.modifications ? JSON.stringify(request.modifications) : null
      })
      .eq('id', request.action_id);

    // Logger dans l'historique
    const kbSources = pendingAction.kb_sources as Array<{ base_type: string }> || [];
    await supabase
      .from('jarvis_action_history')
      .insert({
        user_id: request.user_id,
        action_id: request.action_id,
        action_type: actionType,
        trigger_type: pendingAction.trigger_type,
        confidence_score: pendingAction.proposed_action.confidence_score,
        was_modified: !!request.modifications,
        was_approved: success,
        execution_time_ms: executionTime,
        kb_articles_count: kbSources.length,
        kb_base_types: [...new Set(kbSources.map(s => s.base_type))]
      });

    console.log(`[JARVIS-EXECUTE] ${actionType} completed in ${executionTime}ms - Success: ${success}`);

    return new Response(JSON.stringify({
      success,
      action_id: request.action_id,
      action_type: actionType,
      execution_time_ms: executionTime,
      result,
      error: errorMessage,
    }), {
      status: success ? 200 : 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return buildErrorResponse('jarvis-execute', error, corsHeaders, 500);
  }
});


// ============================================================
// Exécution des actions
// ============================================================

async function executeSendEmail(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseKey: string,
  data: ActionData,
  userId: string
): Promise<Record<string, unknown>> {
  
  if (!data.to || !data.body) {
    throw new Error('Email requires "to" and "body" fields');
  }

  // Appeler send-email-reply
  const response = await fetch(`${supabaseUrl}/functions/v1/send-email-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      thread_id: data.thread_id,
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      body: data.body,
      user_id: userId
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email: ${errorText}`);
  }

  const result = await response.json();
  return { 
    email_sent: true, 
    message_id: result.message_id,
    to: data.to 
  };
}

async function executeCreateTask(
  supabase: ReturnType<typeof createClient>,
  data: ActionData,
  userId: string
): Promise<Record<string, unknown>> {
  
  if (!data.titre) {
    throw new Error('Task requires "titre" field');
  }

  // Récupérer le profile_id depuis le user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  // Get or create default "Jarvis" category (OBLIGATOIRE - categorie_id is NOT NULL)
  let categorieId: string;
  
  // Try to find existing Jarvis category
  const { data: existingCategory } = await supabase
    .from('tache_categories')
    .select('id')
    .eq('nom', 'Jarvis')
    .limit(1)
    .single();
  
  if (existingCategory?.id) {
    categorieId = existingCategory.id;
  } else {
    // Create Jarvis category if not exists
    const { data: newCategory } = await supabase
      .from('tache_categories')
      .insert({ nom: 'Jarvis', couleur: '#6366f1', description: 'Tâches créées par Jarvis' })
      .select('id')
      .single();
    
    if (newCategory?.id) {
      categorieId = newCategory.id;
    } else {
      // Fallback: get any existing category
      const { data: fallbackCategory } = await supabase
        .from('tache_categories')
        .select('id')
        .limit(1)
        .single();
      
      categorieId = fallbackCategory?.id || '00000000-0000-0000-0000-000000000000';
    }
  }

  const { data: task, error } = await supabase
    .from('taches')
    .insert({
      titre: data.titre,
      description: data.description || null,
      priorite: data.priorite || 'moyenne',
      statut: 'a_faire',
      responsable_id: data.assignee_id || profile?.id,
      etablissement_id: data.etablissement_id || null,
      echeance: data.date_echeance || null,
      categorie_id: categorieId
    })
    .select('id, titre')
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return { 
    task_created: true, 
    task_id: task.id,
    titre: task.titre 
  };
}

async function executeUpdateStatus(
  supabase: ReturnType<typeof createClient>,
  data: ActionData
): Promise<Record<string, unknown>> {
  
  if (!data.entity_type || !data.entity_id || !data.new_status) {
    throw new Error('Update requires entity_type, entity_id and new_status');
  }

  let tableName: string;
  let statusColumn: string;

  switch (data.entity_type) {
    case 'etablissement':
      tableName = 'etablissements';
      statusColumn = 'statut';
      break;
    case 'tache':
      tableName = 'taches';
      statusColumn = 'statut';
      break;
    case 'task':
      tableName = 'taches';
      statusColumn = 'statut';
      break;
    default:
      throw new Error(`Unknown entity type: ${data.entity_type}`);
  }

  const { error } = await supabase
    .from(tableName)
    .update({ [statusColumn]: data.new_status })
    .eq('id', data.entity_id);

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  return { 
    status_updated: true, 
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    new_status: data.new_status 
  };
}

async function executeCloseTicket(
  supabase: ReturnType<typeof createClient>,
  data: ActionData,
  userId: string
): Promise<Record<string, unknown>> {
  
  if (!data.ticket_id) {
    throw new Error('Close ticket requires ticket_id');
  }

  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'resolu',
      resolution_note: data.resolution_note || 'Clôturé via Jarvis',
      resolved_at: new Date().toISOString(),
      resolved_by: userId
    })
    .eq('id', data.ticket_id);

  if (error) {
    throw new Error(`Failed to close ticket: ${error.message}`);
  }

  return { 
    ticket_closed: true, 
    ticket_id: data.ticket_id 
  };
}

async function executeScheduleMeeting(
  supabase: ReturnType<typeof createClient>,
  data: ActionData,
  userId: string
): Promise<Record<string, unknown>> {
  
  if (!data.title || !data.start_time || !data.end_time) {
    throw new Error('Meeting requires title, start_time and end_time');
  }

  // Récupérer ou créer le calendrier par défaut de l'utilisateur
  let calendarId = data.calendar_id;
  
  if (!calendarId) {
    const { data: calendar } = await supabase
      .from('calendars')
      .select('id')
      .eq('owner_id', userId)
      .eq('is_default', true)
      .single();

    if (calendar) {
      calendarId = calendar.id;
    } else {
      // Créer un calendrier par défaut
      const { data: newCalendar, error: calError } = await supabase
        .from('calendars')
        .insert({
          owner_id: userId,
          name: 'Mon calendrier',
          is_default: true,
          color: '#3B82F6'
        })
        .select('id')
        .single();

      if (calError) {
        throw new Error(`Failed to create calendar: ${calError.message}`);
      }
      calendarId = newCalendar.id;
    }
  }

  const { data: event, error } = await supabase
    .from('calendar_events')
    .insert({
      calendar_id: calendarId,
      title: data.title,
      start_time: data.start_time,
      end_time: data.end_time,
      location: data.location || null,
      video_conference_url: data.video_conference_url || null,
      created_by: userId,
      status: 'confirmed'
    })
    .select('id, title')
    .single();

  if (error) {
    throw new Error(`Failed to schedule meeting: ${error.message}`);
  }

  return { 
    meeting_scheduled: true, 
    event_id: event.id,
    title: event.title,
    start_time: data.start_time 
  };
}

// ============================================================
// Nouvelles actions IA
// ============================================================

async function executeDraftResponse(data: ActionData): Promise<Record<string, unknown>> {
  // Le brouillon est déjà généré par l'agent, on le retourne simplement
  if (!data.content) {
    throw new Error('Draft response requires content');
  }

  return {
    draft_created: true,
    content: data.content,
    subject: data.subject || null
  };
}

async function executeSummarize(data: ActionData): Promise<Record<string, unknown>> {
  // Le résumé est déjà généré par l'agent
  if (!data.summary) {
    throw new Error('Summary action requires summary content');
  }

  return {
    summary_generated: true,
    summary: data.summary,
    source_type: data.source_type || 'unknown',
    source_id: data.source_id || null
  };
}

async function executeAnalyze(data: ActionData): Promise<Record<string, unknown>> {
  // L'analyse est déjà générée par l'agent
  if (!data.analysis) {
    throw new Error('Analysis action requires analysis content');
  }

  return {
    analysis_completed: true,
    analysis: data.analysis,
    source_type: data.source_type || 'unknown',
    source_id: data.source_id || null
  };
}

async function executeRemind(
  supabase: ReturnType<typeof createClient>,
  data: ActionData,
  userId: string
): Promise<Record<string, unknown>> {
  if (!data.reminder_text) {
    throw new Error('Remind action requires reminder_text');
  }

  // Créer une tâche de rappel
  const reminderDate = data.reminder_date 
    ? new Date(data.reminder_date) 
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // Demain par défaut

  const { data: task, error } = await supabase
    .from('taches')
    .insert({
      titre: `🔔 Rappel: ${data.reminder_text.substring(0, 50)}`,
      description: data.reminder_text,
      priorite: 'moyenne',
      statut: 'A faire',
      assignee_id: userId,
      date_echeance: reminderDate.toISOString(),
      created_by: userId
    })
    .select('id, titre')
    .single();

  if (error) {
    throw new Error(`Failed to create reminder: ${error.message}`);
  }

  return {
    reminder_created: true,
    task_id: task.id,
    reminder_date: reminderDate.toISOString(),
    reminder_text: data.reminder_text
  };
}
