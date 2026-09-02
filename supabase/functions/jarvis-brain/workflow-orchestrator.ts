/**
 * JARVIS 16.0 - Workflow Orchestrator
 * 
 * Executes multi-step workflows with:
 * - Sequential and parallel step execution
 * - Real-time progress tracking
 * - Error handling with step rollback info
 * - Dependency graph resolution
 */

import { ToolResult, ToolExecutionContext } from "./tools-executor.ts";

// ============================================================
// Types
// ============================================================
export interface WorkflowStep {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  dependsOn?: string[];          // Step IDs this depends on
  useResultFrom?: string;        // Step ID whose result populates args
  argMapping?: Record<string, string>; // Map result fields to args: { "etablissement_id": "result.data.id" }
  label: string;
  optional?: boolean;            // If true, failure doesn't stop workflow
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowStepResult {
  stepId: string;
  label: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: ToolResult;
  startedAt?: number;
  completedAt?: number;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  workflowName: string;
  status: 'completed' | 'partial' | 'failed';
  steps: WorkflowStepResult[];
  totalTimeMs: number;
  summary: string;
}

export type ProgressCallback = (stepResult: WorkflowStepResult, overallProgress: number) => void;

// ============================================================
// Predefined Workflow Templates
// ============================================================
export const WORKFLOW_TEMPLATES: Record<string, WorkflowDefinition> = {
  onboarding_client: {
    id: 'onboarding_client',
    name: 'Onboarding Client Complet',
    description: 'Crée l\'établissement, les tâches d\'onboarding, planifie un kick-off, et envoie un email de bienvenue',
    steps: [
      {
        id: 'create_etab',
        toolName: 'manage_etablissement',
        toolArgs: { action: 'create' },
        label: 'Créer l\'établissement',
      },
      {
        id: 'create_tasks',
        toolName: 'create_task',
        toolArgs: {},
        dependsOn: ['create_etab'],
        useResultFrom: 'create_etab',
        argMapping: { etablissement_id: 'data.etablissement.id' },
        label: 'Créer les tâches d\'onboarding',
      },
      {
        id: 'schedule_kickoff',
        toolName: 'schedule_meeting',
        toolArgs: {},
        dependsOn: ['create_etab'],
        useResultFrom: 'create_etab',
        argMapping: { etablissement_id: 'data.etablissement.id' },
        label: 'Planifier le kick-off',
      },
      {
        id: 'send_welcome',
        toolName: 'send_email',
        toolArgs: {},
        dependsOn: ['create_etab'],
        label: 'Envoyer l\'email de bienvenue',
        optional: true,
      },
    ],
  },
  devis_to_invoice: {
    id: 'devis_to_invoice',
    name: 'Devis → Facture → Email',
    description: 'Convertit un devis accepté en facture et envoie la facture au client',
    steps: [
      {
        id: 'convert',
        toolName: 'convert_devis_to_invoice',
        toolArgs: {},
        label: 'Convertir le devis en facture',
      },
      {
        id: 'send_invoice',
        toolName: 'send_email',
        toolArgs: {},
        dependsOn: ['convert'],
        label: 'Envoyer la facture au client',
        optional: true,
      },
    ],
  },
  support_escalation: {
    id: 'support_escalation',
    name: 'Escalade Support',
    description: 'Escalade un ticket: assigne, crée une tâche urgente, notifie l\'équipe',
    steps: [
      {
        id: 'assign',
        toolName: 'assign_ticket',
        toolArgs: {},
        label: 'Assigner le ticket',
      },
      {
        id: 'create_task',
        toolName: 'create_task',
        toolArgs: { priorite: 'Urgente' },
        dependsOn: ['assign'],
        label: 'Créer tâche urgente liée',
      },
      {
        id: 'notify',
        toolName: 'send_notification',
        toolArgs: { type: 'urgent' },
        dependsOn: ['assign'],
        label: 'Notifier l\'équipe',
        optional: true,
      },
    ],
  },
  bilan_csm_mensuel: {
    id: 'bilan_csm_mensuel',
    name: 'Bilan CSM Mensuel',
    description: 'Récupère les KPIs CSM, scores de santé, et envoie un rapport par email',
    steps: [
      {
        id: 'get_kpis',
        toolName: 'get_csm_kpis',
        toolArgs: {},
        label: 'Récupérer les KPIs CSM',
      },
      {
        id: 'get_health',
        toolName: 'get_csm_health_score',
        toolArgs: {},
        label: 'Récupérer les scores de santé',
      },
      {
        id: 'get_churn',
        toolName: 'get_churn_predictions',
        toolArgs: {},
        label: 'Récupérer les prédictions de churn',
      },
      {
        id: 'send_report',
        toolName: 'send_email',
        toolArgs: {},
        dependsOn: ['get_kpis', 'get_health', 'get_churn'],
        label: 'Envoyer le rapport par email',
        optional: true,
      },
    ],
  },
  cloture_sprint: {
    id: 'cloture_sprint',
    name: 'Clôture de Sprint R&D',
    description: 'Clôture le sprint, calcule les métriques, génère un rapport',
    steps: [
      {
        id: 'close_sprint',
        toolName: 'manage_sprint',
        toolArgs: { action: 'update' },
        label: 'Clôturer le sprint',
      },
      {
        id: 'metrics',
        toolName: 'calculate_rd_metrics',
        toolArgs: {},
        dependsOn: ['close_sprint'],
        label: 'Calculer les métriques',
      },
      {
        id: 'report',
        toolName: 'generate_report',
        toolArgs: { report_type: 'sprint_review' },
        dependsOn: ['metrics'],
        label: 'Générer le rapport de sprint',
        optional: true,
      },
    ],
  },
  revue_hebdomadaire: {
    id: 'revue_hebdomadaire',
    name: 'Revue Hebdomadaire Direction',
    description: 'Pipeline + Cash + Tâches équipe + Tickets ouverts → synthèse email',
    steps: [
      { id: 'pipeline', toolName: 'calculate_metrics', toolArgs: { metric_type: 'pipeline_value' }, label: 'Analyser le pipeline commercial' },
      { id: 'treasury', toolName: 'get_tresorerie_summary', toolArgs: {}, label: 'Résumé trésorerie' },
      { id: 'unpaid', toolName: 'manage_invoice', toolArgs: { action: 'get_unpaid' }, label: 'Factures impayées' },
      { id: 'team_tasks', toolName: 'calculate_metrics', toolArgs: { metric_type: 'tasks_completion' }, label: 'KPIs tâches équipe' },
      { id: 'support', toolName: 'get_support_kpis', toolArgs: {}, label: 'KPIs support' },
      { id: 'send_report', toolName: 'send_email', toolArgs: {}, dependsOn: ['pipeline', 'treasury', 'unpaid', 'team_tasks', 'support'], label: 'Envoyer la synthèse par email', optional: true },
    ],
  },
  relance_impayes: {
    id: 'relance_impayes',
    name: 'Relance Factures Impayées',
    description: 'Identifie les factures > 30j et envoie des emails de relance',
    steps: [
      { id: 'get_unpaid', toolName: 'manage_invoice', toolArgs: { action: 'get_unpaid' }, label: 'Identifier les factures impayées' },
      { id: 'send_reminders', toolName: 'batch_send_emails', toolArgs: {}, dependsOn: ['get_unpaid'], label: 'Envoyer les relances par email' },
    ],
  },
  rapport_mensuel_direction: {
    id: 'rapport_mensuel_direction',
    name: 'Rapport Mensuel Direction',
    description: 'KPIs complets tous modules → rapport formaté et envoyé',
    steps: [
      { id: 'dashboard', toolName: 'get_dashboard_summary', toolArgs: {}, label: 'Résumé dashboard' },
      { id: 'pipeline', toolName: 'calculate_metrics', toolArgs: { metric_type: 'pipeline_value' }, label: 'Pipeline commercial' },
      { id: 'revenue', toolName: 'calculate_metrics', toolArgs: { metric_type: 'monthly_revenue' }, label: 'Revenus mensuels' },
      { id: 'csm', toolName: 'get_csm_kpis', toolArgs: {}, label: 'KPIs CSM' },
      { id: 'support', toolName: 'get_support_kpis', toolArgs: {}, label: 'KPIs Support' },
      { id: 'rh', toolName: 'calculate_payroll_kpis', toolArgs: { period: new Date().toISOString().substring(0, 7) }, label: 'KPIs RH' },
      { id: 'report', toolName: 'generate_report', toolArgs: { report_type: 'monthly_executive' }, dependsOn: ['dashboard', 'pipeline', 'revenue', 'csm', 'support', 'rh'], label: 'Générer le rapport' },
      { id: 'send', toolName: 'send_email', toolArgs: {}, dependsOn: ['report'], label: 'Envoyer le rapport', optional: true },
    ],
  },
};

// ============================================================
// Workflow Executor
// ============================================================

/**
 * Resolves the execution order from dependency graph (topological sort)
 */
function resolveExecutionOrder(steps: WorkflowStep[]): WorkflowStep[][] {
  const layers: WorkflowStep[][] = [];
  const resolved = new Set<string>();
  const remaining = [...steps];

  while (remaining.length > 0) {
    const layer = remaining.filter(step => {
      if (!step.dependsOn?.length) return !resolved.has(step.id);
      return step.dependsOn.every(dep => resolved.has(dep)) && !resolved.has(step.id);
    });

    if (layer.length === 0 && remaining.length > 0) {
      // Circular dependency or unresolvable - add remaining as final layer
      layers.push(remaining.filter(s => !resolved.has(s.id)));
      break;
    }

    layers.push(layer);
    layer.forEach(s => resolved.add(s.id));
    remaining.splice(0, remaining.length, ...remaining.filter(s => !resolved.has(s.id)));
  }

  return layers;
}

/**
 * Resolve dynamic arguments from previous step results
 */
function resolveStepArgs(
  step: WorkflowStep,
  stepResults: Map<string, WorkflowStepResult>
): Record<string, unknown> {
  const args = { ...step.toolArgs };

  if (step.useResultFrom && step.argMapping) {
    const sourceResult = stepResults.get(step.useResultFrom);
    if (sourceResult?.result?.data) {
      for (const [argKey, resultPath] of Object.entries(step.argMapping)) {
        const value = getNestedValue(sourceResult.result.data, resultPath);
        if (value !== undefined) {
          args[argKey] = value;
        }
      }
    }
  }

  return args;
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Execute a complete workflow with progress tracking
 */
export async function executeWorkflowOrchestrated(
  definition: WorkflowDefinition,
  ctx: ToolExecutionContext,
  executeTool: (ctx: ToolExecutionContext, toolName: string, args: Record<string, unknown>) => Promise<ToolResult>,
  onProgress?: ProgressCallback
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const stepResults = new Map<string, WorkflowStepResult>();
  const totalSteps = definition.steps.length;

  // Initialize all step results
  for (const step of definition.steps) {
    stepResults.set(step.id, {
      stepId: step.id,
      label: step.label,
      toolName: step.toolName,
      status: 'pending',
    });
  }

  // Resolve execution layers
  const layers = resolveExecutionOrder(definition.steps);
  let hasFailure = false;

  for (const layer of layers) {
    // Execute steps in this layer in parallel
    const promises = layer.map(async (step) => {
      const stepResult = stepResults.get(step.id)!;

      // Skip if a required dependency failed
      if (step.dependsOn?.some(depId => {
        const dep = stepResults.get(depId);
        return dep?.status === 'failed' && !definition.steps.find(s => s.id === depId)?.optional;
      })) {
        stepResult.status = 'skipped';
        onProgress?.(stepResult, completedCount() / totalSteps);
        return;
      }

      stepResult.status = 'running';
      stepResult.startedAt = Date.now();
      onProgress?.(stepResult, completedCount() / totalSteps);

      try {
        const resolvedArgs = resolveStepArgs(step, stepResults);
        const result = await executeTool(ctx, step.toolName, resolvedArgs);

        stepResult.result = result;
        stepResult.status = result.success ? 'completed' : 'failed';
        stepResult.completedAt = Date.now();

        if (!result.success && !step.optional) {
          hasFailure = true;
        }
      } catch (error) {
        stepResult.status = 'failed';
        stepResult.completedAt = Date.now();
        stepResult.result = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          execution_time_ms: Date.now() - (stepResult.startedAt || Date.now()),
        };
        if (!step.optional) hasFailure = true;
      }

      onProgress?.(stepResult, completedCount() / totalSteps);
    });

    await Promise.all(promises);
  }

  function completedCount(): number {
    let count = 0;
    stepResults.forEach(r => {
      if (r.status !== 'pending' && r.status !== 'running') count++;
    });
    return count;
  }

  // Build summary
  const allResults = Array.from(stepResults.values());
  const completed = allResults.filter(r => r.status === 'completed').length;
  const failed = allResults.filter(r => r.status === 'failed').length;
  const skipped = allResults.filter(r => r.status === 'skipped').length;

  const status = failed === 0 ? 'completed' : (completed > 0 ? 'partial' : 'failed');

  const summaryParts = allResults.map(r => {
    const icon = r.status === 'completed' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'skipped' ? '⏭️' : '⏸️';
    return `${icon} ${r.label}`;
  });

  return {
    workflowId: definition.id,
    workflowName: definition.name,
    status,
    steps: allResults,
    totalTimeMs: Date.now() - startTime,
    summary: `**Workflow: ${definition.name}** (${status})\n\n${summaryParts.join('\n')}\n\n📊 ${completed}/${totalSteps} étapes réussies${failed > 0 ? `, ${failed} échouée(s)` : ''}${skipped > 0 ? `, ${skipped} sautée(s)` : ''} en ${Math.round((Date.now() - startTime) / 1000)}s`,
  };
}
