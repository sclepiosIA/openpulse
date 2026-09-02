/**
 * Types stricts pour le moteur d'automatisation (Workflow Builder).
 */

export type WorkflowTriggerType =
  | 'etablissement.statut_changed'
  | 'email.received'
  | 'facture.overdue'
  | 'task.completed'
  | 'call.completed'
  | 'manual'
  | 'schedule'
  | 'webhook'
  | 'schedule_cron'
  | 'contact.created'
  | 'prospect.statut_changed'
  | 'devis.signed'
  | 'contrat.signed'
  | 'ticket.created'
  | 'ticket.status_changed'
  | 'prospect.score_above'
  | 'email.no_reply_after_days'
  | 'calendar.event_starts_in'
  | 'churn.risk_detected';

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type WorkflowNodeType = 'trigger' | 'condition' | 'action' | 'delay';

export type WorkflowActionType =
  | 'create_task'
  | 'send_email'
  | 'send_notification'
  | 'update_field'
  | 'create_ticket'
  | 'webhook'
  | 'wait'
  | 'ai_write_email'
  | 'ai_summarize'
  | 'ai_classify'
  | 'http_request'
  | 'set_variables'
  | 'ai_route'
  | 'ai_extract'
  | 'update_etablissement_statut'
  | 'assign_user'
  | 'for_each'
  | 'wait_until'
  | 'create_event'
  | 'create_devis'
  | 'start_email_sequence'
  | 'pulse_notify'
  | 'update_csm_playbook'
  | 'add_to_segment';

export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'is_empty'
  | 'is_not_empty';

export interface WorkflowConditionLeaf {
  field: string;
  operator: WorkflowConditionOperator;
  value?: string | number | boolean | string[];
}

export interface WorkflowConditionGroup {
  all?: WorkflowConditionConfig[];
  any?: WorkflowConditionConfig[];
}

export type WorkflowConditionConfig = WorkflowConditionLeaf | WorkflowConditionGroup;

export interface WorkflowRetryConfig {
  max?: number;        // 1..5
  backoff_ms?: number; // 0..30000
}

export interface WorkflowDelayConfig {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface WorkflowActionConfig {
  // create_task
  titre?: string;
  description?: string;
  responsable_id?: string;
  echeance_offset_days?: number;
  priorite?: 'low' | 'medium' | 'high' | 'urgent';
  // send_email
  template_id?: string | null;
  to?: string;
  subject?: string;
  body?: string;
  // send_notification
  user_id?: string;
  message?: string;
  // update_field
  table?: string;
  record_id?: string;
  field?: string;
  value?: string;
  // create_ticket
  sujet?: string;
  // webhook
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: Record<string, unknown>;
  // ai_write_email — rédige un email contextuel via GPT-5
  ai_recipient_context?: string; // ex: "{{trigger.sender_email}} — prospect chaud secteur santé"
  ai_objective?: string;          // ex: "relancer après 7j sans réponse, ton chaleureux"
  ai_tone?: 'formel' | 'amical' | 'direct' | 'empathique';
  ai_max_words?: number;
  ai_send_to?: string;            // si défini, l'email est envoyé après génération
  ai_subject_hint?: string;       // sujet suggéré (l'IA peut l'affiner)
  // ai_summarize — résume un contenu (interpolation supportée dans ai_input)
  ai_input?: string;
  ai_summary_length?: 'court' | 'moyen' | 'long';
  // ai_classify — classifie un contenu dans une liste de catégories
  ai_categories?: string;         // CSV "urgent,normal,info"
  // commun aux actions IA — clé sous laquelle stocker la sortie dans le contexte du run
  ai_output_key?: string;         // ex: "ai_email_body" → réutilisable via {{ai.ai_email_body}}
}

export interface WorkflowNodeData {
  label: string;
  trigger_type?: WorkflowTriggerType;
  action_type?: WorkflowActionType;
  config?: WorkflowConditionConfig | WorkflowDelayConfig | WorkflowActionConfig | Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowStats {
  runs: number;
  success: number;
  failed: number;
}

export interface Workflow {
  id: string;
  nom: string;
  description: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown>;
  graph: WorkflowGraph;
  is_active: boolean;
  is_template: boolean;
  created_by: string | null;
  updated_by: string | null;
  stats: WorkflowStats;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  parent_run_id: string | null;
  trigger_payload: Record<string, unknown>;
  status: WorkflowRunStatus;
  steps_log: WorkflowStepLog[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface WorkflowStepLog {
  node_id: string;
  node_type: WorkflowNodeType;
  status: 'success' | 'failed' | 'skipped' | 'scheduled';
  started_at: string;
  finished_at?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  'etablissement.statut_changed': 'Changement de statut établissement',
  'email.received': 'Email entrant reçu',
  'facture.overdue': 'Facture en retard',
  'task.completed': 'Tâche complétée',
  'call.completed': 'Appel téléphonique terminé',
  'manual': 'Déclenchement manuel',
  'schedule': 'Planification (cron)',
  'webhook': '🔌 Webhook entrant',
  'schedule_cron': '⏰ Planification cron',
  'contact.created': 'Contact créé',
  'prospect.statut_changed': 'Statut prospect changé',
  'devis.signed': 'Devis signé',
  'contrat.signed': 'Contrat signé',
  'ticket.created': 'Ticket support créé',
  'ticket.status_changed': 'Statut ticket changé',
  'prospect.score_above': '🎯 Score prospect dépasse seuil',
  'email.no_reply_after_days': '📭 Pas de réponse après X jours',
  'calendar.event_starts_in': '📅 RDV calendrier imminent',
  'churn.risk_detected': '⚠️ Risque de churn détecté',
};

export const ACTION_LABELS: Record<WorkflowActionType, string> = {
  'create_task': 'Créer une tâche',
  'send_email': 'Envoyer un email',
  'send_notification': 'Envoyer une notification',
  'update_field': 'Mettre à jour un champ',
  'create_ticket': 'Créer un ticket support',
  'webhook': 'Appeler un webhook',
  'wait': 'Attendre',
  'ai_write_email': '🤖 IA — Rédiger un email intelligent',
  'ai_summarize': '🤖 IA — Résumer un contenu',
  'ai_classify': '🤖 IA — Classifier un contenu',
  'http_request': '🔗 Requête HTTP',
  'set_variables': '📝 Définir des variables',
  'ai_route': '🧭 IA — Router vers une branche',
  'ai_extract': '🧠 IA — Extraire des données structurées',
  'update_etablissement_statut': 'Mettre à jour statut établissement',
  'assign_user': 'Assigner à un utilisateur',
  'for_each': '🔁 Boucle (for each)',
  'wait_until': '⏳ Attendre une date précise',
  'create_event': '📅 Créer un événement calendrier',
  'create_devis': '📄 Créer un devis',
  'start_email_sequence': '✉️ Démarrer une séquence email',
  'pulse_notify': '💬 Notifier sur Pulse',
  'update_csm_playbook': '🎯 Avancer un playbook CSM',
  'add_to_segment': '🏷️ Ajouter à un segment',
};
