import { describe, it, expect } from 'vitest';
import {
  CALL_STATUS_LABELS,
  CALL_DIRECTION_LABELS,
  type Call,
  type UserPhoneSettings,
  type SipCredentials,
  type CallTarget,
  type CallStatus,
  type CallDirection,
  type SipTransport,
} from './calls';

describe('calls.ts', () => {
  it('expose les libellés attendus pour tous les statuts', () => {
    const expected: Record<CallStatus, string> = {
      initiating: 'Initialisation',
      ringing: 'Sonnerie',
      'in-progress': 'En cours',
      completed: 'Terminé',
      missed: 'Manqué',
      failed: 'Échec',
      canceled: 'Annulé',
    };

    expect(CALL_STATUS_LABELS).toEqual(expected);
    expect(CALL_STATUS_LABELS.initiating).toBe('Initialisation');
    expect(CALL_STATUS_LABELS.ringing).toBe('Sonnerie');
    expect(CALL_STATUS_LABELS['in-progress']).toBe('En cours');
    expect(CALL_STATUS_LABELS.completed).toBe('Terminé');
    expect(CALL_STATUS_LABELS.missed).toBe('Manqué');
    expect(CALL_STATUS_LABELS.failed).toBe('Échec');
    expect(CALL_STATUS_LABELS.canceled).toBe('Annulé');
    expect(Object.keys(CALL_STATUS_LABELS)).toHaveLength(7);
  });

  it('expose les libellés attendus pour les directions', () => {
    const expected: Record<CallDirection, string> = {
      outbound: 'Sortant',
      inbound: 'Entrant',
    };

    expect(CALL_DIRECTION_LABELS).toEqual(expected);
    expect(CALL_DIRECTION_LABELS.outbound).toBe('Sortant');
    expect(CALL_DIRECTION_LABELS.inbound).toBe('Entrant');
    expect(Object.keys(CALL_DIRECTION_LABELS)).toHaveLength(2);
  });

  it('permet de typer un objet Call cohérent avec le domaine téléphonie', () => {
    const call: Call = {
      id: 'call-1',
      user_id: 'user-1',
      direction: 'outbound',
      from_number: '+33100000001',
      to_number: '+33100000002',
      display_name: 'Alice Martin',
      contact_id: 'contact-1',
      etablissement_id: 'eta-1',
      prospect_id: 'prospect-1',
      status: 'completed',
      started_at: '2024-01-01T10:00:00.000Z',
      answered_at: '2024-01-01T10:00:03.000Z',
      ended_at: '2024-01-01T10:02:03.000Z',
      duration_sec: 120,
      recording_path: '/records/call-1.wav',
      recording_purged_at: null,
      notes: 'Appel de qualification terminé',
      failure_reason: null,
      sip_call_id: 'sip-1',
      metadata: { source: 'softphone', quality: 'good' },
      created_at: '2024-01-01T10:00:00.000Z',
      updated_at: '2024-01-01T10:02:03.000Z',
    };

    expect(call.direction).toBe('outbound');
    expect(call.status).toBe('completed');
    expect(call.duration_sec).toBe(120);
    expect(call.display_name).toBe('Alice Martin');
    expect(call.metadata).toEqual({ source: 'softphone', quality: 'good' });
    expect(CALL_STATUS_LABELS[call.status]).toBe('Terminé');
    expect(CALL_DIRECTION_LABELS[call.direction]).toBe('Sortant');
  });

  it('permet de typer la configuration téléphonique utilisateur et les identifiants SIP', () => {
    const transport: SipTransport = 'wss';

    const settings: UserPhoneSettings = {
      id: 'ups-1',
      user_id: 'user-1',
      sip_uri: 'sip:user@example.test',
      sip_username: 'user',
      sip_domain: 'example.test',
      sip_proxy: null,
      sip_transport: transport,
      caller_id: '+33100000003',
      is_active: true,
      record_calls: true,
      rgpd_announcement: 'Cet appel peut être enregistré',
    };

    const credentials: SipCredentials = {
      sip_uri: settings.sip_uri,
      sip_username: settings.sip_username,
      sip_password: 'pwd',
      sip_domain: settings.sip_domain,
      sip_proxy: settings.sip_proxy,
      sip_transport: settings.sip_transport,
      caller_id: settings.caller_id,
      record_calls: settings.record_calls,
      rgpd_announcement: settings.rgpd_announcement,
    };

    expect(settings.sip_transport).toBe('wss');
    expect(settings.is_active).toBe(true);
    expect(settings.record_calls).toBe(true);
    expect(credentials.sip_uri).toBe('sip:user@example.test');
    expect(credentials.sip_username).toBe('user');
    expect(credentials.sip_domain).toBe('example.test');
    expect(credentials.caller_id).toBe('+33100000003');
  });

  it('permet de typer une cible d appel métier', () => {
    const target: CallTarget = {
      phoneNumber: '+33100000004',
      displayName: 'Bob Dupont',
      contactId: 'contact-2',
      etablissementId: 'eta-2',
      prospectId: 'prospect-2',
    };

    expect(target.phoneNumber).toBe('+33100000004');
    expect(target.displayName).toBe('Bob Dupont');
    expect(target.contactId).toBe('contact-2');
    expect(target.etablissementId).toBe('eta-2');
    expect(target.prospectId).toBe('prospect-2');
  });

  it('associe correctement les libellés à une combinaison direction/statut réelle', () => {
    const direction: CallDirection = 'inbound';
    const status: CallStatus = 'missed';

    expect(CALL_DIRECTION_LABELS[direction]).toBe('Entrant');
    expect(CALL_STATUS_LABELS[status]).toBe('Manqué');
    expect(`${CALL_DIRECTION_LABELS[direction]} - ${CALL_STATUS_LABELS[status]}`).toBe('Entrant - Manqué');
  });
});