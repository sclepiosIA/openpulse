/**
 * JARVIS - Workflow Tools
 * 
 * Exécute des workflows automatisés complets
 */

import { SupabaseClient } from "@supabase/supabase-js";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  authUserId?: string;
  conversationId?: string;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  execution_time_ms: number;
}

// Workflow IDs disponibles
const AVAILABLE_WORKFLOWS = [
  'onboarding_client',
  'cloture_mensuelle',
  'suivi_prospect',
  'weekly_report',
  'new_employee_onboarding',
  'invoice_reminder_sequence',
  'contract_renewal_30days',
  'quarterly_business_review',
  'prospect_nurturing_7days',
  'support_escalation',
  'monthly_report_automation',
  'lead_qualification',
  'offboarding_checklist',
  'weekly_standup_prep'
] as const;

type WorkflowId = typeof AVAILABLE_WORKFLOWS[number];

interface WorkflowParams {
  // Commun
  target_email?: string;
  target_name?: string;
  // Client onboarding
  etablissement_id?: string;
  // Employee
  employee_id?: string;
  employee_name?: string;
  // Invoice/Contract
  invoice_id?: string;
  contract_id?: string;
  // Lead
  prospect_id?: string;
  // Ticket
  ticket_id?: string;
}

/**
 * Exécute un workflow automatisé complet
 */
export async function executeWorkflow(
  ctx: ToolContext,
  args: {
    workflow_id: string;
    params?: WorkflowParams;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const workflowId = args.workflow_id as WorkflowId;
    
    if (!AVAILABLE_WORKFLOWS.includes(workflowId)) {
      return {
        success: false,
        error: `Workflow inconnu: ${args.workflow_id}. Disponibles: ${AVAILABLE_WORKFLOWS.join(', ')}`,
        execution_time_ms: Date.now() - start
      };
    }
    
    // Appeler le workflow engine
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/jarvis-workflow-engine`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          action: 'execute',
          workflow_id: workflowId,
          user_id: ctx.userId,
          params: args.params || {}
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Workflow engine error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    // Logger l'exécution
    await ctx.supabase.from('jarvis_workflow_executions').insert({
      user_id: ctx.userId,
      workflow_id: workflowId,
      status: result.success ? 'completed' : 'failed',
      steps_completed: result.steps_completed || 0,
      total_steps: result.total_steps || 0,
      result_summary: result.summary,
      params: args.params
    }).select().single();
    
    return {
      success: result.success,
      data: {
        workflow_id: workflowId,
        status: result.status,
        steps_completed: result.steps_completed,
        total_steps: result.total_steps,
        summary: result.summary,
        actions_taken: result.actions_taken || [],
        next_steps: result.next_steps || []
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[Workflow] Execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Workflow execution failed',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Liste les workflows disponibles avec leur description
 */
export async function listAvailableWorkflows(
  ctx: ToolContext,
  args: {
    category?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  const workflows = [
    { id: 'onboarding_client', name: 'Onboarding Client', category: 'crm', description: 'Accueil complet d\'un nouveau client' },
    { id: 'cloture_mensuelle', name: 'Clôture Mensuelle', category: 'finance', description: 'Réconciliation et rapports mensuels' },
    { id: 'suivi_prospect', name: 'Suivi Prospect', category: 'crm', description: 'Relance et qualification de prospect' },
    { id: 'weekly_report', name: 'Rapport Hebdomadaire', category: 'reporting', description: 'Génération automatique du rapport hebdo' },
    { id: 'new_employee_onboarding', name: 'Onboarding Employé', category: 'rh', description: 'Accueil nouvel employé' },
    { id: 'invoice_reminder_sequence', name: 'Relance Factures', category: 'finance', description: 'Séquence de relance automatique' },
    { id: 'contract_renewal_30days', name: 'Renouvellement Contrat', category: 'crm', description: 'Processus de renouvellement J-30' },
    { id: 'quarterly_business_review', name: 'Revue Trimestrielle', category: 'reporting', description: 'QBR automatisée' },
    { id: 'prospect_nurturing_7days', name: 'Nurturing 7 jours', category: 'crm', description: 'Séquence d\'engagement prospect' },
    { id: 'support_escalation', name: 'Escalade Support', category: 'support', description: 'Escalade ticket critique' },
    { id: 'monthly_report_automation', name: 'Rapport Mensuel', category: 'reporting', description: 'Rapport mensuel automatisé' },
    { id: 'lead_qualification', name: 'Qualification Lead', category: 'crm', description: 'Scoring et routage de lead' },
    { id: 'offboarding_checklist', name: 'Offboarding', category: 'rh', description: 'Départ employé' },
    { id: 'weekly_standup_prep', name: 'Prépa Standup', category: 'rd', description: 'Préparation réunion hebdo' }
  ];
  
  const filtered = args.category 
    ? workflows.filter(w => w.category === args.category)
    : workflows;
  
  return {
    success: true,
    data: {
      workflows: filtered,
      total: filtered.length,
      categories: [...new Set(workflows.map(w => w.category))]
    },
    execution_time_ms: Date.now() - start
  };
}

/**
 * Récupère l'historique d'exécution des workflows
 */
export async function getWorkflowHistory(
  ctx: ToolContext,
  args: {
    workflow_id?: string;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    let query = ctx.supabase
      .from('jarvis_workflow_executions')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 20);
    
    if (args.workflow_id) {
      query = query.eq('workflow_id', args.workflow_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      success: true,
      data: {
        executions: data || [],
        total: data?.length || 0
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch workflow history',
      execution_time_ms: Date.now() - start
    };
  }
}
