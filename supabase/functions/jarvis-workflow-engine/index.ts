/**
 * JARVIS 9.0 - Moteur de Workflows Automatisés
 * 
 * Exécute des chaînes d'actions programmables :
 * - Workflows prédéfinis (Onboarding, Clôture mensuelle, Suivi prospect)
 * - Workflows personnalisés créés par l'utilisateur
 * - Exécution séquentielle avec conditions et branchements
 * - Rollback automatique en cas d'échec
 * - Templates de workflows par cas d'usage
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { 
  WORKFLOW_TEMPLATES, 
  findWorkflowByCommand, 
  getWorkflowsByCategory,
  generateWorkflowCatalog 
} from "./workflow-templates.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  params: Record<string, unknown>;
  condition?: {
    type: 'always' | 'if_success' | 'if_failure' | 'custom';
    expression?: string;
  };
  on_failure?: 'stop' | 'continue' | 'rollback';
  rollback_action?: string;
  // V11.0: Support DAG avec parallélisme
  depends_on?: string[]; // IDs des steps dont celui-ci dépend
  parallel_with?: string[]; // IDs des steps à exécuter en parallèle
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers?: {
    type: 'manual' | 'schedule' | 'event';
    config?: Record<string, unknown>;
  };
  // V11.0: Stratégie d'exécution
  execution_strategy?: 'sequential' | 'parallel' | 'dag';
}

interface WorkflowExecution {
  workflow_id: string;
  workflow_name: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  steps_executed: {
    step_id: string;
    step_name: string;
    status: 'success' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
    duration_ms: number;
    parallel_group?: string; // V11.0: Groupe d'exécution parallèle
  }[];
  total_duration_ms: number;
  // V11.0: Métriques de parallélisme
  parallel_groups_count?: number;
  max_parallelism?: number;
}

// Workflows prédéfinis
const PREDEFINED_WORKFLOWS: Record<string, Workflow> = {
  'onboarding_client': {
    id: 'onboarding_client',
    name: 'Onboarding Client Complet',
    description: 'Processus complet d\'onboarding d\'un nouveau client',
    steps: [
      {
        id: 'create_etab',
        name: 'Créer l\'établissement',
        action: 'create_entity',
        params: { entity_type: 'etablissement' },
        on_failure: 'stop',
      },
      {
        id: 'add_contacts',
        name: 'Ajouter les contacts',
        action: 'create_entity',
        params: { entity_type: 'contact', link_to_prev: true },
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
      {
        id: 'create_tasks',
        name: 'Créer les tâches de déploiement',
        action: 'create_tasks_from_template',
        params: { template: 'deploiement' },
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
      {
        id: 'send_welcome',
        name: 'Envoyer email de bienvenue',
        action: 'send_email',
        params: { template: 'welcome_client' },
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
      {
        id: 'schedule_kickoff',
        name: 'Planifier le kickoff',
        action: 'schedule_meeting',
        params: { type: 'kickoff', days_from_now: 7 },
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
    ],
  },

  'cloture_mensuelle': {
    id: 'cloture_mensuelle',
    name: 'Clôture Mensuelle',
    description: 'Processus de clôture comptable mensuelle',
    steps: [
      {
        id: 'sync_qonto',
        name: 'Synchroniser Qonto',
        action: 'sync_qonto_transactions',
        params: { days_back: 35 },
        on_failure: 'continue',
      },
      {
        id: 'reconcile',
        name: 'Rapprocher les factures',
        action: 'reconcile_invoices',
        params: {},
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
      {
        id: 'generate_report',
        name: 'Générer rapport trésorerie',
        action: 'generate_treasury_report',
        params: { period: 'last_month' },
        condition: { type: 'always' },
        on_failure: 'continue',
      },
      {
        id: 'notify_admins',
        name: 'Notifier les admins',
        action: 'send_notification',
        params: { role: 'admin', subject: 'Rapport mensuel disponible' },
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
    ],
  },

  'suivi_prospect': {
    id: 'suivi_prospect',
    name: 'Suivi Prospect Automatique',
    description: 'Relances automatiques pour les prospects',
    steps: [
      {
        id: 'check_status',
        name: 'Vérifier le statut',
        action: 'query_database',
        params: { table: 'etablissements', filters: [{ column: 'statut', operator: 'eq', value: 'Prospect' }] },
        on_failure: 'stop',
      },
      {
        id: 'check_last_contact',
        name: 'Vérifier dernier contact',
        action: 'calculate_days_since_contact',
        params: {},
        condition: { type: 'if_success' },
        on_failure: 'stop',
      },
      {
        id: 'send_relance_3j',
        name: 'Relance J+3',
        action: 'send_email',
        params: { template: 'prospect_relance_soft', condition: 'days_since_contact >= 3 && days_since_contact < 7' },
        condition: { type: 'custom', expression: 'days >= 3 && days < 7' },
        on_failure: 'continue',
      },
      {
        id: 'alert_commercial_7j',
        name: 'Alerte commercial J+7',
        action: 'create_alert',
        params: { type: 'cold_prospect', priority: 'high', condition: 'days_since_contact >= 7' },
        condition: { type: 'custom', expression: 'days >= 7' },
        on_failure: 'continue',
      },
    ],
  },

  'weekly_report': {
    id: 'weekly_report',
    name: 'Rapport Hebdomadaire',
    description: 'Génère et envoie le rapport hebdomadaire',
    steps: [
      {
        id: 'collect_crm_data',
        name: 'Collecter données CRM',
        action: 'orchestrate',
        params: { agents: ['crm'] },
        on_failure: 'continue',
      },
      {
        id: 'collect_finance_data',
        name: 'Collecter données finance',
        action: 'orchestrate',
        params: { agents: ['tresorerie'] },
        on_failure: 'continue',
      },
      {
        id: 'collect_support_data',
        name: 'Collecter données support',
        action: 'orchestrate',
        params: { agents: ['support'] },
        on_failure: 'continue',
      },
      {
        id: 'generate_summary',
        name: 'Générer synthèse',
        action: 'generate_weekly_summary',
        params: {},
        condition: { type: 'always' },
        on_failure: 'stop',
      },
      {
        id: 'send_report',
        name: 'Envoyer le rapport',
        action: 'send_notification',
        params: { role: 'all', type: 'weekly_report' },
        condition: { type: 'if_success' },
        on_failure: 'continue',
      },
    ],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { action, workflow_id, workflow_data, params } = body;
    const user_id = auth.isServiceCall ? body.user_id : auth.userId;

    // Get profile
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

    switch (action) {
      case 'list': {
        // Lister tous les workflows disponibles
        const { data: customWorkflows } = await supabase
          .from('jarvis_workflows')
          .select('*')
          .or(`created_by.eq.${profile.id},is_public.eq.true`)
          .eq('is_active', true);

        const allWorkflows = [
          ...Object.values(PREDEFINED_WORKFLOWS).map(w => ({ ...w, type: 'predefined' })),
          ...(customWorkflows || []).map(w => ({ ...w, type: 'custom' })),
        ];

        return new Response(JSON.stringify({
          success: true,
          workflows: allWorkflows,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'execute': {
        // Exécuter un workflow
        const workflow = PREDEFINED_WORKFLOWS[workflow_id] || 
          (await supabase.from('jarvis_workflows').select('*').eq('id', workflow_id).single()).data;

        if (!workflow) {
          return new Response(JSON.stringify({ error: 'Workflow not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const execution = await executeWorkflow(supabase, workflow, profile.id, params);

        // Log execution
        await supabase.from('ai_processing_log').insert({
          processing_type: 'workflow_execution',
          model_used: 'jarvis-workflow-engine',
          success: execution.status === 'completed',
          processing_duration_ms: execution.total_duration_ms,
          result: execution,
          processed_by: profile.id,
        });

        return new Response(JSON.stringify({
          success: execution.status === 'completed',
          execution,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'create': {
        // Créer un workflow personnalisé
        const { data: newWorkflow, error } = await supabase
          .from('jarvis_workflows')
          .insert({
            name: workflow_data.name,
            description: workflow_data.description,
            steps: workflow_data.steps,
            triggers: workflow_data.triggers,
            created_by: profile.id,
            is_active: true,
            is_public: workflow_data.is_public || false,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          workflow: newWorkflow,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        await supabase
          .from('jarvis_workflows')
          .delete()
          .eq('id', workflow_id)
          .eq('created_by', profile.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('[workflow-engine] Error:', error);
    return buildErrorResponse('jarvis-workflow-engine', error, corsHeaders, 500);
  }
});

async function executeWorkflow(
  supabase: any,
  workflow: Workflow,
  profileId: string,
  params: Record<string, unknown>
): Promise<WorkflowExecution> {
  const execution: WorkflowExecution = {
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    started_at: new Date().toISOString(),
    status: 'running',
    steps_executed: [],
    total_duration_ms: 0,
    parallel_groups_count: 0,
    max_parallelism: 1,
  };

  const startTime = Date.now();
  const stepResults: Map<string, unknown> = new Map();
  let shouldRollback = false;
  const executedSteps: { step: WorkflowStep; result: unknown }[] = [];

  // V11.0: Déterminer la stratégie d'exécution
  const strategy = workflow.execution_strategy || 'sequential';

  if (strategy === 'dag' || strategy === 'parallel') {
    // Exécution DAG avec parallélisme
    const { results, executed, rollback } = await executeDAG(
      supabase,
      workflow.steps,
      profileId,
      params,
      execution
    );
    
    results.forEach((v, k) => stepResults.set(k, v));
    executedSteps.push(...executed);
    shouldRollback = rollback;
  } else {
    // Exécution séquentielle classique
    let lastResult: unknown = null;

    for (const step of workflow.steps) {
      const stepStart = Date.now();
      
      // Check condition
      if (step.condition) {
        const shouldExecute = evaluateCondition(step.condition, lastResult, params);
        if (!shouldExecute) {
          execution.steps_executed.push({
            step_id: step.id,
            step_name: step.name,
            status: 'skipped',
            duration_ms: 0,
          });
          continue;
        }
      }

      try {
        // Execute step
        const result = await executeStep(supabase, step, profileId, params, lastResult);
        lastResult = result;
        stepResults.set(step.id, result);
        executedSteps.push({ step, result });

        execution.steps_executed.push({
          step_id: step.id,
          step_name: step.name,
          status: 'success',
          result,
          duration_ms: Date.now() - stepStart,
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Step failed';
        
        execution.steps_executed.push({
          step_id: step.id,
          step_name: step.name,
          status: 'failed',
          error: errorMsg,
          duration_ms: Date.now() - stepStart,
        });

        if (step.on_failure === 'stop') {
          execution.status = 'failed';
          break;
        } else if (step.on_failure === 'rollback') {
          shouldRollback = true;
          break;
        }
        // else continue
      }
    }
  }

  // Rollback if needed
  if (shouldRollback) {
    for (const { step, result } of executedSteps.reverse()) {
      if (step.rollback_action) {
        try {
          await executeStep(supabase, {
            ...step,
            action: step.rollback_action,
          }, profileId, params, result);
        } catch (e) {
          console.error(`[workflow] Rollback failed for step ${step.id}:`, e);
        }
      }
    }
    execution.status = 'rolled_back';
  }

  if (execution.status === 'running') {
    execution.status = 'completed';
  }

  execution.completed_at = new Date().toISOString();
  execution.total_duration_ms = Date.now() - startTime;

  return execution;
}

/**
 * V11.0: Exécution DAG avec parallélisme intelligent
 * 
 * Analyse les dépendances entre steps et exécute en parallèle
 * les steps qui n'ont pas de dépendances entre eux.
 */
