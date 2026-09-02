import type { Node, Edge } from '@xyflow/react';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  node_id: string;
  severity: ValidationSeverity;
  message: string;
}

const ACTION_REQUIRED_FIELDS: Record<string, string[]> = {
  create_task: ['titre'],
  send_email: ['to', 'subject'],
  send_notification: ['message'],
  create_ticket: ['sujet'],
  update_field: ['table', 'record_id', 'field'],
  webhook: ['url'],
  http_request: ['url'],
  ai_write_email: ['ai_objective'],
  ai_summarize: ['ai_input'],
  ai_classify: ['ai_input', 'ai_categories'],
  ai_route: ['ai_input', 'ai_branches'],
  ai_extract: ['ai_input', 'ai_schema'],
  set_variables: ['variables'],
  update_etablissement_statut: ['statut'],
  assign_user: ['table', 'record_id', 'user_id'],
  for_each: ['items_path'],
  wait_until: ['until'],
  create_event: ['title', 'start_time'],
  create_devis: ['montant_ht'],
  start_email_sequence: ['sequence_id', 'contact_email'],
  pulse_notify: ['content'],
  update_csm_playbook: ['playbook_id'],
  add_to_segment: ['segment'],
};

export function validateWorkflowGraph(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1) Triggers
  const triggers = nodes.filter((n) => n.type === 'trigger');
  if (triggers.length === 0) {
    // pas de trigger : on ne peut rien marquer sur un nœud précis
  } else if (triggers.length > 1) {
    triggers.slice(1).forEach((t) =>
      issues.push({ node_id: t.id, severity: 'error', message: 'Plusieurs déclencheurs : un seul est autorisé' })
    );
  }

  // 2) Orphans (pas d'edge entrant et pas trigger)
  const incoming = new Set<string>();
  edges.forEach((e) => incoming.add(e.target));
  nodes.forEach((n) => {
    if (n.type !== 'trigger' && !incoming.has(n.id)) {
      issues.push({ node_id: n.id, severity: 'warning', message: 'Nœud non connecté à un déclencheur' });
    }
  });

  // 3) Configs requises
  nodes.forEach((n) => {
    const data = (n.data ?? {}) as { action_type?: string; config?: Record<string, unknown> };
    if (n.type === 'action') {
      const at = data.action_type;
      if (!at) {
        issues.push({ node_id: n.id, severity: 'error', message: 'Type d\'action non défini' });
      } else {
        const required = ACTION_REQUIRED_FIELDS[at] || [];
        const cfg = (data.config || {}) as Record<string, unknown>;
        const missing = required.filter((k) => !cfg[k] || String(cfg[k]).trim() === '');
        if (missing.length) {
          issues.push({
            node_id: n.id,
            severity: 'warning',
            message: `Configuration incomplète : ${missing.join(', ')}`,
          });
        }
      }
    }
    if (n.type === 'condition') {
      const cfg = (data.config || {}) as { field?: unknown; operator?: unknown };
      if (!cfg.field || !cfg.operator) {
        issues.push({ node_id: n.id, severity: 'warning', message: 'Condition incomplète (champ ou opérateur manquant)' });
      }
    }
    if (n.type === 'delay') {
      const cfg = (data.config || {}) as { amount?: number };
      if (!cfg.amount || cfg.amount <= 0) {
        issues.push({ node_id: n.id, severity: 'warning', message: 'Délai sans durée définie' });
      }
    }
  });

  return issues;
}

export function getIssuesForNode(issues: ValidationIssue[], nodeId: string): ValidationIssue[] {
  return issues.filter((i) => i.node_id === nodeId);
}
