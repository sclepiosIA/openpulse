/**
 * Types pour les tâches affichées dans le calendrier
 * 
 * Ces types permettent un typage strict des tâches
 * dans les vues CalendarMonthView, CalendarAgendaView, etc.
 */

/** Structure minimale d'une tâche pour l'affichage calendrier */
export interface CalendarTask {
  id: string;
  titre: string;
  echeance: string | null;
  statut: string;
  priorite?: string | null;
  categories_taches?: {
    id?: string;
    nom: string;
    couleur?: string | null;
  } | null;
  etablissements?: {
    id: string;
    nom: string;
  } | null;
  responsable_profile?: {
    id?: string;
    prenom: string | null;
    nom: string | null;
  } | null;
  // Alias pour compatibilité
  etablissement?: {
    id: string;
    nom: string;
  } | null;
  responsable?: {
    prenom: string | null;
    nom: string | null;
  } | null;
}

/** Tâche enrichie pour le calendrier avec dates calculées */
export interface CalendarTaskEnriched extends CalendarTask {
  date_debut?: string | null;
  duree_estimee_jours?: number | null;
  progression?: number | null;
}

/** Props standard pour les composants de vue calendrier */
export interface CalendarViewProps {
  tasks: CalendarTask[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onTaskClick: (task: CalendarTask) => void;
}
