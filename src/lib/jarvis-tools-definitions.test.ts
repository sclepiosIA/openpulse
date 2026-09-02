import { describe, it, expect } from 'vitest';
import {
  JARVIS_REALTIME_TOOLS,
  SENSITIVE_VOICE_ACTIONS,
  getRealtimeToolsForSession,
  getActionDescription,
} from './jarvis-tools-definitions';

const { LONG_PROMPT } = vi.hoisted(() => ({
  LONG_PROMPT: 'x'.repeat(75),
}));

describe('jarvis-tools-definitions', () => {
  it('expose a non-empty JARVIS_REALTIME_TOOLS list with valid structure and unique names', () => {
    expect(Array.isArray(JARVIS_REALTIME_TOOLS)).toBe(true);
    expect(JARVIS_REALTIME_TOOLS.length).toBeGreaterThan(0);

    const names = JARVIS_REALTIME_TOOLS.map(t => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    for (const tool of JARVIS_REALTIME_TOOLS) {
      expect(tool.type).toBe('function');
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(typeof tool.parameters.properties).toBe('object');
    }

    // spot-check presence of some key tools
    expect(names).toEqual(expect.arrayContaining([
      'query_database',
      'send_email',
      'create_task',
      'update_entity_status',
      'schedule_meeting',
      'get_user_context',
      'search_knowledge_base',
      'get_bank_balance',
      'create_invoice',
      'calculate_payroll_kpis',
      'manage_absence',
      'manage_user_story',
      'calculate_rd_metrics',
      'create_support_ticket',
      'get_support_kpis',
      'get_dashboard_summary',
      'calculate_metrics',
      'manage_etablissement',
      'manage_contact',
      'translate_email',
      'suggest_email_response',
      'web_search',
      'create_reminder',
      'list_workflows_v2',
      'create_workflow_from_prompt',
      'list_catalogue_produits',
      'get_activity_feed',
      'get_churn_risk_accounts',
      'get_sales_forecast',
      'list_signature_requests',
      'run_custom_report',
      'get_workflow_runs',
      'get_churn_account_detail',
      'compare_forecast_vs_actual',
      'get_attribution_analysis',
    ]));

    // spot-check enums and required fields of some tools
    const createTask = JARVIS_REALTIME_TOOLS.find(t => t.name === 'create_task');
    expect(createTask?.parameters.required).toEqual(['titre']);
    // @ts-expect-error - accessing specific shape to validate
    expect(createTask?.parameters.properties.priorite.enum).toEqual(['basse', 'moyenne', 'haute', 'critique']);

    const queryDb = JARVIS_REALTIME_TOOLS.find(t => t.name === 'query_database');
    expect(queryDb?.parameters.required).toEqual(['table']);

    const calculateMetrics = JARVIS_REALTIME_TOOLS.find(t => t.name === 'calculate_metrics');
    // @ts-expect-error - accessing specific shape to validate
    expect(calculateMetrics?.parameters.properties.metric_type.enum).toEqual(['pipeline_value', 'conversion_rate', 'tasks_completion']);
  });

  it('getRealtimeToolsForSession returns mapped tools with same length and expected fields', () => {
    const sessionTools = getRealtimeToolsForSession();
    expect(Array.isArray(sessionTools)).toBe(true);
    expect(sessionTools.length).toBe(JARVIS_REALTIME_TOOLS.length);

    // names should match
    const sessionNames = sessionTools.map(t => t.name);
    const originalNames = JARVIS_REALTIME_TOOLS.map(t => t.name);
    expect(sessionNames).toEqual(originalNames);

    // check one sample tool mapping integrity
    const name = 'create_task';
    const original = JARVIS_REALTIME_TOOLS.find(t => t.name === name);
    const mapped = sessionTools.find(t => t.name === name);
    expect(mapped).toBeDefined();
    expect(mapped?.type).toBe(original?.type);
    expect(mapped?.description).toBe(original?.description);
    // parameters reference is preserved (by design here)
    expect(mapped?.parameters).toBe(original?.parameters);
  });

  it('SENSITIVE_VOICE_ACTIONS lists all sensitive actions', () => {
    expect(SENSITIVE_VOICE_ACTIONS).toEqual([
      'send_email',
      'batch_send_emails',
      'create_invoice',
      'manage_user',
      'manage_user_role',
      'request_signature',
      'cleanup_old_data',
      'delete_entity',
      'create_workflow_from_prompt',
      'run_workflow_now',
      'toggle_workflow',
      'manage_catalogue_produit',
      'cancel_signature',
      'remind_signature',
      'recompute_churn_risk',
    ]);
    // sanity: at least a subset is present in tool names (some may not be tools)
    const toolNames = new Set(JARVIS_REALTIME_TOOLS.map(t => t.name));
    expect(toolNames.has('send_email')).toBe(true);
    expect(toolNames.has('create_invoice')).toBe(true);
    expect(toolNames.has('create_workflow_from_prompt')).toBe(true);
  });

  it('getActionDescription returns correct messages for known actions and default', () => {
    // send_email
    expect(getActionDescription('send_email', { to: 'user@example.co' })).toBe('envoyer un email à user@example.co');
    expect(getActionDescription('send_email', {})).toBe('envoyer un email à destinataire');

    // create_invoice
    expect(getActionDescription('create_invoice', {})).toBe('créer une facture');

    // request_signature
    expect(getActionDescription('request_signature', {})).toBe('demander une signature');

    // cleanup_old_data
    expect(getActionDescription('cleanup_old_data', {})).toBe('nettoyer les anciennes données');

    // create_workflow_from_prompt with long prompt trimmed to 60 chars and ellipsis
    const trimmed = String(LONG_PROMPT).slice(0, 60);
    expect(getActionDescription('create_workflow_from_prompt', { prompt: LONG_PROMPT })).toBe(`créer une automatisation : "${trimmed}…"`);

    // toggle_workflow
    expect(getActionDescription('toggle_workflow', { is_active: true })).toBe('activer un workflow');
    expect(getActionDescription('toggle_workflow', { is_active: false })).toBe('désactiver un workflow');

    // manage_catalogue_produit
    expect(getActionDescription('manage_catalogue_produit', { action: 'supprimer' })).toBe('supprimer un produit du catalogue');
    expect(getActionDescription('manage_catalogue_produit', {})).toBe('modifier un produit du catalogue');

    // cancel/remind/recompute churn actions
    expect(getActionDescription('cancel_signature', {})).toBe('annuler une demande de signature');
    expect(getActionDescription('remind_signature', {})).toBe('relancer les signataires');
    expect(getActionDescription('recompute_churn_risk', {})).toBe('recalculer les prédictions de churn');

    // run_workflow_now
    expect(getActionDescription('run_workflow_now', {})).toBe('déclencher manuellement un workflow');

    // default fallback
    expect(getActionDescription('unknown_tool_xyz', {})).toBe('exécuter unknown_tool_xyz');
  });
});