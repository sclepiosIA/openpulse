// Types pour le Module 8 : RGPD & Conformité

export type RgpdBaseLegale = 
  | 'consentement'
  | 'contrat'
  | 'obligation_legale'
  | 'interet_vital'
  | 'mission_publique'
  | 'interet_legitime';

export type RgpdDemandeStatut = 
  | 'nouvelle'
  | 'en_cours'
  | 'completee'
  | 'refusee'
  | 'annulee';

export type RgpdDroitType = 
  | 'acces'
  | 'rectification'
  | 'effacement'
  | 'limitation'
  | 'portabilite'
  | 'opposition';

export type RgpdViolationSeverite = 
  | 'faible'
  | 'moyenne'
  | 'elevee'
  | 'critique';

// Registre des traitements (Article 30)
export interface RgpdTraitement {
  id: string;
  nom: string;
  description: string | null;
  finalites: string[];
  base_legale: RgpdBaseLegale;
  categories_personnes: string[];
  categories_donnees: string[];
  donnees_sensibles: boolean;
  destinataires: string[];
  transferts_hors_ue: boolean;
  pays_transfert: string[] | null;
  garanties_transfert: string | null;
  duree_conservation: string | null;
  mesures_securite: string[] | null;
  responsable_id: string | null;
  sous_traitants: string[] | null;
  dpia_requis: boolean;
  dpia_realise: boolean;
  dpia_date: string | null;
  dpia_document_url: string | null;
  est_actif: boolean;
  date_creation: string;
  date_derniere_revision: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  responsable?: { id: string; nom: string; prenom: string } | null;
}

// Consentements
export interface RgpdConsentement {
  id: string;
  personne_email: string;
  personne_nom: string | null;
  finalite: string;
  traitement_id: string | null;
  est_accorde: boolean;
  date_consentement: string | null;
  date_retrait: string | null;
  mode_collecte: string;
  preuve_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  version_conditions: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  traitement?: RgpdTraitement | null;
}

// Demandes de droits
export interface RgpdDemandeDroit {
  id: string;
  numero: string;
  type_droit: RgpdDroitType;
  demandeur_email: string;
  demandeur_nom: string | null;
  demandeur_telephone: string | null;
  description: string | null;
  statut: RgpdDemandeStatut;
  date_demande: string;
  date_limite: string;
  date_traitement: string | null;
  traite_par: string | null;
  reponse: string | null;
  documents_fournis: string[] | null;
  motif_refus: string | null;
  verification_identite: boolean;
  notes_internes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  traite_par_profile?: { id: string; nom: string; prenom: string } | null;
}

// DPA (Data Processing Agreements)
export interface RgpdDpa {
  id: string;
  nom_sous_traitant: string;
  type_service: string;
  description: string | null;
  pays: string;
  est_hors_ue: boolean;
  garanties_adequation: string | null;
  categories_donnees: string[];
  date_signature: string | null;
  date_expiration: string | null;
  document_url: string | null;
  contact_email: string | null;
  contact_nom: string | null;
  contact_telephone: string | null;
  certifications: string[] | null;
  est_hds: boolean;
  date_certification_hds: string | null;
  audit_realise: boolean;
  date_dernier_audit: string | null;
  notes: string | null;
  est_actif: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Violations de données
export interface RgpdViolation {
  id: string;
  numero: string;
  titre: string;
  description: string;
  date_detection: string;
  date_incident: string | null;
  severite: RgpdViolationSeverite;
  categories_donnees: string[];
  nombre_personnes_affectees: number | null;
  origine: string | null;
  consequences_potentielles: string | null;
  mesures_prises: string | null;
  notification_cnil_requise: boolean;
  date_notification_cnil: string | null;
  reference_cnil: string | null;
  notification_personnes_requise: boolean;
  date_notification_personnes: string | null;
  responsable_id: string | null;
  statut: string;
  date_cloture: string | null;
  retour_experience: string | null;
  actions_preventives: string | null;
  documents: string[] | null;
  created_at: string;
  updated_at: string;
  // Relations
  responsable?: { id: string; nom: string; prenom: string } | null;
}

// Certifications
export interface RgpdCertification {
  id: string;
  nom: string;
  type: string;
  organisme_certificateur: string | null;
  numero_certificat: string | null;
  date_obtention: string;
  date_expiration: string | null;
  perimetre: string | null;
  document_url: string | null;
  est_valide: boolean;
  notes: string | null;
  alerte_expiration_jours: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Audit logs
export interface RgpdAuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// KPIs
export interface RgpdKPIs {
  total_traitements: number;
  traitements_actifs: number;
  traitements_sensibles: number;
  dpia_en_attente: number;
  demandes_en_cours: number;
  demandes_en_retard: number;
  violations_ouvertes: number;
  dpa_actifs: number;
  dpa_expirant_bientot: number;
  certifications_valides: number;
  certifications_expirant_bientot: number;
  consentements_actifs: number;
}

// Labels pour l'UI
export const BASE_LEGALE_LABELS: Record<RgpdBaseLegale, string> = {
  consentement: 'Consentement',
  contrat: 'Exécution d\'un contrat',
  obligation_legale: 'Obligation légale',
  interet_vital: 'Intérêt vital',
  mission_publique: 'Mission d\'intérêt public',
  interet_legitime: 'Intérêt légitime',
};

export const DEMANDE_STATUT_LABELS: Record<RgpdDemandeStatut, string> = {
  nouvelle: 'Nouvelle',
  en_cours: 'En cours',
  completee: 'Complétée',
  refusee: 'Refusée',
  annulee: 'Annulée',
};

export const DEMANDE_STATUT_COLORS: Record<RgpdDemandeStatut, string> = {
  nouvelle: 'bg-blue-100 text-blue-800',
  en_cours: 'bg-yellow-100 text-yellow-800',
  completee: 'bg-green-100 text-green-800',
  refusee: 'bg-red-100 text-red-800',
  annulee: 'bg-gray-100 text-gray-800',
};

export const DROIT_TYPE_LABELS: Record<RgpdDroitType, string> = {
  acces: 'Droit d\'accès',
  rectification: 'Droit de rectification',
  effacement: 'Droit à l\'effacement',
  limitation: 'Droit à la limitation',
  portabilite: 'Droit à la portabilité',
  opposition: 'Droit d\'opposition',
};

export const VIOLATION_SEVERITE_LABELS: Record<RgpdViolationSeverite, string> = {
  faible: 'Faible',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
  critique: 'Critique',
};

export const VIOLATION_SEVERITE_COLORS: Record<RgpdViolationSeverite, string> = {
  faible: 'bg-gray-100 text-gray-800',
  moyenne: 'bg-yellow-100 text-yellow-800',
  elevee: 'bg-orange-100 text-orange-800',
  critique: 'bg-red-100 text-red-800',
};
