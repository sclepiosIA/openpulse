import { describe, it, expect } from 'vitest';
import { TRIGGER_LABELS, ACTION_LABELS } from './workflow';

describe('workflow.ts - constants', () => {
  it('exposes correct trigger labels and counts', () => {
    expect(TRIGGER_LABELS['email.received']).toBe('Email entrant reçu');
    expect(TRIGGER_LABELS['webhook']).toBe('🔌 Webhook entrant');
    // Ensure all defined trigger types are accounted for
    expect(Object.keys(TRIGGER_LABELS).length).toBe(19);
  });

  it('exposes correct action labels and counts', () => {
    expect(ACTION_LABELS['send_email']).toBe('Envoyer un email');
    expect(ACTION_LABELS['wait']).toBe('Attendre');
    // Ensure all defined action types are accounted for
    expect(Object.keys(ACTION_LABELS).length).toBe(24);
  });
});