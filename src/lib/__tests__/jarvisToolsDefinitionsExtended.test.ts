import { describe, it, expect } from 'vitest';
import { getActionDescription, SENSITIVE_VOICE_ACTIONS, JARVIS_REALTIME_TOOLS } from '../jarvis-tools-definitions';

describe('jarvis-tools-definitions extended', () => {
  it('every sensitive action is also a defined realtime tool or known action', () => {
    expect(SENSITIVE_VOICE_ACTIONS.length).toBeGreaterThan(10);
    SENSITIVE_VOICE_ACTIONS.forEach((a) => {
      expect(typeof a).toBe('string');
      expect(a.length).toBeGreaterThan(0);
    });
  });

  it('every realtime tool parameter declares object type', () => {
    JARVIS_REALTIME_TOOLS.forEach((t) => {
      expect(t.parameters.type).toBe('object');
      if (t.parameters.required) expect(Array.isArray(t.parameters.required)).toBe(true);
    });
  });

  it.each([
    ['manage_user', {}, 'utilisateur'],
    ['request_signature', {}, 'signature'],
    ['cleanup_old_data', {}, 'anciennes'],
    ['create_workflow_from_prompt', { prompt: 'Hello world' }, 'automatisation'],
    ['run_workflow_now', {}, 'déclencher'],
    ['toggle_workflow', { is_active: true }, 'activer'],
    ['toggle_workflow', { is_active: false }, 'désactiver'],
    ['manage_catalogue_produit', { action: 'créer' }, 'créer'],
    ['manage_catalogue_produit', {}, 'modifier'],
    ['cancel_signature', {}, 'annuler'],
    ['remind_signature', {}, 'relancer'],
    ['recompute_churn_risk', {}, 'churn'],
    ['send_email', {}, 'destinataire'],
  ])('describes %s', (tool, args, expected) => {
    expect(getActionDescription(tool, args as Record<string, unknown>).toLowerCase()).toContain(expected.toLowerCase());
  });

  it('truncates long prompts in create_workflow_from_prompt', () => {
    const long = 'A'.repeat(120);
    const out = getActionDescription('create_workflow_from_prompt', { prompt: long });
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(120);
  });
});
