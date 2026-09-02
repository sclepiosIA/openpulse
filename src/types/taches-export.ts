/**
 * Types pour l'export de tâches (CSV, PDF, etc.)
 * 
 * Ces types permettent un typage strict des données
 * lors de l'export vers différents formats.
 */

import type { ProfileRelation, EtablissementRelation } from './database-relations';

/** Structure minimale d'une tâche pour l'export */
export interface TaskForExport {
  id: string;
  titre: string;
  description?: string | null;
  statut: string;
  priorite?: string | null;
  date_debut?: string | null;
  echeance?: string | null;
  etablissements?: EtablissementRelation | null;
  categories_taches?: {
    id?: string;
    nom: string;
  } | null;
  responsable_profile?: ProfileRelation | null;
}

/** Structure pour les tâches Gantt filtrables */
export interface GanttTaskForFilter {
  id: string;
  titre: string;
  description?: string | null;
  statut: string;
  priorite?: string | null;
  echeance?: string | null;
  date_debut?: string | null;
  etablissement_id?: string | null;
  responsable_id?: string | null;
  categorie_id?: string | null;
  categories_taches?: {
    id?: string;
    nom?: string;
  } | null;
  // Champs additionnels pour le tri et le rendu
  ordre?: number | null;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  archive?: boolean;
  progression?: number;
  duree_estimee_jours?: number;
  projet_id?: string;
  date_fin_reelle?: string;
  comments_count?: number;
  etablissements?: {
    nom: string;
    ville?: string;
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

/** Contexte de monitoring typé */
export interface MonitoringContext {
  component?: string;
  action?: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  errorCode?: string;
  duration?: number;
  [key: string]: string | number | boolean | undefined;
}

/** Données de breadcrumb typées */
export interface BreadcrumbData {
  route?: string;
  action?: string;
  entityId?: string;
  [key: string]: string | number | boolean | undefined;
}
