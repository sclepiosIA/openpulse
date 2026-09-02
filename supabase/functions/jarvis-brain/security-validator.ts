/**
 * JARVIS 12.0 - Security Validator
 * 
 * Valide les permissions utilisateur avant l'exécution des outils.
 * Gère les niveaux de risque et les confirmations requises.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Types de rôles applicatifs
export type AppRole = 'admin' | 'direction' | 'rh' | 'commercial' | 'csm' | 'chef_projet' | 'user';

// Niveaux de risque des outils
export type RiskLevel = 'safe' | 'moderate' | 'sensitive' | 'critical';

// Classification des outils par niveau de risque
export const TOOL_RISK_LEVELS: Record<string, RiskLevel> = {
  // Safe: Lecture seule - pas de confirmation
  'query_database': 'safe',
  'get_user_context': 'safe',
  'search_knowledge_base': 'safe',
  'calculate_metrics': 'safe',
  'get_employee_competences': 'safe',
  'get_recruitment_pipeline': 'safe',
  'get_session_attendance': 'safe',
  'get_training_analytics': 'safe',
  'get_support_kpis': 'safe',
  'calculate_rd_metrics': 'safe',
  'calculate_payroll_kpis': 'safe',
  'detect_calendar_conflicts': 'safe',
  'get_bank_balance': 'safe',
  'get_ai_usage_stats': 'safe',
  'get_system_logs': 'safe',
  // Analytics tools - safe (read-only)
  'get_dashboard_summary': 'safe',
  'get_daily_digest': 'safe',
  'get_performance_report': 'safe',
  'analyze_trends': 'safe',
  'get_smart_suggestions': 'safe',
  'compare_periods': 'safe',
  'export_data': 'safe',
  // Notification tools - safe (read)
  'get_notifications': 'safe',
  'auto_followup_check': 'safe',
  'get_team_availability': 'safe',
  // NEW: Web Search - safe (read-only, external)
  'web_search': 'safe',
  // NEW: Utility tools - safe (no data modification)
  'get_weather': 'safe',
  'calculate_date': 'safe',
  'convert_units': 'safe',
  // NEW: Document AI - safe (analysis only)
  'summarize_content': 'safe',
  'analyze_with_ai': 'safe',
  'extract_data': 'safe',
  // NEW Phase 2: Reporting - safe (read-only reports)
  'generate_report': 'safe',
  'create_dashboard_snapshot': 'safe',
  'get_automation_stats': 'safe',
  'list_automation_rules': 'safe',
  // NEW Phase 2: File reading - safe
  'list_files': 'safe',
  'get_file_url': 'safe',
  'search_documents': 'safe',
  'get_storage_stats': 'safe',
  // NEW Phase 2: Advanced analytics - safe
  'predict_trend': 'safe',
  'detect_anomalies': 'safe',
  'correlation_analysis': 'safe',
  'get_performance_score': 'safe',
  // Pulse - safe (read-only)
  'list_pulse_conversations': 'safe',
  'search_pulse_messages': 'safe',
  // CSM - safe
  'get_csm_health_score': 'safe',
  'get_csm_kpis': 'safe',
  'get_churn_predictions': 'safe',
  'get_contrat_alerts': 'safe',
  'get_candidate_history': 'safe',
  'get_satisfaction_results': 'safe',
  'get_tresorerie_summary': 'safe',
  // Forum - safe
  'vote_forum_post': 'safe',
  'bookmark_forum_post': 'safe',
  // People/HR dossier - safe (read-only aggregate)
  'get_employee_dossier': 'safe',

  // Moderate: Création - confirmation si autonomousMode = false
  'create_task': 'moderate',
  'schedule_meeting': 'moderate',
  'create_reminder': 'moderate',
  'create_invoice': 'moderate',
  'create_training_session': 'moderate',
  'create_recurring_event': 'moderate',
  'create_email_template': 'moderate',
  'create_support_ticket': 'moderate',
  'manage_epic': 'moderate',
  'manage_user_story': 'moderate',
  'manage_sprint': 'moderate',
  'manage_job_offer': 'moderate',
  'manage_candidate': 'moderate',
  'manage_absence': 'moderate',
  'manage_certification': 'moderate',
  'manage_contract_template': 'moderate',
  'manage_document': 'moderate',
  'manage_expense': 'moderate',
  'register_attendance': 'moderate',
  // Invoice & profile management - moderate
  'manage_invoice': 'moderate',
  'update_profile': 'moderate',
  'move_story_to_sprint': 'moderate',
  'schedule_interview': 'moderate',
  'evaluate_candidate': 'moderate',
  'assign_ticket': 'moderate',
  'update_ticket_status': 'moderate',
  'recommend_training': 'moderate',
  'ai_assist_story': 'moderate',
  'forecast_cashflow': 'moderate',
  'import_ics_calendar': 'moderate',
  'report_jarvis_issue': 'moderate',
  'mark_notifications_read': 'moderate',
  'create_workflow': 'moderate',
  // NEW: CRM Management - moderate (data modification with confirmation)
  'manage_contact': 'moderate',
  'manage_groupe': 'moderate',
  'manage_partenaire': 'moderate',
  // NEW Phase 2: Automation - moderate (creates rules but doesn't execute)
  // NOTE: create_reminder already defined at line 75
  'create_automation_rule': 'moderate',
  'toggle_automation_rule': 'moderate',
  'create_scheduled_task': 'moderate',
  'schedule_report': 'moderate',
  // NEW Phase 2: File management - moderate (creates/organizes)
  'create_folder': 'moderate',
  'move_file': 'moderate',
  'copy_file': 'moderate',
  // Pulse - moderate (data modification)
  'send_pulse_message': 'moderate',
  'create_pulse_conversation': 'moderate',
  // NEW: File deletion - sensitive (destructive action)
  'delete_file': 'sensitive',

  // Task management
  'update_task': 'moderate',
  'delete_task': 'sensitive',
  'manage_subtask': 'moderate',
  'log_time_entry': 'moderate',
  'manage_task_recurrence': 'moderate',

  // Devis
  'manage_devis': 'moderate',
  'add_devis_ligne': 'moderate',
  'convert_devis_to_invoice': 'sensitive',

  // Forum
  'manage_forum_post': 'moderate',
  'manage_forum_comment': 'moderate',

  // CSM
  'manage_csm_milestone': 'moderate',
  'manage_csm_billing_followup': 'moderate',

  // Calendar management
  'update_calendar_event': 'moderate',
  'delete_calendar_event': 'sensitive',
  'manage_event_attendees': 'moderate',
  'manage_event_reminder': 'moderate',
  'manage_booking': 'moderate',

  // Avoirs
  'manage_avoir': 'moderate',
  'add_avoir_ligne': 'moderate',

  // Email management
  'manage_email_draft': 'moderate',
  'manage_email_filter': 'moderate',
  'manage_email_thread': 'moderate',
  'classify_email_thread': 'moderate',

  // Tresorerie management
  'manage_revenue': 'moderate',
  'manage_budget': 'moderate',

  // R&D extended
  'manage_rd_comment': 'moderate',
  'manage_rd_label': 'moderate',

  // Contracts extended
  'manage_contrat_avenant': 'moderate',

  // Sensitive: Modification/Envoi - toujours confirmation
  'send_email': 'sensitive',
  'send_notification': 'sensitive',
  'update_entity_status': 'sensitive',
  'translate_email': 'sensitive',
  'correct_email': 'sensitive',
  'reformulate_email': 'sensitive',
  'suggest_email_response': 'sensitive',
  'generate_invoice_pdf': 'sensitive',
  'generate_contract': 'sensitive',
  'ai_assist_contract': 'sensitive',
  'request_signature': 'sensitive',
  'parse_payslip': 'sensitive',
  'parse_cv': 'sensitive',
  'sync_qonto_transactions': 'sensitive',
  'reconcile_transaction': 'sensitive',
  'sync_rh_to_treasury': 'sensitive',
  'sync_external_calendar': 'sensitive',
  'send_satisfaction_survey': 'sensitive',
  // Batch tools - sensitive (modify multiple records)
  'batch_update_tasks': 'sensitive',
  'batch_send_emails': 'sensitive',
  'batch_create_tasks': 'sensitive',
  'batch_assign_tasks': 'sensitive',
  'batch_close_tickets': 'sensitive',
  'bulk_email_classification': 'sensitive',
  // NEW: manage_etablissement is sensitive (core CRM data)
  'manage_etablissement': 'sensitive',

  // Critical: Admin - double confirmation + log audit
  'manage_user': 'critical',
  'manage_user_role': 'critical',
  'export_data_rgpd': 'critical',
  'export_fec': 'critical',
  'execute_edge_function': 'critical',
  'manage_notification_preferences': 'critical',
  'manage_onboarding': 'critical',
  'cleanup_old_data': 'critical',

  // === NEW: P6→P10 modules ===
  'list_workflows_v2': 'safe',
  'get_workflow_runs': 'safe',
  'create_workflow_from_prompt': 'sensitive',
  'toggle_workflow': 'sensitive',
  'run_workflow_now': 'sensitive',
  'list_catalogue_produits': 'safe',
  'get_catalogue_stats': 'safe',
  'manage_catalogue_produit': 'sensitive',
  'list_custom_reports': 'safe',
  'run_custom_report': 'safe',
  'export_custom_report': 'moderate',
  'get_activity_feed': 'safe',
  'pin_activity_event': 'moderate',
  'get_churn_risk_accounts': 'safe',
  'recompute_churn_risk': 'sensitive',
  'get_churn_account_detail': 'safe',
  'get_sales_forecast': 'safe',
  'compare_forecast_vs_actual': 'safe',
  'list_signature_requests': 'safe',
  'remind_signature': 'sensitive',
  'cancel_signature': 'sensitive',
  'get_attribution_analysis': 'safe',
};

// Permissions par outil (quels rôles peuvent exécuter quel outil)
const TOOL_PERMISSIONS: Record<string, AppRole[]> = {
  // Outils admin uniquement
  'manage_user': ['admin', 'direction'],
  'manage_user_role': ['admin'],
  'get_system_logs': ['admin', 'direction'],
  'export_data_rgpd': ['admin', 'direction'],
  'export_fec': ['admin', 'direction'],
  
  // Outils RH
  'parse_payslip': ['admin', 'rh', 'direction'],
  'get_employee_salaries': ['admin', 'rh', 'direction'],
  'get_employee_dossier': ['admin', 'rh', 'direction'],
  'manage_absence': ['admin', 'rh', 'direction'],
  'calculate_payroll_kpis': ['admin', 'rh', 'direction'],
  'manage_onboarding': ['admin', 'rh', 'direction'],
  'sync_rh_to_treasury': ['admin', 'rh', 'direction'],
  'update_profile': ['admin', 'rh', 'direction'],
  
  // Outils trésorerie
  'sync_qonto_transactions': ['admin', 'direction'],
  'reconcile_transaction': ['admin', 'direction'],
  'create_invoice': ['admin', 'direction', 'commercial'],
  'manage_invoice': ['admin', 'direction', 'commercial'],
  'generate_invoice_pdf': ['admin', 'direction', 'commercial'],
  'manage_expense': ['admin', 'direction'],
  'get_bank_balance': ['admin', 'direction'],
  'forecast_cashflow': ['admin', 'direction'],
  
  // Outils recrutement
  'manage_job_offer': ['admin', 'rh', 'direction'],
  'manage_candidate': ['admin', 'rh'],
  'schedule_interview': ['admin', 'rh'],
  'evaluate_candidate': ['admin', 'rh', 'direction'],
  'parse_cv': ['admin', 'rh'],
  'get_recruitment_pipeline': ['admin', 'rh', 'direction'],

  // === NEW: P6→P10 modules — direction-only writes ===
  'create_workflow_from_prompt': ['admin', 'direction'],
  'toggle_workflow': ['admin', 'direction'],
  'run_workflow_now': ['admin', 'direction'],
  'manage_catalogue_produit': ['admin', 'direction', 'commercial'],
  'recompute_churn_risk': ['admin', 'direction', 'csm'],
  'cancel_signature': ['admin', 'direction'],
  'remind_signature': ['admin', 'direction', 'commercial', 'csm'],
  'export_custom_report': ['admin', 'direction', 'csm', 'commercial', 'chef_projet'],

  // Default: accessible à tous les utilisateurs authentifiés
};

const DEFAULT_ROLES: AppRole[] = ['admin', 'direction', 'rh', 'commercial', 'csm', 'chef_projet', 'user'];

/**
 * Valide si un utilisateur a la permission d'exécuter un outil
 */
