// Types pour le module Compétences & Certifications

export type CompetenceCategorie = 
  | 'technique'
  | 'metier'
  | 'soft_skill'
  | 'langue'
  | 'outil'
  | 'certification';

export type CompetenceNiveau = 
  | 'debutant'
  | 'intermediaire'
  | 'avance'
  | 'expert';

export const CATEGORIE_LABELS: Record<CompetenceCategorie, string> = {
  technique: 'Technique',
  metier: 'Métier Santé',
  soft_skill: 'Soft Skills',
  langue: 'Langues',
  outil: 'Outils',
  certification: 'Certifications',
};

export const CATEGORIE_COLORS: Record<CompetenceCategorie, string> = {
  technique: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  metier: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  soft_skill: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  langue: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  outil: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  certification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export const NIVEAU_LABELS: Record<CompetenceNiveau, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export const NIVEAU_VALUES: Record<CompetenceNiveau, number> = {
  debutant: 1,
  intermediaire: 2,
  avance: 3,
  expert: 4,
};

export const NIVEAU_COLORS: Record<CompetenceNiveau, string> = {
  debutant: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  intermediaire: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  avance: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  expert: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

// Référentiel des compétences
export interface ReferentielCompetence {
  id: string;
  nom: string;
  description: string | null;
  categorie: CompetenceCategorie;
  parent_id: string | null;
  icone: string | null;
  ordre: number;
  est_actif: boolean;
  created_at: string;
  updated_at: string;
}

// Compétence d'un employé
export interface EmployeeCompetence {
  id: string;
  profile_id: string;
  competence_id: string;
  niveau_auto: CompetenceNiveau | null;
  niveau_manager: CompetenceNiveau | null;
  niveau_valide: CompetenceNiveau | null;
  date_auto_evaluation: string | null;
  date_evaluation_manager: string | null;
  date_validation: string | null;
  validateur_id: string | null;
  commentaire_employe: string | null;
  commentaire_manager: string | null;
  objectif_niveau: CompetenceNiveau | null;
  date_objectif: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  competence?: ReferentielCompetence;
  profile?: {
    id: string;
    nom: string;
    prenom: string;
  };
  validateur?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

// Référentiel des certifications
export interface ReferentielCertification {
  id: string;
  nom: string;
  description: string | null;
  organisme: string | null;
  url_officielle: string | null;
  duree_validite_mois: number | null;
  competences_associees: string[];
  cout_moyen: number | null;
  niveau_difficulte: number | null;
  est_actif: boolean;
  created_at: string;
  updated_at: string;
}

// Certification d'un employé
export interface EmployeeCertification {
  id: string;
  profile_id: string;
  certification_id: string;
  date_obtention: string;
  date_expiration: string | null;
  numero_certification: string | null;
  fichier_url: string | null;
  storage_path: string | null;
  statut: 'valide' | 'expiree' | 'en_cours' | 'a_renouveler';
  rappel_envoye: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  certification?: ReferentielCertification;
  profile?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

export const CERTIFICATION_STATUT_LABELS: Record<EmployeeCertification['statut'], string> = {
  valide: 'Valide',
  expiree: 'Expirée',
  en_cours: 'En cours',
  a_renouveler: 'À renouveler',
};

export const CERTIFICATION_STATUT_COLORS: Record<EmployeeCertification['statut'], string> = {
  valide: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  expiree: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  a_renouveler: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

// Plan de développement individuel
export interface PlanDeveloppement {
  id: string;
  profile_id: string;
  titre: string;
  description: string | null;
  date_debut: string;
  date_fin: string | null;
  statut: 'brouillon' | 'en_cours' | 'termine' | 'abandonne';
  manager_id: string | null;
  objectifs: any[];
  progression: number;
  created_at: string;
  updated_at: string;
  // Relations
  profile?: {
    id: string;
    nom: string;
    prenom: string;
  };
  manager?: {
    id: string;
    nom: string;
    prenom: string;
  };
  actions?: PlanAction[];
}

// Action du plan de développement
export interface PlanAction {
  id: string;
  plan_id: string;
  competence_id: string | null;
  certification_id: string | null;
  titre: string;
  description: string | null;
  type_action: 'formation' | 'certification' | 'projet' | 'mentorat' | 'autoformation' | 'autre';
  date_prevue: string | null;
  date_realisation: string | null;
  statut: 'a_faire' | 'en_cours' | 'termine' | 'annule';
  priorite: number;
  ressources: string | null;
  cout_estime: number | null;
  created_at: string;
  updated_at: string;
  // Relations
  competence?: ReferentielCompetence;
  certification?: ReferentielCertification;
}

export const ACTION_TYPE_LABELS: Record<PlanAction['type_action'], string> = {
  formation: 'Formation',
  certification: 'Certification',
  projet: 'Projet pratique',
  mentorat: 'Mentorat',
  autoformation: 'Autoformation',
  autre: 'Autre',
};

export const PLAN_STATUT_LABELS: Record<PlanDeveloppement['statut'], string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Terminé',
  abandonne: 'Abandonné',
};

export const PLAN_STATUT_COLORS: Record<PlanDeveloppement['statut'], string> = {
  brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  termine: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  abandonne: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const ACTION_STATUT_LABELS: Record<PlanAction['statut'], string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

// KPIs du module
export interface CompetencesKPIs {
  totalCompetences: number;
  totalEmployeesWithCompetences: number;
  averageCompetencesPerEmployee: number;
  certificationExpiringIn30Days: number;
  certificationExpiringIn90Days: number;
  plansEnCours: number;
  progressionMoyenne: number;
}

// Matrice de compétences pour affichage
export interface CompetenceMatrixCell {
  profileId: string;
  profileNom: string;
  profilePrenom: string;
  competenceId: string;
  competenceNom: string;
  categorie: CompetenceCategorie;
  niveauAuto: CompetenceNiveau | null;
  niveauManager: CompetenceNiveau | null;
  niveauValide: CompetenceNiveau | null;
  objectif: CompetenceNiveau | null;
}
