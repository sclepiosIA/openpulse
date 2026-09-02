/**
 * Types pour les tâches dans la vue analytics
 * 
 * Ces types permettent un typage strict des tâches
 * dans les vues d'analyse et statistiques.
 */

/** Structure minimale d'une tâche pour les analytics */
export interface TaskForAnalytics {
  id: string;
  titre: string;
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
    couleur?: string | null;
  } | null;
  etablissements?: {
    id?: string;
    nom?: string;
  } | null;
  responsable_profile?: {
    id?: string;
    prenom?: string | null;
    nom?: string | null;
  } | null;
}

/** Interface pour les profils dans les vues de table */
export interface ProfileForTable {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role?: string;
  actif?: boolean;
  fonction?: string | null;
  avatar_url?: string | null;
}