export async function validateToolPermission(
  supabase: SupabaseClient,
  userId: string,
  toolName: string
): Promise<{ allowed: boolean; reason?: string; userRoles: AppRole[] }> {
  try {
    // Récupérer les rôles de l'utilisateur
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('[SecurityValidator] Error fetching roles:', error);
      return { allowed: false, reason: 'Unable to verify permissions', userRoles: [] };
    }

    const userRoles = (roles?.map(r => r.role) || ['user']) as AppRole[];
    
    // Récupérer les rôles requis pour cet outil
    const requiredRoles = TOOL_PERMISSIONS[toolName] || DEFAULT_ROLES;
    
    // Vérifier si l'utilisateur a au moins un des rôles requis
    const hasPermission = userRoles.some(role => requiredRoles.includes(role));

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Cette action nécessite l'un des rôles suivants: ${requiredRoles.join(', ')}`,
        userRoles
      };
    }

    return { allowed: true, userRoles };
  } catch (error) {
    console.error('[SecurityValidator] Exception:', error);
    return { allowed: false, reason: 'Permission check failed', userRoles: [] };
  }
}

/**
 * Détermine si un outil nécessite une confirmation utilisateur
 */
/**
 * Détermine si un outil nécessite une confirmation utilisateur
 * Seules les actions sensitive et critical requièrent confirmation
 * Les actions safe et moderate s'exécutent automatiquement
 */