async function executeDAG(
  supabase: any,
  steps: WorkflowStep[],
  profileId: string,
  params: Record<string, unknown>,
  execution: WorkflowExecution
): Promise<{
  results: Map<string, unknown>;
  executed: { step: WorkflowStep; result: unknown }[];
  rollback: boolean;
}> {
  const results = new Map<string, unknown>();
  const executed: { step: WorkflowStep; result: unknown }[] = [];
  const completed = new Set<string>();
  const failed = new Set<string>();
  let rollback = false;
  let parallelGroupIndex = 0;

  // Construire le graphe de dépendances
  const dependencyGraph = new Map<string, Set<string>>();
  for (const step of steps) {
    dependencyGraph.set(step.id, new Set(step.depends_on || []));
  }

  // Exécuter par vagues
  while (completed.size + failed.size < steps.length && !rollback) {
    // Trouver les steps prêts (toutes dépendances satisfaites)
    const readySteps = steps.filter(step => {
      if (completed.has(step.id) || failed.has(step.id)) return false;
      const deps = dependencyGraph.get(step.id) || new Set();
      return [...deps].every(depId => completed.has(depId));
    });

    if (readySteps.length === 0) {
      // Cycle détecté ou tous bloqués
      console.error('[workflow-dag] No ready steps, possible cycle detected');
      break;
    }

    parallelGroupIndex++;
    const groupId = `parallel_${parallelGroupIndex}`;
    
    // Mettre à jour les métriques
    execution.parallel_groups_count = parallelGroupIndex;
    if (readySteps.length > (execution.max_parallelism || 1)) {
      execution.max_parallelism = readySteps.length;
    }

    // Exécuter en parallèle
    const parallelResults = await Promise.allSettled(
      readySteps.map(async (step) => {
        const stepStart = Date.now();
        
        // Vérifier les conditions
        if (step.condition) {
          const lastResult = step.depends_on?.length 
            ? results.get(step.depends_on[0]) 
            : null;
          const shouldExecute = evaluateCondition(step.condition, lastResult, params);
          if (!shouldExecute) {
            return { step, status: 'skipped' as const, duration_ms: 0 };
          }
        }

        try {
          // Collecter les résultats des dépendances
          const dependencyResults: Record<string, unknown> = {};
          for (const depId of step.depends_on || []) {
            dependencyResults[depId] = results.get(depId);
          }

          const result = await executeStep(
            supabase, 
            step, 
            profileId, 
            { ...params, dependency_results: dependencyResults },
            dependencyResults
          );
          
          return { 
            step, 
            status: 'success' as const, 
            result, 
            duration_ms: Date.now() - stepStart 
          };
        } catch (error) {
          return { 
            step, 
            status: 'failed' as const, 
            error: error instanceof Error ? error.message : 'Step failed',
            duration_ms: Date.now() - stepStart 
          };
        }
      })
    );

    // Traiter les résultats
    for (const outcome of parallelResults) {
      if (outcome.status === 'fulfilled') {
        const { step, status, result, error, duration_ms } = outcome.value;
        
        execution.steps_executed.push({
          step_id: step.id,
          step_name: step.name,
          status,
          result,
          error,
          duration_ms,
          parallel_group: groupId,
        });

        if (status === 'success') {
          completed.add(step.id);
          results.set(step.id, result);
          executed.push({ step, result });
        } else if (status === 'skipped') {
          completed.add(step.id);
        } else if (status === 'failed') {
          failed.add(step.id);
          if (step.on_failure === 'stop') {
            execution.status = 'failed';
            break;
          } else if (step.on_failure === 'rollback') {
            rollback = true;
            break;
          }
        }
      } else {
        // Promise rejected
        console.error('[workflow-dag] Promise rejected:', outcome.reason);
      }
    }
  }

  return { results, executed, rollback };
}

