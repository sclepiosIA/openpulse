// Types pour le module Signature électronique (DocuSeal)

export type SignatureRequestStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'completed'
  | 'refused'
  | 'expired'
  | 'cancelled';

export type SignatureEventType =
  | 'created'
  | 'sent'
  | 'opened'
  | 'viewed'
  | 'signed'
  | 'completed'
  | 'refused'
  | 'expired'
  | 'reminded'
  | 'cancelled'
  | 'error';

export interface SignatureSigner {
  name: string;
  email: string;
  role?: string | null;
  status?: SignatureRequestStatus;
  signed_at?: string | null;
  ip?: string | null;
  external_id?: string | null;
}

export interface SignatureRequest {
  id: string;
  contrat_id: string;
  provider: 'docuseal';
  provider_request_id: string | null;
  provider_url: string | null;
  status: SignatureRequestStatus;
  signers: SignatureSigner[];
  message: string | null;
  expire_at: string | null;
  reminders_sent: number;
  last_reminder_at: string | null;
  document_hash: string | null;
  document_path: string | null;
  signed_document_path: string | null;
  audit_log_url: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
}

export interface SignatureEvent {
  id: string;
  request_id: string;
  event_type: SignatureEventType;
  signer_email: string | null;
  signer_name: string | null;
  payload: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const SIGNATURE_STATUS_LABELS: Record<SignatureRequestStatus, string> = {
  pending: 'En préparation',
  sent: 'Envoyé',
  viewed: 'Consulté',
  signed: 'Signé partiellement',
  completed: 'Complété',
  refused: 'Refusé',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

export const SIGNATURE_STATUS_COLORS: Record<SignatureRequestStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-amber-100 text-amber-700',
  signed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  refused: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

export const SIGNATURE_EVENT_LABELS: Record<SignatureEventType, string> = {
  created: 'Demande créée',
  sent: 'Envoyé au(x) signataire(s)',
  opened: 'Email ouvert',
  viewed: 'Document consulté',
  signed: 'Signé par un signataire',
  completed: 'Tous les signataires ont signé',
  refused: 'Signature refusée',
  expired: 'Demande expirée',
  reminded: 'Relance envoyée',
  cancelled: 'Demande annulée',
  error: 'Erreur',
};