export function requiresConfirmation(toolName: string): boolean {
  const riskLevel = TOOL_RISK_LEVELS[toolName] || 'moderate';
  return riskLevel === 'sensitive' || riskLevel === 'critical';
}

/**
 * Obtient le niveau de risque d'un outil
 */
export function getToolRiskLevel(toolName: string): RiskLevel {
  return TOOL_RISK_LEVELS[toolName] || 'moderate';
}

// Alias for tests
export const getRiskLevel = getToolRiskLevel;

/**
 * Vérifie si un outil nécessite un audit log
 */
export function requiresAuditLog(toolName: string): boolean {
  const riskLevel = TOOL_RISK_LEVELS[toolName] || 'moderate';
  return riskLevel === 'sensitive' || riskLevel === 'critical';
}

// ============================================================
// INPUT VALIDATION
// ============================================================

export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'date' | 'array';
    required?: boolean;
    sanitize?: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SQL_INJECTION_PATTERNS = [
  /('|(\\')|(;)|(--)|(\/\*)|(\*\/)|(\bOR\b)|(\bAND\b))/gi,
  /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b|\bSELECT\b.*\bFROM\b)/gi
];
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi
];

/**
 * Valide et sanitize les inputs
 */
export function validateInput(
  input: Record<string, unknown>,
  schema: ValidationSchema
): ValidationResult {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = input[key];

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field '${key}' is required`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    switch (rules.type) {
      case 'email':
        if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
          errors.push(`Field '${key}' must be a valid email`);
        }
        break;
      case 'uuid':
        if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
          errors.push(`Field '${key}' must be a valid UUID`);
        }
        break;
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${key}' must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`Field '${key}' must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Field '${key}' must be a boolean`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Field '${key}' must be an array`);
        }
        break;
    }

    // Sanitize if requested
    if (rules.sanitize && typeof value === 'string') {
      let sanitizedValue = value;
      
      // Check for SQL injection
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(sanitizedValue)) {
          sanitizedValue = sanitizedValue.replace(pattern, '');
        }
      }
      
      // Check for XSS
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(sanitizedValue)) {
          sanitizedValue = sanitizedValue.replace(pattern, '');
        }
      }
      
      sanitized[key] = sanitizedValue;
    } else {
      sanitized[key] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

/**
 * Valide la sécurité globale d'une requête outil
 */
export function validateToolSecurity(
  toolName: string,
  args: Record<string, unknown>,
  userRoles: AppRole[]
): { allowed: boolean; reason?: string } {
  const riskLevel = getToolRiskLevel(toolName);
  const requiredRoles = TOOL_PERMISSIONS[toolName] || DEFAULT_ROLES;
  
  // Check role permission
  const hasPermission = userRoles.some(role => requiredRoles.includes(role));
  
  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Requires roles: ${requiredRoles.join(', ')}`
    };
  }
  
  // Critical tools need admin or direction
  if (riskLevel === 'critical' && !userRoles.includes('admin') && !userRoles.includes('direction')) {
    return {
      allowed: false,
      reason: 'Critical action requires admin or direction role'
    };
  }
  
  return { allowed: true };
}