function evaluateCondition(
  condition: WorkflowStep['condition'],
  lastResult: unknown,
  params: Record<string, unknown>
): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case 'always':
      return true;
    case 'if_success':
      return lastResult !== null && lastResult !== undefined;
    case 'if_failure':
      return lastResult === null || lastResult === undefined;
    case 'custom':
      // Simple expression evaluation
      if (condition.expression) {
        try {
          const context = { ...params, result: lastResult };
          // Basic safe evaluation (no eval)
          if (condition.expression.includes('days >=')) {
            const match = condition.expression.match(/days >= (\d+)/);
            if (match && context.days_since_contact) {
              return (context.days_since_contact as number) >= parseInt(match[1]);
            }
          }
        } catch {
          return false;
        }
      }
      return true;
    default:
      return true;
  }
}

async function executeStep(
  supabase: any,
  step: WorkflowStep,
  profileId: string,
  params: Record<string, unknown>,
  lastResult: unknown
): Promise<unknown> {
  // Merge step params with workflow params
  const mergedParams = { ...step.params, ...params, previous_result: lastResult };

  switch (step.action) {
    case 'create_entity':
      // Simplified - would call actual creation logic
      return { created: true, entity_type: mergedParams.entity_type };

    case 'create_tasks_from_template':
      // Create tasks from template
      return { tasks_created: 5 }; // Placeholder

    case 'send_email':
      // Invoke send-email function
      const { data: emailResult } = await supabase.functions.invoke('send-email', {
        body: mergedParams,
      });
      return emailResult;

    case 'schedule_meeting':
      // Create calendar event
      return { meeting_scheduled: true };

    case 'sync_qonto_transactions':
      const { data: syncResult } = await supabase.functions.invoke('qonto-sync-transactions', {
        body: { days_back: mergedParams.days_back || 30 },
      });
      return syncResult;

    case 'reconcile_invoices':
      const { data: reconcileResult } = await supabase.functions.invoke('qonto-reconcile', {});
      return reconcileResult;

    case 'generate_treasury_report':
      return { report_generated: true };

    case 'send_notification':
      const { data: notifResult } = await supabase.functions.invoke('send-push-notification', {
        body: mergedParams,
      });
      return notifResult;

    case 'query_database':
      const { data: queryResult } = await supabase
        .from(mergedParams.table as string)
        .select('*')
        .limit(100);
      return queryResult;

    case 'orchestrate':
      const { data: orchResult } = await supabase.functions.invoke('jarvis-orchestrator', {
        body: { agents: mergedParams.agents, query: 'collect data', user_id: profileId },
      });
      return orchResult;

    case 'calculate_days_since_contact':
      // Would calculate from etablissement data
      return { days_since_contact: 5 }; // Placeholder

    case 'create_alert':
      await supabase.from('jarvis_proactive_alerts').insert({
        user_id: profileId,
        type: mergedParams.type,
        priority: mergedParams.priority || 'medium',
        title: 'Alerte workflow',
        message: `Alerte générée par workflow`,
        action_type: 'workflow',
        action_data: mergedParams,
      });
      return { alert_created: true };

    case 'generate_weekly_summary':
      return { summary: 'Weekly summary generated' };

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}
