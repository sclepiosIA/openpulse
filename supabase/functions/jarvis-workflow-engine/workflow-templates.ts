/**
 * JARVIS 9.0 - Workflow Templates
 * 
 * Templates de workflows pré-configurés pour les cas d'usage courants.
 * Chaque workflow est une chaîne d'actions exécutables en 1 commande.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'finance' | 'hr' | 'support' | 'operations' | 'management';
  triggerCommand: string;
  steps: WorkflowStep[];
  estimatedDurationMs: number;
  requiredPermissions: string[];
  tags: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  params: Record<string, unknown>;
  condition?: string;
  onFailure: 'stop' | 'continue' | 'notify';
  timeout_ms?: number;
}

/**
 * Templates de workflows pré-définis
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ============== SALES WORKFLOWS ==============
  {
    id: 'morning_sales_briefing',
    name: 'Briefing Commercial du Matin',
    description: 'Résumé complet pour démarrer la journée commerciale',
    category: 'sales',
    triggerCommand: 'Génère mon briefing commercial du matin',
    steps: [
      {
        id: 'check_pipeline',
        name: 'État du pipeline',
        tool: 'query_database',
        params: {
          table: 'etablissements',
          filters: [{ column: 'statut', operator: 'in', value: ['Prospect', 'Qualification', 'Proposition'] }],
          select: 'nom, statut, valeur_estimee, commercial_id, updated_at',
          order_by: 'valeur_estimee',
          order_direction: 'desc',
          limit: 20,
        },
        onFailure: 'continue',
      },
      {
        id: 'check_tasks',
        name: 'Tâches du jour',
        tool: 'query_database',
        params: {
          table: 'taches',
          filters: [{ column: 'echeance', operator: 'eq', value: 'TODAY' }],
          select: 'titre, priorite, etablissement_id',
        },
        onFailure: 'continue',
      },
      {
        id: 'check_meetings',
        name: 'Réunions planifiées',
        tool: 'query_database',
        params: {
          table: 'calendar_events',
          filters: [{ column: 'start_time', operator: 'gte', value: 'TODAY_START' }],
          select: 'title, start_time, location',
          order_by: 'start_time',
          limit: 10,
        },
        onFailure: 'continue',
      },
      {
        id: 'generate_summary',
        name: 'Synthèse IA',
        tool: 'generate_ai_summary',
        params: { type: 'sales_briefing' },
        onFailure: 'stop',
      },
    ],
    estimatedDurationMs: 3000,
    requiredPermissions: ['read:etablissements', 'read:taches', 'read:calendar'],
    tags: ['quotidien', 'commercial', 'briefing'],
  },
  
  {
    id: 'prospect_followup_sequence',
    name: 'Séquence de Relance Prospect',
    description: 'Relance automatique des prospects inactifs',
    category: 'sales',
    triggerCommand: 'Lance la séquence de relance prospects',
    steps: [
      {
        id: 'find_cold_prospects',
        name: 'Identifier prospects froids',
        tool: 'query_database',
        params: {
          table: 'etablissements',
          filters: [
            { column: 'statut', operator: 'eq', value: 'Prospect' },
            { column: 'updated_at', operator: 'lt', value: 'DAYS_AGO_7' },
          ],
          select: 'id, nom, email, commercial_id',
          limit: 10,
        },
        onFailure: 'stop',
      },
      {
        id: 'generate_relance_emails',
        name: 'Générer emails de relance',
        tool: 'generate_bulk_emails',
        params: { template: 'prospect_relance', use_previous_result: true },
        condition: 'previous_result.count > 0',
        onFailure: 'notify',
      },
      {
        id: 'create_followup_tasks',
        name: 'Créer tâches de suivi',
        tool: 'create_bulk_tasks',
        params: { template: 'followup_call', days_due: 3 },
        condition: 'previous_result.count > 0',
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 5000,
    requiredPermissions: ['read:etablissements', 'write:taches', 'send:email'],
    tags: ['relance', 'prospect', 'automatisation'],
  },
  
  // ============== FINANCE WORKFLOWS ==============
  {
    id: 'monthly_closing',
    name: 'Clôture Mensuelle',
    description: 'Processus complet de clôture comptable mensuelle',
    category: 'finance',
    triggerCommand: 'Lance la clôture mensuelle',
    steps: [
      {
        id: 'sync_bank',
        name: 'Synchroniser Qonto',
        tool: 'sync_qonto_transactions',
        params: { days_back: 35 },
        onFailure: 'notify',
        timeout_ms: 30000,
      },
      {
        id: 'reconcile_invoices',
        name: 'Rapprocher factures',
        tool: 'reconcile_transactions',
        params: { auto_match: true },
        onFailure: 'continue',
      },
      {
        id: 'check_unpaid',
        name: 'Identifier impayés',
        tool: 'query_database',
        params: {
          table: 'factures',
          filters: [
            { column: 'statut', operator: 'eq', value: 'En attente' },
            { column: 'date_echeance', operator: 'lt', value: 'TODAY' },
          ],
        },
        onFailure: 'continue',
      },
      {
        id: 'generate_report',
        name: 'Générer rapport',
        tool: 'generate_treasury_report',
        params: { period: 'last_month', format: 'pdf' },
        onFailure: 'stop',
      },
      {
        id: 'notify_team',
        name: 'Notifier l\'équipe',
        tool: 'send_notification',
        params: { recipients: 'finance_team', template: 'monthly_report_ready' },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 45000,
    requiredPermissions: ['sync:qonto', 'read:factures', 'write:reports'],
    tags: ['clôture', 'mensuel', 'comptabilité'],
  },
  
  {
    id: 'invoice_reminder_batch',
    name: 'Relances Factures Batch',
    description: 'Envoi groupé de relances pour factures impayées',
    category: 'finance',
    triggerCommand: 'Envoie les relances de factures impayées',
    steps: [
      {
        id: 'find_overdue',
        name: 'Trouver factures en retard',
        tool: 'query_database',
        params: {
          table: 'factures',
          filters: [
            { column: 'statut', operator: 'eq', value: 'En attente' },
            { column: 'date_echeance', operator: 'lt', value: 'DAYS_AGO_15' },
          ],
          select: 'id, numero, etablissement_id, montant_ttc, date_echeance',
        },
        onFailure: 'stop',
      },
      {
        id: 'generate_reminders',
        name: 'Générer emails de relance',
        tool: 'generate_invoice_reminders',
        params: { template: 'relance_facture', use_previous_result: true },
        condition: 'previous_result.count > 0',
        onFailure: 'notify',
      },
      {
        id: 'log_reminders',
        name: 'Logger les relances',
        tool: 'log_activity',
        params: { type: 'invoice_reminder_sent' },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 8000,
    requiredPermissions: ['read:factures', 'send:email'],
    tags: ['relance', 'facture', 'batch'],
  },
  
  // ============== SUPPORT WORKFLOWS ==============
  {
    id: 'support_triage',
    name: 'Triage Support Automatique',
    description: 'Analyse et priorise les tickets support entrants',
    category: 'support',
    triggerCommand: 'Analyse les nouveaux tickets support',
    steps: [
      {
        id: 'fetch_new_tickets',
        name: 'Récupérer nouveaux tickets',
        tool: 'query_database',
        params: {
          table: 'support_tickets',
          filters: [
            { column: 'status', operator: 'eq', value: 'open' },
            { column: 'assigned_to', operator: 'is', value: null },
          ],
          order_by: 'created_at',
          limit: 20,
        },
        onFailure: 'stop',
      },
      {
        id: 'analyze_priority',
        name: 'Analyser priorités',
        tool: 'ai_analyze_tickets',
        params: { classify_urgency: true, suggest_assignee: true },
        condition: 'previous_result.count > 0',
        onFailure: 'continue',
      },
      {
        id: 'auto_assign',
        name: 'Assigner automatiquement',
        tool: 'assign_tickets_balanced',
        params: { respect_capacity: true },
        onFailure: 'notify',
      },
      {
        id: 'notify_team',
        name: 'Notifier équipe support',
        tool: 'send_notification',
        params: { recipients: 'support_team', template: 'new_tickets_assigned' },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 5000,
    requiredPermissions: ['read:tickets', 'write:tickets', 'send:notification'],
    tags: ['support', 'triage', 'automatisation'],
  },
  
  // ============== HR WORKFLOWS ==============
  {
    id: 'employee_onboarding',
    name: 'Onboarding Employé',
    description: 'Processus complet d\'intégration d\'un nouvel employé',
    category: 'hr',
    triggerCommand: 'Lance l\'onboarding pour un nouvel employé',
    steps: [
      {
        id: 'create_profile',
        name: 'Créer profil utilisateur',
        tool: 'create_user_profile',
        params: { send_welcome_email: true },
        onFailure: 'stop',
      },
      {
        id: 'create_onboarding_tasks',
        name: 'Créer tâches onboarding',
        tool: 'create_tasks_from_template',
        params: { template: 'onboarding_checklist' },
        onFailure: 'continue',
      },
      {
        id: 'schedule_intro_meetings',
        name: 'Planifier réunions d\'intro',
        tool: 'schedule_onboarding_meetings',
        params: { templates: ['meet_manager', 'meet_team', 'meet_hr'] },
        onFailure: 'notify',
      },
      {
        id: 'grant_access',
        name: 'Configurer accès',
        tool: 'configure_user_access',
        params: { default_role: 'user' },
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 10000,
    requiredPermissions: ['write:profiles', 'write:taches', 'write:calendar'],
    tags: ['rh', 'onboarding', 'nouvel employé'],
  },
  
  // ============== OPERATIONS WORKFLOWS ==============
  {
    id: 'weekly_team_report',
    name: 'Rapport Hebdomadaire Équipe',
    description: 'Génère un rapport consolidé de l\'activité de l\'équipe',
    category: 'operations',
    triggerCommand: 'Génère le rapport hebdomadaire de l\'équipe',
    steps: [
      {
        id: 'collect_task_stats',
        name: 'Collecter stats tâches',
        tool: 'calculate_task_metrics',
        params: { period: 'last_week' },
        onFailure: 'continue',
      },
      {
        id: 'collect_sales_stats',
        name: 'Collecter stats commerciales',
        tool: 'calculate_sales_metrics',
        params: { period: 'last_week' },
        onFailure: 'continue',
      },
      {
        id: 'collect_support_stats',
        name: 'Collecter stats support',
        tool: 'calculate_support_metrics',
        params: { period: 'last_week' },
        onFailure: 'continue',
      },
      {
        id: 'generate_consolidated_report',
        name: 'Générer rapport consolidé',
        tool: 'generate_team_report',
        params: { format: 'html', include_charts: true },
        onFailure: 'stop',
      },
      {
        id: 'send_report',
        name: 'Envoyer à l\'équipe',
        tool: 'send_email',
        params: { recipients: 'all_team', template: 'weekly_report' },
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 15000,
    requiredPermissions: ['read:all', 'send:email'],
    tags: ['rapport', 'hebdomadaire', 'équipe'],
  },

  // ============== NEW EMPLOYEE ONBOARDING COMPLETE ==============
  {
    id: 'new_employee_onboarding_complete',
    name: 'Onboarding Complet Nouvel Employé',
    description: 'Processus complet d\'accueil: profil, email, équipe, formation, accès',
    category: 'hr',
    triggerCommand: 'Lance l\'onboarding complet pour un nouvel employé',
    steps: [
      {
        id: 'create_profile',
        name: 'Créer profil utilisateur',
        tool: 'create_user_profile',
        params: { send_welcome_email: true, set_temporary_password: true },
        onFailure: 'stop',
      },
      {
        id: 'configure_email',
        name: 'Configurer compte email',
        tool: 'setup_email_account',
        params: { template: 'employee_email' },
        onFailure: 'notify',
      },
      {
        id: 'assign_team',
        name: 'Affecter à l\'équipe',
        tool: 'assign_to_team',
        params: { notify_manager: true },
        onFailure: 'continue',
      },
      {
        id: 'create_onboarding_tasks',
        name: 'Créer checklist onboarding',
        tool: 'create_tasks_from_template',
        params: { template: 'onboarding_checklist_complete' },
        onFailure: 'continue',
      },
      {
        id: 'schedule_training',
        name: 'Planifier formation initiale',
        tool: 'schedule_training_session',
        params: { type: 'new_employee', days_from_start: 3 },
        onFailure: 'notify',
      },
      {
        id: 'grant_access',
        name: 'Configurer accès systèmes',
        tool: 'configure_user_access',
        params: { default_role: 'user', grant_basic_permissions: true },
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 15000,
    requiredPermissions: ['write:profiles', 'write:taches', 'write:calendar', 'admin:access'],
    tags: ['rh', 'onboarding', 'nouvel employé', 'complet'],
  },

  // ============== INVOICE REMINDER SEQUENCE ==============
  {
    id: 'invoice_reminder_sequence',
    name: 'Séquence de Relance Factures',
    description: 'Relance automatique: J+7 rappel soft → J+15 rappel ferme → J+30 mise en demeure',
    category: 'finance',
    triggerCommand: 'Lance la séquence de relance factures impayées',
    steps: [
      {
        id: 'find_overdue_7days',
        name: 'Factures en retard +7 jours',
        tool: 'query_database',
        params: {
          table: 'factures',
          filters: [
            { column: 'statut', operator: 'in', value: ['Envoyée', 'En attente'] },
            { column: 'date_echeance', operator: 'lt', value: 'DAYS_AGO_7' },
            { column: 'date_echeance', operator: 'gte', value: 'DAYS_AGO_15' },
          ],
          select: 'id, numero, etablissement_id, montant_ttc, date_echeance',
        },
        onFailure: 'continue',
      },
      {
        id: 'send_soft_reminder',
        name: 'Envoyer rappels courtois',
        tool: 'send_bulk_emails',
        params: { template: 'invoice_reminder_soft', use_previous_result: true },
        condition: 'previous_result.count > 0',
        onFailure: 'notify',
      },
      {
        id: 'find_overdue_15days',
        name: 'Factures en retard +15 jours',
        tool: 'query_database',
        params: {
          table: 'factures',
          filters: [
            { column: 'statut', operator: 'in', value: ['Envoyée', 'En attente'] },
            { column: 'date_echeance', operator: 'lt', value: 'DAYS_AGO_15' },
            { column: 'date_echeance', operator: 'gte', value: 'DAYS_AGO_30' },
          ],
          select: 'id, numero, etablissement_id, montant_ttc, date_echeance',
        },
        onFailure: 'continue',
      },
      {
        id: 'send_firm_reminder',
        name: 'Envoyer rappels fermes',
        tool: 'send_bulk_emails',
        params: { template: 'invoice_reminder_firm', use_previous_result: true },
        condition: 'previous_result.count > 0',
        onFailure: 'notify',
      },
      {
        id: 'find_overdue_30days',
        name: 'Factures en retard +30 jours',
        tool: 'query_database',
        params: {
          table: 'factures',
          filters: [
            { column: 'statut', operator: 'in', value: ['Envoyée', 'En attente', 'En retard'] },
            { column: 'date_echeance', operator: 'lt', value: 'DAYS_AGO_30' },
          ],
          select: 'id, numero, etablissement_id, montant_ttc, date_echeance',
        },
        onFailure: 'continue',
      },
      {
        id: 'send_formal_notice',
        name: 'Envoyer mises en demeure',
        tool: 'send_bulk_emails',
        params: { template: 'invoice_formal_notice', use_previous_result: true, mark_as_critical: true },
        condition: 'previous_result.count > 0',
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 12000,
    requiredPermissions: ['read:factures', 'send:email'],
    tags: ['relance', 'facture', 'séquence', 'impayés'],
  },

  // ============== QUARTERLY BUSINESS REVIEW ==============
  {
    id: 'quarterly_business_review',
    name: 'Revue Trimestrielle',
    description: 'Collecter KPIs → Générer rapport → Planifier réunion direction',
    category: 'management',
    triggerCommand: 'Prépare la revue trimestrielle',
    steps: [
      {
        id: 'collect_sales_kpis',
        name: 'Collecter KPIs commerciaux',
        tool: 'calculate_sales_metrics',
        params: { period: 'last_quarter', include_comparison: true },
        onFailure: 'continue',
      },
      {
        id: 'collect_finance_kpis',
        name: 'Collecter KPIs financiers',
        tool: 'calculate_treasury_metrics',
        params: { period: 'last_quarter' },
        onFailure: 'continue',
      },
      {
        id: 'collect_hr_kpis',
        name: 'Collecter KPIs RH',
        tool: 'calculate_hr_metrics',
        params: { period: 'last_quarter' },
        onFailure: 'continue',
      },
      {
        id: 'collect_support_kpis',
        name: 'Collecter KPIs support',
        tool: 'calculate_support_metrics',
        params: { period: 'last_quarter' },
        onFailure: 'continue',
      },
      {
        id: 'generate_qbr_report',
        name: 'Générer rapport QBR',
        tool: 'generate_comprehensive_report',
        params: { type: 'quarterly_business_review', format: 'pdf', include_charts: true },
        onFailure: 'stop',
      },
      {
        id: 'schedule_qbr_meeting',
        name: 'Planifier réunion direction',
        tool: 'schedule_meeting',
        params: { 
          title: 'Revue Trimestrielle',
          duration_minutes: 120,
          attendees: 'direction_team',
          attach_report: true,
        },
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 20000,
    requiredPermissions: ['read:all', 'write:calendar', 'write:reports'],
    tags: ['trimestriel', 'revue', 'direction', 'qbr'],
  },

  // ============== PROSPECT NURTURING 7 DAYS ==============
  {
    id: 'prospect_nurturing_7days',
    name: 'Nurturing Prospect 7 Jours',
    description: 'J+1 email intro → J+3 case study → J+7 proposition d\'appel',
    category: 'sales',
    triggerCommand: 'Lance le nurturing prospect sur 7 jours',
    steps: [
      {
        id: 'identify_new_prospects',
        name: 'Identifier nouveaux prospects',
        tool: 'query_database',
        params: {
          table: 'etablissements',
          filters: [
            { column: 'statut', operator: 'eq', value: 'Prospect' },
            { column: 'created_at', operator: 'gte', value: 'DAYS_AGO_1' },
          ],
          select: 'id, nom, email, commercial_id',
        },
        onFailure: 'stop',
      },
      {
        id: 'send_intro_email',
        name: 'Envoyer email intro (J+1)',
        tool: 'send_bulk_emails',
        params: { template: 'prospect_intro', delay_hours: 0 },
        condition: 'previous_result.count > 0',
        onFailure: 'notify',
      },
      {
        id: 'schedule_case_study',
        name: 'Programmer case study (J+3)',
        tool: 'schedule_bulk_emails',
        params: { template: 'prospect_case_study', delay_days: 2 },
        onFailure: 'continue',
      },
      {
        id: 'schedule_call_proposal',
        name: 'Programmer proposition appel (J+7)',
        tool: 'schedule_bulk_emails',
        params: { template: 'prospect_call_proposal', delay_days: 6 },
        onFailure: 'continue',
      },
      {
        id: 'create_followup_tasks',
        name: 'Créer tâches de suivi',
        tool: 'create_bulk_tasks',
        params: { template: 'prospect_followup', days_due: 8 },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 8000,
    requiredPermissions: ['read:etablissements', 'send:email', 'write:taches'],
    tags: ['nurturing', 'prospect', 'séquence', '7jours'],
  },

  // ============== SUPPORT ESCALATION ==============
  {
    id: 'support_escalation',
    name: 'Escalade Ticket Critique',
    description: 'Notifier manager → Assigner senior → Planifier call client',
    category: 'support',
    triggerCommand: 'Escalade ce ticket critique',
    steps: [
      {
        id: 'notify_manager',
        name: 'Notifier le manager support',
        tool: 'send_notification',
        params: { recipients: 'support_manager', template: 'critical_ticket_alert', priority: 'high' },
        onFailure: 'continue',
      },
      {
        id: 'assign_senior',
        name: 'Assigner agent senior',
        tool: 'assign_ticket_to_senior',
        params: { priority_override: 'critical', notify_assignee: true },
        onFailure: 'notify',
      },
      {
        id: 'update_ticket_priority',
        name: 'Mettre à jour priorité',
        tool: 'update_entity_status',
        params: { entity_type: 'support_ticket', new_priority: 'critical' },
        onFailure: 'continue',
      },
      {
        id: 'schedule_client_call',
        name: 'Planifier appel client',
        tool: 'schedule_meeting',
        params: { 
          type: 'support_call',
          duration_minutes: 30,
          urgency: 'within_24h',
          include_client: true,
        },
        onFailure: 'notify',
      },
      {
        id: 'log_escalation',
        name: 'Logger l\'escalade',
        tool: 'log_activity',
        params: { type: 'ticket_escalation', notify_stakeholders: true },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 6000,
    requiredPermissions: ['write:tickets', 'send:notification', 'write:calendar'],
    tags: ['support', 'escalade', 'critique', 'urgent'],
  },

  // ============== CONTRACT RENEWAL 30 DAYS ==============
  {
    id: 'contract_renewal_30days',
    name: 'Renouvellement Contrat J-30',
    description: 'J-30 alerte → J-15 envoi proposition → J-7 relance',
    category: 'sales',
    triggerCommand: 'Lance le processus de renouvellement contrat',
    steps: [
      {
        id: 'find_expiring_contracts',
        name: 'Identifier contrats expirant dans 30j',
        tool: 'query_database',
        params: {
          table: 'contrats',
          filters: [
            { column: 'date_fin', operator: 'gte', value: 'TODAY' },
            { column: 'date_fin', operator: 'lte', value: 'DAYS_FROM_NOW_30' },
            { column: 'statut', operator: 'eq', value: 'Actif' },
          ],
          select: 'id, etablissement_id, date_fin, valeur_annuelle',
        },
        onFailure: 'stop',
      },
      {
        id: 'send_renewal_alert',
        name: 'Alerter commerciaux (J-30)',
        tool: 'send_notification',
        params: { template: 'contract_renewal_alert', to_role: 'commercial' },
        condition: 'previous_result.count > 0',
        onFailure: 'continue',
      },
      {
        id: 'generate_renewal_proposals',
        name: 'Générer propositions renouvellement',
        tool: 'generate_renewal_proposals',
        params: { include_upsell: true },
        onFailure: 'notify',
      },
      {
        id: 'create_renewal_tasks',
        name: 'Créer tâches de suivi',
        tool: 'create_bulk_tasks',
        params: { template: 'contract_renewal_followup', assign_to_commercial: true },
        onFailure: 'continue',
      },
      {
        id: 'schedule_renewal_emails',
        name: 'Programmer séquence emails',
        tool: 'schedule_email_sequence',
        params: { 
          sequence: ['renewal_proposal_j15', 'renewal_reminder_j7'],
          delays_days: [15, 23],
        },
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 10000,
    requiredPermissions: ['read:contrats', 'send:email', 'write:taches'],
    tags: ['contrat', 'renouvellement', 'j-30', 'relance'],
  },

  // ============== MONTHLY REPORT AUTOMATION ==============
  {
    id: 'monthly_report_automation',
    name: 'Rapport Mensuel Automatique',
    description: 'Sync données → Générer PDF → Envoyer par email à la direction',
    category: 'operations',
    triggerCommand: 'Génère et envoie le rapport mensuel',
    steps: [
      {
        id: 'sync_all_data',
        name: 'Synchroniser toutes les données',
        tool: 'sync_all_integrations',
        params: { include_qonto: true, include_emails: true },
        onFailure: 'continue',
        timeout_ms: 60000,
      },
      {
        id: 'calculate_all_metrics',
        name: 'Calculer tous les KPIs',
        tool: 'calculate_monthly_metrics',
        params: { period: 'last_month' },
        onFailure: 'continue',
      },
      {
        id: 'generate_pdf_report',
        name: 'Générer rapport PDF',
        tool: 'generate_comprehensive_report',
        params: { 
          type: 'monthly_summary',
          format: 'pdf',
          include_charts: true,
          include_executive_summary: true,
        },
        onFailure: 'stop',
      },
      {
        id: 'send_to_direction',
        name: 'Envoyer à la direction',
        tool: 'send_email',
        params: { 
          recipients: 'direction_team',
          template: 'monthly_report_delivery',
          attach_report: true,
        },
        onFailure: 'notify',
      },
      {
        id: 'archive_report',
        name: 'Archiver le rapport',
        tool: 'archive_document',
        params: { category: 'monthly_reports', retention_years: 5 },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 45000,
    requiredPermissions: ['read:all', 'write:reports', 'send:email'],
    tags: ['rapport', 'mensuel', 'automatique', 'direction'],
  },

  // ============== LEAD QUALIFICATION ==============
  {
    id: 'lead_qualification',
    name: 'Qualification Lead',
    description: 'Enrichir données → Scorer lead → Router vers commercial approprié',
    category: 'sales',
    triggerCommand: 'Qualifie les nouveaux leads',
    steps: [
      {
        id: 'fetch_new_leads',
        name: 'Récupérer nouveaux leads',
        tool: 'query_database',
        params: {
          table: 'etablissements',
          filters: [
            { column: 'statut', operator: 'eq', value: 'Lead' },
            { column: 'lead_score', operator: 'is', value: null },
          ],
          select: 'id, nom, email, telephone, ville, created_at',
          limit: 20,
        },
        onFailure: 'stop',
      },
      {
        id: 'enrich_data',
        name: 'Enrichir données leads',
        tool: 'enrich_lead_data',
        params: { sources: ['societe_info', 'linkedin'] },
        condition: 'previous_result.count > 0',
        onFailure: 'continue',
      },
      {
        id: 'calculate_score',
        name: 'Calculer score lead',
        tool: 'calculate_lead_score',
        params: { 
          criteria: ['company_size', 'industry_fit', 'engagement', 'budget_signals'],
        },
        onFailure: 'notify',
      },
      {
        id: 'assign_commercial',
        name: 'Assigner commercial',
        tool: 'route_lead_to_commercial',
        params: { 
          routing_strategy: 'round_robin_weighted',
          consider_territory: true,
          consider_capacity: true,
        },
        onFailure: 'notify',
      },
      {
        id: 'notify_assigned',
        name: 'Notifier commercial assigné',
        tool: 'send_notification',
        params: { template: 'new_qualified_lead', priority: 'high' },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 12000,
    requiredPermissions: ['read:etablissements', 'write:etablissements', 'send:notification'],
    tags: ['lead', 'qualification', 'scoring', 'routage'],
  },

  // ============== OFFBOARDING CHECKLIST ==============
  {
    id: 'offboarding_checklist',
    name: 'Départ Employé',
    description: 'Désactiver accès → Transférer responsabilités → Archiver données',
    category: 'hr',
    triggerCommand: 'Lance le processus de départ employé',
    steps: [
      {
        id: 'notify_stakeholders',
        name: 'Notifier parties prenantes',
        tool: 'send_notification',
        params: { recipients: ['manager', 'hr', 'it'], template: 'employee_departure_notice' },
        onFailure: 'continue',
      },
      {
        id: 'identify_responsibilities',
        name: 'Identifier responsabilités à transférer',
        tool: 'query_responsibilities',
        params: { 
          include_tasks: true,
          include_clients: true,
          include_projects: true,
        },
        onFailure: 'continue',
      },
      {
        id: 'create_transfer_tasks',
        name: 'Créer tâches de transfert',
        tool: 'create_tasks_from_template',
        params: { template: 'responsibility_transfer' },
        onFailure: 'notify',
      },
      {
        id: 'schedule_exit_interview',
        name: 'Planifier entretien de sortie',
        tool: 'schedule_meeting',
        params: { type: 'exit_interview', with: 'hr', duration_minutes: 60 },
        onFailure: 'continue',
      },
      {
        id: 'revoke_access',
        name: 'Révoquer accès systèmes',
        tool: 'revoke_user_access',
        params: { immediate: false, scheduled_date: 'last_day' },
        onFailure: 'notify',
      },
      {
        id: 'archive_user_data',
        name: 'Archiver données utilisateur',
        tool: 'archive_user_data',
        params: { retention_years: 5, comply_rgpd: true },
        onFailure: 'notify',
      },
    ],
    estimatedDurationMs: 8000,
    requiredPermissions: ['write:profiles', 'admin:access', 'write:calendar'],
    tags: ['rh', 'offboarding', 'départ', 'transfert'],
  },

  // ============== WEEKLY STANDUP PREP ==============
  {
    id: 'weekly_standup_prep',
    name: 'Préparation Standup Hebdo',
    description: 'Collecter tâches terminées → Identifier blocages → Générer résumé',
    category: 'operations',
    triggerCommand: 'Prépare le standup hebdomadaire',
    steps: [
      {
        id: 'collect_completed_tasks',
        name: 'Collecter tâches terminées',
        tool: 'query_database',
        params: {
          table: 'taches',
          filters: [
            { column: 'statut', operator: 'eq', value: 'Terminé' },
            { column: 'updated_at', operator: 'gte', value: 'DAYS_AGO_7' },
          ],
          select: 'titre, responsable_id, updated_at, etablissement_id',
          order_by: 'updated_at',
        },
        onFailure: 'continue',
      },
      {
        id: 'identify_blockers',
        name: 'Identifier blocages',
        tool: 'query_database',
        params: {
          table: 'taches',
          filters: [{ column: 'statut', operator: 'eq', value: 'Bloqué' }],
          select: 'titre, responsable_id, notes, etablissement_id',
        },
        onFailure: 'continue',
      },
      {
        id: 'collect_upcoming_deadlines',
        name: 'Collecter échéances proches',
        tool: 'query_database',
        params: {
          table: 'taches',
          filters: [
            { column: 'statut', operator: 'in', value: ['A faire', 'En cours'] },
            { column: 'echeance', operator: 'lte', value: 'DAYS_FROM_NOW_7' },
          ],
          select: 'titre, responsable_id, echeance, priorite',
          order_by: 'echeance',
        },
        onFailure: 'continue',
      },
      {
        id: 'generate_standup_summary',
        name: 'Générer résumé standup',
        tool: 'generate_ai_summary',
        params: { 
          type: 'weekly_standup',
          include_recommendations: true,
          format: 'markdown',
        },
        onFailure: 'stop',
      },
      {
        id: 'send_to_team',
        name: 'Envoyer à l\'équipe',
        tool: 'send_notification',
        params: { recipients: 'all_team', template: 'weekly_standup_summary' },
        onFailure: 'continue',
      },
    ],
    estimatedDurationMs: 8000,
    requiredPermissions: ['read:taches', 'send:notification'],
    tags: ['standup', 'hebdomadaire', 'équipe', 'résumé'],
  },
];

/**
 * Trouve un workflow par commande utilisateur
 */
