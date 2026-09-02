/**
 * useJarvisWorkflows - Workflows multi-étapes automatisés
 * 
 * Permet d'exécuter des séquences d'actions complexes
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  tool: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
  dependsOn?: string[]; // IDs of steps that must complete first
  conditional?: {
    stepId: string;
    condition: 'success' | 'failure' | 'has_data';
    path: string; // JSON path to check in result
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
}

// Predefined workflow templates
export const WORKFLOW_TEMPLATES: Omit<Workflow, 'id' | 'status' | 'progress'>[] = [
  {
    name: 'Onboarding Établissement',
    description: 'Configure un nouvel établissement avec tâches, contacts et premier email',
    steps: [
      {
        id: 'create_etab',
        name: 'Créer établissement',
        description: 'Créer la fiche établissement',
        tool: 'manage_etablissement',
        arguments: { action: 'create' },
        status: 'pending',
      },
      {
        id: 'create_contact',
        name: 'Créer contact principal',
        description: 'Ajouter le contact décideur',
        tool: 'manage_contact',
        arguments: { action: 'create' },
        status: 'pending',
        dependsOn: ['create_etab'],
      },
      {
        id: 'create_tasks',
        name: 'Créer tâches onboarding',
        description: 'Générer les tâches de déploiement',
        tool: 'batch_create_from_template',
        arguments: { template_type: 'onboarding' },
        status: 'pending',
        dependsOn: ['create_etab'],
      },
      {
        id: 'send_welcome',
        name: 'Envoyer email bienvenue',
        description: 'Envoyer l\'email de bienvenue',
        tool: 'send_email',
        arguments: { template: 'welcome' },
        status: 'pending',
        dependsOn: ['create_contact'],
      },
    ],
  },
  {
    name: 'Relance Client Froid',
    description: 'Séquence de relance pour un prospect inactif',
    steps: [
      {
        id: 'check_history',
        name: 'Vérifier historique',
        description: 'Analyser les dernières interactions',
        tool: 'query_database',
        arguments: { table: 'email_threads', limit: 5 },
        status: 'pending',
      },
      {
        id: 'create_task',
        name: 'Créer tâche relance',
        description: 'Planifier un appel de suivi',
        tool: 'create_task',
        arguments: { titre: 'Appel de relance', priorite: 'haute' },
        status: 'pending',
      },
      {
        id: 'draft_email',
        name: 'Rédiger email',
        description: 'Préparer un email de relance personnalisé',
        tool: 'suggest_email_content',
        arguments: { type: 'relance' },
        status: 'pending',
        dependsOn: ['check_history'],
      },
    ],
  },
  {
    name: 'Rapport Hebdomadaire',
    description: 'Génère un rapport complet de la semaine',
    steps: [
      {
        id: 'pipeline_metrics',
        name: 'Métriques pipeline',
        description: 'Calculer les métriques commerciales',
        tool: 'get_pipeline_overview',
        arguments: {},
        status: 'pending',
      },
      {
        id: 'support_kpis',
        name: 'KPIs support',
        description: 'Récupérer les stats support',
        tool: 'get_support_kpis',
        arguments: {},
        status: 'pending',
      },
      {
        id: 'treasury_status',
        name: 'État trésorerie',
        description: 'Résumé financier',
        tool: 'get_treasury_overview',
        arguments: {},
        status: 'pending',
      },
      {
        id: 'generate_report',
        name: 'Générer rapport',
        description: 'Compiler le rapport final',
        tool: 'summarize_content',
        arguments: { format: 'executive_summary' },
        status: 'pending',
        dependsOn: ['pipeline_metrics', 'support_kpis', 'treasury_status'],
      },
    ],
  },
];

interface UseJarvisWorkflowsReturn {
  workflows: Workflow[];
  activeWorkflow: Workflow | null;
  isExecuting: boolean;
  
  startWorkflow: (workflow: Omit<Workflow, 'id' | 'status' | 'progress'>, context?: Record<string, unknown>) => Promise<void>;
  cancelWorkflow: () => void;
  getTemplates: () => typeof WORKFLOW_TEMPLATES;
}

export function useJarvisWorkflows(): UseJarvisWorkflowsReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const cancelledRef = useRef(false);

  const executeStep = useCallback(async (
    step: WorkflowStep,
    context: Record<string, unknown>,
    previousResults: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> => {
    if (!user?.id) throw new Error('Not authenticated');

    try {
      // Merge context and previous results into arguments
      const mergedArgs = {
        ...step.arguments,
        ...context,
        _previous_results: previousResults,
      };

      // Execute via jarvis-brain
      const { data, error } = await supabase.functions.invoke('jarvis-brain', {
        body: {
          user_id: user.id,
          message: `Execute l'outil ${step.tool} avec les arguments: ${JSON.stringify(mergedArgs)}`,
          autonomous_mode: true,
        },
      });

      if (error) throw error;

      return {
        success: data.success,
        result: data.tool_results?.[0]?.result?.data,
        error: data.tool_results?.[0]?.result?.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [user]);

  const startWorkflow = useCallback(async (
    workflowTemplate: Omit<Workflow, 'id' | 'status' | 'progress'>,
    context: Record<string, unknown> = {}
  ) => {
    if (!user?.id || isExecuting) return;

    cancelledRef.current = false;
    setIsExecuting(true);

    const workflow: Workflow = {
      ...workflowTemplate,
      id: crypto.randomUUID(),
      status: 'running',
      progress: 0,
      startedAt: new Date(),
      steps: workflowTemplate.steps.map(s => ({ ...s, status: 'pending' as const })),
    };

    setActiveWorkflow(workflow);
    setWorkflows(prev => [workflow, ...prev]);

    toast({
      title: '🚀 Workflow démarré',
      description: workflow.name,
    });

    const previousResults: Record<string, unknown> = {};
    const totalSteps = workflow.steps.length;
    let completedSteps = 0;

    try {
      // Execute steps respecting dependencies
      const executedSteps = new Set<string>();
      
      while (executedSteps.size < workflow.steps.length && !cancelledRef.current) {
        // Find steps that can be executed
        const readySteps = workflow.steps.filter(step => {
          if (executedSteps.has(step.id)) return false;
          if (step.dependsOn && step.dependsOn.length > 0) {
            return step.dependsOn.every(depId => executedSteps.has(depId));
          }
          return true;
        });

        if (readySteps.length === 0) {
          // No more steps can be executed
          break;
        }

        // Execute ready steps in parallel
        await Promise.all(readySteps.map(async (step) => {
          if (cancelledRef.current) return;

          // Check conditional
          if (step.conditional) {
            const depResult = previousResults[step.conditional.stepId];
            let shouldExecute = true;

            switch (step.conditional.condition) {
              case 'success':
                shouldExecute = !!depResult;
                break;
              case 'failure':
                shouldExecute = !depResult;
                break;
              case 'has_data':
                // Check if specific path has data
                shouldExecute = !!depResult;
                break;
            }

            if (!shouldExecute) {
              step.status = 'skipped';
              executedSteps.add(step.id);
              return;
            }
          }

          // Update step status
          step.status = 'executing';
          setActiveWorkflow({ ...workflow });

          // Execute step
          const result = await executeStep(step, context, previousResults);

          step.status = result.success ? 'completed' : 'failed';
          step.result = result.result;
          step.error = result.error;

          previousResults[step.id] = result.result;
          executedSteps.add(step.id);

          completedSteps++;
          workflow.progress = Math.round((completedSteps / totalSteps) * 100);
          setActiveWorkflow({ ...workflow });
        }));
      }

      if (cancelledRef.current) {
        workflow.status = 'cancelled';
      } else {
        const hasFailures = workflow.steps.some(s => s.status === 'failed');
        workflow.status = hasFailures ? 'failed' : 'completed';
      }

      workflow.completedAt = new Date();
      workflow.progress = 100;
      setActiveWorkflow({ ...workflow });
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? workflow : w));

      toast({
        title: workflow.status === 'completed' ? '✅ Workflow terminé' : '⚠️ Workflow terminé avec erreurs',
        description: `${completedSteps}/${totalSteps} étapes complétées`,
        variant: workflow.status === 'completed' ? 'default' : 'destructive',
      });
    } catch (error) {
      workflow.status = 'failed';
      workflow.completedAt = new Date();
      setActiveWorkflow({ ...workflow });
      
      toast({
        title: 'Erreur workflow',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [user, isExecuting, executeStep, toast]);

  const cancelWorkflow = useCallback(() => {
    cancelledRef.current = true;
    toast({
      title: 'Workflow annulé',
    });
  }, [toast]);

  const getTemplates = useCallback(() => WORKFLOW_TEMPLATES, []);

  return {
    workflows,
    activeWorkflow,
    isExecuting,
    startWorkflow,
    cancelWorkflow,
    getTemplates,
  };
}
