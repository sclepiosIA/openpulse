import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
 /**
  * JARVIS V12.0 - Workflow Learner
  * 
  * Apprend les séquences d'actions répétitives et propose des automatisations
  */
 
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;
 
 interface ActionSequence {
   actions: string[];
   count: number;
   lastOccurred: string;
   avgTimeBetween: number;
 }
 
 interface WorkflowSuggestion {
   id: string;
   name: string;
   description: string;
   actions: string[];
   confidence: number;
   timesSaved: number;
   suggestedAt: string;
 }
 
 // Minimum occurrences to suggest a workflow
 const MIN_OCCURRENCES = 3;
 // Maximum time between actions to be considered a sequence (ms)
 const MAX_SEQUENCE_GAP = 300000; // 5 minutes
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       throw new Error('Missing authorization');
     }
 
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL')!,
       Deno.env.get('SUPABASE_ANON_KEY')!,
       { global: { headers: { Authorization: authHeader } } }
     );
 
     const { data: { user }, error: authError } = await supabase.auth.getUser();
     if (authError || !user) {
       throw new Error('Unauthorized');
     }
 
     const { action } = await req.json();
 
     if (action === 'analyze') {
       // Analyze user's action history to find patterns
       const patterns = await analyzePatterns(supabase, user.id);
       
       return new Response(JSON.stringify({
         success: true,
         patterns,
         suggestions: generateSuggestions(patterns)
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
 
     if (action === 'record') {
       // Record a new action for learning
       const { actionType, actionData, context } = await req.json();
       
       await recordAction(supabase, user.id, actionType, actionData, context);
       
       return new Response(JSON.stringify({ success: true }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
 
     if (action === 'create_workflow') {
       // Create a workflow from a detected pattern
       const { workflowName, actions, description } = await req.json();
       
       const workflow = await createWorkflow(supabase, user.id, workflowName, actions, description);
       
       return new Response(JSON.stringify({
         success: true,
         workflow
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
 
     if (action === 'get_suggestions') {
       // Get workflow suggestions for the user
       const suggestions = await getWorkflowSuggestions(supabase, user.id);
       
       return new Response(JSON.stringify({
         success: true,
         suggestions
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
 
     throw new Error(`Unknown action: ${action}`);
 
   } catch (error: unknown) {
     console.error('[jarvis-workflow-learner] Error:', error);
     return buildErrorResponse('jarvis-workflow-learner', error, corsHeaders, 500);
  }
 });
 
 async function analyzePatterns(supabase: any, userId: string): Promise<ActionSequence[]> {
   // Get recent Jarvis interactions
   const { data: interactions } = await supabase
     .from('jarvis_agent_interactions')
     .select('query, tool_calls, created_at')
     .eq('user_id', userId)
     .order('created_at', { ascending: false })
     .limit(500);
 
   if (!interactions || interactions.length < MIN_OCCURRENCES) {
     return [];
   }
 
   // Extract action sequences
   const sequences = new Map<string, ActionSequence>();
   let currentSequence: string[] = [];
   let lastTimestamp: Date | null = null;
 
   for (const interaction of interactions.reverse()) {
     const timestamp = new Date(interaction.created_at);
     
     // Extract action type from tool_calls or query
     const actionType = extractActionType(interaction);
     if (!actionType) continue;
 
     // Check if this continues the current sequence
     if (lastTimestamp && (timestamp.getTime() - lastTimestamp.getTime()) < MAX_SEQUENCE_GAP) {
       currentSequence.push(actionType);
     } else {
       // Save current sequence if valid
       if (currentSequence.length >= 2) {
         const key = currentSequence.join('→');
         const existing = sequences.get(key);
         if (existing) {
           existing.count++;
           existing.lastOccurred = timestamp.toISOString();
         } else {
           sequences.set(key, {
             actions: [...currentSequence],
             count: 1,
             lastOccurred: timestamp.toISOString(),
             avgTimeBetween: 0
           });
         }
       }
       currentSequence = [actionType];
     }
     
     lastTimestamp = timestamp;
   }
 
   // Filter to sequences that occur frequently
   return Array.from(sequences.values())
     .filter(seq => seq.count >= MIN_OCCURRENCES)
     .sort((a, b) => b.count - a.count)
     .slice(0, 10);
 }
 
 function extractActionType(interaction: any): string | null {
   if (interaction.tool_calls && Array.isArray(interaction.tool_calls)) {
     const firstTool = interaction.tool_calls[0];
     if (firstTool?.name) return firstTool.name;
   }
   
   // Fallback: extract intent from query
   const query = interaction.query?.toLowerCase() || '';
   if (query.includes('email') || query.includes('envoyer')) return 'send_email';
   if (query.includes('tâche') || query.includes('task')) return 'create_task';
   if (query.includes('réunion') || query.includes('meeting')) return 'schedule_meeting';
   if (query.includes('facture') || query.includes('invoice')) return 'manage_invoice';
   if (query.includes('contact')) return 'manage_contact';
   
   return null;
 }
 
 function generateSuggestions(patterns: ActionSequence[]): WorkflowSuggestion[] {
   const actionLabels: Record<string, string> = {
     send_email: 'Envoyer email',
     create_task: 'Créer tâche',
     schedule_meeting: 'Planifier réunion',
     manage_invoice: 'Gérer facture',
     manage_contact: 'Gérer contact',
     update_etablissement: 'Mise à jour établissement'
   };
 
   return patterns.map((pattern, index) => {
     const actionNames = pattern.actions.map(a => actionLabels[a] || a);
     const name = `Workflow ${actionNames[0]} → ${actionNames[actionNames.length - 1]}`;
     
     return {
       id: `wf_suggestion_${index}`,
       name,
       description: `Séquence détectée ${pattern.count} fois: ${actionNames.join(' → ')}`,
       actions: pattern.actions,
       confidence: Math.min(0.95, 0.5 + (pattern.count * 0.1)),
       timesSaved: Math.round(pattern.count * 2), // Estimated minutes saved
       suggestedAt: new Date().toISOString()
     };
   });
 }
 
 async function recordAction(
   supabase: any,
   userId: string,
   actionType: string,
   actionData: any,
   context: any
 ): Promise<void> {
   // Store in jarvis_agent_interactions for learning
   await supabase
     .from('jarvis_agent_interactions')
     .insert({
       user_id: userId,
       agent_id: 'workflow_learner',
       query: `action:${actionType}`,
       tool_calls: [{ name: actionType, arguments: actionData }],
       execution_time_ms: 0,
       created_at: new Date().toISOString()
     });
 }
 
 async function createWorkflow(
   supabase: any,
   userId: string,
   name: string,
   actions: string[],
   description: string
 ): Promise<any> {
   const { data: workflow, error } = await supabase
     .from('jarvis_autopilot_rules')
     .insert({
       user_id: userId,
       name,
       description,
       trigger_type: 'manual',
       trigger_config: { workflow: true, actions },
       action_type: 'workflow_execute',
       action_config: { actions, sequential: true },
       is_active: true,
       priority: 5
     })
     .select()
     .single();
 
   if (error) throw error;
   
   // Award gamification points for creating workflow
   await supabase.rpc('increment_jarvis_score', {
     p_user_id: userId,
     p_points: 50,
     p_time_saved: 5
   });
   
   return workflow;
 }
 
 async function getWorkflowSuggestions(supabase: any, userId: string): Promise<WorkflowSuggestion[]> {
   // Analyze patterns and return suggestions
   const patterns = await analyzePatterns(supabase, userId);
   return generateSuggestions(patterns);
 }