export function findWorkflowByCommand(userCommand: string): WorkflowTemplate | null {
  const normalizedCommand = userCommand.toLowerCase().trim();
  
  // Recherche exacte
  for (const workflow of WORKFLOW_TEMPLATES) {
    if (workflow.triggerCommand.toLowerCase().includes(normalizedCommand) ||
        normalizedCommand.includes(workflow.triggerCommand.toLowerCase())) {
      return workflow;
    }
  }
  
  // Recherche par tags
  for (const workflow of WORKFLOW_TEMPLATES) {
    const matchingTags = workflow.tags.filter(tag => normalizedCommand.includes(tag));
    if (matchingTags.length >= 2) {
      return workflow;
    }
  }
  
  // Recherche par mots-clés dans la description
  for (const workflow of WORKFLOW_TEMPLATES) {
    const descWords = workflow.description.toLowerCase().split(' ');
    const matchCount = descWords.filter(word => 
      word.length > 3 && normalizedCommand.includes(word)
    ).length;
    
    if (matchCount >= 2) {
      return workflow;
    }
  }
  
  return null;
}

/**
 * Liste les workflows par catégorie
 */
export function getWorkflowsByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(w => w.category === category);
}

/**
 * Génère un résumé des workflows disponibles
 */
export function generateWorkflowCatalog(): string {
  const byCategory = new Map<string, WorkflowTemplate[]>();
  
  for (const workflow of WORKFLOW_TEMPLATES) {
    const existing = byCategory.get(workflow.category) || [];
    existing.push(workflow);
    byCategory.set(workflow.category, existing);
  }
  
  let catalog = '# Workflows Automatisés Disponibles\n\n';
  
  const categoryNames: Record<string, string> = {
    sales: '🎯 Commercial',
    finance: '💰 Finance',
    hr: '👥 Ressources Humaines',
    support: '🎫 Support',
    operations: '⚙️ Opérations',
    management: '📊 Management',
  };
  
  for (const [category, workflows] of byCategory) {
    catalog += `## ${categoryNames[category] || category}\n\n`;
    
    for (const w of workflows) {
      catalog += `### ${w.name}\n`;
      catalog += `${w.description}\n`;
      catalog += `**Commande:** "${w.triggerCommand}"\n`;
      catalog += `**Étapes:** ${w.steps.length} | **Durée estimée:** ${Math.round(w.estimatedDurationMs / 1000)}s\n\n`;
    }
  }
  
  return catalog;
}
