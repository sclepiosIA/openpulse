 /**
  * JARVIS V12.0 - Preemptive Actions
  * 
  * Exécute des actions AVANT que l'utilisateur ne les demande
  */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-function-secret;

interface PreemptiveAction {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: {
    type: string;
    data: Record<string, any>;
    preview?: string;
  };
  context: {
    entityType?: string;
    entityId?: string;
    reason: string;
  };
  expiresAt?: string;
  createdAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication gate — block anonymous access
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    // Service callers (CRON) use service role; user callers keep their JWT (RLS applies)
    const supabase = auth.isServiceCall
      ? createClient(supabaseUrl, serviceKey)
      : createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader! } },
        });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'scan' || !action) {
      // For service calls (CRON), allow targeting any user via body.userId.
      // For user calls, always derive from validated JWT — never trust body.
      const targetUserId = auth.isServiceCall ? (body.userId ?? null) : auth.userId!;
      if (!targetUserId) {
        return new Response(JSON.stringify({ success: false, error: 'userId required for service scan' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Service path uses service-role client; user path needs service-role for cross-table writes
      const writeClient = createClient(supabaseUrl, serviceKey);
      const preemptiveActions = await scanForPreemptiveActions(writeClient, targetUserId);

      for (const pa of preemptiveActions) {
        await storePreemptiveAction(writeClient, targetUserId, pa);
      }

      return new Response(JSON.stringify({
        success: true,
        actionsFound: preemptiveActions.length,
        actions: preemptiveActions
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_pending') {
      const userId = auth.userId;
      if (!userId) throw new Error('Unauthorized');

      const pending = await getPendingActions(supabase, userId);

      return new Response(JSON.stringify({
        success: true,
        actions: pending
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'execute') {
      const userId = auth.userId;
      if (!userId) throw new Error('Unauthorized');

      const { actionId } = body;
      const result = await executePreemptiveAction(supabase, userId, actionId);

      return new Response(JSON.stringify({
        success: true,
        result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'dismiss') {
      const userId = auth.userId;
      if (!userId) throw new Error('Unauthorized');

      const { actionId } = body;
      await dismissPreemptiveAction(supabase, userId, actionId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Unknown action: ${action}`);
 
   } catch (error: unknown) {
     console.error('[jarvis-preemptive-actions] Error:', error);
     return buildErrorResponse('jarvis-preemptive-actions', error, corsHeaders, 500);
  }
 });
 
 async function scanForPreemptiveActions(supabase: any, userId: string): Promise<PreemptiveAction[]> {
   const actions: PreemptiveAction[] = [];
   const now = new Date();
 
   // 1. Check for invoices due for reminder (J+30)
   const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
   const { data: overdueInvoices } = await supabase
     .from('factures')
     .select('id, numero, montant_ttc, client_nom, etablissement_id, date_echeance')
     .eq('statut', 'envoyee')
     .lt('date_echeance', thirtyDaysAgo.toISOString().split('T')[0])
     .limit(10);
 
   for (const invoice of overdueInvoices || []) {
     actions.push({
       id: `preempt_invoice_${invoice.id}`,
       type: 'invoice_reminder',
       title: `Relance facture ${invoice.numero}`,
       description: `${invoice.client_nom} - ${invoice.montant_ttc}€ impayée depuis plus de 30 jours`,
       priority: 'high',
       suggestedAction: {
         type: 'send_email',
         data: {
           etablissement_id: invoice.etablissement_id,
           template: 'invoice_reminder',
           invoice_id: invoice.id
         },
         preview: `Email de relance pour la facture ${invoice.numero}`
       },
       context: {
         entityType: 'facture',
         entityId: invoice.id,
         reason: 'Facture impayée depuis plus de 30 jours'
       },
       expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
       createdAt: now.toISOString()
     });
   }
 
   // 2. Check for tasks without follow-up
   const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
   const { data: staleTasks } = await supabase
     .from('taches')
     .select('id, titre, etablissement_id, created_at')
     .eq('assignee_id', userId)
     .in('statut', ['A faire', 'En cours'])
     .lt('updated_at', sevenDaysAgo.toISOString())
     .limit(10);
 
   for (const task of staleTasks || []) {
     actions.push({
       id: `preempt_task_${task.id}`,
       type: 'task_followup',
       title: `Suivi tâche: ${task.titre.substring(0, 40)}...`,
       description: `Tâche sans mise à jour depuis 7 jours`,
       priority: 'medium',
       suggestedAction: {
         type: 'update_task',
         data: {
           task_id: task.id,
           add_comment: true
         },
         preview: `Ajouter un commentaire de suivi`
       },
       context: {
         entityType: 'tache',
         entityId: task.id,
         reason: 'Aucune mise à jour depuis 7 jours'
       },
       createdAt: now.toISOString()
     });
   }
 
   // 3. Check for prospects going cold
   const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
   const { data: coldProspects } = await supabase
     .from('etablissements')
     .select('id, nom, email_contact, updated_at')
     .eq('statut', 'Prospect')
     .or(`commercial_id.eq.${userId},chef_projet_id.eq.${userId}`)
     .lt('updated_at', fourteenDaysAgo.toISOString())
     .limit(10);
 
   for (const prospect of coldProspects || []) {
     actions.push({
       id: `preempt_prospect_${prospect.id}`,
       type: 'prospect_reactivation',
       title: `Relance prospect: ${prospect.nom}`,
       description: `Aucun contact depuis 14 jours`,
       priority: 'high',
       suggestedAction: {
         type: 'send_email',
         data: {
           etablissement_id: prospect.id,
           template: 'prospect_followup',
           to: prospect.email_contact
         },
         preview: `Email de suivi commercial`
       },
       context: {
         entityType: 'etablissement',
         entityId: prospect.id,
         reason: 'Prospect sans interaction depuis 14 jours'
       },
       createdAt: now.toISOString()
     });
   }
 
   // 4. Upcoming meetings without preparation
   const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
   const { data: upcomingMeetings } = await supabase
     .from('calendar_events')
     .select('id, title, etablissement_id, start_time')
     .gte('start_time', now.toISOString())
     .lte('start_time', tomorrow.toISOString())
     .not('etablissement_id', 'is', null)
     .limit(5);
 
   for (const meeting of upcomingMeetings || []) {
     actions.push({
       id: `preempt_meeting_${meeting.id}`,
       type: 'meeting_preparation',
       title: `Préparer: ${meeting.title.substring(0, 40)}`,
       description: `Réunion demain - préparer le contexte client`,
       priority: 'medium',
       suggestedAction: {
         type: 'generate_briefing',
         data: {
           meeting_id: meeting.id,
           etablissement_id: meeting.etablissement_id
         },
         preview: `Générer un briefing pour la réunion`
       },
       context: {
         entityType: 'calendar_event',
         entityId: meeting.id,
         reason: 'Réunion prévue dans les 24h'
       },
       expiresAt: meeting.start_time,
       createdAt: now.toISOString()
     });
   }
 
   return actions;
 }
 
 async function storePreemptiveAction(supabase: any, userId: string, action: PreemptiveAction): Promise<void> {
   // Check if similar action already exists
   const { data: existing } = await supabase
     .from('jarvis_proactive_alerts')
     .select('id')
     .eq('user_id', userId)
     .eq('type', action.type)
     .eq('action_data->>entityId', action.context.entityId)
     .eq('dismissed', false)
     .single();
 
   if (existing) return; // Don't duplicate
 
   await supabase
     .from('jarvis_proactive_alerts')
     .insert({
       user_id: userId,
       type: action.type,
       priority: action.priority,
       title: action.title,
       message: action.description,
       action_type: action.suggestedAction.type,
       action_data: {
         ...action.suggestedAction.data,
         preview: action.suggestedAction.preview,
         entityType: action.context.entityType,
         entityId: action.context.entityId,
         reason: action.context.reason
       }
     });
 }
 
 async function getPendingActions(supabase: any, userId: string): Promise<PreemptiveAction[]> {
   const { data } = await supabase
     .from('jarvis_proactive_alerts')
     .select('*')
     .eq('user_id', userId)
     .eq('dismissed', false)
     .eq('read', false)
     .order('priority', { ascending: false })
     .order('created_at', { ascending: false })
     .limit(20);
 
   return (data || []).map((alert: any) => ({
     id: alert.id,
     type: alert.type,
     title: alert.title,
     description: alert.message,
     priority: alert.priority,
     suggestedAction: {
       type: alert.action_type,
       data: alert.action_data,
       preview: alert.action_data?.preview
     },
     context: {
       entityType: alert.action_data?.entityType,
       entityId: alert.action_data?.entityId,
       reason: alert.action_data?.reason
     },
     createdAt: alert.created_at
   }));
 }
 
 async function executePreemptiveAction(supabase: any, userId: string, actionId: string): Promise<any> {
   const { data: alert } = await supabase
     .from('jarvis_proactive_alerts')
     .select('*')
     .eq('id', actionId)
     .eq('user_id', userId)
     .single();
 
   if (!alert) throw new Error('Action not found');
 
   // Mark as executed
   await supabase
     .from('jarvis_proactive_alerts')
     .update({ read: true })
     .eq('id', actionId);
 
   // Award points for executing preemptive action
   await supabase.rpc('increment_jarvis_score', {
     p_user_id: userId,
     p_points: 15,
     p_time_saved: 3
   });
 
   return {
     executed: true,
     actionType: alert.action_type,
     actionData: alert.action_data
   };
 }
 
 async function dismissPreemptiveAction(supabase: any, userId: string, actionId: string): Promise<void> {
   await supabase
     .from('jarvis_proactive_alerts')
     .update({ dismissed: true })
     .eq('id', actionId)
     .eq('user_id', userId);
 }