// Types pour le module de recrutement

export type JobOfferStatus = 'draft' | 'published' | 'paused' | 'closed' | 'filled';
export type JobContractType = 'cdi' | 'cdd' | 'stage' | 'alternance' | 'freelance' | 'interim';
export type CandidateStatus = 
  | 'new'
  | 'screening'
  | 'phone_interview'
  | 'technical_interview'
  | 'final_interview'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_declined'
  | 'rejected'
  | 'withdrawn';

export interface JobOffer {
  id: string;
  titre: string;
  description: string | null;
  description_html: string | null;
  type_contrat: JobContractType;
  statut: JobOfferStatus;
  localisation: string | null;
  departement: string | null;
  salaire_min: number | null;
  salaire_max: number | null;
  experience_minimum: number | null;
  niveau_etudes: string | null;
  competences_requises: string[] | null;
  avantages: string[] | null;
  date_publication: string | null;
  date_cloture: string | null;
  nombre_postes: number | null;
  postes_pourvus: number | null;
  diffusion_externe: boolean | null;
  url_externe: string | null;
  priorite: string | null;
  responsable_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any> | null;
  // Relations
  responsable?: {
    id: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  } | null;
  candidates_count?: number;
}

export interface Candidate {
  id: string;
  job_offer_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  statut: CandidateStatus;
  source: string | null;
  source_detail: string | null;
  annees_experience: number | null;
  salaire_souhaite: number | null;
  disponibilite: string | null;
  date_disponibilite: string | null;
  competences: string[] | null;
  langues: Record<string, string> | null;
  notes: string | null;
  note_globale: number | null;
  tags: string[] | null;
  resume_parsed: Record<string, any> | null;
  assignee_id: string | null;
  cooptation_par: string | null;
  profile_id: string | null;
  date_candidature: string;
  date_derniere_action: string | null;
  date_embauche: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Relations
  job_offer?: JobOffer;
  assignee?: {
    id: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CandidateInterview {
  id: string;
  candidate_id: string;
  titre: string;
  type: string;
  date_heure: string;
  duree_minutes: number | null;
  lieu: string | null;
  visio_url: string | null;
  description: string | null;
  interviewers: string[] | null;
  statut: string;
  feedback: string | null;
  note: number | null;
  points_forts: string[] | null;
  points_amelioration: string[] | null;
  recommandation: string | null;
  rappel_envoye: boolean | null;
  calendar_event_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateEvaluation {
  id: string;
  candidate_id: string;
  evaluator_id: string;
  interview_id: string | null;
  criteres: Record<string, number>;
  note_globale: number | null;
  points_forts: string[] | null;
  points_amelioration: string[] | null;
  commentaire_general: string | null;
  recommandation: string | null;
  is_decision_maker: boolean | null;
  created_at: string;
  updated_at: string;
  // Relations
  evaluator?: {
    id: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CandidateHistory {
  id: string;
  candidate_id: string;
  action_type: string;
  description: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  performed_by: string | null;
  created_at: string;
}

// Colonnes du pipeline Kanban
export const CANDIDATE_PIPELINE_COLUMNS: { status: CandidateStatus; label: string; color: string }[] = [
  { status: 'new', label: 'Nouveau', color: 'bg-gray-100 dark:bg-gray-800' },
  { status: 'screening', label: 'Présélection', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { status: 'phone_interview', label: 'Entretien Tél.', color: 'bg-indigo-50 dark:bg-indigo-900/20' },
  { status: 'technical_interview', label: 'Entretien Tech.', color: 'bg-purple-50 dark:bg-purple-900/20' },
  { status: 'final_interview', label: 'Entretien Final', color: 'bg-pink-50 dark:bg-pink-900/20' },
  { status: 'offer_sent', label: 'Offre Envoyée', color: 'bg-amber-50 dark:bg-amber-900/20' },
  { status: 'offer_accepted', label: 'Acceptée', color: 'bg-green-50 dark:bg-green-900/20' },
];

export const CONTRACT_TYPE_LABELS: Record<JobContractType, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  stage: 'Stage',
  alternance: 'Alternance',
  freelance: 'Freelance',
  interim: 'Intérim',
};

export const JOB_STATUS_LABELS: Record<JobOfferStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  paused: 'En pause',
  closed: 'Clôturée',
  filled: 'Pourvue',
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  new: 'Nouveau',
  screening: 'Présélection',
  phone_interview: 'Entretien Téléphonique',
  technical_interview: 'Entretien Technique',
  final_interview: 'Entretien Final',
  offer_sent: 'Offre Envoyée',
  offer_accepted: 'Offre Acceptée',
  offer_declined: 'Offre Déclinée',
  rejected: 'Rejeté',
  withdrawn: 'Retiré',
};

export const CANDIDATE_SOURCES = [
  'Site carrières',
  'LinkedIn',
  'Indeed',
  'APEC',
  'Cooptation',
  'Cabinet de recrutement',
  'Candidature spontanée',
  'Autre',
];
