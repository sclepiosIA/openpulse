// Types pour le module Gestion des Contrats

export type ContratStatut = 
  | 'brouillon'
  | 'en_attente_signature'
  | 'signe'
  | 'actif'
  | 'en_renouvellement'
  | 'resilie'
  | 'expire'
  | 'archive';

export type ContratType = 
  | 'licence'
  | 'maintenance'
  | 'formation'
  | 'consulting'
  | 'hebergement'
  | 'support'
  | 'partenariat'
  | 'autre';

export interface ContratTemplate {
  id: string;
  nom: string;
  description: string | null;
  type: ContratType;
  contenu_html: string;
  variables: string[];
  clauses_ids: string[];
  est_actif: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContratClause {
  id: string;
  titre: string;
  categorie: string;
  contenu_html: string;
  variables: string[];
  est_obligatoire: boolean;
  ordre: number;
  est_actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contrat {
  id: string;
  numero: string | null;
  titre: string;
  
  // Liaisons
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  contact_id: string | null;
  template_id: string | null;
  devis_id: string | null;
  
  // Infos client
  client_nom: string;
  client_adresse: string | null;
  client_siret: string | null;
  client_representant: string | null;
  
  // Type et statut
  type: ContratType;
  statut: ContratStatut;
  
  // Dates
  date_emission: string;
  date_debut: string | null;
  date_fin: string | null;
  date_signature: string | null;
  date_resiliation: string | null;
  
  // Renouvellement
  reconduction_tacite: boolean;
  preavis_jours: number;
  duree_initiale_mois: number;
  duree_renouvellement_mois: number;
  alerte_renouvellement_envoyee: boolean;
  
  // Montants
  montant_annuel_ht: number;
  montant_mensuel_ht: number;
  remise_pourcent: number | null;
  conditions_paiement: string | null;
  
  // Contenu
  contenu_html: string | null;
  clauses_selectionnees: string[];
  conditions_particulieres: string | null;
  
  // Signature électronique
  signature_provider: string | null;
  signature_external_id: string | null;
  signature_url: string | null;
  signature_status: string | null;
  signe_par: string | null;
  
  // Métadonnées
  notes_internes: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  
  // Audit
  created_by: string | null;
  commercial_id: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  etablissement?: { id: string; nom: string; ville: string | null } | null;
  contact?: { id: string; nom: string; prenom: string | null } | null;
  commercial?: { id: string; prenom: string | null; nom: string | null } | null;
  template?: ContratTemplate | null;
  avenants?: ContratAvenant[];
}

export interface ContratAvenant {
  id: string;
  contrat_id: string;
  numero: number;
  titre: string;
  description: string | null;
  modifications: Record<string, unknown>;
  contenu_html: string | null;
  date_effet: string;
  date_signature: string | null;
  signature_url: string | null;
  signe_par: string | null;
  statut: ContratStatut;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContratAlerte {
  id: string;
  contrat_id: string;
  type: 'renouvellement' | 'echeance' | 'preavis' | 'custom';
  titre: string;
  description: string | null;
  date_alerte: string;
  date_echeance: string | null;
  est_traitee: boolean;
  traitee_par: string | null;
  traitee_le: string | null;
  notification_envoyee: boolean;
  notification_envoyee_le: string | null;
  created_at: string;
  
  // Relations
  contrat?: Contrat;
}

export interface ContratDocument {
  id: string;
  contrat_id: string;
  avenant_id: string | null;
  nom: string;
  type: 'contrat_signe' | 'avenant' | 'annexe' | 'autre';
  storage_path: string;
  storage_bucket: string;
  mime_type: string | null;
  taille_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

// Labels et couleurs
export const CONTRAT_STATUT_LABELS: Record<ContratStatut, string> = {
  brouillon: 'Brouillon',
  en_attente_signature: 'En attente de signature',
  signe: 'Signé',
  actif: 'Actif',
  en_renouvellement: 'En renouvellement',
  resilie: 'Résilié',
  expire: 'Expiré',
  archive: 'Archivé'
};

export const CONTRAT_STATUT_COLORS: Record<ContratStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  en_attente_signature: 'bg-amber-100 text-amber-700',
  signe: 'bg-blue-100 text-blue-700',
  actif: 'bg-green-100 text-green-700',
  en_renouvellement: 'bg-orange-100 text-orange-700',
  resilie: 'bg-red-100 text-red-700',
  expire: 'bg-gray-200 text-gray-600',
  archive: 'bg-slate-100 text-slate-600'
};

export const CONTRAT_TYPE_LABELS: Record<ContratType, string> = {
  licence: 'Licence',
  maintenance: 'Maintenance',
  formation: 'Formation',
  consulting: 'Consulting',
  hebergement: 'Hébergement',
  support: 'Support',
  partenariat: 'Partenariat',
  autre: 'Autre'
};

export const CONTRAT_TYPE_COLORS: Record<ContratType, string> = {
  licence: 'bg-purple-100 text-purple-700',
  maintenance: 'bg-blue-100 text-blue-700',
  formation: 'bg-emerald-100 text-emerald-700',
  consulting: 'bg-cyan-100 text-cyan-700',
  hebergement: 'bg-indigo-100 text-indigo-700',
  support: 'bg-teal-100 text-teal-700',
  partenariat: 'bg-pink-100 text-pink-700',
  autre: 'bg-gray-100 text-gray-700'
};

export const CLAUSE_CATEGORIES = [
  'Général',
  'Financier',
  'Juridique',
  'RGPD',
  'Technique',
  'Commercial'
] as const;
