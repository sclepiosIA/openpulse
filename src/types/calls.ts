/**
 * Types pour le module CTI / Téléphonie SIP.
 */

export type CallStatus =
  | 'initiating'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'missed'
  | 'failed'
  | 'canceled';

export type CallDirection = 'outbound' | 'inbound';

export type SipTransport = 'tls' | 'wss' | 'tcp' | 'udp';

export interface Call {
  id: string;
  user_id: string;
  direction: CallDirection;
  from_number: string;
  to_number: string;
  display_name: string | null;
  contact_id: string | null;
  etablissement_id: string | null;
  prospect_id: string | null;
  status: CallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_sec: number;
  recording_path: string | null;
  recording_purged_at: string | null;
  notes: string | null;
  failure_reason: string | null;
  sip_call_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserPhoneSettings {
  id: string;
  user_id: string;
  sip_uri: string;
  sip_username: string;
  sip_domain: string;
  sip_proxy: string | null;
  sip_transport: SipTransport;
  caller_id: string | null;
  is_active: boolean;
  record_calls: boolean;
  rgpd_announcement: string | null;
}

export interface SipCredentials {
  sip_uri: string;
  sip_username: string;
  sip_password: string;
  sip_domain: string;
  sip_proxy: string | null;
  sip_transport: SipTransport;
  caller_id: string | null;
  record_calls: boolean;
  rgpd_announcement: string | null;
}

export interface CallTarget {
  phoneNumber: string;
  displayName?: string;
  contactId?: string;
  etablissementId?: string;
  prospectId?: string;
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  initiating: 'Initialisation',
  ringing: 'Sonnerie',
  'in-progress': 'En cours',
  completed: 'Terminé',
  missed: 'Manqué',
  failed: 'Échec',
  canceled: 'Annulé',
};

export const CALL_DIRECTION_LABELS: Record<CallDirection, string> = {
  outbound: 'Sortant',
  inbound: 'Entrant',
};
