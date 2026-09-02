import { Database } from '@/integrations/supabase/types';

export type TaskRow = Database['public']['Tables']['taches']['Row'];
export type TaskInsert = Database['public']['Tables']['taches']['Insert'];
export type TaskUpdate = Database['public']['Tables']['taches']['Update'];

export type TaskStatus = 'A faire' | 'En cours' | 'Bloqué' | 'Terminé' | 'Annulé';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  titre: string;
  description?: string;
  statut: TaskStatus;
  priorite?: TaskPriority;
  date_debut?: string;
  date_echeance?: string;
  echeance?: string; // Alias pour compatibilité
  date_fin_reelle?: string;
  duree_estimee_jours?: number;
  progression?: number;
  etablissement_id?: string;
  responsable_id?: string;
  categorie_id?: string;
  projet_id?: string;
  ordre?: number;
  tags?: string[];
  archive?: boolean;
  created_at: string;
  updated_at: string;
  comments_count?: number;
  etablissements?: {
    nom: string;
    ville?: string;
  };
  categories_taches?: {
    id?: string;
    nom: string;
    couleur: string;
  };
  responsable_profile?: {
    nom: string;
    prenom?: string;
    email?: string;
  };
  profiles?: {
    nom: string;
    prenom?: string;
    email?: string;
  };
}

export interface TaskWithRelations extends Task {
  etablissement?: {
    nom: string;
    slug: string;
  };
  responsable?: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  };
  categorie?: {
    nom: string;
    couleur: string;
  };
}

export interface GanttTask extends TaskWithRelations {
  start: Date;
  end: Date;
  x: number;
  width: number;
  progress: number;
}

export interface GanttGrouping {
  type: 'establishment' | 'category' | 'responsible' | 'status';
  label: string;
}

export interface GanttStats {
  total: number;
  completionRate: number;
  overdue: number;
  inProgress: number;
  daysToNextDeadline?: number;
  peopleCount: number;
}

export interface GanttFilters {
  etablissements?: string[];
  responsables?: string[];
  categories?: string[];
  statuts?: TaskStatus[];
  priorites?: TaskPriority[];
  searchQuery?: string;
  dateDebut?: string;
  dateEcheance?: string;
}

export interface GanttViewOptions {
  zoom: 'day' | 'week' | 'month' | 'quarter';
  groupBy?: GanttGrouping['type'];
  showMilestones: boolean;
  showHeatmap: boolean;
  showWeekends: boolean;
  collapsedGroups: Set<string>;
}
