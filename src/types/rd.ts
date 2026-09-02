// Types for R&D / Agile Development Module

export type RDProjetStatut = 'actif' | 'en_pause' | 'termine' | 'archive';
export type RDPriorite = 'low' | 'medium' | 'high' | 'critical';
export type RDEpicStatut = 'todo' | 'in_progress' | 'done';
export type RDSprintStatut = 'planifie' | 'actif' | 'termine' | 'annule';
export type RDUserStoryStatut = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type RDTaskStatut = 'todo' | 'in_progress' | 'done';
export type StoryPoints = 1 | 2 | 3 | 5 | 8 | 13 | 21;
export type RDProjetDPI = 'hm' | 'resurgences' | 'transverse';

export interface RDProjet {
  id: string;
  nom: string;
  description: string | null;
  statut: RDProjetStatut;
  date_debut: string | null;
  date_fin_prevue: string | null;
  responsable_id: string | null;
  couleur: string;
  dpi: RDProjetDPI | null;
  visible_portail: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  responsable?: {
    id: string;
    prenom: string;
    nom: string;
    avatar_url?: string | null;
  };
  _count?: {
    epics: number;
    sprints: number;
    stories: number;
  };
}

export interface RDEpic {
  id: string;
  projet_id: string;
  titre: string;
  description: string | null;
  priorite: RDPriorite;
  couleur: string;
  ordre: number;
  statut: RDEpicStatut;
  created_at: string;
  updated_at: string;
  // Relations
  user_stories?: RDUserStory[];
  _count?: {
    stories: number;
    done_stories: number;
  };
}

export interface RDSprint {
  id: string;
  projet_id: string;
  nom: string;
  numero: number;
  date_debut: string;
  date_fin: string;
  objectif: string | null;
  statut: RDSprintStatut;
  velocity_prevue: number | null;
  velocity_reelle: number | null;
  created_at: string;
  updated_at: string;
  // Relations
  user_stories?: RDUserStory[];
  _computed?: {
    total_points: number;
    done_points: number;
    progress: number;
    days_remaining: number;
  };
}

export interface RDUserStory {
  id: string;
  projet_id: string;
  epic_id: string | null;
  sprint_id: string | null;
  titre: string;
  description: string | null;
  criteres_acceptation: string[] | null;
  statut: RDUserStoryStatut;
  points: StoryPoints | null;
  priorite: RDPriorite;
  responsable_id: string | null;
  ordre: number;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  epic?: RDEpic;
  sprint?: RDSprint;
  responsable?: {
    id: string;
    prenom: string;
    nom: string;
    avatar_url?: string | null;
  };
  tasks?: RDTask[];
  _count?: {
    tasks: number;
    done_tasks: number;
  };
  // Lien optionnel vers un établissement client (déploiement/production)
  etablissement_id?: string | null;
  etablissement?: {
    id: string;
    nom: string;
    statut: string;
  } | null;
}

export interface RDTask {
  id: string;
  user_story_id: string;
  titre: string;
  description: string | null;
  statut: RDTaskStatut;
  estimation_heures: number | null;
  temps_passe: number;
  responsable_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  responsable?: {
    id: string;
    prenom: string;
    nom: string;
    avatar_url?: string | null;
  };
}

// Form types
export interface RDProjetFormData {
  nom: string;
  description?: string;
  statut?: RDProjetStatut;
  date_debut?: string;
  date_fin_prevue?: string;
  responsable_id?: string;
  couleur?: string;
  dpi?: RDProjetDPI | null;
  visible_portail?: boolean;
}

export const DPI_CONFIG: Record<RDProjetDPI, { label: string; color: string }> = {
  hm: { label: 'HM', color: 'hsl(var(--primary))' },
  resurgences: { label: 'Résurgences', color: 'hsl(var(--secondary))' },
  transverse: { label: 'Transverse', color: 'hsl(var(--accent))' },
};

export interface RDEpicFormData {
  projet_id: string;
  titre: string;
  description?: string;
  priorite?: RDPriorite;
  couleur?: string;
}

export interface RDSprintFormData {
  projet_id: string;
  nom: string;
  numero: number;
  date_debut: string;
  date_fin: string;
  objectif?: string;
  velocity_prevue?: number;
}

export interface RDUserStoryFormData {
  projet_id: string;
  epic_id?: string;
  sprint_id?: string;
  titre: string;
  description?: string;
  criteres_acceptation?: string[];
  points?: StoryPoints;
  priorite?: RDPriorite;
  statut?: RDUserStoryStatut;
  responsable_id?: string;
  etablissement_id?: string | null;
  date_debut?: string;
  date_fin?: string;
}

export interface RDTaskFormData {
  user_story_id: string;
  titre: string;
  description?: string;
  estimation_heures?: number;
  responsable_id?: string;
}

// Analytics types
export interface BurndownDataPoint {
  date: string;
  ideal: number;
  actual: number;
}

export interface VelocityDataPoint {
  sprint: string;
  planned: number;
  completed: number;
}

export interface CumulativeFlowDataPoint {
  date: string;
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

// Kanban column config
export const KANBAN_COLUMNS: { id: RDUserStoryStatut; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'hsl(var(--muted))' },
  { id: 'todo', label: 'À faire', color: 'hsl(var(--primary))' },
  { id: 'in_progress', label: 'En cours', color: 'hsl(var(--warning))' },
  { id: 'review', label: 'Review', color: 'hsl(var(--secondary))' },
  { id: 'done', label: 'Terminé', color: 'hsl(var(--success))' },
];

export const STORY_POINTS: StoryPoints[] = [1, 2, 3, 5, 8, 13, 21];

export const PRIORITE_CONFIG: Record<RDPriorite, { label: string; color: string }> = {
  low: { label: 'Basse', color: 'hsl(var(--muted-foreground))' },
  medium: { label: 'Moyenne', color: 'hsl(var(--primary))' },
  high: { label: 'Haute', color: 'hsl(var(--warning))' },
  critical: { label: 'Critique', color: 'hsl(var(--destructive))' },
};
